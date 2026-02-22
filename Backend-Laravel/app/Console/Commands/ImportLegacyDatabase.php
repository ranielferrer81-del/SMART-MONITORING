<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ImportLegacyDatabase extends Command
{
    protected $signature = 'app:import-legacy-database {--fresh : Drop all tables before importing}';
    protected $description = 'Import the legacy database from database/legacy_seed.sql';

    public function handle()
    {
        $sqlFile = database_path('legacy_seed.sql');

        if (!file_exists($sqlFile)) {
            $this->error("SQL file not found at: {$sqlFile}");
            return 1;
        }

        if ($this->option('fresh')) {
            $this->info('Dropping all tables and views...');
            try {
                DB::statement('SET FOREIGN_KEY_CHECKS=0');

                // Drop views first (they depend on tables)
                $views = DB::select("SHOW FULL TABLES WHERE Table_type = 'VIEW'");
                foreach ($views as $view) {
                    $viewName = array_values((array) $view)[0];
                    DB::statement("DROP VIEW IF EXISTS `{$viewName}`");
                    $this->line("  Dropped view: {$viewName}");
                }

                // Then drop base tables
                $tables = DB::select("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
                foreach ($tables as $table) {
                    $tableName = array_values((array) $table)[0];
                    DB::statement("DROP TABLE IF EXISTS `{$tableName}`");
                    $this->line("  Dropped table: {$tableName}");
                }

                // Also drop stored functions and procedures
                $functions = DB::select("SHOW FUNCTION STATUS WHERE Db = DATABASE()");
                foreach ($functions as $func) {
                    DB::statement("DROP FUNCTION IF EXISTS `{$func->Name}`");
                    $this->line("  Dropped function: {$func->Name}");
                }

                $procedures = DB::select("SHOW PROCEDURE STATUS WHERE Db = DATABASE()");
                foreach ($procedures as $proc) {
                    DB::statement("DROP PROCEDURE IF EXISTS `{$proc->Name}`");
                    $this->line("  Dropped procedure: {$proc->Name}");
                }

                DB::statement('SET FOREIGN_KEY_CHECKS=1');
                $this->info('All objects dropped successfully.');
            } catch (\Exception $e) {
                DB::statement('SET FOREIGN_KEY_CHECKS=1');
                $this->error('Failed during drop phase: ' . $e->getMessage());
                return 1;
            }
        }

        $this->info('Reading SQL file...');
        $sql = file_get_contents($sqlFile);

        // ---- Pre-process the SQL to fix compatibility issues ----

        // 1. Strip DEFINER clauses (Railway MySQL user is not root@localhost)
        $sql = preg_replace('/\bDEFINER\s*=\s*`[^`]*`@`[^`]*`\s*/i', '', $sql);

        // 2. Strip SQL SECURITY DEFINER
        $sql = preg_replace('/\bSQL\s+SECURITY\s+DEFINER\b\s*/i', '', $sql);

        // 3. Fix ALGORITHM=UNDEFINED (not supported in all MySQL versions, just remove it)
        $sql = preg_replace('/\bALGORITHM\s*=\s*UNDEFINED\s*/i', '', $sql);

        // 4. Remove START TRANSACTION and COMMIT (DDL statements can't be in transactions)
        $sql = preg_replace('/^\s*START\s+TRANSACTION\s*;?\s*$/im', '', $sql);
        $sql = preg_replace('/^\s*COMMIT\s*;?\s*$/im', '', $sql);
        $sql = preg_replace('/^\s*ROLLBACK\s*;?\s*$/im', '', $sql);

        // ---- Parse and execute ----
        $statements = $this->parseSql($sql);
        $total = count($statements);
        $this->info("Executing {$total} SQL statements...");

        DB::statement('SET FOREIGN_KEY_CHECKS=0');

        $errors = 0;
        foreach ($statements as $i => $statement) {
            $statement = trim($statement);
            if (empty($statement)) {
                continue;
            }
            try {
                DB::unprepared($statement);
            } catch (\Exception $e) {
                $this->warn("  [" . ($i + 1) . "/{$total}] Warning: " . $e->getMessage());
                $errors++;
            }
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=1');

        if ($errors > 0) {
            $this->warn("Import finished with {$errors} warnings out of {$total} statements.");
        } else {
            $this->info("Import completed successfully! ({$total} statements executed)");
        }

        return 0;
    }

    private function parseSql(string $sql): array
    {
        $statements = [];
        $delimiter = ';';
        $currentStatement = '';
        $lines = explode("\n", $sql);

        foreach ($lines as $line) {
            $trimmedLine = rtrim($line);

            // Skip pure comment lines
            if (preg_match('/^\s*--/', $trimmedLine) || preg_match('/^\s*#/', $trimmedLine)) {
                continue;
            }

            // Handle DELIMITER directive
            if (preg_match('/^\s*DELIMITER\s+(\S+)\s*$/i', $trimmedLine, $matches)) {
                $delimiter = $matches[1];
                continue;
            }

            $currentStatement .= $line . "\n";

            // Check if the accumulated statement ends with the current delimiter
            $trimmedStatement = rtrim($currentStatement);
            if (
                strlen($trimmedStatement) >= strlen($delimiter) &&
                substr($trimmedStatement, -strlen($delimiter)) === $delimiter
            ) {
                // Remove the trailing delimiter
                $stmt = trim(substr($trimmedStatement, 0, -strlen($delimiter)));
                if ($stmt !== '') {
                    $statements[] = $stmt;
                }
                $currentStatement = '';
            }
        }

        // Flush any remaining content
        $remaining = trim($currentStatement);
        if ($remaining !== '') {
            $statements[] = $remaining;
        }

        return $statements;
    }
}
