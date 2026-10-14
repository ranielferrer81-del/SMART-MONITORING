<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

echo "=== KILL ALL GHOST SESSIONS + TOKENS ===\n\n";

$students = DB::table('users')->where('role', 'student')->get(['id', 'full_name', 'email']);

$totalSessionsEnded = 0;
$totalTokensRevoked = 0;

foreach ($students as $s) {
    $sname = $s->full_name ?? $s->email ?? "id=$s->id";

    // 1) Revoke ALL Sanctum personal access tokens for this student.
    //    Without a valid token, NO client (Electron / Chrome ext) can send
    //    heartbeats, so NO new monitoring session can be created.
    $tokensBefore = DB::table('personal_access_tokens')
        ->where('tokenable_type', 'App\\Models\\User')
        ->where('tokenable_id', $s->id)
        ->count();
    if ($tokensBefore > 0) {
        DB::table('personal_access_tokens')
            ->where('tokenable_type', 'App\\Models\\User')
            ->where('tokenable_id', $s->id)
            ->delete();
        echo "[$sname] Revoked $tokensBefore personal_access_tokens\n";
        $totalTokensRevoked += $tokensBefore;
    }

    // 2) End every active monitoring session (regardless of updated_at)
    $sessionsBefore = DB::table('monitoring_sessions')
        ->where('student_user_id', $s->id)
        ->where('is_active', true)
        ->count();
    if ($sessionsBefore > 0) {
        DB::table('monitoring_sessions')
            ->where('student_user_id', $s->id)
            ->where('is_active', true)
            ->update([
                'is_active' => false,
                'session_end' => date('Y-m-d H:i:s'),
            ]);
        echo "[$sname] Ended $sessionsBefore active monitoring_sessions\n";
        $totalSessionsEnded += $sessionsBefore;
    }
}

echo "\n=== SUMMARY ===\n";
echo "Total tokens revoked:       $totalTokensRevoked\n";
echo "Total sessions ended:       $totalSessionsEnded\n";

$stillActive = DB::table('monitoring_sessions')->where('is_active', true)->count();
$anyTokens   = DB::table('personal_access_tokens')
    ->where('tokenable_type', 'App\\Models\\User')
    ->join('users', 'users.id', '=', 'personal_access_tokens.tokenable_id')
    ->where('users.role', 'student')
    ->count();
echo "Student sessions still active: $stillActive\n";
echo "Student tokens still present:  $anyTokens\n";

echo "\nDone. Refresh the teacher dashboard — NO ghost card should re-appear because\n";
echo "there are NO valid tokens left that a client could use to send heartbeats.\n";
echo "To bring a student back, physically log the student back in through the login\n";
echo "form (creates a NEW token + NEW session on the next real heartbeat).\n";
