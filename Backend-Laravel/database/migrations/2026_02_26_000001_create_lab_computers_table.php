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
        if (Schema::hasTable('lab_computers')) {
            return;
        }

        Schema::create('lab_computers', function (Blueprint $table) {
            $table->id();
            $table->string('computer_name', 255)->unique(); // e.g., "LAB2-PC-15"
            $table->string('laboratory_room', 255);          // e.g., "Lab 2"
            $table->timestamps();

            $table->index('computer_name');
            $table->index('laboratory_room');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('lab_computers');
    }
};
