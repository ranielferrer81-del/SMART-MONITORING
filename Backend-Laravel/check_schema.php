<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    // Get table structure
    $columns = DB::select("DESCRIBE teacher_profiles");

    echo "teacher_profiles table columns:" . PHP_EOL;
    foreach ($columns as $col) {
        echo "- {$col->Field} ({$col->Type})" . PHP_EOL;
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . PHP_EOL;
}
