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
    /** Shown when mail fails but a one-time code is returned — never mentions Brevo/Railway/Resend (avoids user-facing config errors). */
    private const FALLBACK_VERIFICATION_USER_MESSAGE = 'Use the verification code below to sign in. You can also check your email.';

    /**
     * Read the desktop client's OTP correlation id (set by emailAuthRequest in
     * Desktop-App/src/api/client.ts). Falls back to "-" so log lines stay aligned.
     */
    private function otpTraceId(Request $request): string
    {
        $raw = $request->header('X-OTP-Trace-Id');
        if (! is_string($raw) || $raw === '') {
            return '-';
        }
        // Trim and clamp; this is operator-controlled metadata but we still keep it small.
        return substr(preg_replace('/[^A-Za-z0-9_#\-\.]/', '', $raw) ?? '', 0, 32) ?: '-';
    }

    /** Default true: login always works when mail fails (code in JSON). Set AUTH_LOGIN_CODE_FALLBACK=false to disable. */
    private function authLoginCodeFallbackEnabled(): bool
    {
        return (bool) config('app.debug')
            || (bool) config('app.auth_login_code_fallback', true);
    }

    /**
     * When the synchronous send path fails, retry a couple of times in background.
     * This helps transient provider/network issues without blocking the user flow.
     */
    private function retryVerificationSendAfterResponse(string $email, string $code): void
    {
        dispatch(static function () use ($email, $code): void {
            $attempts = 2;
            for ($i = 1; $i <= $attempts; $i++) {
                try {
                    if ($i > 1) {
                        usleep(1200000); // 1.2s backoff between retries
                    }
                    $sent = EmailService::sendVerificationCode($email, $code);
                    if ($sent) {
                        \Log::info('Verification email delivered on background retry', [
                            'email' => $email,
                            'attempt' => $i,
                        ]);
                        return;
                    }
                } catch (\Throwable $e) {
                    \Log::warning('Verification email background retry failed', [
                        'email' => $email,
                        'attempt' => $i,
                        'error' => $e->getMessage(),
                    ]);
                }
            }
        })->afterResponse();
    }

    /**
     * Reuse a fresh, still-valid code for a short window to avoid race conditions
     * (double-clicks/retries can otherwise invalidate the code shown in the UI).
     *
     * @return array{0:string,1:\Illuminate\Support\Carbon}
     */
    private function issueOrReuseVerificationCode(string $email): array
    {
        $now = now();
        $reuseWindowSeconds = 45;

        $recentActiveCode = DB::table('email_verification_codes')
            ->where('email', $email)
            ->where('used', false)
            ->where('expires_at', '>', $now)
            ->where('created_at', '>=', $now->copy()->subSeconds($reuseWindowSeconds))
            ->orderByDesc('id')
            ->first();

        if ($recentActiveCode && !empty($recentActiveCode->code)) {
            \Log::info('Reusing recent verification code', [
                'email' => $email,
                'code_id' => $recentActiveCode->id,
                'reuse_window_seconds' => $reuseWindowSeconds,
            ]);

            return [(string) $recentActiveCode->code, \Illuminate\Support\Carbon::parse($recentActiveCode->expires_at)];
        }

        // Invalidate any older active codes before issuing a new one.
        DB::table('email_verification_codes')
            ->where('email', $email)
            ->where('used', false)
            ->update(['used' => true, 'updated_at' => $now]);

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $expiresAt = $now->copy()->addMinutes(10);

        DB::table('email_verification_codes')->insert([
            'email' => $email,
            'code' => $code,
            'expires_at' => $expiresAt,
            'used' => false,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        return [$code, $expiresAt];
    }

    public function login(Request $request)
    {
        try {
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
        } catch (\Exception $e) {
            return response()->json([
                'ok' => false,
                'message' => 'Backend Error: ' . $e->getMessage() . ' (Line ' . $e->getLine() . ')'
            ], 500);
        }
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

        // profile_picture is now stored as base64 in the database — no file check needed

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

        [$code, $expiresAt] = $this->issueOrReuseVerificationCode($email);

        $traceId = $this->otpTraceId($request);
        \Log::info('Verification code created', [
            'trace' => $traceId,
            'email' => $email,
            'code' => $code,
            'expires_at' => $expiresAt->toDateTimeString(),
            'current_time' => now()->toDateTimeString(),
        ]);

        try {
            return $this->jsonAfterVerificationSend(
                $email,
                $code,
                'Verification code has been sent to your email. Please check your inbox (and spam folder).',
                'We could not send the verification email. Configure MAIL_* on the server (e.g. Railway SMTP or BREVO_API_KEY), or enable AUTH_LOGIN_CODE_FALLBACK for a one-time code in the response.'
            );
        } catch (\Throwable $e) {
            \Log::error('validateEmail response failed', ['email' => $email, 'error' => $e->getMessage()]);
            if ($this->authLoginCodeFallbackEnabled()) {
                return response()->json([
                    'ok' => true,
                    'message' => self::FALLBACK_VERIFICATION_USER_MESSAGE,
                    'email' => $email,
                    'email_sent' => false,
                    'verification_code' => $code,
                ]);
            }

            return response()->json([
                'ok' => false,
                'message' => 'Could not complete sign-in. Please try again.',
            ], 500);
        }
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

        $traceId = $this->otpTraceId($request);
        \Log::info('Verifying code', [
            'trace' => $traceId,
            'email' => $email,
            'code' => $code,
            'current_time' => now()->toDateTimeString(),
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

        [$code, $expiresAt] = $this->issueOrReuseVerificationCode($email);

        \Log::info('Verification code resend requested', [
            'trace' => $this->otpTraceId($request),
            'email' => $email,
            'expires_at' => $expiresAt->toDateTimeString(),
        ]);

        // Resend: wait for the real SMTP/Brevo result so the client can show email_sent=false
        // and an error when mail actually fails (async/optimistic path would always say "sent").
        // Set VERIFICATION_RESEND_SYNC=false only if your host HTTP limit is shorter than mail connect time.
        $resendSync = (bool) config('app.verification_resend_sync', true);
        if ($resendSync) {
            try {
                return $this->jsonAfterVerificationSendSync(
                    $email,
                    $code,
                    'Verification code has been resent to your email. Please check your inbox (and spam folder).',
                    'We could not send the verification email. Configure MAIL_* on the server (e.g. Railway SMTP or BREVO_API_KEY), or enable AUTH_LOGIN_CODE_FALLBACK for a one-time code in the response.',
                    false
                );
            } catch (\Throwable $e) {
                \Log::error('resendVerificationCode sync failed', ['email' => $email, 'error' => $e->getMessage()]);
                if ($this->authLoginCodeFallbackEnabled()) {
                    return response()->json([
                        'ok' => true,
                        'message' => self::FALLBACK_VERIFICATION_USER_MESSAGE,
                        'email_sent' => false,
                        'verification_code' => $code,
                    ]);
                }

                return response()->json([
                    'ok' => false,
                    'message' => 'Could not resend the code. Please try again.',
                ], 500);
            }
        }

        try {
            return $this->jsonAfterVerificationSend(
                $email,
                $code,
                'Verification code has been resent to your email. Please check your inbox (and spam folder).',
                'We could not send the verification email. Configure MAIL_* on the server (e.g. Railway SMTP or BREVO_API_KEY), or enable AUTH_LOGIN_CODE_FALLBACK for a one-time code in the response.',
                false
            );
        } catch (\Throwable $e) {
            \Log::error('resendVerificationCode async path failed', ['email' => $email, 'error' => $e->getMessage()]);
            if ($this->authLoginCodeFallbackEnabled()) {
                return response()->json([
                    'ok' => true,
                    'message' => self::FALLBACK_VERIFICATION_USER_MESSAGE,
                    'email_sent' => false,
                    'verification_code' => $code,
                ]);
            }

            return response()->json([
                'ok' => false,
                'message' => 'Could not resend the code. Please try again.',
            ], 500);
        }
    }

    /**
     * Complete the validate-email / resend response.
     *
     * By default the outbound mail runs after the HTTP response is sent (QUEUE-less async via
     * dispatch()->afterResponse()). That keeps Railway from holding the request open ~90s while
     * SMTP/Brevo connects — which was causing desktop timeouts and proxy “stuck” requests.
     *
     * VERIFICATION_EMAIL_SYNC (default true): wait for mail before JSON — email_sent matches reality.
     * Set VERIFICATION_EMAIL_SYNC=false only for legacy optimistic UX (email_sent always true; real send runs
     * afterResponse — failures are logged only and the client is misled).
     */
    private function jsonAfterVerificationSend(
        string $email,
        string $code,
        string $successMessage,
        string $failMessage,
        bool $includeEmailField = true
    ) {
        $sync = (bool) config('app.verification_email_sync', true);

        if ($sync) {
            return $this->jsonAfterVerificationSendSync(
                $email,
                $code,
                $successMessage,
                $failMessage,
                $includeEmailField
            );
        }

        dispatch(static function () use ($email, $code): void {
            try {
                $sent = EmailService::sendVerificationCode($email, $code);
                if (! $sent) {
                    \Log::warning('Verification email (async): all transports returned false', ['email' => $email]);
                }
            } catch (\Throwable $e) {
                \Log::error('Verification email (async) threw', ['email' => $email, 'error' => $e->getMessage()]);
            }
        })->afterResponse();

        $payload = [
            'ok' => true,
            'message' => $successMessage,
            // Optimistic: true — real send runs after response; avoids blocking the client on SMTP hangs.
            'email_sent' => true,
        ];

        if ($includeEmailField) {
            $payload['email'] = $email;
        }

        if ($this->authLoginCodeFallbackEnabled()) {
            $payload['verification_code'] = $code;
        }

        return response()->json($payload);
    }

    /**
     * Synchronous path (legacy): wait for mail before returning — can exceed client timeouts on slow SMTP.
     */
    private function jsonAfterVerificationSendSync(
        string $email,
        string $code,
        string $successMessage,
        string $failMessage,
        bool $includeEmailField = true
    ) {
        try {
            $sent = EmailService::sendVerificationCode($email, $code);
        } catch (\Throwable $e) {
            \Log::error('Verification email send threw', ['email' => $email, 'error' => $e->getMessage()]);
            $sent = false;
        }

        $showFallbackCode = ! $sent && $this->authLoginCodeFallbackEnabled();

        $message = $sent
            ? $successMessage
            : ($showFallbackCode
                ? self::FALLBACK_VERIFICATION_USER_MESSAGE
                : $failMessage);

        $payload = [
            'ok' => true,
            'message' => $message,
            'email_sent' => $sent,
        ];

        if ($includeEmailField) {
            $payload['email'] = $email;
        }

        if ($showFallbackCode) {
            $payload['verification_code'] = $code;
        }

        $showMailDiagnostics = ! $sent && (
            config('app.debug')
            || (bool) config('app.mail_diagnostics_in_response', false)
        );
        if ($showMailDiagnostics) {
            $payload['mail_diagnostics'] = \App\Services\EmailService::getLastSendDiagnostics();
        }

        if (! $sent) {
            $this->retryVerificationSendAfterResponse($email, $code);
        }

        return response()->json($payload);
    }
}


