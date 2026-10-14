<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('screen_monitor_frames')) {
            return;
        }

        Schema::create('screen_monitor_frames', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('student_user_id')->unique();
            $table->unsignedBigInteger('monitoring_session_id')->nullable();
            $table->string('storage_path', 512);
            $table->string('computer_name', 255)->nullable();
            $table->string('laboratory_room', 255)->nullable();
            $table->unsignedSmallInteger('width')->nullable();
            $table->unsignedSmallInteger('height')->nullable();
            $table->timestamp('captured_at');
            $table->timestamps();

            $table->foreign('student_user_id')->references('id')->on('users')->onDelete('cascade');
            $table->index('laboratory_room');
            $table->index('captured_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('screen_monitor_frames');
    }
};
