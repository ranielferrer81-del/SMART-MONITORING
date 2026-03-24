<?php

namespace Database\Seeders;

use App\Models\LabGateway;
use Illuminate\Database\Seeder;

/**
 * Default gateway → laboratory name mappings for browser monitoring.
 *
 * Run after migrations:
 *   php artisan db:seed --class=LabGatewaySeeder
 *
 * Safe to run more than once: uses firstOrCreate on gateway_ip only.
 * Edit the rows below to match your campus/home test layout.
 */
class LabGatewaySeeder extends Seeder
{
    public function run(): void
    {
        $mappings = [
            [
                'gateway_ip' => '192.168.1.1',
                'laboratory_room' => 'Laboratory 1',
                'description' => 'Main home router / primary Wi‑Fi (typical 192.168.1.x LAN)',
            ],
            [
                'gateway_ip' => '192.168.110.1',
                'laboratory_room' => 'Laboratory 2',
                'description' => 'Second-router subnet (your test lab network 192.168.110.x)',
            ],
        ];

        foreach ($mappings as $row) {
            LabGateway::firstOrCreate(
                ['gateway_ip' => $row['gateway_ip']],
                [
                    'laboratory_room' => $row['laboratory_room'],
                    'description' => $row['description'],
                ]
            );
        }
    }
}
