<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PresentationController extends Controller
{
    private function assertTeacher(): object
    {
        $u = Auth::user();
        if (! $u || ($u->role ?? '') !== 'teacher') {
            $this->denyJson('Only teachers can do this', 403);
        }

        return $u;
    }

    private function assertStudent(): object
    {
        $u = Auth::user();
        if (! $u || ($u->role ?? '') !== 'student') {
            $this->denyJson('Only students can join as viewers', 403);
        }

        return $u;
    }

    private function denyJson(string $message, int $code = 403): void
    {
        throw new HttpResponseException(response()->json(['ok' => false, 'message' => $message], $code));
    }

    /** @param mixed|null $payload */
    private function normalizePayload($payload): ?string
    {
        if ($payload === null) {
            return null;
        }
        if ($payload === '') {
            return null;
        }
        if (is_array($payload)) {
            return json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        }
        $s = is_string($payload) ? $payload : json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

        return strlen($s) <= 65535 ? $s : null;
    }

    private function decodePayload(?string $raw)
    {
        if ($raw === null || $raw === '') {
            return null;
        }
        $dec = json_decode($raw, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            return $dec;
        }

        return $raw;
    }

    private function sessionByUuid(string $uuid): ?object
    {
        return DB::table('presentation_sessions')->where('public_uuid', $uuid)->first();
    }

    private function studentTaughtByTeacher(int $studentId, int $teacherId): bool
    {
        return DB::table('subject_enrollments')
            ->join('subjects', 'subjects.id', '=', 'subject_enrollments.subject_id')
            ->where('subject_enrollments.student_id', $studentId)
            ->where('subject_enrollments.status', 'active')
            ->where('subjects.teacher_user_id', $teacherId)
            ->exists();
    }

    /**
     * Start (or replace) an active presentation for this teacher.
     */
    public function start(Request $request)
    {
        $teacher = $this->assertTeacher();

        DB::transaction(function () use ($teacher) {
            $active = DB::table('presentation_sessions')
                ->where('teacher_user_id', $teacher->id)
                ->where('status', 'active')
                ->lockForUpdate()
                ->first();
            if ($active) {
                DB::table('presentation_sessions')
                    ->where('id', $active->id)
                    ->update(['status' => 'ended', 'updated_at' => now()]);
            }
            DB::table('presentation_sessions')->insert([
                'public_uuid' => (string) Str::uuid(),
                'teacher_user_id' => $teacher->id,
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });

        $row = DB::table('presentation_sessions')
            ->where('teacher_user_id', $teacher->id)
            ->where('status', 'active')
            ->orderByDesc('id')
            ->first();

        return response()->json([
            'ok' => true,
            'session' => [
                'id' => $row->id,
                'uuid' => $row->public_uuid,
                'teacher_user_id' => (int) $row->teacher_user_id,
            ],
        ]);
    }

    /**
     * End active presentation for this teacher (by uuid or current).
     */
    public function end(Request $request, string $uuid)
    {
        $teacher = $this->assertTeacher();
        $session = $this->sessionByUuid($uuid);
        if (! $session || (int) $session->teacher_user_id !== (int) $teacher->id) {
            return response()->json(['ok' => false, 'message' => 'Session not found'], 404);
        }
        DB::table('presentation_sessions')
            ->where('id', $session->id)
            ->update(['status' => 'ended', 'updated_at' => now()]);

        DB::table('presentation_signaling_messages')->insert([
            'presentation_session_id' => $session->id,
            'sender_user_id' => $teacher->id,
            'recipient_user_id' => null,
            'message_type' => 'hangup',
            'payload' => json_encode(['reason' => 'ended']),
            'created_at' => now(),
        ]);

        return response()->json(['ok' => true]);
    }

    public function statusForTeacher(Request $request)
    {
        $teacher = $this->assertTeacher();
        $row = DB::table('presentation_sessions')
            ->where('teacher_user_id', $teacher->id)
            ->where('status', 'active')
            ->orderByDesc('id')
            ->first();
        if (! $row) {
            return response()->json(['ok' => true, 'active' => false]);
        }

        return response()->json([
            'ok' => true,
            'active' => true,
            'session' => [
                'id' => $row->id,
                'uuid' => $row->public_uuid,
            ],
        ]);
    }

    /**
     * Students: any active presentation by a teacher who teaches this student.
     */
    public function activeForStudent(Request $request)
    {
        $student = $this->assertStudent();

        $row = DB::table('presentation_sessions as ps')
            ->join('users as t', 't.id', '=', 'ps.teacher_user_id')
            ->where('ps.status', 'active')
            ->whereIn('ps.teacher_user_id', function ($q) use ($student) {
                $q->select('subjects.teacher_user_id')
                    ->from('subject_enrollments')
                    ->join('subjects', 'subjects.id', '=', 'subject_enrollments.subject_id')
                    ->where('subject_enrollments.student_id', $student->id)
                    ->where('subject_enrollments.status', 'active');
            })
            ->orderByDesc('ps.id')
            ->select('ps.id', 'ps.public_uuid', 'ps.teacher_user_id', 't.full_name as teacher_name')
            ->first();

        if (! $row) {
            return response()->json(['ok' => true, 'active' => false]);
        }

        return response()->json([
            'ok' => true,
            'active' => true,
            'session' => [
                'uuid' => $row->public_uuid,
                'teacher_user_id' => (int) $row->teacher_user_id,
                'teacher_name' => $row->teacher_name,
            ],
        ]);
    }

    public function join(Request $request, string $uuid)
    {
        $student = $this->assertStudent();
        $session = $this->sessionByUuid($uuid);
        if (! $session || $session->status !== 'active') {
            return response()->json(['ok' => false, 'message' => 'Presentation not active'], 404);
        }

        $teacherId = (int) $session->teacher_user_id;
        if (! $this->studentTaughtByTeacher((int) $student->id, $teacherId)) {
            return response()->json(['ok' => false, 'message' => 'You are not enrolled with this instructor'], 403);
        }

        $now = now();
        $updated = DB::table('presentation_viewers')
            ->where('presentation_session_id', $session->id)
            ->where('student_user_id', $student->id)
            ->update(['joined_at' => $now, 'updated_at' => $now]);
        if ($updated === 0) {
            DB::table('presentation_viewers')->insert([
                'presentation_session_id' => $session->id,
                'student_user_id' => $student->id,
                'joined_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        return response()->json([
            'ok' => true,
            'teacher_user_id' => $teacherId,
        ]);
    }

    public function viewers(Request $request, string $uuid)
    {
        $teacher = $this->assertTeacher();
        $session = $this->sessionByUuid($uuid);
        if (! $session || (int) $session->teacher_user_id !== (int) $teacher->id) {
            return response()->json(['ok' => false, 'message' => 'Session not found'], 404);
        }

        $ids = DB::table('presentation_viewers')
            ->where('presentation_session_id', $session->id)
            ->pluck('student_user_id');

        return response()->json([
            'ok' => true,
            'student_ids' => $ids->map(fn ($id) => (int) $id)->values()->all(),
        ]);
    }

    /**
     * POST SDP / ICE message.
     */
    public function sendSignal(Request $request, string $uuid)
    {
        $session = $this->sessionByUuid($uuid);
        if (! $session || $session->status !== 'active') {
            return response()->json(['ok' => false, 'message' => 'Presentation not active'], 404);
        }

        $data = $request->validate([
            'message_type' => 'required|string|in:offer,answer,iceCandidate,hangup',
            'recipient_user_id' => 'nullable|integer|exists:users,id',
            'payload' => ['nullable'],
        ]);

        $sender = Auth::user();
        if (! $sender) {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 401);
        }

        $teacherId = (int) $session->teacher_user_id;
        $recipientId = isset($data['recipient_user_id']) ? (int) $data['recipient_user_id'] : null;

        if (($sender->role ?? '') === 'teacher') {
            if ((int) $sender->id !== $teacherId) {
                return response()->json(['ok' => false, 'message' => 'Forbidden'], 403);
            }
            $allowedTypes = ['offer', 'iceCandidate'];
            if (! in_array($data['message_type'], $allowedTypes, true)) {
                return response()->json(['ok' => false, 'message' => 'Invalid message for teacher'], 422);
            }
            if ($data['message_type'] === 'offer' && (! $recipientId || $recipientId === $teacherId)) {
                return response()->json(['ok' => false, 'message' => 'Offer requires recipient student id'], 422);
            }
            if ($data['message_type'] === 'iceCandidate' && (! $recipientId || $recipientId === $teacherId)) {
                return response()->json(['ok' => false, 'message' => 'ICE requires recipient student id'], 422);
            }
            if ($recipientId && ! DB::table('presentation_viewers')
                ->where('presentation_session_id', $session->id)
                ->where('student_user_id', $recipientId)
                ->exists()) {
                return response()->json(['ok' => false, 'message' => 'Recipient has not joined this session'], 422);
            }
        } elseif (($sender->role ?? '') === 'student') {
            if (! $this->studentTaughtByTeacher((int) $sender->id, $teacherId)) {
                return response()->json(['ok' => false, 'message' => 'Forbidden'], 403);
            }
            if (! DB::table('presentation_viewers')
                ->where('presentation_session_id', $session->id)
                ->where('student_user_id', $sender->id)
                ->exists()) {
                return response()->json(['ok' => false, 'message' => 'Join the session first'], 403);
            }
            $allowedTypes = ['answer', 'iceCandidate'];
            if (! in_array($data['message_type'], $allowedTypes, true)) {
                return response()->json(['ok' => false, 'message' => 'Invalid message for student'], 422);
            }
            // Answers and ICE always go to the presenter (teacher).
            $recipientId = $teacherId;
        } else {
            return response()->json(['ok' => false, 'message' => 'Forbidden'], 403);
        }

        $payloadStored = $this->normalizePayload($request->input('payload'));
        if ($payloadStored === null && $request->has('payload') && $request->input('payload') !== null && $request->input('payload') !== '') {
            return response()->json(['ok' => false, 'message' => 'Invalid or oversized payload'], 422);
        }

        DB::table('presentation_signaling_messages')->insert([
            'presentation_session_id' => $session->id,
            'sender_user_id' => $sender->id,
            'recipient_user_id' => $recipientId,
            'message_type' => $data['message_type'],
            'payload' => $payloadStored,
            'created_at' => now(),
        ]);

        return response()->json(['ok' => true]);
    }

    public function pollSignals(Request $request, string $uuid)
    {
        $session = $this->sessionByUuid($uuid);
        if (! $session) {
            return response()->json(['ok' => false, 'message' => 'Not found'], 404);
        }

        $receiver = Auth::user();
        if (! $receiver) {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 401);
        }

        $teacherId = (int) $session->teacher_user_id;
        $role = $receiver->role ?? '';
        if ($role === 'teacher') {
            if ((int) $receiver->id !== $teacherId) {
                return response()->json(['ok' => false, 'message' => 'Forbidden'], 403);
            }
        } elseif ($role === 'student') {
            if (! $this->studentTaughtByTeacher((int) $receiver->id, $teacherId)) {
                return response()->json(['ok' => false, 'message' => 'Forbidden'], 403);
            }
        } else {
            return response()->json(['ok' => false, 'message' => 'Forbidden'], 403);
        }

        $since = max(0, (int) $request->query('since', 0));
        $rid = (int) $receiver->id;

        $query = DB::table('presentation_signaling_messages')
            ->where('presentation_session_id', $session->id)
            ->where('id', '>', $since)
            ->where('sender_user_id', '!=', $rid)
            ->where(function ($q) use ($rid) {
                $q->whereNull('recipient_user_id')
                    ->orWhere('recipient_user_id', $rid);
            })
            ->orderBy('id')
            ->limit(200);

        $rows = $query->get()->map(fn ($row) => [
            'id' => (int) $row->id,
            'sender_user_id' => $row->sender_user_id !== null ? (int) $row->sender_user_id : null,
            'recipient_user_id' => $row->recipient_user_id !== null ? (int) $row->recipient_user_id : null,
            'message_type' => $row->message_type,
            'payload' => $this->decodePayload($row->payload),
        ]);

        return response()->json([
            'ok' => true,
            'signals' => $rows,
            'session_status' => $session->status,
        ]);
    }
}
