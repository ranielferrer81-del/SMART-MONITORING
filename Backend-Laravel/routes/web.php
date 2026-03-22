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

// Temporary diagnostic route to debug email sending on Railway
Route::get('/test-email-debug', function () {
    $config = [
        'MAIL_MAILER' => config('mail.default'),
        'MAIL_HOST' => config('mail.mailers.smtp.host'),
        'MAIL_PORT' => config('mail.mailers.smtp.port'),
        'MAIL_USERNAME' => config('mail.mailers.smtp.username') ? substr(config('mail.mailers.smtp.username'), 0, 10) . '...' : '(empty)',
        'MAIL_PASSWORD_LENGTH' => strlen(config('mail.mailers.smtp.password') ?? ''),
        'MAIL_ENCRYPTION' => config('mail.mailers.smtp.encryption'),
        'MAIL_FROM_ADDRESS' => config('mail.from.address'),
        'MAIL_FROM_NAME' => config('mail.from.name'),
        'BREVO_API_KEY_SET' => !empty(config('services.brevo.key')),
        'ENV_MAIL_USERNAME' => getenv('MAIL_USERNAME') ? substr(getenv('MAIL_USERNAME'), 0, 10) . '...' : '(not in env)',
        'ENV_MAIL_PASSWORD_LEN' => strlen(getenv('MAIL_PASSWORD') ?: ''),
    ];

    $testResult = 'Not attempted';
    $errorDetail = null;

    try {
        \Illuminate\Support\Facades\Config::set('mail.mailers.test_gmail', [
            'transport' => 'smtp',
            'host' => 'smtp.gmail.com',
            'port' => 587,
            'encryption' => 'tls',
            'username' => config('mail.mailers.smtp.username'),
            'password' => config('mail.mailers.smtp.password'),
            'timeout' => 15,
        ]);

        $from = config('mail.from.address', config('mail.mailers.smtp.username'));
        $html = '<p>Test email from Railway diagnostic endpoint.</p>';

        \Illuminate\Support\Facades\Mail::mailer('test_gmail')->html($html, function ($message) use ($from) {
            $message->to($from)
                ->subject('Railway Email Test')
                ->from($from, 'SIA System Test');
        });

        $testResult = 'SUCCESS - Email sent!';
    } catch (\Throwable $e) {
        $testResult = 'FAILED';
        $errorDetail = $e->getMessage();
    }

    return response()->json([
        'config' => $config,
        'test_result' => $testResult,
        'error' => $errorDetail,
    ], 200, [], JSON_PRETTY_PRINT);
});

