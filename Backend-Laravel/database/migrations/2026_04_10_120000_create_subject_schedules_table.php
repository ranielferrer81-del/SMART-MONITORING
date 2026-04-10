<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\QueryException;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('subject_schedules')) {
            return;
        }

        Schema::create('subject_schedules', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('subject_id');
            $table->unsignedTinyInteger('day_of_week'); // 0 = Sunday ... 6 = Saturday
            $table->time('start_time');
            $table->time('end_time');
            $table->unsignedSmallInteger('late_grace_minutes')->default(15);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index('subject_id');
            $table->index(['subject_id', 'day_of_week', 'is_active'], 'subject_schedule_lookup_idx');
            $table->unique(['subject_id', 'day_of_week', 'start_time', 'end_time'], 'subject_schedule_unique_slot');
        });
    }

    public function down(): void
    {
        if (! Schema::hasTable('subject_schedules')) {
            return;
        }

        try {
            Schema::drop('subject_schedules');
        } catch (QueryException) {
            // Keep rollback resilient on partially managed databases.
        }
    }
};

