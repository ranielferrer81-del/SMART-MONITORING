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
        DB::statement('ALTER TABLE monitoring_sessions MODIFY session_start TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;');
        if (Schema::hasTable('screen_monitor_frames')) {
            DB::statement('ALTER TABLE screen_monitor_frames MODIFY captured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;');
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Reverting this is not strictly necessary, but if we did, we'd add it back.
        // Doing nothing is safer than breaking existing sessions again.
    }
};
