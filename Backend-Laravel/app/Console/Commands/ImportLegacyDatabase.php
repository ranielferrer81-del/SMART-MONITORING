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
            $this->info('Dropping all tables...');
            DB::statement('SET FOREIGN_KEY_CHECKS=0;');

            $tables = DB::select('SHOW TABLES');
            foreach ($tables as $table) {
                $tableName = array_values((array)$table)[0];
                DB::statement("DROP TABLE IF EXISTS `{$tableName}`");
                DB::statement("DROP VIEW IF EXISTS `{$tableName}`");
            }

            DB::statement('SET FOREIGN_KEY_CHECKS=1;');
            $this->info('All tables dropped.');
        }

        $this->info('Reading SQL file...');
        $sql = file_get_contents($sqlFile);

        // Parse SQL handling DELIMITER statements for stored procedures, functions, triggers
        $statements = $this->parseSql($sql);

        $this->info('Executing ' . count($statements) . ' SQL statements...');

        DB::statement('SET FOREIGN_KEY_CHECKS=0;');

        $errors = 0;
        foreach ($statements as $i => $statement) {
            $statement = trim($statement);
            if (empty($statement)) {
                continue;
            }
            try {
                DB::unprepared($statement);
            } catch (\Exception $e) {
                $this->warn("Statement " . ($i + 1) . " failed: " . $e->getMessage());
                $errors++;
            }
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        if ($errors > 0) {
            $this->warn("Import completed with {$errors} warnings (some statements may have been skipped).");
        } else {
            $this->info('Import completed successfully!');
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
            $trimmedLine = trim($line);

            // Skip empty lines and comments
            if (empty($trimmedLine) || str_starts_with($trimmedLine, '--') || str_starts_with($trimmedLine, '#')) {
                continue;
            }

            // Handle DELIMITER changes
            if (preg_match('/^DELIMITER\s+(.+)$/i', $trimmedLine, $matches)) {
                $delimiter = trim($matches[1]);
                continue;
            }

            $currentStatement .= $line . "\n";

            // Check if current statement ends with the delimiter
            if (str_ends_with(rtrim($currentStatement), $delimiter)) {
                // Remove the trailing delimiter
                $stmt = rtrim($currentStatement);
                $stmt = substr($stmt, 0, strlen($stmt) - strlen($delimiter));
                $stmt = trim($stmt);

                if (!empty($stmt)) {
                    $statements[] = $stmt;
                }
                $currentStatement = '';
            }
        }

        // Add any remaining statement
        if (!empty(trim($currentStatement))) {
            $statements[] = trim($currentStatement);
        }

        return $statements;
    }
}
