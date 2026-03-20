<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\StorageController;

Route::get('/', function () {
    return response()->json(['status' => 'ok', 'message' => 'Laravel is running']);
});

// Simple health check (no database needed)
Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'time' => now()->toIso8601String(),
        'php' => PHP_VERSION,
    ]);
});

// Serve storage files with proper headers (fixes ERR_BLOCKED_BY_ORB with php artisan serve)
Route::get('/storage/{path}', [StorageController::class, 'serve'])->where('path', '.*');

// Easy way to run migrations on Railway without the terminal
Route::get('/run-migrations-for-railway', function () {
    try {
        // Only run our new lab tracking migrations (old tables already exist on Railway)
        \Illuminate\Support\Facades\Artisan::call('migrate', [
            '--force' => true,
            '--path' => [
                'database/migrations/2026_02_26_000001_create_lab_computers_table.php',
                'database/migrations/2026_02_26_000002_add_computer_name_to_monitoring_sessions_table.php',
            ],
        ]);
        return "Migration successful! Result: " . \Illuminate\Support\Facades\Artisan::output();
    } catch (\Exception $e) {
        return "Migration failed: " . $e->getMessage();
    }
});
