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
    $brevoKey = config('services.brevo.key') ?: getenv('BREVO_API_KEY');
    $senderEmail = config('services.brevo.sender') ?: getenv('BREVO_SENDER_EMAIL') ?: config('mail.from.address') ?: getenv('MAIL_FROM_ADDRESS');

    $config = [
        'MAIL_MAILER' => config('mail.default'),
        'MAIL_HOST' => config('mail.mailers.smtp.host'),
        'MAIL_PORT' => config('mail.mailers.smtp.port'),
        'MAIL_USERNAME' => config('mail.mailers.smtp.username') ? substr(config('mail.mailers.smtp.username'), 0, 10) . '...' : '(empty)',
        'MAIL_PASSWORD_LENGTH' => strlen(config('mail.mailers.smtp.password') ?? ''),
        'MAIL_FROM_ADDRESS' => config('mail.from.address'),
        'BREVO_API_KEY_LENGTH' => strlen($brevoKey ?: ''),
        'BREVO_SENDER_EMAIL' => $senderEmail,
        'SMTP_NOTE' => 'SMTP ports blocked on Railway - only REST APIs work',
    ];

    $results = [];

    // Test 1: Brevo REST API
    if ($brevoKey) {
        $payload = json_encode([
            'sender' => ['email' => $senderEmail, 'name' => 'SIA System'],
            'to' => [['email' => $senderEmail]],
            'subject' => 'Railway Email Test',
            'htmlContent' => '<p>Test email from Railway diagnostic.</p>',
        ]);

        $ch = curl_init('https://api.brevo.com/v3/smtp/email');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_HTTPHEADER => [
                'api-key: ' . $brevoKey,
                'Content-Type: application/json',
                'Accept: application/json',
            ],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 15,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        curl_close($ch);

        $results['brevo_rest'] = [
            'http_code' => $httpCode,
            'response' => json_decode($response, true) ?: $response,
            'curl_error' => $curlError ?: null,
            'sender_used' => $senderEmail,
        ];
    } else {
        $results['brevo_rest'] = 'BREVO_API_KEY not set';
    }

    // Test 2: Brevo account info
    if ($brevoKey) {
        $ch = curl_init('https://api.brevo.com/v3/account');
        curl_setopt_array($ch, [
            CURLOPT_HTTPHEADER => ['api-key: ' . $brevoKey, 'Accept: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
        ]);
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        $acct = json_decode($response, true);
        $results['brevo_account'] = [
            'http_code' => $httpCode,
            'email' => $acct['email'] ?? null,
            'plan' => $acct['plan'] ?? null,
        ];
    }

    return response()->json([
        'config' => $config,
        'results' => $results,
    ], 200, [], JSON_PRETTY_PRINT);
});

