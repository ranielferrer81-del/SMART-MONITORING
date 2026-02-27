<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use App\Mail\VerificationCodeMail;

class EmailService
{
    /**
     * Send verification code email using multiple methods
     */
    public static function sendVerificationCode($toEmail, $code): bool
    {
        // CRITICAL CHECK: If mailer is set to 'log', emails are NOT sent, only logged!
        $mailer = config('mail.default');
        if ($mailer === 'log' || $mailer === 'array') {
            Log::error('❌ Email NOT sent - MAIL_MAILER is set to "' . $mailer . '" which only logs emails. Change to "smtp" in .env');
            // Don't try other methods if mailer is log - it will never work
            return false;
        }

        // Method 1: Try Laravel Mail (SMTP) FIRST - most reliable for Gmail
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

        if (!$isPlaceholder) {
            try {
                // Use send() with error handling - this will throw if it fails
                Mail::to($toEmail)->send(new VerificationCodeMail($code, $toEmail));

                // If we reach here without exception, email was sent successfully
                Log::info('✅ Email sent successfully via SMTP', [
                    'to' => $toEmail,
                    'host' => $mailHost,
                    'username' => $mailUsername
                ]);
                return true;
            } catch (\Exception $e) {
                $errorMsg = $e->getMessage();
                Log::error('❌ SMTP failed with exception', [
                    'to' => $toEmail,
                    'error' => $errorMsg,
                    'username' => $mailUsername,
                    'host' => $mailHost
                ]);
                // Don't continue to other methods if it's an auth error - credentials are wrong
                if (
                    strpos($errorMsg, '535') !== false ||
                    strpos($errorMsg, 'BadCredentials') !== false ||
                    strpos($errorMsg, 'Authentication failed') !== false ||
                    strpos($errorMsg, '530') !== false ||
                    strpos($errorMsg, 'Invalid credentials') !== false ||
                    strpos($errorMsg, 'SMTP connect() failed') !== false
                ) {
                    Log::error('SMTP authentication/connection failed - check Gmail credentials in .env');
                    return false;
                }
                // For other errors, fall through to try other methods
            }
        } else {
            Log::warning('SMTP not configured - credentials are placeholders or invalid', [
                'username' => $mailUsername ? '***' : 'empty',
                'password' => $mailPassword ? '***' : 'empty',
                'host' => $mailHost
            ]);
        }

        // Method 2: Try SendGrid API (if configured)
        $sendGridKey = env('SENDGRID_API_KEY');
        if ($sendGridKey && $sendGridKey !== 'your-sendgrid-api-key' && !empty($sendGridKey) && strlen($sendGridKey) > 20) {
            try {
                if (self::sendViaSendGrid($toEmail, $code, $sendGridKey)) {
                    Log::info('✅ Email sent via SendGrid', ['to' => $toEmail]);
                    return true;
                }
            } catch (\Exception $e) {
                Log::warning('SendGrid failed', ['error' => $e->getMessage()]);
            }
        }

        // Method 2.5: Try Brevo (Sendinblue) API (if configured)
        $brevoKey = env('BREVO_API_KEY');
        if ($brevoKey && !empty($brevoKey)) {
            try {
                if (self::sendViaBrevo($toEmail, $code, $brevoKey)) {
                    Log::info('✅ Email sent via Brevo API', ['to' => $toEmail]);
                    return true;
                }
            } catch (\Exception $e) {
                Log::warning('Brevo failed', ['error' => $e->getMessage()]);
            }
        }

        // Method 3: Try Mailgun API (if configured)
        $mailgunKey = env('MAILGUN_SECRET');
        $mailgunDomain = env('MAILGUN_DOMAIN');
        if ($mailgunKey && $mailgunDomain && $mailgunKey !== 'your-mailgun-api-key' && !empty($mailgunKey)) {
            try {
                if (self::sendViaMailgun($toEmail, $code, $mailgunDomain, $mailgunKey)) {
                    Log::info('✅ Email sent via Mailgun', ['to' => $toEmail]);
                    return true;
                }
            } catch (\Exception $e) {
                Log::warning('Mailgun failed', ['error' => $e->getMessage()]);
            }
        }

        // Method 4: PHP mail() as last resort (usually doesn't work on Windows/XAMPP)
        try {
            if (self::sendViaPHPMail($toEmail, $code)) {
                Log::info('✅ Email sent via PHP mail()', ['to' => $toEmail]);
                return true;
            }
        } catch (\Exception $e) {
            Log::warning('PHP mail() failed', ['error' => $e->getMessage()]);
        }

        Log::error('❌ ALL email methods failed - no email sent', [
            'to' => $toEmail,
            'smtp_configured' => !$isPlaceholder,
            'sendgrid_configured' => !empty($sendGridKey) && strlen($sendGridKey) > 20,
            'mailgun_configured' => !empty($mailgunKey)
        ]);
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
     * Send via Brevo (Sendinblue) API
     */
    private static function sendViaBrevo($to, $code, $apiKey): bool
    {
        $response = Http::withHeaders([
            'api-key' => $apiKey,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ])->post('https://api.brevo.com/v3/smtp/email', [
                    'sender' => [
                        'email' => env('MAIL_FROM_ADDRESS', 'noreply@sia-system.com'),
                        'name' => env('MAIL_FROM_NAME', 'SIA System'),
                    ],
                    'to' => [
                        ['email' => $to]
                    ],
                    'subject' => 'Email Verification Code - SIA System',
                    'htmlContent' => self::getEmailHtml($code),
                ]);

        if ($response->successful()) {
            return true;
        }

        throw new \Exception('Brevo API error: ' . $response->body());
    }

    /**
     * Send via SendGrid API
     */
    private static function sendViaSendGrid($to, $code, $apiKey): bool
    {
        $response = Http::withHeaders([
            'Authorization' => 'Bearer ' . $apiKey,
            'Content-Type' => 'application/json',
        ])->post('https://api.sendgrid.com/v3/mail/send', [
                    'personalizations' => [
                        [
                            'to' => [['email' => $to]],
                        ],
                    ],
                    'from' => [
                        'email' => env('MAIL_FROM_ADDRESS', 'noreply@sia-system.com'),
                        'name' => env('MAIL_FROM_NAME', 'SIA System'),
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
        $response = Http::withBasicAuth('api', $apiKey)
            ->asForm()
            ->post("https://api.mailgun.net/v3/{$domain}/messages", [
                'from' => env('MAIL_FROM_ADDRESS', "noreply@{$domain}"),
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
        $headers .= "From: SIA System <" . (env('MAIL_FROM_ADDRESS') ?: 'noreply@sia-system.com') . ">\r\n";
        $headers .= "Reply-To: " . (env('MAIL_FROM_ADDRESS') ?: 'noreply@sia-system.com') . "\r\n";
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
     * Get email HTML content
     */
    private static function getEmailHtml($code): string
    {
        return view('emails.verification-code', ['code' => $code, 'email' => ''])->render();
    }
}

