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
        return $v;
    }

    return $default ?? '';
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

if (getenv('MYSQL_URL') !== false && getenv('MYSQL_URL') !== '') {
    $u = parse_url((string) getenv('MYSQL_URL'));
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
$mailFrom = g('MAIL_FROM_ADDRESS', 'ranielferrer81@gmail.com');
$brevoKey = g('BREVO_API_KEY');

$mailMailer = g('MAIL_MAILER', 'smtp');
$mailHost = g('MAIL_HOST', 'smtp.gmail.com');
$mailPort = g('MAIL_PORT', '587');
$mailUser = g('MAIL_USERNAME', 'ranielferrer81@gmail.com');
$mailPass = g('MAIL_PASSWORD', 'jtkrtmascloxplsb');
$mailEnc = g('MAIL_ENCRYPTION', 'tls');

// NOTE: Do NOT override SMTP settings here when BREVO_API_KEY is set.
// EmailService handles Brevo independently (REST API + dynamic SMTP mailer).
// Keeping the main SMTP config as Gmail (or whatever the user configured) so it
// serves as a reliable fallback when Brevo is unavailable (e.g. 403 / credits / DKIM).

$lines = [
    line('APP_NAME', g('APP_NAME', 'SIA')),
    line('APP_ENV', g('APP_ENV', 'production')),
    line('APP_KEY', $appKey),
    line('APP_DEBUG', g('APP_DEBUG', 'true')),
    line('APP_URL', $appUrl),
    '',
    'LOG_CHANNEL=stack',
    'LOG_LEVEL=debug',
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

file_put_contents(
    dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env',
    implode("\n", $lines) . "\n"
);

echo "=== .env written via scripts/write-env.php ===\n";
echo 'BREVO_API_KEY length: ' . strlen($brevoKey) . "\n";
echo 'MAIL_FROM_ADDRESS: ' . $mailFrom . "\n";
echo 'MAIL_HOST: ' . $mailHost . "\n";
