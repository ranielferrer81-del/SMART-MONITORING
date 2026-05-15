<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

class BootstrapAdminSeeder extends Seeder
{
    /**
     * Create or update a bootstrap admin account from environment variables.
     */
    public function run(): void
    {
        if (!Schema::hasTable('users')) {
            return;
        }

        $password = (string) env('BOOTSTRAP_ADMIN_PASSWORD', '');
        if ($password === '') {
            return;
        }

        $emailRaw = env('BOOTSTRAP_ADMIN_EMAIL');
        $email = strtolower(
            trim($emailRaw !== null && (string) $emailRaw !== '' ? (string) $emailRaw : 'admin@example.com'),
        );
        $name = trim((string) env('BOOTSTRAP_ADMIN_NAME', 'Admin User'));

        // User model uses 'password' => 'hashed' — pass plaintext, not Hash::make (avoids double-hash).
        User::updateOrCreate(
            ['email' => $email],
            [
                'name' => $name !== '' ? $name : 'Admin User',
                'password' => $password,
            ]
        );
    }
}
