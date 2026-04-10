<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::dropIfExists('student_barcodes');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (!Schema::hasTable('student_barcodes')) {
            Schema::create('student_barcodes', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('user_id');
                $table->string('barcode', 50)->unique();
                $table->timestamp('expires_at')->nullable();
                $table->boolean('used')->default(false);
                $table->timestamps();

                $table->foreign('user_id')->references('id')->on('users')->onDelete('cascade');
                $table->index('barcode');
                $table->index('user_id');
            });
        }
    }
};

