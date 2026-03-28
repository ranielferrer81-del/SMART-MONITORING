<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'token' => env('POSTMARK_TOKEN'),
    ],

    'resend' => [
        /** Either name works; EmailService uses Laravel's resend mailer (HTTPS). */
        'key' => env('RESEND_API_KEY') ?: env('RESEND_KEY'),
        'from_email' => env('RESEND_FROM_EMAIL'),
        'from_name' => env('RESEND_FROM_NAME'),
        /**
         * When no verified domain / MAIL_FROM is still example.com, use Resend's onboarding From so OTP can send.
         * Set false once RESEND_FROM_EMAIL is on a verified domain.
         */
        'use_onboarding_sender' => filter_var(env('RESEND_USE_ONBOARDING_SENDER', true), FILTER_VALIDATE_BOOLEAN),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    /*
    | Used by App\Services\EmailService — must live here so values resolve after
    | `php artisan config:cache` (env() is null in app code when config is cached).
    */
    'brevo' => [
        'key' => env('BREVO_API_KEY'),
        /** Optional: verified sender email for Brevo when MAIL_FROM_ADDRESS is wrong in .env */
        'sender_email' => env('BREVO_SENDER_EMAIL'),
        /** smtp-relay.brevo.com login (often your Brevo account email); optional if same as sender */
        'smtp_login' => env('BREVO_SMTP_LOGIN'),
        /** Brevo "SMTP key" from dashboard (can differ from REST API key) */
        'smtp_password' => env('BREVO_SMTP_KEY') ?: env('BREVO_SMTP_PASSWORD'),
    ],

    'sendgrid' => [
        'key' => env('SENDGRID_API_KEY'),
    ],

    'mailgun' => [
        'domain' => env('MAILGUN_DOMAIN'),
        'secret' => env('MAILGUN_SECRET'),
    ],

];
