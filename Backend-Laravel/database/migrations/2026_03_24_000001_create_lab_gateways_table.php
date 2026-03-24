<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (Schema::hasTable('lab_gateways')) {
            return;
        }

        Schema::create('lab_gateways', function (Blueprint $table) {
            $table->id();
            $table->string('gateway_ip', 45)->unique();
            $table->string('laboratory_room', 255);
            $table->string('description', 255)->nullable();
            $table->timestamps();

            $table->index('laboratory_room');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lab_gateways');
    }
};
