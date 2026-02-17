<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    $teachers = DB::table('users')->where('role', 'teacher')->get();
    echo "Teachers count: " . count($teachers) . PHP_EOL;

    foreach ($teachers as $t) {
        echo "ID: {$t->id} | Name: {$t->full_name} | Email: {$t->email}" . PHP_EOL;
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . PHP_EOL;
}
