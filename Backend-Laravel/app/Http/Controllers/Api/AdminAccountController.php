<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

class AdminAccountController extends Controller
{
    protected function ensureAdmin()
    {
        $authUser = Auth::user();
        if (!$authUser || ($authUser->role ?? 'student') !== 'admin') {
            abort(response()->json(['ok' => false, 'message' => 'Unauthorized'], 403));
        }
        return $authUser;
    }

    public function store(Request $request)
    {
        $authUser = $this->ensureAdmin();

        $data = $request->validate([
            'role' => ['required', 'in:admin,teacher,student'],
            'full_name' => ['required', 'string', 'max:191'],
            'email' => ['required', 'email', 'max:191'],
            'password' => ['required', 'string', 'min:6'],
            // student optional extras
            'course' => ['required_if:role,student', 'string', 'max:100', 'in:BSIT,BSCS,BSEMC'],
            'section' => ['required_if:role,student', 'string', 'max:50'],
            'student_number' => ['required_if:role,student', 'regex:/^\d{11}$/'],
        ]);

        $exists = DB::table('users')->whereRaw('LOWER(email) = ?', [strtolower($data['email'])])->exists();
        if ($exists) {
            return response()->json(['ok' => false, 'message' => 'Email already exists'], 422);
        }

        $userId = null;
        DB::transaction(function () use ($data, $authUser, &$userId) {
            $userId = DB::table('users')->insertGetId([
                'email' => strtolower($data['email']),
                'password' => Hash::make($data['password']),
                'role' => $data['role'],
                'full_name' => $data['full_name'],
                'is_active' => 1,
                'created_by' => $authUser->id,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            if ($data['role'] === 'student') {
                // Ensure student_number is unique
                $existsSn = DB::table('student_profiles')->where('student_number', $data['student_number'])->exists();
                if ($existsSn) {
                    abort(response()->json(['ok' => false, 'message' => 'Student number already exists'], 422));
                }
                DB::table('student_profiles')->insert([
                    'user_id' => $userId,
                    'student_number' => $data['student_number'],
                    'course' => $data['course'] ?? null,
                    'year_level' => null,
                    'section' => $data['section'] ?? null,
                    'status' => 'active',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } elseif ($data['role'] === 'teacher') {
                // Lock table and compute next teacher number safely
                $max = DB::table('teacher_profiles')
                    ->lockForUpdate()
                    ->selectRaw("COALESCE(MAX(CAST(SUBSTRING(teacher_number, 3) AS UNSIGNED)), 0) as max_num")
                    ->value('max_num');
                $next = 'T-' . str_pad((int) $max + 1, 4, '0', STR_PAD_LEFT);

                DB::table('teacher_profiles')->insert([
                    'user_id' => $userId,
                    'teacher_number' => $next,
                    'department' => null,
                    'specialization' => null,
                    'status' => 'active',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('admin_profiles')->insert([
                    'user_id' => $userId,
                    'position' => 'Administrator',
                    'permissions' => json_encode(['manage_users' => true]),
                    'status' => 'active',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        });

        $user = DB::table('users')->where('id', $userId)->first();
        return response()->json([
            'ok' => true,
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'fullName' => $user->full_name,
                'role' => $user->role,
            ],
        ], 201);
    }

    public function indexTeachers()
    {
        $this->ensureAdmin();
        $teachers = DB::table('users as u')
            ->leftJoin('teacher_profiles as tp', 'tp.user_id', '=', 'u.id')
            ->select('u.id', 'u.full_name', 'u.email', 'u.is_active', 'u.created_at', 'tp.teacher_number', 'tp.department', 'tp.specialization', 'tp.profile_picture')
            ->where('u.role', 'teacher')
            ->orderBy('u.created_at', 'desc')
            ->get();
        return response()->json(['ok' => true, 'data' => $teachers]);
    }

    public function indexStudentsByCourse(string $course)
    {
        $this->ensureAdmin();
        $course = strtoupper($course);
        if (!in_array($course, ['BSIT', 'BSCS', 'BSEMC'])) {
            return response()->json(['ok' => false, 'message' => 'Invalid course'], 422);
        }
        $students = DB::table('users as u')
            ->leftJoin('student_profiles as sp', 'sp.user_id', '=', 'u.id')
            ->select('u.id', 'u.full_name', 'u.email', 'u.is_active', 'u.created_at', 'sp.student_number', 'sp.section', 'sp.course', 'sp.profile_picture')
            ->where('u.role', 'student')
            ->whereRaw('UPPER(sp.course) = ?', [$course])
            ->orderBy('u.created_at', 'desc')
            ->get();
        return response()->json(['ok' => true, 'data' => $students]);
    }

    public function indexAllStudents()
    {
        $this->ensureAdmin();
        $students = DB::table('users as u')
            ->leftJoin('student_profiles as sp', 'sp.user_id', '=', 'u.id')
            ->select('u.id', 'u.full_name', 'u.email', 'u.is_active', 'u.created_at', 'sp.student_number', 'sp.section', 'sp.course', 'sp.profile_picture')
            ->where('u.role', 'student')
            ->orderBy('u.created_at', 'desc')
            ->get();
        return response()->json(['ok' => true, 'data' => $students]);
    }

    public function update(Request $request, int $userId)
    {
        $this->ensureAdmin();
        $data = $request->validate([
            'full_name' => ['sometimes', 'string', 'max:191'],
            'email' => ['sometimes', 'email', 'max:191'],
            'is_active' => ['sometimes', 'boolean'],
            // student fields
            'course' => [
                'sometimes',
                'nullable',
                'string',
                'max:100',
                function ($attribute, $value, $fail) {
                    if ($value !== null && !in_array(strtoupper($value), ['BSIT', 'BSCS', 'BSEMC'])) {
                        $fail('The course must be one of: BSIT, BSCS, BSEMC.');
                    }
                }
            ],
            'section' => ['sometimes', 'string', 'max:50'],
            'student_number' => ['sometimes', 'regex:/^\d{11}$/'],
            // teacher fields
            'department' => ['sometimes', 'string', 'max:100'],
            'specialization' => ['sometimes', 'string', 'max:255'],
        ]);

        $user = DB::table('users')->where('id', $userId)->first();
        if (!$user)
            return response()->json(['ok' => false, 'message' => 'User not found'], 404);

        DB::transaction(function () use ($data, $userId, $user) {
            if (!empty($data)) {
                $updateUser = [];
                foreach (['full_name', 'email', 'is_active'] as $k) {
                    if (array_key_exists($k, $data))
                        $updateUser[$k] = $data[$k];
                }
                if (!empty($updateUser)) {
                    $updateUser['updated_at'] = now();
                    DB::table('users')->where('id', $userId)->update($updateUser);
                }
            }
            if (($user->role ?? '') === 'student') {
                $updateSp = [];
                // Always update course if it's in the request (even if null, to explicitly clear it)
                if (array_key_exists('course', $data)) {
                    $updateSp['course'] = $data['course'] ? strtoupper(trim($data['course'])) : null;
                }
                if (array_key_exists('section', $data))
                    $updateSp['section'] = $data['section'];
                if (array_key_exists('student_number', $data)) {
                    // ensure unique
                    $existsSn = DB::table('student_profiles')
                        ->where('student_number', $data['student_number'])
                        ->where('user_id', '!=', $userId)
                        ->exists();
                    if ($existsSn)
                        abort(response()->json(['ok' => false, 'message' => 'Student number already exists'], 422));
                    $updateSp['student_number'] = $data['student_number'];
                }
                if (!empty($updateSp)) {
                    $updateSp['updated_at'] = now();
                    // Use updateOrInsert to ensure the record exists and is updated
                    $exists = DB::table('student_profiles')->where('user_id', $userId)->exists();
                    if ($exists) {
                        DB::table('student_profiles')->where('user_id', $userId)->update($updateSp);
                    } else {
                        // If profile doesn't exist, create it (shouldn't happen, but safety check)
                        $updateSp['user_id'] = $userId;
                        $updateSp['created_at'] = now();
                        DB::table('student_profiles')->insert($updateSp);
                    }
                }
            } elseif (($user->role ?? '') === 'teacher') {
                $updateTp = [];
                if (array_key_exists('department', $data))
                    $updateTp['department'] = $data['department'];
                if (array_key_exists('specialization', $data))
                    $updateTp['specialization'] = $data['specialization'];
                if (!empty($updateTp)) {
                    $updateTp['updated_at'] = now();
                    DB::table('teacher_profiles')->where('user_id', $userId)->update($updateTp);
                }
            }
        });

        return response()->json(['ok' => true]);
    }

    public function destroy(int $userId)
    {
        $this->ensureAdmin();
        $exists = DB::table('users')->where('id', $userId)->exists();
        if (!$exists)
            return response()->json(['ok' => false, 'message' => 'User not found'], 404);

        // Delete all browser monitoring data for this student
        DB::table('browser_activities')->where('student_user_id', $userId)->delete();
        DB::table('monitoring_sessions')->where('student_user_id', $userId)->delete();
        DB::table('incognito_alerts')->where('student_user_id', $userId)->delete();

        // Delete the user account
        DB::table('users')->where('id', $userId)->delete();

        return response()->json(['ok' => true]);
    }
}


