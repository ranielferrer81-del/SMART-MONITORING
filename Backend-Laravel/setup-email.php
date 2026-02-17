<?php
/**
 * Quick Email Setup Script
 * Run this: php setup-email.php
 */

echo "\n========================================\n";
echo "GMAIL EMAIL SETUP FOR SIA SYSTEM\n";
echo "========================================\n\n";

$envFile = __DIR__ . '/.env';

if (!file_exists($envFile)) {
    echo "❌ .env file not found!\n";
    exit(1);
}

echo "This script will help you configure Gmail to send verification codes.\n\n";
echo "You need:\n";
echo "1. A Gmail account (any Gmail - yours, admin's, etc.)\n";
echo "2. Gmail App Password (get it from: https://myaccount.google.com/apppasswords)\n\n";

echo "Enter your Gmail address: ";
$gmail = trim(fgets(STDIN));

if (empty($gmail) || !filter_var($gmail, FILTER_VALIDATE_EMAIL)) {
    echo "❌ Invalid email address!\n";
    exit(1);
}

echo "Enter your Gmail App Password (16 characters, no spaces): ";
$password = trim(fgets(STDIN));

if (empty($password) || strlen(str_replace(' ', '', $password)) < 16) {
    echo "❌ Invalid app password! It should be 16 characters.\n";
    echo "Get it from: https://myaccount.google.com/apppasswords\n";
    exit(1);
}

// Remove spaces from password
$password = str_replace(' ', '', $password);

// Read .env file
$envContent = file_get_contents($envFile);

// Update email settings
$envContent = preg_replace('/^MAIL_USERNAME=.*/m', "MAIL_USERNAME={$gmail}", $envContent);
$envContent = preg_replace('/^MAIL_PASSWORD=.*/m', "MAIL_PASSWORD={$password}", $envContent);
$envContent = preg_replace('/^MAIL_FROM_ADDRESS=.*/m', "MAIL_FROM_ADDRESS=\"{$gmail}\"", $envContent);

// Ensure other settings are correct
$envContent = preg_replace('/^MAIL_MAILER=.*/m', 'MAIL_MAILER=smtp', $envContent);
$envContent = preg_replace('/^MAIL_HOST=.*/m', 'MAIL_HOST=smtp.gmail.com', $envContent);
$envContent = preg_replace('/^MAIL_PORT=.*/m', 'MAIL_PORT=587', $envContent);
$envContent = preg_replace('/^MAIL_ENCRYPTION=.*/m', 'MAIL_ENCRYPTION=tls', $envContent);
$envContent = preg_replace('/^MAIL_FROM_NAME=.*/m', 'MAIL_FROM_NAME="SIA"', $envContent);

// Write back
file_put_contents($envFile, $envContent);

echo "\n✅ .env file updated successfully!\n\n";
echo "Configuration:\n";
echo "  Gmail: {$gmail}\n";
echo "  App Password: " . str_repeat('*', strlen($password)) . "\n\n";

echo "Now run: php artisan config:clear\n";
echo "Then restart your Laravel server.\n\n";
echo "Verification codes will be sent to students' email addresses!\n\n";

