<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
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

        $email = strtolower(trim((string) env('BOOTSTRAP_ADMIN_EMAIL', '')));
        $password = (string) env('BOOTSTRAP_ADMIN_PASSWORD', '');
        $name = trim((string) env('BOOTSTRAP_ADMIN_NAME', 'Admin User'));

        if ($email === '' || $password === '') {
            return;
        }

        User::updateOrCreate(
            ['email' => $email],
            [
                'name' => $name !== '' ? $name : 'Admin User',
                'password' => Hash::make($password),
            ]
        );
    }
}
