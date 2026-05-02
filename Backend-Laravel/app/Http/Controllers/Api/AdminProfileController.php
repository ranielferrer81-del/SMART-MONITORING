<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

class AdminProfileController extends Controller
{
    /**
     * Update authenticated administrator profile (name, password, position title).
     */
    public function updateProfile(Request $request)
    {
        $user = Auth::user();
        if (! $user || ($user->role ?? '') !== 'admin') {
            return response()->json(['ok' => false, 'message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'full_name' => ['sometimes', 'string', 'max:191'],
            'password' => ['sometimes', 'string', 'min:6'],
            'current_password' => ['required_with:password', 'string'],
            'position' => ['sometimes', 'nullable', 'string', 'max:191'],
        ]);

        if (isset($data['password'])) {
            $userWithPassword = DB::table('users')
                ->where('id', $user->id)
                ->select('id', 'password')
                ->first();

            if (! $userWithPassword || ! Hash::check($data['current_password'], $userWithPassword->password)) {
                return response()->json([
                    'ok' => false,
                    'message' => 'Current password is incorrect',
                ], 422);
            }
        }

        $updateUser = [];
        if (isset($data['full_name'])) {
            $updateUser['full_name'] = trim($data['full_name']);
        }
        if (isset($data['password'])) {
            $updateUser['password'] = Hash::make($data['password']);
        }
        if (! empty($updateUser)) {
            $updateUser['updated_at'] = now();
            DB::table('users')->where('id', $user->id)->update($updateUser);
        }

        if (array_key_exists('position', $data)) {
            $exists = DB::table('admin_profiles')->where('user_id', $user->id)->exists();
            if ($exists) {
                DB::table('admin_profiles')->where('user_id', $user->id)->update([
                    'position' => $data['position'],
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('admin_profiles')->insert([
                    'user_id' => $user->id,
                    'position' => $data['position'] ?? 'Administrator',
                    'permissions' => json_encode(['manage_users' => true]),
                    'status' => 'active',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }

        return response()->json([
            'ok' => true,
            'message' => 'Profile updated successfully',
        ]);
    }
}
