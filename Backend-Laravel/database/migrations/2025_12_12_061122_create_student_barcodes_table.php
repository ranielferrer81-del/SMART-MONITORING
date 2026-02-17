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
        } else {
            // Table exists, just ensure foreign key exists
            Schema::table('student_barcodes', function (Blueprint $table) {
                if (!Schema::hasColumn('student_barcodes', 'user_id')) {
                    $table->unsignedInteger('user_id')->after('id');
                }
                if (!Schema::hasColumn('student_barcodes', 'barcode')) {
                    $table->string('barcode', 50)->unique()->after('user_id');
                }
                if (!Schema::hasColumn('student_barcodes', 'expires_at')) {
                    $table->timestamp('expires_at')->nullable()->after('barcode');
                }
                if (!Schema::hasColumn('student_barcodes', 'used')) {
                    $table->boolean('used')->default(false)->after('expires_at');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('student_barcodes');
    }
};
