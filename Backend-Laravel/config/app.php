<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Application Name
    |--------------------------------------------------------------------------
    |
    | This value is the name of your application, which will be used when the
    | framework needs to place the application's name in a notification or
    | other UI elements where an application name needs to be displayed.
    |
    */

    'name' => env('APP_NAME', 'Laravel'),

    /*
    |--------------------------------------------------------------------------
    | Application Environment
    |--------------------------------------------------------------------------
    |
    | This value determines the "environment" your application is currently
    | running in. This may determine how you prefer to configure various
    | services the application utilizes. Set this in your ".env" file.
    |
    */

    'env' => env('APP_ENV', 'production'),

    /*
    |--------------------------------------------------------------------------
    | Application Debug Mode
    |--------------------------------------------------------------------------
    |
    | When your application is in debug mode, detailed error messages with
    | stack traces will be shown on every error that occurs within your
    | application. If disabled, a simple generic error page is shown.
    |
    */

    'debug' => (bool) env('APP_DEBUG', false),

    /*
    |--------------------------------------------------------------------------
    | Application URL
    |--------------------------------------------------------------------------
    |
    | This URL is used by the console to properly generate URLs when using
    | the Artisan command line tool. You should set this to the root of
    | the application so that it's available within Artisan commands.
    |
    */

    'url' => env('APP_URL', 'http://localhost'),

    /*
    |--------------------------------------------------------------------------
    | Application Timezone
    |--------------------------------------------------------------------------
    |
    | Here you may specify the default timezone for your application, which
    | will be used by the PHP date and date-time functions. The timezone
    | is set to "UTC" by default as it is suitable for most use cases.
    |
    */

    'timezone' => 'UTC',

    /*
    |--------------------------------------------------------------------------
    | Application Locale Configuration
    |--------------------------------------------------------------------------
    |
    | The application locale determines the default locale that will be used
    | by Laravel's translation / localization methods. This option can be
    | set to any locale for which you plan to have translation strings.
    |
    */

    'locale' => env('APP_LOCALE', 'en'),

    'fallback_locale' => env('APP_FALLBACK_LOCALE', 'en'),

    'faker_locale' => env('APP_FAKER_LOCALE', 'en_US'),

    /*
    |--------------------------------------------------------------------------
    | Encryption Key
    |--------------------------------------------------------------------------
    |
    | This key is utilized by Laravel's encryption services and should be set
    | to a random, 32 character string to ensure that all encrypted values
    | are secure. You should do this prior to deploying the application.
    |
    */

    'cipher' => 'AES-256-CBC',

    'key' => env('APP_KEY'),

    'previous_keys' => [
        ...array_filter(
            explode(',', (string) env('APP_PREVIOUS_KEYS', ''))
        ),
    ],

    /*
    |--------------------------------------------------------------------------
    | Maintenance Mode Driver
    |--------------------------------------------------------------------------
    |
    | These configuration options determine the driver used to determine and
    | manage Laravel's "maintenance mode" status. The "cache" driver will
    | allow maintenance mode to be controlled across multiple machines.
    |
    | Supported drivers: "file", "cache"
    |
    */

    'maintenance' => [
        'driver' => env('APP_MAINTENANCE_DRIVER', 'file'),
        'store' => env('APP_MAINTENANCE_STORE', 'database'),
    ],

    /*
    |--------------------------------------------------------------------------
    | Email OTP (use config() in app code — env() is null after config:cache)
    |--------------------------------------------------------------------------
    */

    'auth_login_code_fallback' => filter_var(env('AUTH_LOGIN_CODE_FALLBACK', true), FILTER_VALIDATE_BOOLEAN),

    'verification_email_sync' => filter_var(env('VERIFICATION_EMAIL_SYNC', false), FILTER_VALIDATE_BOOLEAN),

    'verification_resend_sync' => filter_var(env('VERIFICATION_RESEND_SYNC', false), FILTER_VALIDATE_BOOLEAN),

    'mail_diagnostics_in_response' => filter_var(env('MAIL_DIAGNOSTICS_IN_RESPONSE', false), FILTER_VALIDATE_BOOLEAN),

    'email_try_resend_first' => env('EMAIL_TRY_RESEND_FIRST') !== null
        ? filter_var(env('EMAIL_TRY_RESEND_FIRST'), FILTER_VALIDATE_BOOLEAN)
        : filter_var(env('RAILWAY_TRY_RESEND_FIRST', true), FILTER_VALIDATE_BOOLEAN),

    /**
     * Try Laravel SMTP before API mailers. Default false: Railway often cannot reach SMTP:587; use HTTPS APIs instead.
     * Set true only if MAIL_* SMTP reliably works from your host (e.g. some non-Railway VPS).
     */
    'email_otp_try_smtp_first' => filter_var(env('EMAIL_OTP_TRY_SMTP_FIRST', false), FILTER_VALIDATE_BOOLEAN),

    /** On Railway, skip Laravel's SMTP mailer for OTP unless EMAIL_OTP_TRY_SMTP_FIRST=true (587 often blocked/hangs). */
    'email_railway_skip_laravel_smtp' => filter_var(env('EMAIL_RAILWAY_SKIP_LARAVEL_SMTP', true), FILTER_VALIDATE_BOOLEAN),

    /** On Railway, attempt Brevo REST (HTTPS) before Resend when BREVO_API_KEY is set (no SMTP required). */
    'email_try_brevo_before_resend_on_railway' => filter_var(env('EMAIL_TRY_BREVO_BEFORE_RESEND_ON_RAILWAY', true), FILTER_VALIDATE_BOOLEAN),

    /**
     * Wall-clock budget for OTP mail attempts (seconds).
     *
     * Keep this tight so desktop login never feels hung when providers are slow.
     * Override with VERIFICATION_MAIL_TIME_BUDGET_SECONDS in environments that need more time.
     */
    'verification_mail_time_budget_seconds' => max(8.0, min(120.0, (float) (env('VERIFICATION_MAIL_TIME_BUDGET_SECONDS') ?: 25))),

];
