<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Railway / first boot: load database/legacy_seed.sql when the DB has no users yet,
 * so logins match the repo snapshot without setting dashboard env vars.
 *
 * IMPORT_LEGACY_SEED_ON_BOOT:
 * - auto (default): import only when `users` is missing or row count is 0
 * - true: always run fresh import (drops all tables — use for intentional resets)
 * - false: never import
 */
class LegacyImportIfEmpty extends Command
{
    protected $signature = 'legacy:import-if-empty';

    protected $description = 'Import database/legacy_seed.sql when IMPORT_LEGACY_SEED_ON_BOOT allows and DB has no users';

    public function handle(): int
    {
        $raw = (string) env('IMPORT_LEGACY_SEED_ON_BOOT', 'auto');
        $mode = strtolower(trim($raw)) === '' ? 'auto' : strtolower(trim($raw));

        if ($mode === 'false') {
            $this->info('IMPORT_LEGACY_SEED_ON_BOOT=false — skipping legacy SQL import.');

            return self::SUCCESS;
        }

        if ($mode === 'true') {
            $this->warn('IMPORT_LEGACY_SEED_ON_BOOT=true — forcing full legacy import (drops all tables in this database).');

            return $this->runFreshImport();
        }

        if ($mode !== 'auto' && $mode !== '1' && $mode !== 'yes') {
            $this->warn("Unknown IMPORT_LEGACY_SEED_ON_BOOT value \"{$raw}\" — treating as auto.");
        }

        try {
            if (Schema::hasTable('users')) {
                $n = (int) DB::table('users')->count();
                if ($n > 0) {
                    $hasSp = Schema::hasTable('student_profiles');
                    $hasTp = Schema::hasTable('teacher_profiles');
                    $spCount = $hasSp ? (int) DB::table('student_profiles')->count() : 0;
                    $tpCount = $hasTp ? (int) DB::table('teacher_profiles')->count() : 0;

                    // Railway often had only BootstrapAdminSeeder (few users, no profile rows). Legacy dump has profiles.
                    if ($n <= 8 && $spCount === 0 && $tpCount === 0) {
                        $this->warn("IMPORT_LEGACY_SEED_ON_BOOT=auto — {$n} user(s) but no student/teacher profile rows; re-importing legacy_seed.sql (fresh).");

                        return $this->runFreshImport();
                    }

                    $this->info("IMPORT_LEGACY_SEED_ON_BOOT=auto — skipping (users={$n}, student_profiles={$spCount}, teacher_profiles={$tpCount}).");

                    return self::SUCCESS;
                }
            }
        } catch (\Throwable $e) {
            $this->error('IMPORT_LEGACY_SEED_ON_BOOT=auto — cannot reach database to inspect users: '.$e->getMessage());

            return self::FAILURE;
        }

        $this->warn('IMPORT_LEGACY_SEED_ON_BOOT=auto — empty or missing users; importing database/legacy_seed.sql (fresh).');

        return $this->runFreshImport();
    }

    private function runFreshImport(): int
    {
        $code = Artisan::call('app:import-legacy-database', ['--fresh' => true]);
        if ($code !== 0) {
            $this->error('app:import-legacy-database failed.');

            return self::FAILURE;
        }

        $this->line(trim((string) Artisan::output()));
        $this->info('Legacy database import finished.');

        return self::SUCCESS;
    }
}
