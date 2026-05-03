<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('presentation_sessions')) {
            return;
        }

        Schema::create('presentation_sessions', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_uuid')->unique();
            $table->unsignedBigInteger('teacher_user_id');
            $table->string('status', 20)->default('active'); // active | ended
            $table->timestamps();

            $table->foreign('teacher_user_id')->references('id')->on('users')->onDelete('cascade');
            $table->index(['teacher_user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('presentation_sessions');
    }
};
