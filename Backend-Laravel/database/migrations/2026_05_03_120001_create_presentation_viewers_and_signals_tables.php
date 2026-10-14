<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('presentation_viewers')) {
            Schema::create('presentation_viewers', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presentation_session_id');
                $table->unsignedInteger('student_user_id');
                $table->timestamp('joined_at')->useCurrent();
                $table->timestamps();

                $table->unique(['presentation_session_id', 'student_user_id'], 'pv_session_student_unique');
                $table->foreign('presentation_session_id')->references('id')->on('presentation_sessions')->onDelete('cascade');
                $table->foreign('student_user_id')->references('id')->on('users')->onDelete('cascade');
                $table->index('presentation_session_id');
            });
        }

        if (! Schema::hasTable('presentation_signaling_messages')) {
            Schema::create('presentation_signaling_messages', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('presentation_session_id');
                $table->unsignedInteger('sender_user_id')->nullable(); // nullable for broadcast hangup
                $table->unsignedInteger('recipient_user_id')->nullable(); // null = broadcast hangup etc.
                $table->string('message_type', 32); // offer | answer | iceCandidate | hangup
                $table->mediumText('payload')->nullable(); // JSON
                $table->timestamp('created_at')->useCurrent();

                $table->foreign('presentation_session_id')->references('id')->on('presentation_sessions')->onDelete('cascade');
                $table->index(['presentation_session_id', 'id'], 'psm_session_id_idx');
                $table->index(['presentation_session_id', 'recipient_user_id', 'id'], 'psm_session_recipient_id_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('presentation_signaling_messages');
        Schema::dropIfExists('presentation_viewers');
    }
};
