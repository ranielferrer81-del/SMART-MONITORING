<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class TeacherProfileController extends Controller
{
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

            // Delete old profile picture if exists
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

            // Store new profile picture
            $file = $request->file('profile_picture');
            $fileName = 'profile_' . $user->id . '_' . time() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('profile_pictures', $fileName, 'public');

            // Return relative path for consistent URL building on frontend
            $relativePath = '/storage/' . $path;

            // Update teacher profile
            DB::table('teacher_profiles')
                ->where('user_id', $user->id)
                ->update([
                    'profile_picture' => $relativePath,
                    'updated_at' => now(),
                ]);

            return response()->json([
                'ok' => true,
                'message' => 'Profile picture uploaded successfully',
                'data' => [
                    'profile_picture' => $relativePath,
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

