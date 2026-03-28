<?php

namespace App\Services;

use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use App\Mail\VerificationCodeMail;

class EmailService
{
    private static function hasSendmailBinary(): bool
    {
        // Many container/PAAS environments do not include sendmail.
        // Checking prevents "/usr/bin/sendmail: not found" seen in your Railway logs.
        return file_exists('/usr/sbin/sendmail')
            || file_exists('/usr/bin/sendmail')
            || file_exists('/sbin/sendmail');
    }

    /** Populated on failed sends; consumed by AuthController when MAIL_DIAGNOSTICS_IN_RESPONSE / debug. */
    private static array $lastSendDiagnostics = [];

    public static function getLastSendDiagnostics(): array
    {
        return self::$lastSendDiagnostics;
    }

    private static function clearSendDiagnostics(): void
    {
        self::$lastSendDiagnostics = [];
    }

    private static function noteDiagnostic(string $key, mixed $value): void
    {
        self::$lastSendDiagnostics[$key] = $value;
    }

    /**
     * Resolve API keys from config or the process environment (Railway injects env; config cache can omit keys).
     */
    private static function resolveApiKey(string $configKey, string $envName): string
    {
        $v = config($configKey);
        if (is_string($v) && trim($v) !== '') {
            return trim($v);
        }
        $g = getenv($envName);
        if ($g !== false && trim((string) $g) !== '') {
            return trim((string) $g);
        }
        if (isset($_ENV[$envName]) && is_string($_ENV[$envName]) && trim($_ENV[$envName]) !== '') {
            return trim($_ENV[$envName]);
        }

        return '';
    }

    /**
     * Trim, strip UTF-8 BOM, and accidental wrapping quotes (common when pasting into Railway).
     */
    private static function normalizeSecret(string $s): string
    {
        $s = trim($s);
        if (str_starts_with($s, "\xEF\xBB\xBF")) {
            $s = substr($s, 3);
        }
        $s = trim($s);
        if ($s !== '' && (
            (str_starts_with($s, '"') && str_ends_with($s, '"')) ||
            (str_starts_with($s, "'") && str_ends_with($s, "'"))
        )) {
            $s = trim(substr($s, 1, -1));
        }

        return $s;
    }

    /**
     * From address for Brevo: dedicated BREVO_SENDER_EMAIL, then mail.from, then getenv (Railway).
     */
    private static function resolveBrevoSender(): array
    {
        // Prefer real process env (Railway) so we are not blind if .env / config is stale.
        $dedicated = trim((string) (getenv('BREVO_SENDER_EMAIL') ?: ''));
        if ($dedicated === '') {
            $dedicated = trim((string) (config('services.brevo.sender_email') ?: ''));
        }
        if ($dedicated !== '' && ! str_contains(strtolower($dedicated), 'example.com')) {
            $name = trim((string) (getenv('MAIL_FROM_NAME') ?: ''));
            if ($name === '') {
                $name = (string) config('mail.from.name', 'SIA System');
            }

            return [
                'email' => $dedicated,
                'name' => $name !== '' ? $name : 'SIA System',
            ];
        }

        $email = trim((string) (getenv('MAIL_FROM_ADDRESS') ?: ''));
        if ($email === '' || str_contains(strtolower($email), 'example.com')) {
            $email = trim((string) config('mail.from.address', ''));
        }
        if ($email === '' || str_contains(strtolower($email), 'example.com')) {
            $email = trim((string) (getenv('BREVO_SENDER_EMAIL') ?: ''));
        }

        $name = trim((string) (getenv('MAIL_FROM_NAME') ?: ''));
        if ($name === '') {
            $name = trim((string) config('mail.from.name', 'SIA System'));
        }

        return ['email' => $email, 'name' => $name !== '' ? $name : 'SIA System'];
    }

    /**
     * From address for Resend: RESEND_FROM_EMAIL, then MAIL_FROM_ADDRESS / mail.from (must be a verified domain in Resend).
     */
    private static function resolveResendSender(): array
    {
        $email = trim((string) (getenv('RESEND_FROM_EMAIL') ?: ''));
        if ($email === '') {
            $email = trim((string) (config('services.resend.from_email') ?: ''));
        }
        if ($email === '' || str_contains(strtolower($email), 'example.com')) {
            $email = trim((string) (getenv('MAIL_FROM_ADDRESS') ?: ''));
        }
        if ($email === '' || str_contains(strtolower($email), 'example.com')) {
            $email = trim((string) config('mail.from.address', ''));
        }

        $name = trim((string) (getenv('RESEND_FROM_NAME') ?: ''));
        if ($name === '') {
            $name = trim((string) (config('services.resend.from_name') ?: ''));
        }
        if ($name === '') {
            $name = trim((string) (getenv('MAIL_FROM_NAME') ?: ''));
        }
        if ($name === '') {
            $name = (string) config('mail.from.name', 'SIA System');
        }

        return ['email' => $email, 'name' => $name !== '' ? $name : 'SIA System'];
    }

    /**
     * Send verification code email using multiple methods
     */
    public static function sendVerificationCode($toEmail, $code): bool
    {
        self::clearSendDiagnostics();
        self::noteDiagnostic('to_domain', Str::after((string) $toEmail, '@') ?: '(none)');

        $brevoKey = self::normalizeSecret(self::resolveApiKey('services.brevo.key', 'BREVO_API_KEY'));
        self::noteDiagnostic('brevo_key_length', strlen($brevoKey));
        $resendKey = self::normalizeSecret(self::resolveApiKey('services.resend.key', 'RESEND_API_KEY'));
        if ($resendKey === '') {
            $resendKey = self::normalizeSecret(self::resolveApiKey('services.resend.key', 'RESEND_KEY'));
        }
        self::noteDiagnostic('resend_key_configured', $resendKey !== '');
        $sendGridKey = self::resolveApiKey('services.sendgrid.key', 'SENDGRID_API_KEY');
        $mailgunKey = self::resolveApiKey('services.mailgun.secret', 'MAILGUN_SECRET');
        $mailgunDomain = self::resolveApiKey('services.mailgun.domain', 'MAILGUN_DOMAIN');

        // Check mailer config - if set to 'log' or 'array', skip SMTP but still try API methods (Brevo, SendGrid, etc.)
        $mailer = config('mail.default');
        $runningOnRailway = (getenv('RAILWAY_ENVIRONMENT') !== false || getenv('RAILWAY_PROJECT_ID') !== false);
        // Brevo SMTP relay uses port 587; many PaaS networks block or time out — skip to avoid ~30s waits when REST already failed.
        $skipBrevoSmtpRelayOnRailway = $runningOnRailway && filter_var(env('EMAIL_SKIP_BREVO_SMTP_ON_RAILWAY', true), FILTER_VALIDATE_BOOLEAN);
        $smtpHostCfg = strtolower((string) config('mail.mailers.smtp.host', ''));
        $skipSmtp = ($mailer === 'log' || $mailer === 'array');
        /*
         * On Railway + Brevo REST key we used to skip *all* Laravel SMTP. That blocked the Brevo SMTP relay
         * that write-env.php sets (smtp-relay.brevo.com) when REST fails — users with correct MAIL_* were still stuck.
         * Only skip slow/unconfigured SMTP (Gmail default, etc.), not smtp-relay.brevo.com.
         */
        if ($runningOnRailway && $brevoKey !== '') {
            $isBrevoRelay = str_contains($smtpHostCfg, 'brevo');
            $looksLikeGmailOrUnset = $smtpHostCfg === '' || str_contains($smtpHostCfg, 'gmail') || $smtpHostCfg === 'smtp.gmail.com';
            if (! $isBrevoRelay && $looksLikeGmailOrUnset) {
                $skipSmtp = true;
                self::noteDiagnostic('smtp_skipped_reason', 'railway_with_brevo_avoid_slow_smtp');
            }
        }
        if ($skipSmtp) {
            Log::info('MAIL_MAILER is "' . $mailer . '" - skipping SMTP, will try API methods (Brevo, SendGrid, Mailgun)');
        }

        // Used when logging final failure
        $isPlaceholder = true;
        if (! $skipSmtp) {
            $mailUsername = config('mail.mailers.smtp.username');
            $mailPassword = config('mail.mailers.smtp.password');
            $mailHost = config('mail.mailers.smtp.host');

            $isPlaceholder = empty($mailUsername) ||
                strpos($mailUsername, 'your-gmail') !== false ||
                strpos($mailUsername, 'your-email') !== false ||
                strpos($mailUsername, 'null') !== false ||
                empty($mailPassword) ||
                strpos($mailPassword, 'your-app-password') !== false ||
                strpos($mailPassword, 'your-app-password-here') !== false ||
                strpos($mailPassword, 'null') !== false ||
                empty($mailHost) ||
                $mailHost === '127.0.0.1';
        }

        /*
         * Resend (HTTPS :443) is stable on PaaS; Brevo REST can 401 (keys/IP). When RESEND_API_KEY is set,
         * try Resend first by default — not tied to UI or "Railway only". Set EMAIL_TRY_RESEND_FIRST=false to prefer Brevo.
         */
        $resendFirstEnv = env('EMAIL_TRY_RESEND_FIRST');
        if ($resendFirstEnv === null) {
            $resendFirstEnv = env('RAILWAY_TRY_RESEND_FIRST', true);
        }
        $tryResendFirst = $resendKey !== ''
            && strlen($resendKey) > 8
            && filter_var($resendFirstEnv, FILTER_VALIDATE_BOOLEAN);

        if ($tryResendFirst) {
            try {
                if (self::sendViaResend($toEmail, $code, $resendKey)) {
                    Log::info('✅ Email sent via Resend API (primary — EMAIL_TRY_RESEND_FIRST)', ['to' => $toEmail]);

                    return true;
                }
            } catch (\Throwable $e) {
                self::noteDiagnostic('resend_error', Str::limit($e->getMessage(), 400));
                Log::warning('Resend (primary) failed, will try other transports', ['error' => $e->getMessage()]);
            }
        }

        /*
         * When BREVO_API_KEY is set, try Brevo *before* Laravel SMTP. Gmail/other SMTP can hang until
         * MAIL_TIMEOUT or fail from IP/auth while Brevo REST succeeds immediately — the old order made
         * Railway + Brevo setups look "broken" if MAIL_* still pointed at Gmail locally.
         */
        if ($brevoKey !== '') {
            try {
                if (self::sendViaBrevo($toEmail, $code, $brevoKey)) {
                    Log::info('✅ Email sent via Brevo REST API', ['to' => $toEmail]);

                    return true;
                }
            } catch (\Throwable $e) {
                Log::warning('Brevo REST failed', ['error' => $e->getMessage()]);
            }
            if ($skipBrevoSmtpRelayOnRailway) {
                self::noteDiagnostic('brevo_smtp_skipped', 'EMAIL_SKIP_BREVO_SMTP_ON_RAILWAY=true (SMTP 587 often blocked on Railway; set false to try relay)');
            } else {
                try {
                    if (self::sendViaBrevoSmtp($toEmail, $code, $brevoKey)) {
                        Log::info('✅ Email sent via Brevo SMTP relay (runtime mailer)', ['to' => $toEmail]);

                        return true;
                    }
                } catch (\Throwable $e) {
                    self::noteDiagnostic('brevo_smtp_error', Str::limit($e->getMessage(), 400));
                    Log::warning('Brevo SMTP failed', ['error' => $e->getMessage()]);
                }
            }
        }

        // Resend HTTPS API (fallback when Brevo failed or when Resend was not tried first)
        if ($resendKey !== '' && strlen($resendKey) > 8 && ! $tryResendFirst) {
            try {
                if (self::sendViaResend($toEmail, $code, $resendKey)) {
                    Log::info('✅ Email sent via Resend API', ['to' => $toEmail]);

                    return true;
                }
            } catch (\Throwable $e) {
                self::noteDiagnostic('resend_error', Str::limit($e->getMessage(), 400));
                Log::warning('Resend failed', ['error' => $e->getMessage()]);
            }
        }

        // Laravel Mail over configured SMTP (Gmail, Brevo relay via MAIL_*, etc.)
        // Always use the "smtp" mailer here — config("mail.default") may be "sendmail" (no binary in Docker/Railway).
        if (! $skipSmtp && ! $isPlaceholder) {
            $mailHost = config('mail.mailers.smtp.host');
            $mailUsername = config('mail.mailers.smtp.username');
            self::noteDiagnostic('smtp_attempted', true);
            self::noteDiagnostic('smtp_host', (string) $mailHost);
            self::noteDiagnostic('smtp_username_set', !empty($mailUsername));
            try {
                Mail::mailer('smtp')->to($toEmail)->send(new VerificationCodeMail($code, $toEmail));
                Log::info('✅ Email sent via Laravel SMTP', [
                    'to' => $toEmail,
                    'host' => $mailHost,
                    'username' => $mailUsername,
                ]);

                self::noteDiagnostic('smtp_result', 'success');
                return true;
            } catch (\Throwable $e) {
                self::noteDiagnostic('smtp_error', Str::limit($e->getMessage(), 400));
                Log::error('Laravel SMTP failed', ['error' => $e->getMessage(), 'host' => $mailHost]);
            }
        } elseif (! $skipSmtp && $isPlaceholder) {
            self::noteDiagnostic('smtp_skipped', 'placeholder_or_missing_creds');
            Log::warning('SMTP not configured (placeholder or empty) — skipped Laravel SMTP');
        } elseif ($skipSmtp) {
            self::noteDiagnostic('smtp_skipped', 'mail_default_not_smtp');
        }

        // Method 2: Try SendGrid API (if configured)
        if ($sendGridKey && $sendGridKey !== 'your-sendgrid-api-key' && strlen($sendGridKey) > 20) {
            try {
                if (self::sendViaSendGrid($toEmail, $code, $sendGridKey)) {
                    Log::info('✅ Email sent via SendGrid', ['to' => $toEmail]);
                    return true;
                }
            } catch (\Exception $e) {
                Log::warning('SendGrid failed', ['error' => $e->getMessage()]);
            }
        }

        // Method 3: Try Mailgun API (if configured)
        if ($mailgunKey && $mailgunDomain && $mailgunKey !== 'your-mailgun-api-key') {
            try {
                if (self::sendViaMailgun($toEmail, $code, $mailgunDomain, $mailgunKey)) {
                    Log::info('✅ Email sent via Mailgun', ['to' => $toEmail]);
                    return true;
                }
            } catch (\Exception $e) {
                Log::warning('Mailgun failed', ['error' => $e->getMessage()]);
            }
        }

        // Method 4: PHP mail() — invokes sendmail; not present in Railway/Docker images (causes "sendmail: not found").
        if (getenv('RAILWAY_ENVIRONMENT') !== false || getenv('RAILWAY_PROJECT_ID') !== false) {
            Log::info('Skipping PHP mail() on Railway (no sendmail in container).');
        } else {
        try {
            if (self::sendViaPHPMail($toEmail, $code)) {
                Log::info('✅ Email sent via PHP mail()', ['to' => $toEmail]);
                return true;
            }
        } catch (\Exception $e) {
            Log::warning('PHP mail() failed', ['error' => $e->getMessage()]);
        }
        }

        Log::error('❌ ALL email methods failed - no email sent', [
            'to' => $toEmail,
            'smtp_configured' => !$isPlaceholder,
            'brevo_configured' => $brevoKey !== '',
            'sendgrid_configured' => strlen($sendGridKey) > 20,
            'mailgun_configured' => $mailgunKey !== '' && $mailgunDomain !== '',
        ]);
        self::noteDiagnostic('final', 'all_transport_methods_failed');

        return false;
    }

    /**
     * Send via Gmail API using HTTP
     */
    private static function sendViaGmailAPI($to, $code, $fromEmail, $apiKey): bool
    {
        // Using Gmail API requires OAuth, so this is a placeholder
        // For now, we'll use SMTP which is simpler
        return false;
    }

    /**
     * Brevo transactional email API — one retry on cold network / 5xx / rate limit.
     */
    private static function postBrevoTransactionalEmail(
        string $apiKey,
        string $fromEmail,
        string $fromName,
        string $to,
        string $subject,
        string $html,
        string $plain
    ): ?Response {
        $payload = [
            'sender' => [
                'email' => $fromEmail,
                'name' => $fromName,
            ],
            'to' => [
                ['email' => $to],
            ],
            'subject' => $subject,
            'htmlContent' => $html,
            'textContent' => $plain,
        ];

        $attempt = 0;
        $response = null;

        while ($attempt < 2) {
            if ($attempt > 0) {
                usleep(150000);
            }
            try {
                $response = Http::timeout(25)
                    ->connectTimeout(10)
                    ->withHeaders([
                        'api-key' => $apiKey,
                        'Content-Type' => 'application/json',
                        'Accept' => 'application/json',
                    ])->post('https://api.brevo.com/v3/smtp/email', $payload);

                if ($response->successful()) {
                    return $response;
                }

                $status = $response->status();
                if ($attempt === 0 && ($status >= 500 || $status === 429)) {
                    $attempt++;

                    continue;
                }

                return $response;
            } catch (ConnectionException $e) {
                if ($attempt === 0) {
                    $attempt++;

                    continue;
                }
                self::noteDiagnostic('brevo_rest_error', 'connection: '.$e->getMessage());
                Log::error('Brevo REST connection failed', ['error' => $e->getMessage(), 'from' => $fromEmail]);

                return null;
            }
        }

        return $response;
    }

    /**
     * Send via Brevo (Sendinblue) API
     */
    private static function sendViaBrevo($to, $code, $apiKey): bool
    {
        $sender = self::resolveBrevoSender();
        $fromEmail = $sender['email'];
        if ($fromEmail === '' || str_contains(strtolower($fromEmail), 'example.com')) {
            self::noteDiagnostic(
                'brevo_blocked',
                'Set MAIL_FROM_ADDRESS or BREVO_SENDER_EMAIL to an address verified in Brevo (not example.com).'
            );
            Log::error('Brevo blocked: set MAIL_FROM_ADDRESS or BREVO_SENDER_EMAIL in Railway to your verified Brevo sender (not noreply@example.com).', [
                'resolved_from' => $fromEmail ?: '(empty)',
            ]);

            return false;
        }

        $html = self::inlineVerificationHtml($code);
        $plain = "Your SIA verification code is: {$code}\n\nThis code expires in 10 minutes.";

        self::noteDiagnostic('brevo_from', $fromEmail);

        $brand = (string) config('app.name', 'SIA');
        $subject = $brand.': Your verification code (login)';

        $response = self::postBrevoTransactionalEmail($apiKey, $fromEmail, $sender['name'], $to, $subject, $html, $plain);

        if ($response === null) {
            return false;
        }

        if ($response->successful()) {
            self::noteDiagnostic('brevo_rest', 'ok HTTP '.$response->status());

            return true;
        }

        $body = $response->body();
        $bodySnippet = Str::limit($body, 500);
        self::noteDiagnostic('brevo_rest_error', 'HTTP '.$response->status().': '.$bodySnippet);

        if ($response->status() === 401) {
            self::noteDiagnostic('brevo_401', Str::limit($body, 400));
            $lower = strtolower($body);
            $json = json_decode($body, true);
            $msg = is_array($json) && isset($json['message']) ? strtolower((string) $json['message']) : $lower;
            // Brevo may mention authorised_ips even when the fix is a new key or wrong key pasted — keep flag for logs only.
            if (
                str_contains($lower, 'authorised_ips') ||
                str_contains($lower, 'authorized_ips') ||
                str_contains($lower, 'authorized ip') ||
                (str_contains($msg, 'authorised') && str_contains($msg, 'ip')) ||
                (str_contains($msg, 'authorized') && str_contains($msg, 'ip'))
            ) {
                self::noteDiagnostic('brevo_ip_restriction', true);
            }
        }

        Log::error('Brevo API non-success response', [
            'status' => $response->status(),
            'body' => $body,
            'from' => $fromEmail,
        ]);

        return false;
    }

    /**
     * Resend via Laravel's official transport (HTTPS) — same From as config/mail + optional RESEND_FROM_*.
     */
    private static function sendViaResend(string $to, string $code, string $apiKey): bool
    {
        $apiKey = self::normalizeSecret($apiKey);
        if ($apiKey === '' || strlen($apiKey) < 8) {
            self::noteDiagnostic('resend_blocked', 'RESEND_API_KEY is missing or invalid.');

            return false;
        }

        $sender = self::resolveResendSender();
        $fromEmail = $sender['email'];
        if ($fromEmail === '' || str_contains(strtolower($fromEmail), 'example.com')) {
            self::noteDiagnostic('resend_blocked', 'Set RESEND_FROM_EMAIL or MAIL_FROM_ADDRESS to an address on a domain verified in Resend.');

            return false;
        }

        Config::set('services.resend.key', $apiKey);
        Config::set('mail.mailers.resend.key', $apiKey);

        try {
            Mail::mailer('resend')->to($to)->send(
                new VerificationCodeMail($code, $to, $fromEmail, $sender['name'])
            );
            self::noteDiagnostic('resend_rest', 'ok Laravel resend mailer');

            return true;
        } catch (\Throwable $e) {
            self::noteDiagnostic('resend_error', Str::limit($e->getMessage(), 400));
            Log::error('Resend mail failed', ['error' => $e->getMessage(), 'to' => $to]);

            return false;
        }
    }

    /**
     * Brevo SMTP relay — works when REST key differs from "SMTP key" in Brevo dashboard.
     */
    private static function sendViaBrevoSmtp(string $toEmail, string $code, string $restApiKey): bool
    {
        $sender = self::resolveBrevoSender();
        $from = $sender['email'];
        if ($from === '' || str_contains(strtolower($from), 'example.com')) {
            return false;
        }

        $smtpUser = trim((string) (config('services.brevo.smtp_login') ?: ''));
        if ($smtpUser === '') {
            $smtpUser = self::resolveApiKey('services.brevo.smtp_login', 'BREVO_SMTP_LOGIN');
        }
        if ($smtpUser === '') {
            $smtpUser = $from;
        }

        $smtpPass = trim((string) (config('services.brevo.smtp_password') ?: ''));
        if ($smtpPass === '') {
            $g = getenv('BREVO_SMTP_KEY');
            if ($g !== false && trim((string) $g) !== '') {
                $smtpPass = trim((string) $g);
            }
        }
        if ($smtpPass === '') {
            $g = getenv('BREVO_SMTP_PASSWORD');
            if ($g !== false && trim((string) $g) !== '') {
                $smtpPass = trim((string) $g);
            }
        }
        if ($smtpPass === '') {
            $smtpPass = $restApiKey;
        }

        $html = self::inlineVerificationHtml($code);
        $smtpHost = 'smtp-relay.brevo.com';
        $mailerName = 'brevo_smtp_'.substr(sha1($smtpUser.$smtpHost), 0, 8);
        Config::set('mail.mailers.'.$mailerName, [
            'transport' => 'smtp',
            'host' => $smtpHost,
            'port' => 587,
            'encryption' => 'tls',
            'username' => $smtpUser,
            'password' => $smtpPass,
            'timeout' => 30,
        ]);

        $brand = (string) config('app.name', 'SIA');
        $subj = $brand.': Your verification code (login)';
        Mail::mailer($mailerName)->html($html, function ($message) use ($toEmail, $from, $sender, $subj) {
            $message->to($toEmail)
                ->subject($subj)
                ->from($from, $sender['name'])
                ->replyTo($from, $sender['name']);
        });

        return true;
    }

    /**
     * Send via SendGrid API
     */
    private static function sendViaSendGrid($to, $code, $apiKey): bool
    {
        $response = Http::timeout(20)
            ->connectTimeout(8)
            ->withHeaders([
            'Authorization' => 'Bearer ' . $apiKey,
            'Content-Type' => 'application/json',
        ])->post('https://api.sendgrid.com/v3/mail/send', [
                    'personalizations' => [
                        [
                            'to' => [['email' => $to]],
                        ],
                    ],
                    'from' => [
                        'email' => config('mail.from.address', 'noreply@sia-system.com'),
                        'name' => config('mail.from.name', 'SIA System'),
                    ],
                    'subject' => 'Email Verification Code - SIA System',
                    'content' => [
                        [
                            'type' => 'text/html',
                            'value' => self::getEmailHtml($code),
                        ],
                    ],
                ]);

        if ($response->successful()) {
            Log::info('Email sent via SendGrid', ['to' => $to]);
            return true;
        }

        throw new \Exception('SendGrid API error: ' . $response->body());
    }

    /**
     * Send via Mailgun API
     */
    private static function sendViaMailgun($to, $code, $domain, $apiKey): bool
    {
        $response = Http::timeout(20)
            ->connectTimeout(8)
            ->withBasicAuth('api', $apiKey)
            ->asForm()
            ->post("https://api.mailgun.net/v3/{$domain}/messages", [
                'from' => config('mail.from.address') ?: "noreply@{$domain}",
                'to' => $to,
                'subject' => 'Email Verification Code - SIA System',
                'html' => self::getEmailHtml($code),
            ]);

        if ($response->successful()) {
            Log::info('Email sent via Mailgun', ['to' => $to]);
            return true;
        }

        throw new \Exception('Mailgun API error: ' . $response->body());
    }

    /**
     * Send via PHP mail() function - works on most servers
     * NOTE: PHP mail() often fails silently on Windows/XAMPP - not reliable
     */
    private static function sendViaPHPMail($to, $code): bool
    {
        // PHP mail() is unreliable on Windows - don't use it as fallback
        // It often returns true even when email is not sent
        if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
            Log::warning('PHP mail() skipped on Windows - not reliable', ['to' => $to]);
            return false;
        }

        if (!self::hasSendmailBinary()) {
            Log::warning('PHP mail() skipped because sendmail binary is missing', ['to' => $to]);
            return false;
        }

        $subject = 'Email Verification Code - SIA System';

        // Simple HTML email
        $message = "
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset='utf-8'>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
                .content { background-color: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; }
                .code-box { background-color: white; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0; }
                .code { font-size: 36px; font-weight: bold; color: #dc2626; letter-spacing: 8px; font-family: 'Courier New', monospace; }
            </style>
        </head>
        <body>
            <div class='container'>
                <div class='header'>
                    <h1>SIA System</h1>
                </div>
                <div class='content'>
                    <h2>Email Verification Code</h2>
                    <p>Hello,</p>
                    <p>You have requested to log in to the SIA System. Please use the following verification code to complete your login:</p>
                    <div class='code-box'>
                        <div class='code'>{$code}</div>
                    </div>
                    <p>This code will expire in <strong>10 minutes</strong>. Please do not share this code with anyone.</p>
                    <p style='color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;'>
                        If you did not request this code, please ignore this email or contact support if you have concerns.
                    </p>
                </div>
            </div>
        </body>
        </html>
        ";

        $headers = "MIME-Version: 1.0\r\n";
        $headers .= "Content-type: text/html; charset=UTF-8\r\n";
        $fromAddr = config('mail.from.address') ?: 'noreply@sia-system.com';
        $headers .= "From: SIA System <{$fromAddr}>\r\n";
        $headers .= "Reply-To: {$fromAddr}\r\n";
        $headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";

        $result = @mail($to, $subject, $message, $headers);

        if ($result) {
            Log::info('PHP mail() returned true (but may not have actually sent on Windows)', ['to' => $to]);
            // Don't trust PHP mail() on Windows - return false to try other methods
            if (strtoupper(substr(PHP_OS, 0, 3)) === 'WIN') {
                return false;
            }
            return true;
        }

        Log::warning('PHP mail() returned false - email not sent', ['to' => $to]);
        return false;
    }

    /**
     * HTML body without Blade (avoids view-cache / compile failures on some hosts).
     */
    private static function inlineVerificationHtml(string $code): string
    {
        $safe = htmlspecialchars($code, ENT_QUOTES, 'UTF-8');

        return '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif">'
            .'<p>Your SIA verification code is:</p>'
            .'<p style="font-size:32px;font-weight:bold;color:#dc2626;letter-spacing:8px">'.$safe.'</p>'
            .'<p style="color:#666">This code expires in 10 minutes.</p></body></html>';
    }

    /**
     * Get email HTML content (inline; Blade removed from hot path for reliability).
     */
    private static function getEmailHtml($code): string
    {
        return self::inlineVerificationHtml($code);
    }
}

