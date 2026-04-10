<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('attendance_logs')) {
            return;
        }

        try {
            Schema::table('attendance_logs', function (Blueprint $table) {
                if (! Schema::hasColumn('attendance_logs', 'source')) {
                    $table->string('source', 20)->default('manual')->after('status');
                }
                if (! Schema::hasColumn('attendance_logs', 'marked_by_user_id')) {
                    $table->unsignedBigInteger('marked_by_user_id')->nullable()->after('teacher_user_id');
                }
                if (! Schema::hasColumn('attendance_logs', 'mark_reason')) {
                    $table->string('mark_reason', 255)->nullable()->after('source');
                }
            });
        } catch (QueryException $e) {
            $msg = $e->getMessage();
            if (! str_contains($msg, 'Duplicate column name') && ! str_contains($msg, '1060')) {
                throw $e;
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('attendance_logs')) {
            return;
        }

        try {
            Schema::table('attendance_logs', function (Blueprint $table) {
                if (Schema::hasColumn('attendance_logs', 'mark_reason')) {
                    $table->dropColumn('mark_reason');
                }
                if (Schema::hasColumn('attendance_logs', 'marked_by_user_id')) {
                    $table->dropColumn('marked_by_user_id');
                }
                if (Schema::hasColumn('attendance_logs', 'source')) {
                    $table->dropColumn('source');
                }
            });
        } catch (QueryException) {
            // Ignore rollback issues on legacy databases.
        }
    }
};

