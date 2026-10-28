<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MonitoringSession;
use App\Models\ScreenMonitorFrame;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class ScreenMonitorController extends Controller
{
    private const ONLINE_SECONDS = 90;

    private const STALE_SECONDS = 30;

    private const MAX_IMAGE_BYTES = 2_000_000;

    /**
     * Student desktop app uploads a JPEG/PNG screen frame (base64 JSON or multipart "frame").
     */
    public function uploadFrame(Request $request)
    {
        $user = Auth::user();

        if (($user->role ?? '') !== 'student') {
            return response()->json(['error' => 'Only students can upload screen frames'], 403);
        }

        $validated = $request->validate([
            'image_base64' => 'nullable|string',
            'frame' => 'nullable|file|mimes:jpeg,jpg,png|max:2048',
            'width' => 'nullable|integer|min:1|max:10000',
            'height' => 'nullable|integer|min:1|max:10000',
            'computer_name' => 'nullable|string|max:255',
            'laboratory_room' => 'nullable|string|max:255',
        ]);

        $binary = null;

        if ($request->hasFile('frame')) {
            $binary = file_get_contents($request->file('frame')->getRealPath());
        } elseif (! empty($validated['image_base64'])) {
            $raw = (string) $validated['image_base64'];
            if (str_contains($raw, ',')) {
                $raw = substr($raw, strrpos($raw, ',') + 1);
            }
            $binary = base64_decode($raw, true);
        }

        if ($binary === false || $binary === null || $binary === '') {
            return response()->json(['error' => 'No valid image data provided'], 422);
        }

        if (strlen($binary) > self::MAX_IMAGE_BYTES) {
            return response()->json(['error' => 'Image too large'], 422);
        }

        $mime = $this->detectImageMime($binary);
        if ($mime === null) {
            return response()->json(['error' => 'Unsupported image format'], 422);
        }

        $ext = $mime === 'image/png' ? 'png' : 'jpg';
        $relativePath = 'screen_monitor_frames/'.$user->id.'.'.$ext;

        $activeSession = MonitoringSession::where('student_user_id', $user->id)
            ->where('is_active', true)
            ->latest('session_start')
            ->first();

        if ($activeSession) {
            $activeSession->touch();
        }

        $existing = ScreenMonitorFrame::where('student_user_id', $user->id)->first();
        if ($existing && $existing->storage_path && $existing->storage_path !== $relativePath) {
            Storage::disk('local')->delete($existing->storage_path);
        }

        Storage::disk('local')->put($relativePath, $binary);

        $computerName = $validated['computer_name']
            ?? ($activeSession?->computer_name)
            ?? null;
        $laboratoryRoom = $validated['laboratory_room']
            ?? ($activeSession?->laboratory_room)
            ?? null;

        ScreenMonitorFrame::updateOrCreate(
            ['student_user_id' => $user->id],
            [
                'monitoring_session_id' => $activeSession?->id,
                'storage_path' => $relativePath,
                'computer_name' => $computerName,
                'laboratory_room' => $laboratoryRoom,
                'width' => $validated['width'] ?? null,
                'height' => $validated['height'] ?? null,
                'captured_at' => now(),
            ]
        );

        return response()->json([
            'success' => true,
            'captured_at' => now()->toIso8601String(),
        ]);
    }

    /**
     * Teacher/admin grid of online students with latest frame metadata.
     */
    public function getGrid(Request $request)
    {
        $user = Auth::user();

        if (! in_array($user->role ?? '', ['admin', 'teacher'], true)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'laboratory_room' => 'nullable|string|max:255',
        ]);

        $threshold = now()->subSeconds(self::ONLINE_SECONDS);

        // Belt-and-suspenders: any session that is still marked is_active=true
        // but has not received a heartbeat in ONLINE_SECONDS is clearly dead
        // (app crash, network drop, user closed without logging out, etc.).
        // Close it now so it never appears in any future grid query.
        MonitoringSession::where('is_active', true)
            ->where('updated_at', '<', $threshold)
            ->update([
                'is_active' => false,
                'session_end' => now(),
            ]);

        $query = MonitoringSession::query()
            ->where('is_active', true)
            ->where('updated_at', '>=', $threshold)
            ->with('student');

        if ($user->role === 'teacher') {
            $studentIds = DB::table('subject_enrollments')
                ->join('subjects', 'subjects.id', '=', 'subject_enrollments.subject_id')
                ->where('subjects.teacher_user_id', $user->id)
                ->pluck('subject_enrollments.student_id');

            $query->whereIn('student_user_id', $studentIds);
        }

        $labFilter = trim((string) $request->input('laboratory_room', ''));
        if ($labFilter !== '' && Schema::hasColumn('monitoring_sessions', 'laboratory_room')) {
            $query->where('laboratory_room', $labFilter);
        }

        $sessions = $query->get();

        // Deduplicate by student_user_id so each student only has ONE active card (the most recent session)
        $sessions = $sessions->sortByDesc('updated_at')->unique('student_user_id')->values();

        $studentIds = $sessions->pluck('student_user_id')->filter()->unique()->values();
        $frames = ScreenMonitorFrame::whereIn('student_user_id', $studentIds)
            ->get()
            ->keyBy('student_user_id');

        $profiles = DB::table('student_profiles')
            ->whereIn('user_id', $studentIds)
            ->select('user_id', 'profile_picture')
            ->get()
            ->keyBy('user_id');

        $items = [];

        foreach ($sessions as $session) {
            $student = $session->student;
            if (! $student) {
                continue;
            }

            $frame = $frames->get($student->id);
            $capturedAt = $frame?->captured_at;

            // Only count a frame as "belonging" to the current session if the
            // frame was captured AFTER this session started (i.e., the student
            // hasn't just switched PCs and is showing the OLD PC's screenshot).
            $frameMatchesSession = $frame !== null
                && $capturedAt !== null
                && $session->session_start !== null
                && $capturedAt->gte($session->session_start);

            $hasFrame = $frameMatchesSession
                && Storage::disk('local')->exists($frame->storage_path);

            $isStale = ! $capturedAt || $capturedAt->lt(now()->subSeconds(self::STALE_SECONDS));

            // computer_name / laboratory_room always come from the ACTIVE
            // session, never from the stale frame row. This prevents showing
            // the old PC/lab when a student has moved to a different machine.
            $computerName = $session->computer_name;
            $laboratoryRoom = $session->laboratory_room;

            $profile = $profiles->get($student->id);

            $items[] = [
                'student_id' => $student->id,
                'full_name' => $student->full_name ?? $student->name ?? 'Student',
                'email' => $student->email,
                'profile_picture' => $profile?->profile_picture ?? null,
                'monitoring_session_id' => $session->id,
                'computer_name' => $computerName,
                'laboratory_room' => $laboratoryRoom,
                'is_locked' => (bool) ($session->is_locked ?? false),
                'lock_message' => $session->lock_message,
                'locked_at' => $session->locked_at?->toIso8601String(),
                'last_seen' => $session->updated_at?->toIso8601String(),
                'has_frame' => $hasFrame,
                'captured_at' => $capturedAt?->toIso8601String(),
                'is_stale' => $isStale,
                'width' => $frame?->width,
                'height' => $frame?->height,
            ];
        }

        usort($items, static function ($a, $b) {
            return strcmp((string) ($a['laboratory_room'] ?? ''), (string) ($b['laboratory_room'] ?? ''))
                ?: strcmp((string) ($a['full_name'] ?? ''), (string) ($b['full_name'] ?? ''))
                ?: strcmp((string) ($a['computer_name'] ?? ''), (string) ($b['computer_name'] ?? ''))
                ?: ((int) ($a['student_id'] ?? 0) <=> (int) ($b['student_id'] ?? 0));
        });

        return response()->json([
            'ok' => true,
            'data' => $items,
            'poll_seconds' => 3,
        ]);
    }

    /**
     * Serve latest frame image for a student (teacher/admin only).
     */
    public function getFrame(int $studentId)
    {
        $user = Auth::user();

        if (! in_array($user->role ?? '', ['admin', 'teacher'], true)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if ($user->role === 'teacher' && ! $this->teacherCanViewStudent((int) $user->id, $studentId)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $frame = ScreenMonitorFrame::where('student_user_id', $studentId)->first();

        if (! $frame || ! Storage::disk('local')->exists($frame->storage_path)) {
            abort(404, 'Frame not found');
        }

        $absolute = Storage::disk('local')->path($frame->storage_path);
        $mime = mime_content_type($absolute) ?: 'image/jpeg';

        return response()->file($absolute, [
            'Content-Type' => $mime,
            'Cache-Control' => 'private, no-cache, must-revalidate',
        ]);
    }

    private function teacherCanViewStudent(int $teacherId, int $studentId): bool
    {
        return DB::table('subject_enrollments')
            ->join('subjects', 'subjects.id', '=', 'subject_enrollments.subject_id')
            ->where('subjects.teacher_user_id', $teacherId)
            ->where('subject_enrollments.student_id', $studentId)
            ->exists();
    }

    private function detectImageMime(string $binary): ?string
    {
        if (str_starts_with($binary, "\xFF\xD8\xFF")) {
            return 'image/jpeg';
        }
        if (str_starts_with($binary, "\x89PNG\r\n\x1a\n")) {
            return 'image/png';
        }

        return null;
    }
}
