<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
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
        $password = $explicit !== '' ? $explicit : ($fallbackAllowed ? $dbPassword : '');

        if ($password === '') {
            return;
        }

        $exists = User::whereRaw('LOWER(email) = ?', [$email])->first();

        if ($exists !== null && ! $forceUpdate) {
            return;
        }

        // User model uses 'password' => 'hashed' — pass plaintext, not Hash::make (avoids double-hash).
        if ($exists !== null) {
            $exists->update([
                'name' => $name !== '' ? $name : 'Admin User',
                'password' => $password,
            ]);

            return;
        }

        User::create([
            'email' => $email,
            'name' => $name !== '' ? $name : 'Admin User',
            'password' => $password,
        ]);
    }
}
