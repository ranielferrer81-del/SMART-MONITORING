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
        Schema::create('incognito_alerts', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('student_user_id');
            $table->timestamp('detected_at');
            $table->unsignedBigInteger('session_id')->nullable();
            $table->boolean('is_acknowledged')->default(false);
            $table->timestamps();

            $table->foreign('student_user_id')->references('id')->on('users')->onDelete('cascade');
            // Foreign key for session_id will be added in a separate migration

            $table->index('student_user_id');
            $table->index('detected_at');
            $table->index('is_acknowledged');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('incognito_alerts');
    }
};
