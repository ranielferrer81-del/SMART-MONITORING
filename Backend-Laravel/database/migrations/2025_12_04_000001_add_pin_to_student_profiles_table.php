<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('student_profiles')) {
            return;
        }

        // Prefer a cheap check, but Railway/MySQL sometimes still runs ADD (hasColumn out of sync).
        // Treat "duplicate column" as success so migrate can finish and record this migration.
        if (Schema::hasColumn('student_profiles', 'pin')) {
            return;
        }

        try {
            Schema::table('student_profiles', function (Blueprint $table) {
                // Store a hashed 4-digit PIN; nullable so existing students are unaffected.
                $table->string('pin', 100)->nullable()->after('section');
            });
        } catch (QueryException $e) {
            $sqlState = $e->errorInfo[0] ?? '';
            $msg = $e->getMessage();
            if ($sqlState === '42S21' || str_contains($msg, 'Duplicate column name') || str_contains($msg, '1060')) {
                return;
            }
            throw $e;
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('student_profiles')) {
            return;
        }

        if (! Schema::hasColumn('student_profiles', 'pin')) {
            return;
        }

        try {
            Schema::table('student_profiles', function (Blueprint $table) {
                $table->dropColumn('pin');
            });
        } catch (QueryException $e) {
            $msg = $e->getMessage();
            if (str_contains($msg, "check that column/key exists") || str_contains($msg, '1091') || str_contains($msg, 'Unknown column')) {
                return;
            }
            throw $e;
        }
    }
};
