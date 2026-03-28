<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Ensures default gateway → lab rows exist on fresh or Railway DBs without requiring db:seed.
 * Only inserts when gateway_ip is absent — never overwrites admin-customized mappings.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('lab_gateways')) {
            return;
        }

        $defaults = [
            [
                'gateway_ip' => '192.168.1.1',
                'laboratory_room' => 'Laboratory 1',
                'description' => 'Main home router / primary Wi‑Fi (typical 192.168.1.x LAN)',
            ],
            [
                'gateway_ip' => '192.168.110.1',
                'laboratory_room' => 'Laboratory 2',
                'description' => 'Second-router subnet (192.168.110.x)',
            ],
        ];

        $now = now();

        foreach ($defaults as $row) {
            $exists = DB::table('lab_gateways')->where('gateway_ip', $row['gateway_ip'])->exists();
            if ($exists) {
                continue;
            }

            DB::table('lab_gateways')->insert([
                'gateway_ip' => $row['gateway_ip'],
                'laboratory_room' => $row['laboratory_room'],
                'description' => $row['description'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        // Intentionally empty: do not delete rows on rollback (may be edited in production).
    }
};
