<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class HandleCors
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Minimal, reliable CORS implementation for Railway deployments.
        // Ensures preflight requests always include Access-Control-Allow-Origin.
        $allowOrigin = '*';
        $allowMethods = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';

        // Echo requested headers when available to avoid "not allowed header" preflight failures.
        $allowHeaders = $request->header('Access-Control-Request-Headers')
            ?? 'Content-Type, Authorization, X-Requested-With, Accept';

        $baseHeaders = [
            'Access-Control-Allow-Origin' => $allowOrigin,
            'Access-Control-Allow-Methods' => $allowMethods,
            'Access-Control-Allow-Headers' => $allowHeaders,
            'Access-Control-Max-Age' => '86400',
            // Help caches/proxies understand the header depends on Origin/request headers.
            'Vary' => 'Origin, Access-Control-Request-Headers',
        ];

        if ($request->getMethod() === 'OPTIONS') {
            return response('', 204, $baseHeaders);
        }

        $response = $next($request);

        foreach ($baseHeaders as $k => $v) {
            $response->headers->set($k, $v);
        }

        // Release PHP CLI worker immediately so persistent browser keep-alive connections
        // cannot monopolize worker threads and starve the Desktop App.
        $response->headers->set('Connection', 'close');

        return $response;
    }
}
