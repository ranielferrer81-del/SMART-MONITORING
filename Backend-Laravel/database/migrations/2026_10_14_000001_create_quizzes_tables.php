<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('quizzes')) {
            Schema::create('quizzes', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('teacher_user_id');
                $table->unsignedBigInteger('subject_id')->nullable()->index();
                $table->string('title', 255);
                $table->text('description')->nullable();
                $table->string('module_filename', 255)->nullable();
                $table->unsignedInteger('time_limit_minutes')->default(15); // 0 = untimed
                $table->unsignedInteger('passing_percentage')->default(60);
                $table->string('status', 20)->default('draft'); // draft | active | closed
                $table->timestamp('started_at')->nullable();
                $table->timestamp('ended_at')->nullable();
                $table->timestamps();

                $table->index(['teacher_user_id', 'status']);
                $table->index(['subject_id', 'status']);
            });
        }

        if (! Schema::hasTable('quiz_questions')) {
            Schema::create('quiz_questions', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('quiz_id')->index();
                $table->text('question_text');
                $table->json('options');
                $table->text('correct_answer');
                $table->text('explanation')->nullable();
                $table->unsignedInteger('points')->default(1);
                $table->unsignedInteger('order_index')->default(0);
                $table->timestamps();

                $table->foreign('quiz_id')->references('id')->on('quizzes')->onDelete('cascade');
            });
        }

        if (! Schema::hasTable('quiz_attempts')) {
            Schema::create('quiz_attempts', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('quiz_id')->index();
                $table->unsignedInteger('student_user_id')->index();
                $table->string('status', 20)->default('in_progress'); // in_progress | completed | timed_out
                $table->unsignedInteger('score')->default(0);
                $table->unsignedInteger('total_points')->default(0);
                $table->decimal('percentage', 5, 2)->default(0);
                $table->json('submitted_answers')->nullable();
                $table->timestamp('started_at')->nullable();
                $table->timestamp('submitted_at')->nullable();
                $table->timestamps();

                $table->unique(['quiz_id', 'student_user_id']);
                $table->foreign('quiz_id')->references('id')->on('quizzes')->onDelete('cascade');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('quiz_attempts');
        Schema::dropIfExists('quiz_questions');
        Schema::dropIfExists('quizzes');
    }
};
