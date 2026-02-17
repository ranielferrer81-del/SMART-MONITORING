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
}