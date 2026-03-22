<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Hash;

class StudentProfileController extends Controller
{
    private function isProfilePictureValueTooLongForColumn(QueryException $e): bool
    {
        $m = $e->getMessage();

        return str_contains($m, 'profile_picture')
            && (str_contains($m, '1406') || str_contains($m, '22001') || str_contains($m, 'Data too long'));
    }

    private function persistStudentProfilePicture(int $userId, string $base64Image): void
    {
        try {
            DB::table('student_profiles')
                ->where('user_id', $userId)
                ->update([
                    'profile_picture' => $base64Image,
                    'updated_at' => now(),
                ]);
        } catch (QueryException $e) {
            if (! $this->isProfilePictureValueTooLongForColumn($e)) {
                throw $e;
            }
            try {
                if (Schema::hasColumn('student_profiles', 'profile_picture')) {
                    DB::statement('ALTER TABLE student_profiles MODIFY profile_picture LONGTEXT NULL');
                }
            } catch (\Throwable) {
                throw $e;
            }
            DB::table('student_profiles')
                ->where('user_id', $userId)
                ->update([
                    'profile_picture' => $base64Image,
                    'updated_at' => now(),
                ]);
        }
    }

    /**
     * Return subjects where the authenticated student is enrolled.
     */
    public function enrolledSubjects(Request $request)
    {
        $user = Auth::user();
        if (!$user || ($user->role ?? 'student') !== 'student') {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 403);
        }

        $subjects = DB::table('subject_enrollments as se')
            ->join('subjects as s', 's.id', '=', 'se.subject_id')
            ->leftJoin('users as t', 't.id', '=', 's.teacher_user_id')
            ->where('se.student_id', $user->id)
            ->where('se.status', 'active')
            ->selectRaw('
                s.id,
                s.code,
                s.name,
                s.course,
                s.section,
                s.created_at,
                t.full_name as teacher_name
            ')
            ->orderBy('s.name')
            ->get();

        return response()->json([
            'ok' => true,
            'data' => $subjects,
        ]);
    }

    /**
     * Return attendance summary and records for the authenticated student
     * in a specific subject.
     */
    public function attendanceForSubject(Request $request, int $subjectId)
    {
        $user = Auth::user();
        if (!$user || ($user->role ?? 'student') !== 'student') {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 403);
        }

        $subject = DB::table('subjects')->where('id', $subjectId)->first();
        if (!$subject) {
            return response()->json(['ok' => false, 'message' => 'Subject not found'], 404);
        }

        $logs = DB::table('attendance_logs')
            ->where('subject_id', $subjectId)
            ->where('student_id', $user->id)
            ->orderBy('attendance_date', 'asc')
            ->orderBy('scanned_at', 'asc')
            ->get();

        $present = $logs->where('status', 'present')->count();
        $late = $logs->where('status', 'late')->count();
        $absent = $logs->where('status', 'absent')->count();
        $total = $logs->count();

        $records = $logs->map(function ($row) {
            return [
                'date' => $row->attendance_date,
                'status' => $row->status,
                'time' => optional($row->scanned_at)->format('H:i:s'),
            ];
        });

        return response()->json([
            'ok' => true,
            'data' => [
                'present' => $present,
                'late' => $late,
                'absent' => $absent,
                'total' => $total,
                'records' => $records,
            ],
        ]);
    }

    public function updatePin(Request $request)
    {
        $user = Auth::user();
        if (!$user || ($user->role ?? 'student') !== 'student') {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'pin' => ['required', 'digits:4'],
        ]);

        $studentProfile = DB::table('student_profiles')->where('user_id', $user->id)->first();
        if (!$studentProfile) {
            return response()->json(['ok' => false, 'message' => 'Student profile not found'], 404);
        }

        DB::table('student_profiles')
            ->where('user_id', $user->id)
            ->update([
                'pin' => Hash::make($data['pin']),
                'updated_at' => now(),
            ]);

        return response()->json([
            'ok' => true,
            'message' => 'PIN updated successfully',
        ]);
    }

    public function validatePin(Request $request)
    {
        $user = Auth::user();
        if (!$user || ($user->role ?? 'student') !== 'student') {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'pin' => ['required', 'digits:4'],
        ]);

        $studentProfile = DB::table('student_profiles')->where('user_id', $user->id)->first();
        if (!$studentProfile) {
            return response()->json(['ok' => false, 'message' => 'Student profile not found'], 404);
        }

        if (!$studentProfile->pin) {
            return response()->json([
                'ok' => false,
                'message' => 'No PIN has been set. Please set your PIN in the student dashboard first.',
            ], 400);
        }

        if (!Hash::check($data['pin'], $studentProfile->pin)) {
            return response()->json([
                'ok' => false,
                'message' => 'Incorrect PIN. Please try again.',
            ], 401);
        }

        return response()->json([
            'ok' => true,
            'message' => 'PIN validated successfully',
        ]);
    }

    public function uploadProfilePicture(Request $request)
    {
        $user = Auth::user();
        if (!$user || ($user->role ?? 'student') !== 'student') {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'profile_picture' => ['required', 'image', 'mimes:jpeg,jpg,png', 'max:2048'], // Max 2MB
        ]);

        try {
            // Get student profile
            $studentProfile = DB::table('student_profiles')->where('user_id', $user->id)->first();
            if (!$studentProfile) {
                return response()->json(['ok' => false, 'message' => 'Student profile not found'], 404);
            }

            // Generate Base64 from uploaded file (LONGTEXT column — see migration)
            $file = $request->file('profile_picture');
            $imageData = base64_encode(file_get_contents($file->getRealPath()));
            $mime = $file->getMimeType();
            if (! is_string($mime) || ! str_starts_with($mime, 'image/')) {
                $mime = strtolower($file->getClientOriginalExtension()) === 'png' ? 'image/png' : 'image/jpeg';
            }
            $base64Image = 'data:'.$mime.';base64,'.$imageData;

            // Store base64 directly in the database (persists across Railway redeploys)
            $this->persistStudentProfilePicture($user->id, $base64Image);

            return response()->json([
                'ok' => true,
                'message' => 'Profile picture uploaded successfully',
                'data' => [
                    'profile_picture' => $base64Image,
                ],
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'ok' => false,
                'message' => 'Failed to upload profile picture: ' . $e->getMessage(),
            ], 500);
        }
    }

    public function deleteProfilePicture(Request $request)
    {
        $user = Auth::user();
        if (!$user || ($user->role ?? 'student') !== 'student') {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 403);
        }

        try {
            $studentProfile = DB::table('student_profiles')->where('user_id', $user->id)->first();
            if (!$studentProfile) {
                return response()->json(['ok' => false, 'message' => 'Student profile not found'], 404);
            }

            // Delete file if exists
            if ($studentProfile->profile_picture) {
                // Handle both full URL and relative path
                $oldPath = $studentProfile->profile_picture;
                if (strpos($oldPath, '/storage/') !== false) {
                    $oldPath = str_replace('/storage/', '', $oldPath);
                } elseif (strpos($oldPath, 'storage/') !== false) {
                    $oldPath = str_replace('storage/', '', $oldPath);
                } elseif (strpos($oldPath, 'profile_pictures/') !== false) {
                    // Already in correct format
                } else {
                    // Extract path from URL if it's a full URL
                    $parsed = parse_url($oldPath);
                    if (isset($parsed['path'])) {
                        $oldPath = ltrim($parsed['path'], '/storage/');
                    }
                }
                if (Storage::disk('public')->exists($oldPath)) {
                    Storage::disk('public')->delete($oldPath);
                }
            }

            // Update student profile
            DB::table('student_profiles')
                ->where('user_id', $user->id)
                ->update([
                    'profile_picture' => null,
                    'updated_at' => now(),
                ]);

            return response()->json([
                'ok' => true,
                'message' => 'Profile picture deleted successfully',
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'ok' => false,
                'message' => 'Failed to delete profile picture: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Update student's own profile (name, password, etc.)
     */
    public function updateProfile(Request $request)
    {
        $user = Auth::user();
        if (!$user || ($user->role ?? 'student') !== 'student') {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'full_name' => ['sometimes', 'string', 'max:255'],
            'password' => ['sometimes', 'string', 'min:6'],
            'current_password' => ['required_with:password', 'string'],
        ]);

        // If password is being changed, verify current password
        if (isset($data['password'])) {
            // Fetch user with password explicitly
            $userWithPassword = DB::table('users')
                ->where('id', $user->id)
                ->select('id', 'password')
                ->first();

            if (!$userWithPassword || !Hash::check($data['current_password'], $userWithPassword->password)) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Current password is incorrect',
                ], 422);
            }
        }

        $updateData = [];

        // Update full name if provided
        if (isset($data['full_name'])) {
            $updateData['full_name'] = trim($data['full_name']);
        }

        // Update password if provided
        if (isset($data['password'])) {
            $updateData['password'] = Hash::make($data['password']);
        }

        if (!empty($updateData)) {
            $updateData['updated_at'] = now();
            DB::table('users')
                ->where('id', $user->id)
                ->update($updateData);
        }

        return response()->json([
            'ok' => true,
            'message' => 'Profile updated successfully',
        ]);
    }
}

