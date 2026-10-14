<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('presentation_sessions') && !Schema::hasColumn('presentation_sessions', 'subject_id')) {
            Schema::table('presentation_sessions', function (Blueprint $table) {
                $table->unsignedBigInteger('subject_id')->nullable()->after('teacher_user_id');
                $table->index('subject_id');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('presentation_sessions') && Schema::hasColumn('presentation_sessions', 'subject_id')) {
            Schema::table('presentation_sessions', function (Blueprint $table) {
                $table->dropIndex(['subject_id']);
                $table->dropColumn('subject_id');
            });
        }
    }
};
