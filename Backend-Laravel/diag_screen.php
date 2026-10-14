<?php

require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

echo "========== monitoring_sessions table ==========\n";
$sessions = DB::table('monitoring_sessions')
    ->orderBy('id', 'desc')
    ->limit(5)
    ->get([
        'id', 'student_user_id', 'is_active',
        'session_start', 'session_end', 'updated_at',
        'computer_name', 'laboratory_room',
    ]);
foreach ($sessions as $s) {
    $student = DB::table('users')->where('id', $s->student_user_id)->first(['full_name', 'email']);
    $sname = $student->full_name ?? $student->email ?? "Unknown (id=$s->student_user_id)";
    echo sprintf(
        "[#%d] active=%s | student=%s | pc=%s | lab=%s | start=%s | end=%s | updated=%s\n",
        $s->id,
        $s->is_active ? 'TRUE  ' : 'FALSE ',
        $sname,
        var_export($s->computer_name, true),
        var_export($s->laboratory_room, true),
        $s->session_start ?? 'NULL',
        $s->session_end ?? 'NULL',
        $s->updated_at ?? 'NULL'
    );
}

echo "\n========== screen_monitor_frames table ==========\n";
$frames = DB::table('screen_monitor_frames')
    ->orderBy('id', 'desc')
    ->limit(5)
    ->get([
        'id', 'student_user_id', 'monitoring_session_id',
        'computer_name', 'laboratory_room',
        'captured_at',
    ]);
foreach ($frames as $f) {
    $student = DB::table('users')->where('id', $f->student_user_id)->first(['full_name', 'email']);
    $fname = $student->full_name ?? $student->email ?? "Unknown (id=$f->student_user_id)";
    echo sprintf(
        "[#%d] session_id=%s | student=%s | pc=%s | lab=%s | captured=%s\n",
        $f->id,
        $f->monitoring_session_id ?? 'NULL',
        $fname,
        var_export($f->computer_name, true),
        var_export($f->laboratory_room, true),
        $f->captured_at ?? 'NULL'
    );
}

echo "\n========== API getGrid RAW simulation ==========\n";
$user = DB::table('users')->where('role', 'teacher')->first();
if (!$user) $user = DB::table('users')->where('role', 'admin')->first();
$teacherId = $user ? $user->id : null;
echo "Using teacher/admin id: " . ($teacherId ?? 'NONE') . "\n";

$thresholdSeconds = 20; // what our fix should use
$threshold = date('Y-m-d H:i:s', time() - $thresholdSeconds);
echo "ONLINE threshold ({$thresholdSeconds}s ago): $threshold\n";

$allActive = DB::table('monitoring_sessions')
    ->where('is_active', true)
    ->count();
echo "is_active=true rows (ignoring updated_at): $allActive\n";

$activeRecent = DB::table('monitoring_sessions')
    ->where('is_active', true)
    ->where('updated_at', '>=', $threshold)
    ->count();
echo "is_active=true AND updated_at >= threshold: $activeRecent\n";

$oldActive = DB::table('monitoring_sessions')
    ->where('is_active', true)
    ->where('updated_at', '<', $threshold)
    ->get(['id', 'student_user_id', 'updated_at', 'computer_name']);
if ($oldActive->count() > 0) {
    echo "\n⚠️  STALE ACTIVE SESSIONS (active=true but too old):\n";
    foreach ($oldActive as $s) {
    $student = DB::table('users')->where('id', $s->student_user_id)->first(['full_name', 'email']);
    $sname = $student->full_name ?? $student->email ?? "id=$s->student_user_id";
        echo "   - session#$s->id : $sname on pc=$s->computer_name, updated_at=$s->updated_at\n";
    }
} else {
    echo "✅ No stale active sessions (auto-cleanup target is empty)\n";
}
