<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Fresh installs had no migration creating `teacher_profiles`, while later migrations
     * alter it — Railway migrate then failed with "table doesn't exist".
     */
    public function up(): void
    {
        if (Schema::hasTable('teacher_profiles')) {
            return;
        }

        Schema::create('teacher_profiles', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->primary();
            $table->string('teacher_number', 50);
            $table->string('department', 100)->nullable();
            $table->string('specialization', 255)->nullable();
            $table->longText('profile_picture')->nullable();
            $table->enum('status', ['active', 'inactive', 'on_leave'])->default('active');
            $table->timestamps();

            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();

            $table->unique('teacher_number');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('teacher_profiles');
    }
};
