<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class MonitoringTimeClockController extends Controller
{
    private function ensureTeacherOrAdmin()
    {
        $user = Auth::user();
        if (! $user || ! in_array($user->role ?? '', ['admin', 'teacher'], true)) {
            abort(response()->json(['ok' => false, 'message' => 'Unauthorized'], 403));
        }

        return $user;
    }

    /**
     * Students the current user may view (admin: all; teacher: enrolled in any of their subjects).
     *
     * @return list<int>
     */
    private function allowedStudentIdsForTeacher(int $teacherId): array
    {
        return DB::table('subject_enrollments')
            ->join('subjects', 'subjects.id', '=', 'subject_enrollments.subject_id')
            ->where('subjects.teacher_user_id', $teacherId)
            ->where('subject_enrollments.status', 'active')
            ->distinct()
            ->pluck('subject_enrollments.student_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
    }

    private function assertCanViewStudent(int $studentId, object $auth): void
    {
        if (($auth->role ?? '') === 'admin') {
            $ok = DB::table('users')->where('id', $studentId)->where('role', 'student')->exists();
            if (! $ok) {
                abort(response()->json(['ok' => false, 'message' => 'Student not found'], 404));
            }

            return;
        }

        $allowed = $this->allowedStudentIdsForTeacher((int) $auth->id);
        if (! in_array($studentId, $allowed, true)) {
            abort(response()->json(['ok' => false, 'message' => 'You do not teach this student'], 403));
        }
    }

    /**
     * GET /api/monitoring-time/students — list students with course/section for grouping.
     */
    public function students(Request $request)
    {
        $auth = $this->ensureTeacherOrAdmin();

        $query = DB::table('users as u')
            ->join('student_profiles as sp', 'sp.user_id', '=', 'u.id')
            ->where('u.role', 'student')
            ->select(
                'u.id',
                'u.full_name',
                'u.email',
                'sp.student_number',
                'sp.course',
                'sp.section'
            );

        if (($auth->role ?? '') === 'teacher') {
            $ids = $this->allowedStudentIdsForTeacher((int) $auth->id);
            if ($ids === []) {
                return response()->json(['ok' => true, 'data' => []]);
            }
            $query->whereIn('u.id', $ids);
        }

        $rows = $query
            ->orderBy('sp.course')
            ->orderBy('sp.section')
            ->orderBy('u.full_name')
            ->get()
            ->map(function ($row) {
                return [
                    'id' => (int) $row->id,
                    'full_name' => $row->full_name,
                    'email' => $row->email,
                    'student_number' => $row->student_number,
                    'course' => $row->course,
                    'section' => $row->section,
                ];
            });

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    /**
     * GET /api/monitoring-time/students/{studentId}/sessions?date=Y-m-d
     * Sessions overlapping the given calendar day (server timezone).
     */
    public function studentSessions(Request $request, int $studentId)
    {
        $auth = $this->ensureTeacherOrAdmin();
        $this->assertCanViewStudent($studentId, $auth);

        $data = $request->validate([
            'date' => ['required', 'date'],
        ]);

        $dayStart = Carbon::parse($data['date'])->startOfDay();
        $dayEnd = Carbon::parse($data['date'])->endOfDay();

        $rows = DB::table('monitoring_sessions')
            ->where('student_user_id', $studentId)
            ->where('session_start', '<=', $dayEnd)
            ->where(function ($q) use ($dayStart) {
                $q->whereNull('session_end')
                    ->orWhere('session_end', '>=', $dayStart);
            })
            ->orderBy('session_start', 'desc')
            ->get();

        $payload = $rows->map(function ($row) {
            $deviceInfo = null;
            if ($row->device_info !== null && $row->device_info !== '') {
                $deviceInfo = is_string($row->device_info)
                    ? json_decode($row->device_info, true)
                    : (array) $row->device_info;
            }
            $desktop = is_array($deviceInfo) && isset($deviceInfo['desktop']) && is_array($deviceInfo['desktop'])
                ? $deviceInfo['desktop']
                : [];
            $sessionStartIso = Carbon::parse($row->session_start)->toIso8601String();
            $pinReady = $desktop['monitoring_ready_at'] ?? null;
            $timeInIso = is_string($pinReady) && $pinReady !== '' ? $pinReady : $sessionStartIso;
            $timeOutIso = $row->session_end
                ? Carbon::parse($row->session_end)->toIso8601String()
                : null;

            return [
                'id' => (int) $row->id,
                'session_start' => $sessionStartIso,
                'session_end' => $timeOutIso,
                'time_in' => $timeInIso,
                'time_out' => $timeOutIso,
                'is_active' => (bool) $row->is_active,
                'computer_name' => $row->computer_name ?? null,
            ];
        })->values();

        return response()->json([
            'ok' => true,
            'data' => $payload,
            'date' => $data['date'],
            'student_id' => $studentId,
        ]);
    }
}
