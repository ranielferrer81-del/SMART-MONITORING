<?php

/**
 * Build .env from the process environment (Railway injects vars here).
 * Bash heredocs mangle values with $, quotes, etc., and empty BREVO_API_KEY= lines
 * can override real keys when Laravel loads Dotenv.
 */
declare(strict_types=1);

function g(string $key, ?string $default = null): string
{
    $v = getenv($key);
    if ($v !== false && $v !== '') {
        $t = trim($v);
        if ($t !== '') {
            return $t;
        }
    }

    return trim((string) ($default ?? ''));
}

/** Laravel-compatible .env line (quote when needed). */
function line(string $key, string $value): string
{
    if ($value === '') {
        return $key . '=';
    }
    if (preg_match('/^[\w@.\-+]+$/', $value) === 1) {
        return $key . '=' . $value;
    }

    return $key . '="' . str_replace(['\\', '"'], ['\\\\', '\\"'], $value) . '"';
}

$dbHost = g('DB_HOST', g('MYSQLHOST', '127.0.0.1'));
$dbPort = g('DB_PORT', g('MYSQLPORT', '3306'));
$dbDatabase = g('DB_DATABASE', g('MYSQLDATABASE', 'railway'));
$dbUsername = g('DB_USERNAME', g('MYSQLUSER', 'root'));
$dbPassword = g('DB_PASSWORD', g('MYSQLPASSWORD', g('MYSQL_ROOT_PASSWORD', '')));

// Prefer public URL when running backend outside Railway private network (e.g. Render).
$mysqlUrl = '';
if (getenv('MYSQL_PUBLIC_URL') !== false && getenv('MYSQL_PUBLIC_URL') !== '') {
    $mysqlUrl = (string) getenv('MYSQL_PUBLIC_URL');
} elseif (getenv('MYSQL_URL') !== false && getenv('MYSQL_URL') !== '') {
    $mysqlUrl = (string) getenv('MYSQL_URL');
}

if ($mysqlUrl !== '') {
    $u = parse_url($mysqlUrl);
    if ($u !== false) {
        $dbHost = $u['host'] ?? $dbHost;
        $dbPort = isset($u['port']) ? (string) $u['port'] : $dbPort;
        $dbDatabase = isset($u['path']) ? ltrim((string) $u['path'], '/') : $dbDatabase;
        $dbUsername = isset($u['user']) ? rawurldecode((string) $u['user']) : $dbUsername;
        $dbPassword = isset($u['pass']) ? rawurldecode((string) $u['pass']) : $dbPassword;
    }
}

$appKey = g('APP_KEY');
if ($appKey === '') {
    $appKey = 'base64:' . base64_encode(random_bytes(32));
}

$appUrl = g('APP_URL', 'https://smart-monitoring-production.up.railway.app');
$brevoKey = g('BREVO_API_KEY');
// Prefer explicit MAIL_FROM_ADDRESS; else BREVO_SENDER_EMAIL so Brevo never sends from noreply@example.com by default.
$mailFromExplicit = g('MAIL_FROM_ADDRESS');
$brevoSenderPreset = g('BREVO_SENDER_EMAIL');
if ($mailFromExplicit !== '') {
    $mailFrom = $mailFromExplicit;
    // Railway templates often set MAIL_FROM=noreply@example.com while BREVO_SENDER_EMAIL is the real verified sender.
    if ($brevoSenderPreset !== '' && str_contains(strtolower($mailFromExplicit), 'example.com')) {
        $mailFrom = $brevoSenderPreset;
    }
} elseif ($brevoSenderPreset !== '') {
    $mailFrom = $brevoSenderPreset;
} else {
    $mailFrom = 'noreply@example.com';
}

$mailMailer = g('MAIL_MAILER', 'smtp');
$mailHost = g('MAIL_HOST', 'smtp.gmail.com');
$mailPort = g('MAIL_PORT', '587');
$mailUser = g('MAIL_USERNAME');
$mailPass = g('MAIL_PASSWORD');
$mailEnc = g('MAIL_ENCRYPTION', 'tls');

// If you explicitly configured SMTP creds (MAIL_HOST/MAIL_USERNAME/MAIL_PASSWORD), don't override them
// just because BREVO_API_KEY exists. This avoids accidentally breaking Gmail/Hostinger SMTP.
$explicitSmtpHost = getenv('MAIL_HOST');
$explicitSmtpUser = getenv('MAIL_USERNAME');
$explicitSmtpPass = getenv('MAIL_PASSWORD');
$hasExplicitSmtpCreds =
    ($explicitSmtpHost !== false && trim((string) $explicitSmtpHost) !== '') ||
    ($explicitSmtpUser !== false && trim((string) $explicitSmtpUser) !== '') ||
    ($explicitSmtpPass !== false && trim((string) $explicitSmtpPass) !== '');

$useBrevoSmtpRelay = g('USE_BREVO_SMTP_RELAY', 'false') === 'true';

// When Brevo API key is set, use Brevo SMTP relay only when:
// - SMTP creds weren't explicitly provided, OR
// - you explicitly asked for Brevo SMTP relay.
if ($brevoKey !== '' && (!$hasExplicitSmtpCreds || $useBrevoSmtpRelay)) {
    $mailMailer = 'smtp';
    $mailHost = 'smtp-relay.brevo.com';
    $mailPort = '587';
    $mailEnc = 'tls';
    $smtpLogin = g('BREVO_SMTP_LOGIN');
    if ($smtpLogin === '') {
        $smtpLogin = g('BREVO_SENDER_EMAIL');
    }
    if ($smtpLogin === '') {
        $smtpLogin = $mailFrom;
    }
    $mailUser = $smtpLogin;
    $smtpKey = g('BREVO_SMTP_KEY');
    if ($smtpKey === '') {
        $smtpKey = g('BREVO_SMTP_PASSWORD');
    }
    $mailPass = $smtpKey !== '' ? $smtpKey : $brevoKey;
}

$lines = [
    line('APP_NAME', g('APP_NAME', 'SIA')),
    line('APP_ENV', g('APP_ENV', 'production')),
    line('APP_KEY', $appKey),
    line('APP_DEBUG', g('APP_DEBUG', 'false')),
    line('APP_URL', $appUrl),
    '',
    'LOG_CHANNEL=stack',
    'LOG_LEVEL=warning',
    '',
    line('DB_CONNECTION', g('DB_CONNECTION', 'mysql')),
    line('DB_HOST', $dbHost),
    line('DB_PORT', $dbPort),
    line('DB_DATABASE', $dbDatabase),
    line('DB_USERNAME', $dbUsername),
    line('DB_PASSWORD', $dbPassword),
    '',
    line('SESSION_DRIVER', g('SESSION_DRIVER', 'file')),
    'SESSION_LIFETIME=120',
    '',
    line('CACHE_STORE', g('CACHE_STORE', 'file')),
    '',
    'QUEUE_CONNECTION=sync',
    'FILESYSTEM_DISK=local',
    '',
    line('MAIL_MAILER', $mailMailer),
    line('MAIL_HOST', $mailHost),
    line('MAIL_PORT', $mailPort),
    line('MAIL_USERNAME', $mailUser),
    line('MAIL_PASSWORD', $mailPass),
    line('MAIL_ENCRYPTION', $mailEnc),
    'MAIL_TIMEOUT=60',
    line('MAIL_FROM_ADDRESS', $mailFrom),
    line('MAIL_FROM_NAME', g('MAIL_FROM_NAME', 'SIA')),
    '',
];

// Only write BREVO when set so empty lines never shadow Railway env
if ($brevoKey !== '') {
    $lines[] = line('BREVO_API_KEY', $brevoKey);
}
$resendApi = g('RESEND_API_KEY');
if ($resendApi === '') {
    $resendApi = g('RESEND_KEY');
}
if ($resendApi !== '') {
    $lines[] = line('RESEND_API_KEY', $resendApi);
}
$resendFrom = g('RESEND_FROM_EMAIL', '');
if ($resendFrom !== '') {
    $lines[] = line('RESEND_FROM_EMAIL', $resendFrom);
}
$resendFromName = g('RESEND_FROM_NAME', '');
if ($resendFromName !== '') {
    $lines[] = line('RESEND_FROM_NAME', $resendFromName);
}
$emailTryResendFirst = g('EMAIL_TRY_RESEND_FIRST', '');
if ($emailTryResendFirst !== '') {
    $lines[] = line('EMAIL_TRY_RESEND_FIRST', $emailTryResendFirst);
}
$brevoSender = g('BREVO_SENDER_EMAIL');
if ($brevoSender !== '') {
    $lines[] = line('BREVO_SENDER_EMAIL', $brevoSender);
}
$smtpLogin = g('BREVO_SMTP_LOGIN');
if ($smtpLogin !== '') {
    $lines[] = line('BREVO_SMTP_LOGIN', $smtpLogin);
}
$smtpKey = g('BREVO_SMTP_KEY');
if ($smtpKey === '') {
    $smtpKey = g('BREVO_SMTP_PASSWORD');
}
if ($smtpKey !== '') {
    $lines[] = line('BREVO_SMTP_KEY', $smtpKey);
}

// Optional: return verification code in API JSON when Brevo/inbox delivery fails (set on Railway).
$authFallback = g('AUTH_LOGIN_CODE_FALLBACK', '');
if ($authFallback !== '') {
    $lines[] = line('AUTH_LOGIN_CODE_FALLBACK', $authFallback);
}
$mailDiagResp = g('MAIL_DIAGNOSTICS_IN_RESPONSE', '');
if ($mailDiagResp !== '') {
    $lines[] = line('MAIL_DIAGNOSTICS_IN_RESPONSE', $mailDiagResp);
}

file_put_contents(
    dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env',
    implode("\n", $lines) . "\n"
);

if ($brevoKey !== '' && ($mailFrom === '' || str_contains(strtolower($mailFrom), 'example.com'))) {
    fwrite(STDERR, "WARNING: BREVO_API_KEY is set but MAIL_FROM_ADDRESS / BREVO_SENDER_EMAIL is missing or still example.com.\n");
    fwrite(STDERR, "         Add BREVO_SENDER_EMAIL (verified in Brevo) to Railway Variables — the API key alone cannot send mail.\n");
}

echo "=== .env written via scripts/write-env.php ===\n";
echo 'BREVO_API_KEY length: ' . strlen($brevoKey) . "\n";
echo 'MAIL_FROM_ADDRESS: ' . $mailFrom . "\n";
echo 'MAIL_HOST: ' . $mailHost . "\n";
