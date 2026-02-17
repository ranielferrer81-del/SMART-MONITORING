<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    // Test each column individually
    $columns_to_test = [
        'u.id',
        'u.full_name',
        'u.email',
        'u.is_active',
        'u.created_at',
        'tp.teacher_number',
        'tp.department',
        'tp.specialization',
        'tp.profile_picture'
    ];

    foreach ($columns_to_test as $col) {
        try {
            $result = DB::table('users as u')
                ->leftJoin('teacher_profiles as tp', 'tp.user_id', '=', 'u.id')
                ->select($col)
                ->where('u.role', 'teacher')
                ->first();
            echo "✓ {$col} - OK" . PHP_EOL;
        } catch (Exception $e) {
            echo "✗ {$col} - ERROR: " . $e->getMessage() . PHP_EOL;
        }
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . PHP_EOL;
}
