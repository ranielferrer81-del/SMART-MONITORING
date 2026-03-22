<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Base64 profile images exceed VARCHAR(255). LONGTEXT matches existing /fix-profile-columns behavior.
     */
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            return;
        }

        DB::statement('ALTER TABLE teacher_profiles MODIFY profile_picture LONGTEXT NULL');

        if (Schema::hasColumn('student_profiles', 'profile_picture')) {
            DB::statement('ALTER TABLE student_profiles MODIFY profile_picture LONGTEXT NULL');
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            return;
        }

        DB::statement('ALTER TABLE teacher_profiles MODIFY profile_picture VARCHAR(255) NULL');

        if (Schema::hasColumn('student_profiles', 'profile_picture')) {
            DB::statement('ALTER TABLE student_profiles MODIFY profile_picture VARCHAR(255) NULL');
        }
    }
};
