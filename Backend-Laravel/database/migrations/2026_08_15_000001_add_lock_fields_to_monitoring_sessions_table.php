<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monitoring_sessions', function (Blueprint $table) {
            $table->boolean('is_locked')->default(false)->after('is_active');
            $table->text('lock_message')->nullable()->after('is_locked');
            $table->unsignedInteger('locked_by')->nullable()->after('lock_message');
            $table->timestamp('locked_at')->nullable()->after('locked_by');

            $table->foreign('locked_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('monitoring_sessions', function (Blueprint $table) {
            $table->dropForeign(['locked_by']);
            $table->dropColumn(['is_locked', 'lock_message', 'locked_by', 'locked_at']);
        });
    }
};
