<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    $columns = DB::select("SHOW COLUMNS FROM teacher_profiles");

    echo "teacher_profiles columns:" . PHP_EOL;
    $hasProfilePicture = false;
    foreach ($columns as $col) {
        echo "- " . $col->Field . PHP_EOL;
        if ($col->Field === 'profile_picture') {
            $hasProfilePicture = true;
        }
    }

    echo PHP_EOL;
    if ($hasProfilePicture) {
        echo "✓ profile_picture column EXISTS" . PHP_EOL;
    } else {
        echo "✗ profile_picture column MISSING - This is the problem!" . PHP_EOL;
        echo "Solution: Run 'php artisan migrate' to add the missing column" . PHP_EOL;
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . PHP_EOL;
}
