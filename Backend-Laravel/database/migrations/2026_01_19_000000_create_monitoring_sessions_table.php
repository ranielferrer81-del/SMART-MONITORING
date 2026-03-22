<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('monitoring_sessions')) {
            return;
        }

        Schema::create('monitoring_sessions', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('student_user_id');
            $table->timestamp('session_start');
            $table->timestamp('session_end')->nullable();
            $table->json('device_info')->nullable();
            $table->boolean('is_active')->default(true);
            $table->string('session_name', 255)->nullable(); // e.g., "Math Quiz - Jan 19"
            $table->unsignedInteger('created_by')->nullable(); // teacher who started session
            $table->timestamps();

            $table->foreign('student_user_id')->references('id')->on('users')->onDelete('cascade');
            $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');

            $table->index('student_user_id');
            $table->index('is_active');
            $table->index('session_start');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('monitoring_sessions');
    }
};
