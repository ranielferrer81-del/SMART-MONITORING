<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (! Schema::hasTable('teacher_profiles') || Schema::hasColumn('teacher_profiles', 'profile_picture')) {
            return;
        }

        Schema::table('teacher_profiles', function (Blueprint $table) {
            $table->longText('profile_picture')->nullable()->after('specialization');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (! Schema::hasTable('teacher_profiles') || ! Schema::hasColumn('teacher_profiles', 'profile_picture')) {
            return;
        }

        Schema::table('teacher_profiles', function (Blueprint $table) {
            $table->dropColumn('profile_picture');
        });
    }
};
