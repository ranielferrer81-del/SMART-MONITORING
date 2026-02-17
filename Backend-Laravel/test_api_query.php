<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

try {
    // Simulate the exact query from AdminAccountController::indexTeachers
    $teachers = DB::table('users as u')
        ->leftJoin('teacher_profiles as tp', 'tp.user_id', '=', 'u.id')
        ->select('u.id', 'u.full_name', 'u.email', 'u.is_active', 'u.created_at', 'tp.teacher_number', 'tp.department', 'tp.specialization', 'tp.profile_picture')
        ->where('u.role', 'teacher')
        ->orderBy('u.created_at', 'desc')
        ->get();

    echo "API Query Result:" . PHP_EOL;
    echo "Count: " . count($teachers) . PHP_EOL;
    echo PHP_EOL;

    echo "JSON Response (as API would return):" . PHP_EOL;
    echo json_encode(['ok' => true, 'data' => $teachers], JSON_PRETTY_PRINT) . PHP_EOL;

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . PHP_EOL;
    echo $e->getTraceAsString() . PHP_EOL;
}
