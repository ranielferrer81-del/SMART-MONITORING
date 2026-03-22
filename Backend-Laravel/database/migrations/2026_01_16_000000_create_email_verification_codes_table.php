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
        // Duplicate of 2024 migration name/table; skip if first migration already created the table.
        if (Schema::hasTable('email_verification_codes')) {
            return;
        }

        Schema::create('email_verification_codes', function (Blueprint $table) {
            $table->id();
            $table->string('email', 191)->index();
            $table->string('code', 6);
            $table->timestamp('expires_at');
            $table->boolean('used')->default(false);
            $table->timestamps();

            $table->index(['email', 'code', 'used']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('email_verification_codes');
    }
};

