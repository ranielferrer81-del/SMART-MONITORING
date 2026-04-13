<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\StorageController;

// Explicit CORS preflight handler for ALL routes - safety net
Route::options('/{any}', function () {
    return response('', 200)
        ->header('Access-Control-Allow-Origin', '*')
        ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept')
        ->header('Access-Control-Max-Age', '86400');
})->where('any', '.*');

Route::get('/', function () {
    return response()->json(['status' => 'ok', 'message' => 'Laravel is running']);
});

// /health is handled by Laravel's built-in health route in bootstrap/app.php.

// Serve storage files with proper headers (fixes ERR_BLOCKED_BY_ORB with php artisan serve)
Route::get('/storage/{path}', [StorageController::class, 'serve'])->where('path', '.*');

