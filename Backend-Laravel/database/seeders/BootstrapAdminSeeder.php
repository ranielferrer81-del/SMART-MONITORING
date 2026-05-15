<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class BootstrapAdminSeeder extends Seeder
{
    /**
     * Create or update a bootstrap admin account.
     *
     * - BOOTSTRAP_ADMIN_PASSWORD set: always syncs that password (deploy-time reset).
     * - Otherwise, if BOOTSTRAP_ADMIN_USE_DB_PASSWORD_FALLBACK is not false: uses the DB
     *   user password only when no user exists yet for the bootstrap email (Railway-friendly
     *   first login without extra variables).
     *
     * Railway / restored DBs often use legacy columns (full_name, role) instead of Laravel's
     * default `name` only — use DB inserts there so this seeder does not fail and leave no admin.
     */
    public function run(): void
    {
        if (! Schema::hasTable('users')) {
            return;
        }

        $emailRaw = env('BOOTSTRAP_ADMIN_EMAIL');
        $email = strtolower(
            trim($emailRaw !== null && (string) $emailRaw !== '' ? (string) $emailRaw : 'admin@example.com'),
        );
        $name = trim((string) env('BOOTSTRAP_ADMIN_NAME', 'Admin User'));

        $explicit = trim((string) env('BOOTSTRAP_ADMIN_PASSWORD', ''));
        $fallbackAllowed = filter_var(
            env('BOOTSTRAP_ADMIN_USE_DB_PASSWORD_FALLBACK', true),
            FILTER_VALIDATE_BOOL,
        );

        $connection = (string) config('database.default', 'mysql');
        $dbPassword = trim((string) config("database.connections.{$connection}.password", ''));

        $forceUpdate = $explicit !== '';
        $passwordPlain = $explicit !== '' ? $explicit : ($fallbackAllowed ? $dbPassword : '');

        if ($passwordPlain === '') {
            return;
        }

        $legacyUsers = Schema::hasColumn('users', 'full_name') && Schema::hasColumn('users', 'role');

        if ($legacyUsers) {
            $this->seedLegacyStyleAdmin($email, $name, $passwordPlain, $forceUpdate);

            return;
        }

        $exists = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if ($exists !== null && ! $forceUpdate) {
            return;
        }

        if ($exists !== null) {
            $exists->update([
                'name' => $name !== '' ? $name : 'Admin User',
                'password' => $passwordPlain,
            ]);

            return;
        }

        User::create([
            'email' => $email,
            'name' => $name !== '' ? $name : 'Admin User',
            'password' => $passwordPlain,
        ]);
    }

    private function seedLegacyStyleAdmin(string $email, string $name, string $passwordPlain, bool $forceUpdate): void
    {
        $exists = DB::table('users')->whereRaw('LOWER(email) = ?', [$email])->first();

        if ($exists !== null && ! $forceUpdate) {
            return;
        }

        $hash = Hash::make($passwordPlain);
        $displayName = $name !== '' ? $name : 'Admin User';

        if ($exists !== null) {
            DB::table('users')->where('id', $exists->id)->update([
                'password' => $hash,
                'full_name' => $displayName,
                'updated_at' => now(),
            ]);

            return;
        }

        $userId = DB::table('users')->insertGetId([
            'email' => $email,
            'password' => $hash,
            'role' => 'admin',
            'full_name' => $displayName,
            'is_active' => 1,
            'created_by' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        if (Schema::hasTable('admin_profiles')) {
            $already = DB::table('admin_profiles')->where('user_id', $userId)->exists();
            if (! $already) {
                DB::table('admin_profiles')->insert([
                    'user_id' => $userId,
                    'position' => 'Administrator',
                    'permissions' => json_encode(['manage_users' => true]),
                    'status' => 'active',
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }
}
