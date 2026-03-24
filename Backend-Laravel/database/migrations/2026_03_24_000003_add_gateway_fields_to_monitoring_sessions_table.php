<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        if (!Schema::hasTable('monitoring_sessions')) {
            return;
        }

        Schema::table('monitoring_sessions', function (Blueprint $table) {
            if (!Schema::hasColumn('monitoring_sessions', 'gateway_ip')) {
                $table->string('gateway_ip', 45)->nullable()->after('computer_name');
                $table->index('gateway_ip');
            }

            if (!Schema::hasColumn('monitoring_sessions', 'laboratory_room')) {
                $table->string('laboratory_room', 255)->nullable()->after('gateway_ip');
                $table->index('laboratory_room');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('monitoring_sessions')) {
            return;
        }

        Schema::table('monitoring_sessions', function (Blueprint $table) {
            if (Schema::hasColumn('monitoring_sessions', 'laboratory_room')) {
                $table->dropIndex(['laboratory_room']);
                $table->dropColumn('laboratory_room');
            }
            if (Schema::hasColumn('monitoring_sessions', 'gateway_ip')) {
                $table->dropIndex(['gateway_ip']);
                $table->dropColumn('gateway_ip');
            }
        });
    }
};
