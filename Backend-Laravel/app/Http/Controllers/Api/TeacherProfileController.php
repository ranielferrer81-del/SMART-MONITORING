<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class TeacherProfileController extends Controller
{
    private function isProfilePictureValueTooLongForColumn(QueryException $e): bool
    {
        $m = $e->getMessage();

        return str_contains($m, 'profile_picture')
            && (str_contains($m, '1406') || str_contains($m, '22001') || str_contains($m, 'Data too long'));
    }

    private function persistTeacherProfilePicture(int $userId, string $base64Image): void
    {
        try {
            DB::table('teacher_profiles')
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
                DB::statement('ALTER TABLE teacher_profiles MODIFY profile_picture LONGTEXT NULL');
            } catch (\Throwable) {
                // If ALTER is not permitted, rethrow original
                throw $e;
            }
            DB::table('teacher_profiles')
                ->where('user_id', $userId)
                ->update([
                    'profile_picture' => $base64Image,
                    'updated_at' => now(),
                ]);
        }
    }

    public function uploadProfilePicture(Request $request)
    {
        $user = Auth::user();
        if (!$user || ($user->role ?? 'teacher') !== 'teacher') {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 403);
        }

        $request->validate([
            'profile_picture' => ['required', 'image', 'mimes:jpeg,jpg,png', 'max:2048'], // Max 2MB
        ]);

        try {
            // Get teacher profile
            $teacherProfile = DB::table('teacher_profiles')->where('user_id', $user->id)->first();
            if (!$teacherProfile) {
                return response()->json(['ok' => false, 'message' => 'Teacher profile not found'], 404);
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
            $this->persistTeacherProfilePicture($user->id, $base64Image);

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
        if (!$user || ($user->role ?? 'teacher') !== 'teacher') {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 403);
        }

        try {
            $teacherProfile = DB::table('teacher_profiles')->where('user_id', $user->id)->first();
            if (!$teacherProfile) {
                return response()->json(['ok' => false, 'message' => 'Teacher profile not found'], 404);
            }

            // Delete file if exists
            if (isset($teacherProfile->profile_picture) && $teacherProfile->profile_picture) {
                // Handle both full URL and relative path
                $oldPath = $teacherProfile->profile_picture;
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

            // Update teacher profile
            DB::table('teacher_profiles')
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
}

