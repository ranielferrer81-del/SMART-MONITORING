<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class SubjectController extends Controller
{
    protected function ensureTeacherOrAdmin()
    {
        $authUser = Auth::user();
        $role = $authUser->role ?? 'student';
        if (!$authUser || !in_array($role, ['teacher', 'admin'])) {
            abort(response()->json(['ok' => false, 'message' => 'Unauthorized'], 403));
        }
        return $authUser;
    }

    public function index(Request $request)
    {
        $auth = $this->ensureTeacherOrAdmin();
        $course = strtoupper((string) $request->query('course', ''));
        $query = DB::table('subjects')
            ->leftJoin('users', 'subjects.teacher_user_id', '=', 'users.id')
            ->select(
                'subjects.id',
                'subjects.code',
                'subjects.name',
                'subjects.course',
                'subjects.section',
                'subjects.teacher_user_id',
                'users.full_name as teacher_name',
                'subjects.created_at'
            );

        // If user is a teacher (not admin), only show subjects assigned to them
        if ($auth->role === 'teacher') {
            $query->where('subjects.teacher_user_id', $auth->id);
        }

        if (in_array($course, ['BSIT', 'BSCS', 'BSEMC'])) {
            $query->where('subjects.course', $course);
        }
        $subjects = $query->orderBy('subjects.created_at', 'desc')->get();
        return response()->json(['ok' => true, 'data' => $subjects]);
    }

    public function store(Request $request)
    {
        $auth = $this->ensureTeacherOrAdmin();
        $data = $request->validate([
            'code' => ['required', 'string', 'max:32'],
            'name' => ['required', 'string', 'max:191'],
            'course' => ['required', 'in:BSIT,BSCS,BSEMC'],
            'section' => ['required', 'string', 'max:50'],
            'teacher_user_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        // Ensure auto-enrollment trigger is removed (safety check)
        try {
            DB::statement('DROP TRIGGER IF EXISTS `subjects_ai_auto_enroll`');
        } catch (\Exception $e) {
            // Ignore errors - trigger might not exist or database doesn't support it
        }

        // If teacher_user_id is provided and user is admin, use it; otherwise use authenticated user
        $teacherId = null;
        if ($auth->role === 'admin' && isset($data['teacher_user_id']) && $data['teacher_user_id']) {
            // Verify the selected user is a teacher
            $teacher = DB::table('users')->where('id', $data['teacher_user_id'])->where('role', 'teacher')->first();
            if (!$teacher) {
                return response()->json(['ok' => false, 'message' => 'Selected user is not a teacher'], 422);
            }
            $teacherId = $data['teacher_user_id'];
        } else {
            // For teachers or if no teacher_user_id provided, use authenticated user
            $teacherId = $auth->id;
        }

        // Check if exact same subject (code + name + course + section) exists
        $exists = DB::table('subjects')
            ->where('code', $data['code'])
            ->where('name', $data['name'])
            ->where('course', $data['course'])
            ->where('section', $data['section'])
            ->exists();
        if ($exists) {
            return response()->json(['ok' => false, 'message' => 'This exact subject already exists for this course/section'], 422);
        }

        $id = DB::table('subjects')->insertGetId([
            'code' => $data['code'],
            'name' => $data['name'],
            'course' => $data['course'],
            'section' => $data['section'],
            'teacher_user_id' => $teacherId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Return subject with teacher name
        $subject = DB::table('subjects')
            ->leftJoin('users', 'subjects.teacher_user_id', '=', 'users.id')
            ->select(
                'subjects.id',
                'subjects.code',
                'subjects.name',
                'subjects.course',
                'subjects.section',
                'subjects.teacher_user_id',
                'users.full_name as teacher_name',
                'subjects.created_at'
            )
            ->where('subjects.id', $id)
            ->first();

        return response()->json(['ok' => true, 'data' => $subject], 201);
    }

    public function show(int $id)
    {
        $auth = $this->ensureTeacherOrAdmin();

        // Get the subject
        $subject = DB::table('subjects')->where('id', $id)->first();
        if (!$subject) {
            return response()->json(['ok' => false, 'message' => 'Subject not found'], 404);
        }

        // If user is a teacher, verify they are assigned to this subject
        if ($auth->role === 'teacher' && $subject->teacher_user_id != $auth->id) {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 403);
        }

        // Get attendance summary per student for this subject
        $attendance = DB::table('attendance_logs')
            ->select(
                'student_id',
                DB::raw("SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present"),
                DB::raw("SUM(CASE WHEN status = 'late' THEN 1 ELSE 0 END) as late"),
                DB::raw("SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent")
            )
            ->where('subject_id', $id)
            ->groupBy('student_id')
            ->get()
            ->keyBy('student_id');

        // Get enrolled students for this subject
        $enrolledStudents = DB::table('subject_enrollments as se')
            ->join('users as u', 'u.id', '=', 'se.student_id')
            ->leftJoin('student_profiles as sp', 'sp.user_id', '=', 'u.id')
            ->select(
                'u.id',
                'u.full_name',
                'u.email',
                'u.is_active',
                'sp.student_number',
                'sp.section',
                'sp.course',
                'sp.profile_picture',
                'se.enrolled_at',
                'se.status'
            )
            ->where('se.subject_id', $id)
            ->where('se.status', 'active')
            ->orderBy('u.full_name', 'asc')
            ->get()
            ->map(function ($row) use ($attendance) {
                $summary = $attendance->get($row->id);
                $present = (int) ($summary->present ?? 0);
                $late = (int) ($summary->late ?? 0);
                $absent = (int) ($summary->absent ?? 0);

                $row->attendance_summary = [
                    'present' => $present,
                    'late' => $late,
                    'absent' => $absent,
                ];
                return $row;
            });

        return response()->json(['ok' => true, 'data' => $enrolledStudents]);
    }

    public function enrollStudent(Request $request, int $subjectId)
    {
        $auth = $this->ensureTeacherOrAdmin();

        // Get the subject
        $subject = DB::table('subjects')->where('id', $subjectId)->first();
        if (!$subject) {
            return response()->json(['ok' => false, 'message' => 'Subject not found'], 404);
        }

        // If user is a teacher, verify they are assigned to this subject
        if ($auth->role === 'teacher' && $subject->teacher_user_id != $auth->id) {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'student_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        // Verify the student exists and is a student
        $student = DB::table('users')->where('id', $data['student_id'])->where('role', 'student')->first();
        if (!$student) {
            return response()->json(['ok' => false, 'message' => 'Student not found'], 404);
        }

        // Check if already enrolled
        $exists = DB::table('subject_enrollments')
            ->where('subject_id', $subjectId)
            ->where('student_id', $data['student_id'])
            ->where('status', 'active')
            ->exists();

        if ($exists) {
            return response()->json(['ok' => false, 'message' => 'Student is already enrolled'], 422);
        }

        // Enroll the student
        DB::table('subject_enrollments')->insert([
            'subject_id' => $subjectId,
            'student_id' => $data['student_id'],
            'enrolled_at' => now(),
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['ok' => true, 'message' => 'Student enrolled successfully']);
    }

    public function enrollAllStudents(Request $request, int $subjectId)
    {
        $auth = $this->ensureTeacherOrAdmin();

        // Get the subject
        $subject = DB::table('subjects')->where('id', $subjectId)->first();
        if (!$subject) {
            return response()->json(['ok' => false, 'message' => 'Subject not found'], 404);
        }

        // If user is a teacher, verify they are assigned to this subject
        if ($auth->role === 'teacher' && $subject->teacher_user_id != $auth->id) {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'student_ids' => ['required', 'array', 'min:1'],
            'student_ids.*' => ['required', 'integer', 'exists:users,id'],
        ]);

        // Verify all students exist and are students
        $students = DB::table('users')
            ->whereIn('id', $data['student_ids'])
            ->where('role', 'student')
            ->pluck('id')
            ->toArray();

        if (count($students) !== count($data['student_ids'])) {
            return response()->json(['ok' => false, 'message' => 'One or more students not found or invalid'], 422);
        }

        // Get already enrolled students
        $enrolledIds = DB::table('subject_enrollments')
            ->where('subject_id', $subjectId)
            ->whereIn('student_id', $data['student_ids'])
            ->where('status', 'active')
            ->pluck('student_id')
            ->toArray();

        // Filter out already enrolled students
        $toEnroll = array_diff($data['student_ids'], $enrolledIds);

        if (empty($toEnroll)) {
            return response()->json([
                'ok' => true,
                'message' => 'All students are already enrolled',
                'enrolled_count' => 0,
                'skipped_count' => count($enrolledIds)
            ]);
        }

        // Enroll all students in bulk
        $now = now();
        $enrollments = [];
        foreach ($toEnroll as $studentId) {
            $enrollments[] = [
                'subject_id' => $subjectId,
                'student_id' => $studentId,
                'enrolled_at' => $now,
                'status' => 'active',
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::table('subject_enrollments')->insert($enrollments);

        return response()->json([
            'ok' => true,
            'message' => count($toEnroll) . ' student(s) enrolled successfully',
            'enrolled_count' => count($toEnroll),
            'skipped_count' => count($enrolledIds)
        ]);
    }

    public function unenrollStudent(Request $request, int $subjectId, int $studentId)
    {
        $auth = $this->ensureTeacherOrAdmin();

        // Get the subject
        $subject = DB::table('subjects')->where('id', $subjectId)->first();
        if (!$subject) {
            return response()->json(['ok' => false, 'message' => 'Subject not found'], 404);
        }

        // If user is a teacher, verify they are assigned to this subject
        if ($auth->role === 'teacher' && $subject->teacher_user_id != $auth->id) {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 403);
        }

        // Remove enrollment (soft delete by setting status to inactive, or hard delete)
        $deleted = DB::table('subject_enrollments')
            ->where('subject_id', $subjectId)
            ->where('student_id', $studentId)
            ->delete();

        if (!$deleted) {
            return response()->json(['ok' => false, 'message' => 'Enrollment not found'], 404);
        }

        return response()->json(['ok' => true, 'message' => 'Student unenrolled successfully']);
    }

    public function recordAttendance(Request $request, int $subjectId)
    {
        $auth = $this->ensureTeacherOrAdmin();

        // Verify subject exists and belongs to this teacher/admin context
        $subject = DB::table('subjects')->where('id', $subjectId)->first();
        if (!$subject) {
            return response()->json(['ok' => false, 'message' => 'Subject not found'], 404);
        }

        if ($auth->role === 'teacher' && $subject->teacher_user_id != $auth->id) {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'student_id' => ['required', 'integer', 'exists:users,id'],
            'status' => ['required', 'in:present,late,absent'],
        ]);

        // Ensure student is actually enrolled in this subject
        $enrolled = DB::table('subject_enrollments')
            ->where('subject_id', $subjectId)
            ->where('student_id', $data['student_id'])
            ->where('status', 'active')
            ->exists();

        if (!$enrolled) {
            return response()->json(['ok' => false, 'message' => 'Student is not enrolled in this subject'], 422);
        }

        $today = now()->toDateString();

        // Upsert: if a log exists for today, update status; otherwise insert a new one
        $existing = DB::table('attendance_logs')
            ->where('subject_id', $subjectId)
            ->where('student_id', $data['student_id'])
            ->where('attendance_date', $today)
            ->first();

        if ($existing) {
            DB::table('attendance_logs')
                ->where('id', $existing->id)
                ->update([
                    'status' => $data['status'],
                    'scanned_at' => now(),
                    'updated_at' => now(),
                ]);
        } else {
            DB::table('attendance_logs')->insert([
                'subject_id' => $subjectId,
                'student_id' => $data['student_id'],
                'teacher_user_id' => $auth->id,
                'status' => $data['status'],
                'attendance_date' => $today,
                'scanned_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return response()->json([
            'ok' => true,
            'message' => 'Attendance updated successfully',
        ]);
    }

    public function updateAttendanceRecord(Request $request, int $subjectId, int $studentId, int $recordId)
    {
        $auth = $this->ensureTeacherOrAdmin();

        // Verify subject exists and belongs to this teacher/admin context
        $subject = DB::table('subjects')->where('id', $subjectId)->first();
        if (!$subject) {
            return response()->json(['ok' => false, 'message' => 'Subject not found'], 404);
        }

        if ($auth->role === 'teacher' && $subject->teacher_user_id != $auth->id) {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 403);
        }

        // Verify student is enrolled in this subject
        $enrolled = DB::table('subject_enrollments')
            ->where('subject_id', $subjectId)
            ->where('student_id', $studentId)
            ->where('status', 'active')
            ->exists();

        if (!$enrolled) {
            return response()->json(['ok' => false, 'message' => 'Student is not enrolled in this subject'], 422);
        }

        // Verify the attendance record exists and belongs to this student and subject
        $record = DB::table('attendance_logs')
            ->where('id', $recordId)
            ->where('subject_id', $subjectId)
            ->where('student_id', $studentId)
            ->first();

        if (!$record) {
            return response()->json(['ok' => false, 'message' => 'Attendance record not found'], 404);
        }

        $data = $request->validate([
            'status' => ['required', 'in:present,late,absent'],
        ]);

        // Update the attendance record
        DB::table('attendance_logs')
            ->where('id', $recordId)
            ->update([
                'status' => $data['status'],
                'updated_at' => now(),
            ]);

        return response()->json([
            'ok' => true,
            'message' => 'Attendance record updated successfully',
        ]);
    }

    public function getStudentAttendanceHistory(Request $request, int $subjectId, int $studentId)
    {
        $auth = $this->ensureTeacherOrAdmin();

        // Verify subject exists and belongs to this teacher/admin context
        $subject = DB::table('subjects')->where('id', $subjectId)->first();
        if (!$subject) {
            return response()->json(['ok' => false, 'message' => 'Subject not found'], 404);
        }

        if ($auth->role === 'teacher' && $subject->teacher_user_id != $auth->id) {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 403);
        }

        // Verify student is enrolled in this subject
        $enrolled = DB::table('subject_enrollments')
            ->where('subject_id', $subjectId)
            ->where('student_id', $studentId)
            ->where('status', 'active')
            ->exists();

        if (!$enrolled) {
            return response()->json(['ok' => false, 'message' => 'Student is not enrolled in this subject'], 422);
        }

        // Get attendance logs for this student in this subject
        $logs = DB::table('attendance_logs')
            ->where('subject_id', $subjectId)
            ->where('student_id', $studentId)
            ->orderBy('attendance_date', 'desc')
            ->orderBy('scanned_at', 'desc')
            ->get()
            ->map(function ($row) {
                return [
                    'id' => $row->id,
                    'date' => $row->attendance_date,
                    'status' => $row->status,
                    'scanned_at' => $row->scanned_at ? date('Y-m-d H:i:s', strtotime($row->scanned_at)) : null,
                    'scanned_at_time' => $row->scanned_at ? date('H:i:s', strtotime($row->scanned_at)) : null,
                    'created_at' => $row->created_at ? date('Y-m-d H:i:s', strtotime($row->created_at)) : null,
                ];
            });

        return response()->json([
            'ok' => true,
            'data' => $logs,
        ]);
    }

    public function destroy(int $id)
    {
        $this->ensureTeacherOrAdmin();
        $deleted = DB::table('subjects')->where('id', $id)->delete();
        if (!$deleted)
            return response()->json(['ok' => false, 'message' => 'Not found'], 404);
        return response()->json(['ok' => true]);
    }
}
