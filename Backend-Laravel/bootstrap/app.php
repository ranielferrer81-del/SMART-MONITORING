<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/health',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Railway (and other edge proxies) terminate TLS; without this, Laravel sees http://
        // and may issue 302 Location: http://... on API POSTs, breaking axios redirects.
        $middleware->trustProxies(at: '*');
        // Use our explicit middleware so CORS headers are always present on Railway.
        $middleware->prepend(\App\Http\Middleware\HandleCors::class);
        // Token auth (Bearer via Sanctum) — not cookie/CSRF SPA login. statefulApi() would
        // require /sanctum/csrf-cookie before POST /api/login from localhost:3000.
        // $middleware->statefulApi();
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
