<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use App\Mail\VerificationCodeMail;
use App\Services\EmailService;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string', 'min:3'],
        ]);

        $email = strtolower(trim($validated['email']));
        /** @var \App\Models\User|null $user */
        $user = \App\Models\User::whereRaw('LOWER(email) = ?', [$email])->first();

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'Email not found',
            ], 404);
        }

        if (!Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'ok' => false,
                'message' => 'Incorrect password',
            ], 401);
        }

        Auth::login($user);

        // Delete existing 'web' tokens to prevent flooding (allows only 1 active web session)
        $user->tokens()->where('name', 'web')->delete();

        // Create Sanctum token for API access
        $token = $user->createToken('web')->plainTextToken;

        // Get role from user - check if role column exists, otherwise determine by email
        $role = $user->role ?? 'student';

        // If role column doesn't exist or is null, determine role by email
        if (!$role || $role === 'student') {
            $email = strtolower($user->email);
            if (str_contains($email, 'admin')) {
                $role = 'admin';
            } elseif (str_contains($email, 'teacher')) {
                $role = 'teacher';
            } else {
                $role = 'student';
            }
        }

        $route = match ($role) {
            'student' => '/student/dashboard',
            'teacher' => '/teacher/dashboard',
            'admin' => '/admin/dashboard',
            default => '/student/dashboard',
        };

        // Try include student profile details if user is a student
        $studentNumber = null;
        $course = null;
        $section = null;
        if ($role === 'student') {
            $sp = \DB::table('student_profiles')->where('user_id', $user->id)->first();
            if ($sp) {
                $studentNumber = $sp->student_number;
                $course = $sp->course;
                $section = $sp->section;
            }
        }

        return response()->json([
            'ok' => true,
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'fullName' => $user->full_name ?? $user->name ?? null,
                'role' => $role,
                'student_number' => $studentNumber,
                'course' => $course,
                'section' => $section,
            ],
            'token' => $token,
            'route' => $route,
        ]);
    }

    public function me(Request $request)
    {
        /** @var \App\Models\User $user */
        $user = $request->user();
        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'Unauthenticated',
            ], 401);
        }

        $role = $user->role ?? 'student';
        $studentNumber = null;
        $course = null;
        $section = null;
        $profilePicture = null;
        if ($role === 'student') {
            $sp = \DB::table('student_profiles')->where('user_id', $user->id)->first();
            if ($sp) {
                $studentNumber = $sp->student_number;
                $course = $sp->course;
                $section = $sp->section;
                $profilePicture = $sp->profile_picture;
            }
        } elseif ($role === 'teacher') {
            $tp = \DB::table('teacher_profiles')->where('user_id', $user->id)->first();
            if ($tp) {
                $profilePicture = $tp->profile_picture;
            }
        }

        // Verify profile picture file actually exists (handles Railway ephemeral storage)
        if ($profilePicture && !str_starts_with($profilePicture, 'data:')) {
            $relativePath = $profilePicture;
            if (str_starts_with($relativePath, '/storage/')) {
                $relativePath = substr($relativePath, strlen('/storage/'));
            } elseif (str_starts_with($relativePath, 'storage/')) {
                $relativePath = substr($relativePath, strlen('storage/'));
            }
            $fullPath = storage_path('app/public/' . $relativePath);
            if (!file_exists($fullPath)) {
                // File was lost (e.g. Railway redeploy) — clear stale path
                $profilePicture = null;
                $table = $role === 'student' ? 'student_profiles' : 'teacher_profiles';
                \DB::table($table)->where('user_id', $user->id)->update(['profile_picture' => null]);
            }
        }

        if ($role === 'student') {
            if (!$studentNumber || !$course || !$section) {
                $row = \DB::table('bsit_students')->where('user_id', $user->id)->first();
                if ($row) {
                    $studentNumber = $studentNumber ?: $row->student_number;
                    $section = $section ?: $row->section;
                    $course = $course ?: 'BSIT';
                }
                if (!$row) {
                    $row = \DB::table('bscs_students')->where('user_id', $user->id)->first();
                    if ($row) {
                        $studentNumber = $studentNumber ?: $row->student_number;
                        $section = $section ?: $row->section;
                        $course = $course ?: 'BSCS';
                    }
                }
                if (!$row) {
                    $row = \DB::table('bsemc_students')->where('user_id', $user->id)->first();
                    if ($row) {
                        $studentNumber = $studentNumber ?: $row->student_number;
                        $section = $section ?: $row->section;
                        $course = $course ?: 'BSEMC';
                    }
                }
            }
        }

        return response()->json([
            'ok' => true,
            'data' => [
                'id' => $user->id,
                'full_name' => $user->full_name ?? $user->name ?? null,
                'email' => $user->email,
                'student_number' => $studentNumber,
                'course' => $course,
                'section' => $section,
                'profile_picture' => $profilePicture,
                'role' => $role,
            ],
        ]);
    }

    /**
     * Validate barcode and return student credentials with PIN status.
     * Used by desktop app when student enters the random barcode.
     */
    public function validateBarcode(Request $request)
    {
        $validated = $request->validate([
            'barcode' => ['required', 'string', 'max:50'],
        ]);

        $barcode = trim(strtoupper($validated['barcode']));

        // Find barcode in database
        $barcodeRecord = \DB::table('student_barcodes')
            ->where('barcode', $barcode)
            ->where('used', false)
            ->first();

        if (!$barcodeRecord) {
            return response()->json([
                'ok' => false,
                'message' => 'Invalid or expired barcode',
            ], 404);
        }

        // Check if barcode is expired
        if ($barcodeRecord->expires_at && now()->greaterThan($barcodeRecord->expires_at)) {
            return response()->json([
                'ok' => false,
                'message' => 'Barcode has expired',
            ], 400);
        }

        // Get user
        $user = \App\Models\User::find($barcodeRecord->user_id);
        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'Student not found',
            ], 404);
        }

        // Get student profile
        $profile = \DB::table('student_profiles')
            ->where('user_id', $user->id)
            ->first();

        if (!$profile) {
            // Fallback to course tables
            $row = \DB::table('bsit_students')->where('user_id', $user->id)->first();
            if (!$row) {
                $row = \DB::table('bscs_students')->where('user_id', $user->id)->first();
            }
            if (!$row) {
                $row = \DB::table('bsemc_students')->where('user_id', $user->id)->first();
            }

            if ($row) {
                $profile = (object) [
                    'student_number' => $row->student_number,
                    'course' => $row->course ?? ($row->course_code ?? null),
                    'section' => $row->section ?? null,
                    'pin' => null,
                ];
            }
        }

        if (!$profile) {
            return response()->json([
                'ok' => false,
                'message' => 'Student profile not found',
            ], 404);
        }

        // Check if PIN exists (PIN is hashed, so we can only check if it exists)
        $hasPin = !empty($profile->pin);

        // Mark barcode as used
        \DB::table('student_barcodes')
            ->where('id', $barcodeRecord->id)
            ->update(['used' => true, 'updated_at' => now()]);

        // Delete existing 'barcode' tokens to prevent flooding (allows only 1 active desktop app session)
        $user->tokens()->where('name', 'barcode')->delete();

        // Issue Sanctum token for desktop app
        $token = $user->createToken('barcode')->plainTextToken;

        return response()->json([
            'ok' => true,
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'fullName' => $user->full_name ?? $user->name ?? null,
                'role' => 'student',
                'student_number' => $profile->student_number ?? null,
                'course' => $profile->course ?? null,
                'section' => $profile->section ?? null,
            ],
            'credentials' => [
                'student_number' => $profile->student_number ?? null,
                'full_name' => $user->full_name ?? $user->name ?? null,
                'email' => $user->email,
                'course' => $profile->course ?? null,
                'section' => $profile->section ?? null,
                'has_pin' => $hasPin,
                'profile_picture' => $profile->profile_picture ?? null,
            ],
            'route' => '/student/dashboard',
        ]);
    }

    /**
     * Validate email and password, then return student credentials with PIN status.
     * Used by desktop app when student enters their email and password.
     */
    public function validateEmail(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:191'],
            'password' => ['required', 'string', 'min:3'],
        ]);

        $email = strtolower(trim($validated['email']));

        // Find user by email
        $user = \App\Models\User::whereRaw('LOWER(email) = ?', [$email])->first();

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'Email not found. Please check your email and try again.',
            ], 404);
        }

        // Validate password
        if (!Hash::check($validated['password'], $user->password)) {
            return response()->json([
                'ok' => false,
                'message' => 'Incorrect password. Please try again.',
            ], 401);
        }

        // Check if user is a student
        $role = $user->role ?? 'student';
        if ($role !== 'student') {
            return response()->json([
                'ok' => false,
                'message' => 'This email is not registered as a student.',
            ], 403);
        }

        // Check if user is active
        if (!$user->is_active) {
            return response()->json([
                'ok' => false,
                'message' => 'Your account is inactive. Please contact the administrator.',
            ], 403);
        }

        // Get student profile
        $profile = \DB::table('student_profiles')
            ->where('user_id', $user->id)
            ->first();

        if (!$profile) {
            // Fallback to course tables
            $row = \DB::table('bsit_students')->where('user_id', $user->id)->first();
            if (!$row) {
                $row = \DB::table('bscs_students')->where('user_id', $user->id)->first();
            }
            if (!$row) {
                $row = \DB::table('bsemc_students')->where('user_id', $user->id)->first();
            }

            if ($row) {
                $profile = (object) [
                    'student_number' => $row->student_number,
                    'course' => null,
                    'section' => $row->section ?? null,
                    'pin' => null,
                    'profile_picture' => null,
                ];
                // Determine course from table
                if (\DB::table('bsit_students')->where('user_id', $user->id)->exists()) {
                    $profile->course = 'BSIT';
                } elseif (\DB::table('bscs_students')->where('user_id', $user->id)->exists()) {
                    $profile->course = 'BSCS';
                } elseif (\DB::table('bsemc_students')->where('user_id', $user->id)->exists()) {
                    $profile->course = 'BSEMC';
                }
            }
        }

        if (!$profile) {
            return response()->json([
                'ok' => false,
                'message' => 'Student profile not found',
            ], 404);
        }

        // Generate 6-digit verification code
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $expiresAt = now()->addMinutes(10); // Code expires in 10 minutes

        // Invalidate any existing codes for this email
        DB::table('email_verification_codes')
            ->where('email', $email)
            ->where('used', false)
            ->update(['used' => true]);

        // Store verification code
        DB::table('email_verification_codes')->insert([
            'email' => $email,
            'code' => $code,
            'expires_at' => $expiresAt,
            'used' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Debug: Log code creation
        \Log::info('Verification code created', [
            'email' => $email,
            'code' => $code,
            'expires_at' => $expiresAt->toDateTimeString(),
            'current_time' => now()->toDateTimeString()
        ]);

        // Send verification code via email to the student's email address
        // Try multiple methods: SMTP, SendGrid, Mailgun, PHP mail()
        $emailSent = EmailService::sendVerificationCode($email, $code);

        // Check mailer configuration to provide better error message
        $mailer = config('mail.default');
        $mailUsername = config('mail.mailers.smtp.username');
        $isMailerLog = ($mailer === 'log' || $mailer === 'array');

        if ($emailSent) {
            return response()->json([
                'ok' => true,
                'message' => 'Verification code has been sent to your email. Please check your inbox (and spam folder).',
                'email' => $email,
                'email_sent' => true,
            ]);
        }

        // Email failed - provide detailed error message
        $errorMessage = 'Cannot send verification code. ';
        if ($isMailerLog) {
            $errorMessage .= 'Email service is set to LOG mode (emails are not sent, only logged). ';
            $errorMessage .= 'Please set MAIL_MAILER=smtp in your .env file and configure Gmail SMTP credentials.';
        } elseif (empty($mailUsername) || strpos($mailUsername, 'your-') !== false || strpos($mailUsername, 'null') !== false) {
            $errorMessage .= 'Gmail SMTP is not configured. ';
            $errorMessage .= 'Please set MAIL_USERNAME and MAIL_PASSWORD in your .env file with your Gmail App Password.';
        } else {
            $errorMessage .= 'Email service failed to send. Please check your email configuration or contact support.';
        }

        \Log::error('Email sending failed', [
            'email' => $email,
            'mailer' => $mailer,
            'smtp_configured' => !empty($mailUsername) && strpos($mailUsername, 'your-') === false
        ]);

        return response()->json([
            'ok' => true,
            'message' => $errorMessage,
            'email' => $email,
            'verification_code' => $code, // Return code so user can still test
            'email_sent' => false,
            'error_note' => 'Check Laravel logs for detailed error information. To fix: Configure MAIL_MAILER=smtp and Gmail credentials in .env',
        ]);
    }

    /**
     * Verify the email verification code and return student credentials with token.
     */
    public function verifyVerificationCode(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:191'],
            'code' => ['required', 'string', 'size:6'],
        ]);

        $email = strtolower(trim($validated['email']));
        $code = trim($validated['code']);

        // Debug: Log what we're looking for
        \Log::info('Verifying code', [
            'email' => $email,
            'code' => $code,
            'current_time' => now()->toDateTimeString()
        ]);

        // Find valid verification code
        $verificationCode = DB::table('email_verification_codes')
            ->where('email', $email)
            ->where('code', $code)
            ->where('used', false)
            ->where('expires_at', '>', now())
            ->first();

        // Debug: Log what we found
        if (!$verificationCode) {
            // Check if code exists but is expired or used
            $anyCode = DB::table('email_verification_codes')
                ->where('email', $email)
                ->where('code', $code)
                ->orderBy('created_at', 'desc')
                ->first();

            if ($anyCode) {
                \Log::warning('Code exists but failed validation', [
                    'email' => $email,
                    'code' => $code,
                    'used' => $anyCode->used,
                    'expires_at' => $anyCode->expires_at,
                    'current_time' => now()->toDateTimeString(),
                    'expired' => now()->gt($anyCode->expires_at)
                ]);

                if ($anyCode->used) {
                    return response()->json([
                        'ok' => false,
                        'message' => 'This verification code has already been used. Please request a new one.',
                    ], 400);
                }

                if (now()->gt($anyCode->expires_at)) {
                    return response()->json([
                        'ok' => false,
                        'message' => 'Verification code has expired. Please request a new one.',
                    ], 400);
                }
            } else {
                \Log::warning('Code not found in database', [
                    'email' => $email,
                    'code' => $code
                ]);
            }

            return response()->json([
                'ok' => false,
                'message' => 'Invalid verification code. Please check and try again.',
            ], 400);
        }

        \Log::info('Code verified successfully', ['email' => $email]);

        // Mark code as used
        DB::table('email_verification_codes')
            ->where('id', $verificationCode->id)
            ->update(['used' => true, 'updated_at' => now()]);

        // Get user
        $user = \App\Models\User::whereRaw('LOWER(email) = ?', [$email])->first();
        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'User not found',
            ], 404);
        }

        // Get student profile
        $profile = DB::table('student_profiles')
            ->where('user_id', $user->id)
            ->first();

        if (!$profile) {
            // Fallback to course tables
            $row = DB::table('bsit_students')->where('user_id', $user->id)->first();
            if (!$row) {
                $row = DB::table('bscs_students')->where('user_id', $user->id)->first();
            }
            if (!$row) {
                $row = DB::table('bsemc_students')->where('user_id', $user->id)->first();
            }

            if ($row) {
                $profile = (object) [
                    'student_number' => $row->student_number,
                    'course' => null,
                    'section' => $row->section ?? null,
                    'pin' => null,
                    'profile_picture' => null,
                ];
                // Determine course from table
                if (DB::table('bsit_students')->where('user_id', $user->id)->exists()) {
                    $profile->course = 'BSIT';
                } elseif (DB::table('bscs_students')->where('user_id', $user->id)->exists()) {
                    $profile->course = 'BSCS';
                } elseif (DB::table('bsemc_students')->where('user_id', $user->id)->exists()) {
                    $profile->course = 'BSEMC';
                }
            }
        }

        if (!$profile) {
            return response()->json([
                'ok' => false,
                'message' => 'Student profile not found',
            ], 404);
        }

        // Check if PIN exists
        $hasPin = !empty($profile->pin);

        // Delete existing 'web' tokens to prevent flooding (allows only 1 active web session)
        $user->tokens()->where('name', 'web')->delete();

        // Issue Sanctum token for desktop app
        $token = $user->createToken('web')->plainTextToken;

        return response()->json([
            'ok' => true,
            'token' => $token,
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'fullName' => $user->full_name ?? $user->name ?? null,
                'role' => 'student',
                'student_number' => $profile->student_number ?? null,
                'course' => $profile->course ?? null,
                'section' => $profile->section ?? null,
                'profile_picture' => $profile->profile_picture ?? null,
            ],
            'credentials' => [
                'student_number' => $profile->student_number ?? null,
                'full_name' => $user->full_name ?? $user->name ?? null,
                'email' => $user->email,
                'course' => $profile->course ?? null,
                'section' => $profile->section ?? null,
                'has_pin' => $hasPin,
                'profile_picture' => $profile->profile_picture ?? null,
            ],
            'route' => '/student/dashboard',
        ]);
    }

    /**
     * Resend verification code to email.
     */
    public function resendVerificationCode(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:191'],
        ]);

        $email = strtolower(trim($validated['email']));

        // Find user by email
        $user = \App\Models\User::whereRaw('LOWER(email) = ?', [$email])->first();

        if (!$user) {
            return response()->json([
                'ok' => false,
                'message' => 'Email not found.',
            ], 404);
        }

        // Check if user is a student
        $role = $user->role ?? 'student';
        if ($role !== 'student') {
            return response()->json([
                'ok' => false,
                'message' => 'This email is not registered as a student.',
            ], 403);
        }

        // Generate new 6-digit verification code
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $expiresAt = now()->addMinutes(10);

        // Invalidate any existing codes for this email
        DB::table('email_verification_codes')
            ->where('email', $email)
            ->where('used', false)
            ->update(['used' => true]);

        // Store new verification code
        DB::table('email_verification_codes')->insert([
            'email' => $email,
            'code' => $code,
            'expires_at' => $expiresAt,
            'used' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Send verification code via email to the student's email address
        // Try multiple methods: SMTP, SendGrid, Mailgun, PHP mail()
        $emailSent = EmailService::sendVerificationCode($email, $code);

        // Check mailer configuration to provide better error message
        $mailer = config('mail.default');
        $mailUsername = config('mail.mailers.smtp.username');
        $isMailerLog = ($mailer === 'log' || $mailer === 'array');

        if ($emailSent) {
            return response()->json([
                'ok' => true,
                'message' => 'Verification code has been resent to your email. Please check your inbox (and spam folder).',
                'email_sent' => true,
            ]);
        }

        // Email failed - provide detailed error message
        $errorMessage = 'Cannot resend verification code. ';
        if ($isMailerLog) {
            $errorMessage .= 'Email service is set to LOG mode (emails are not sent, only logged). ';
            $errorMessage .= 'Please set MAIL_MAILER=smtp in your .env file and configure Gmail SMTP credentials.';
        } elseif (empty($mailUsername) || strpos($mailUsername, 'your-') !== false || strpos($mailUsername, 'null') !== false) {
            $errorMessage .= 'Gmail SMTP is not configured. ';
            $errorMessage .= 'Please set MAIL_USERNAME and MAIL_PASSWORD in your .env file with your Gmail App Password.';
        } else {
            $errorMessage .= 'Email service failed to send. Please check your email configuration or contact support.';
        }

        \Log::error('Email resend failed', [
            'email' => $email,
            'mailer' => $mailer,
            'smtp_configured' => !empty($mailUsername) && strpos($mailUsername, 'your-') === false
        ]);

        return response()->json([
            'ok' => true,
            'message' => $errorMessage,
            'email_sent' => false,
        ]);

        return response()->json([
            'ok' => true,
            'message' => 'Verification code has been resent to your email.',
            'email_sent' => $emailSent,
        ]);
    }
}


