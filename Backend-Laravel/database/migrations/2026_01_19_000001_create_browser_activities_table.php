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
        if (Schema::hasTable('browser_activities')) {
            return;
        }

        Schema::create('browser_activities', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('student_user_id');
            $table->text('url');
            $table->string('page_title', 500)->nullable();
            $table->timestamp('visit_timestamp');
            $table->integer('duration_seconds')->nullable();
            $table->string('tab_id', 50)->nullable();
            $table->boolean('is_incognito')->default(false);
            $table->unsignedBigInteger('session_id')->nullable();
            $table->timestamps();

            $table->foreign('student_user_id')->references('id')->on('users')->onDelete('cascade');
            // Foreign key for session_id will be added in a separate migration after monitoring_sessions table exists

            $table->index('student_user_id');
            $table->index('visit_timestamp');
            $table->index('session_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('browser_activities');
    }
};
