<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('lab_computers')) {
            return;
        }

        // Safely drop unique index from computer_name if it exists.
        try {
            DB::statement('ALTER TABLE lab_computers DROP INDEX lab_computers_computer_name_unique');
        } catch (\Throwable $e) {
            // Ignore if index is already missing.
        }

        Schema::table('lab_computers', function (Blueprint $table) {
            if (!Schema::hasColumn('lab_computers', 'display_name')) {
                $table->string('display_name', 255)->nullable()->after('computer_name');
            }
        });

        // Backfill display_name from computer_name for existing rows.
        DB::table('lab_computers')
            ->whereNull('display_name')
            ->update(['display_name' => DB::raw('computer_name')]);

        // Enforce per-lab uniqueness.
        Schema::table('lab_computers', function (Blueprint $table) {
            $table->unique(['computer_name', 'laboratory_room'], 'lab_computers_name_room_unique');
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('lab_computers')) {
            return;
        }

        try {
            DB::statement('ALTER TABLE lab_computers DROP INDEX lab_computers_name_room_unique');
        } catch (\Throwable $e) {
            // Ignore if index is already missing.
        }

        Schema::table('lab_computers', function (Blueprint $table) {
            if (Schema::hasColumn('lab_computers', 'display_name')) {
                $table->dropColumn('display_name');
            }
        });

        // Restore old global uniqueness on computer_name.
        Schema::table('lab_computers', function (Blueprint $table) {
            $table->unique('computer_name', 'lab_computers_computer_name_unique');
        });
    }
};
