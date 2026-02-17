<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\StorageController;

Route::get('/', function () {
    return view('welcome');
});

// Serve storage files with proper headers (fixes ERR_BLOCKED_BY_ORB with php artisan serve)
Route::get('/storage/{path}', [StorageController::class, 'serve'])->where('path', '.*');
