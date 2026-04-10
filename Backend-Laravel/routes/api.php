<?php

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;



// Explicit CORS preflight handler for ALL API routes - safety net
Route::options('/{any}', function () {
    return response('', 200)
        ->header('Access-Control-Allow-Origin', '*')
        ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
        ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept')
        ->header('Access-Control-Max-Age', '86400');
})->where('any', '.*');


// TEMPORARY: Fix profile_picture columns for base64 storage - visit once then remove
Route::get('/fix-profile-columns', function () {
    try {
        DB::statement('ALTER TABLE student_profiles MODIFY profile_picture LONGTEXT DEFAULT NULL');
        DB::statement('ALTER TABLE teacher_profiles MODIFY profile_picture LONGTEXT DEFAULT NULL');
        // Clear any stale file paths (not base64)
        DB::table('student_profiles')
            ->whereNotNull('profile_picture')
            ->where('profile_picture', 'NOT LIKE', 'data:%')
            ->update(['profile_picture' => null]);
        DB::table('teacher_profiles')
            ->whereNotNull('profile_picture')
            ->where('profile_picture', 'NOT LIKE', 'data:%')
            ->update(['profile_picture' => null]);
        return response()->json(['ok' => true, 'message' => 'Columns altered to LONGTEXT and stale paths cleared']);
    } catch (\Exception $e) {
        return response()->json(['ok' => false, 'error' => $e->getMessage()]);
    }
});

// TEMPORARY: Database import route - DELETE AFTER USE
Route::get('/run-import', function () {
    set_time_limit(300);
    $log = [];

    try {
        $sqlFile = database_path('legacy_seed.sql');
        if (!file_exists($sqlFile)) {
            return response()->json(['error' => 'SQL file not found at: ' . $sqlFile]);
        }
        $log[] = 'SQL file found: ' . filesize($sqlFile) . ' bytes';

        // Drop everything first
        DB::statement('SET FOREIGN_KEY_CHECKS=0');
        $log[] = 'Foreign key checks disabled';

        // Drop views
        $views = DB::select("SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE()");
        foreach ($views as $v) {
            DB::statement("DROP VIEW IF EXISTS `{$v->TABLE_NAME}`");
            $log[] = "Dropped view: {$v->TABLE_NAME}";
        }

        // Drop tables
        $tables = DB::select("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'");
        foreach ($tables as $t) {
            DB::statement("DROP TABLE IF EXISTS `{$t->TABLE_NAME}`");
            $log[] = "Dropped table: {$t->TABLE_NAME}";
        }

        // Drop functions
        $funcs = DB::select("SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE = 'FUNCTION'");
        foreach ($funcs as $f) {
            DB::statement("DROP FUNCTION IF EXISTS `{$f->ROUTINE_NAME}`");
            $log[] = "Dropped function: {$f->ROUTINE_NAME}";
        }

        $log[] = 'All objects dropped';

        // Read and clean SQL
        $sql = file_get_contents($sqlFile);
        $sql = preg_replace('/DEFINER\s*=\s*`[^`]*`@`[^`]*`\s*/i', '', $sql);
        $sql = preg_replace('/SQL\s+SECURITY\s+DEFINER\s*/i', '', $sql);
        $sql = preg_replace('/ALGORITHM\s*=\s*UNDEFINED\s*/i', '', $sql);
        $log[] = 'SQL cleaned of DEFINER/ALGORITHM clauses';

        // Parse statements (handle DELIMITER)
        $statements = [];
        $delimiter = ';';
        $current = '';
        foreach (explode("\n", $sql) as $line) {
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '--') || str_starts_with($trimmed, '#'))
                continue;
            if (preg_match('/^\s*DELIMITER\s+(\S+)\s*$/i', $trimmed, $m)) {
                $delimiter = $m[1];
                continue;
            }
            $current .= $line . "\n";
            $check = rtrim($current);
            if (strlen($check) >= strlen($delimiter) && substr($check, -strlen($delimiter)) === $delimiter) {
                $stmt = trim(substr($check, 0, -strlen($delimiter)));
                if ($stmt !== '')
                    $statements[] = $stmt;
                $current = '';
            }
        }
        if (trim($current) !== '')
            $statements[] = trim($current);

        $log[] = 'Parsed ' . count($statements) . ' statements';

        // Execute
        $errors = 0;
        foreach ($statements as $i => $stmt) {
            try {
                DB::unprepared($stmt);
            } catch (\Exception $e) {
                $errors++;
                $preview = substr($stmt, 0, 80);
                $log[] = "ERROR #{$errors} in statement " . ($i + 1) . ": " . $e->getMessage() . " | SQL: {$preview}...";
            }
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=1');
        $log[] = "Done! {$errors} errors out of " . count($statements) . " statements";

        return response()->json(['success' => true, 'errors' => $errors, 'log' => $log]);

    } catch (\Exception $e) {
        $log[] = 'FATAL: ' . $e->getMessage();
        return response()->json(['success' => false, 'log' => $log]);
    }
});
// TEMPORARY: Wipe all stale FORCE_CLOSE commands - visit once then remove
Route::get('/cleanup-close-commands', function () {
    try {
        $deleted = DB::table('browser_activities')
            ->whereIn('url', ['FORCE_CLOSE_COMMAND', 'FORCE_CLOSE_TAB_COMMAND'])
            ->delete();
        return response()->json(['ok' => true, 'deleted' => $deleted, 'message' => "Deleted {$deleted} stale close commands"]);
    } catch (\Exception $e) {
        return response()->json(['ok' => false, 'error' => $e->getMessage()]);
    }
});

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AdminAccountController;
use App\Http\Controllers\Api\TeacherStudentController;
use App\Http\Controllers\Api\SubjectController;
use App\Http\Controllers\Api\StudentProfileController;
use App\Http\Controllers\Api\TeacherProfileController;
use App\Http\Controllers\Api\BrowserActivityController;
use App\Http\Controllers\Api\LabComputerController;
use App\Http\Controllers\Api\LabGatewayController;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/validate-email', [AuthController::class, 'validateEmail']);
Route::post('/verify-verification-code', [AuthController::class, 'verifyVerificationCode']);
Route::post('/resend-verification-code', [AuthController::class, 'resendVerificationCode']);

// Admin-managed accounts
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/admin/accounts', [AdminAccountController::class, 'store']);
    Route::get('/admin/accounts/teachers', [AdminAccountController::class, 'indexTeachers']);
    Route::get('/admin/accounts/students', [AdminAccountController::class, 'indexAllStudents']);
    Route::get('/admin/accounts/students/{course}', [AdminAccountController::class, 'indexStudentsByCourse']);
    Route::patch('/admin/accounts/{userId}', [AdminAccountController::class, 'update']);
    Route::delete('/admin/accounts/{userId}', [AdminAccountController::class, 'destroy']);

    // Student profile picture
    Route::post('/student/profile-picture', [StudentProfileController::class, 'uploadProfilePicture']);
    Route::delete('/student/profile-picture', [StudentProfileController::class, 'deleteProfilePicture']);

    // Student PIN
    Route::post('/student/pin', [StudentProfileController::class, 'updatePin']);
    Route::post('/student/validate-pin', [StudentProfileController::class, 'validatePin']);
    // Student profile update (name, password)
    Route::patch('/student/profile', [StudentProfileController::class, 'updateProfile']);
    // Student enrolled subjects (for StudentDashboard "My Subject")
    Route::get('/student/subjects', [StudentProfileController::class, 'enrolledSubjects']);
    // Student attendance per subject
    Route::get('/student/subjects/{id}/attendance', [StudentProfileController::class, 'attendanceForSubject']);
    // Student attendance check-in flow
    Route::get('/student/open-sessions', [StudentProfileController::class, 'openSessions']);
    Route::post('/student/subjects/{id}/check-in', [StudentProfileController::class, 'checkInSubject']);

    // Teacher profile picture
    Route::post('/teacher/profile-picture', [TeacherProfileController::class, 'uploadProfilePicture']);
    Route::delete('/teacher/profile-picture', [TeacherProfileController::class, 'deleteProfilePicture']);
});

// Teacher access to students by course (requires teacher token)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/teacher/students', [TeacherStudentController::class, 'indexAll']); // Get ALL students
    Route::get('/teacher/students/{course}', [TeacherStudentController::class, 'index']);
    // subjects
    Route::get('/subjects', [SubjectController::class, 'index']);
    Route::get('/subjects/{id}', [SubjectController::class, 'show']);
    Route::post('/subjects', [SubjectController::class, 'store']);
    Route::post('/subjects/{id}/enroll', [SubjectController::class, 'enrollStudent']);
    Route::post('/subjects/{id}/enroll-all', [SubjectController::class, 'enrollAllStudents']);
    Route::put('/subjects/{id}/schedules', [SubjectController::class, 'upsertSchedules']);
    // Manual attendance controls (present / late / absent)
    Route::post('/subjects/{id}/attendance', [SubjectController::class, 'recordAttendance']);
    // Get attendance history for a student in a subject
    Route::get('/subjects/{subjectId}/students/{studentId}/attendance', [SubjectController::class, 'getStudentAttendanceHistory']);
    // Update a specific attendance record
    Route::patch('/subjects/{subjectId}/students/{studentId}/attendance/{recordId}', [SubjectController::class, 'updateAttendanceRecord']);
    Route::delete('/subjects/{id}/unenroll/{studentId}', [SubjectController::class, 'unenrollStudent']);
    Route::delete('/subjects/{id}', [SubjectController::class, 'destroy']);
});

// Browser Monitoring System
Route::middleware('auth:sanctum')->group(function () {
    // Student endpoints - log their own activity
    Route::post('/browser-activity/log', [BrowserActivityController::class, 'logActivity']);
    Route::post('/browser-activity/heartbeat', [BrowserActivityController::class, 'heartbeat']);
    Route::post('/browser-activity/end-my-session', [BrowserActivityController::class, 'endMySession']);
    Route::get('/browser-activity/status', [BrowserActivityController::class, 'getMyStatus']);
    Route::post('/browser-activity/incognito-alert', [BrowserActivityController::class, 'logIncognitoAlert']);
    Route::post('/browser-activity/clear-commands', [BrowserActivityController::class, 'clearCommands']);

    // Admin/Teacher endpoints - view student activity
    Route::get('/browser-activity/student/{studentId}', [BrowserActivityController::class, 'getStudentActivity']);
    Route::get('/browser-activity/student/{studentId}/open-tabs', [BrowserActivityController::class, 'getStudentOpenTabs']);
    Route::get('/browser-activity/online-students', [BrowserActivityController::class, 'getOnlineStudents']);
    Route::get('/browser-activity/realtime', [BrowserActivityController::class, 'getRealtimeActivity']);
    Route::get('/browser-activity/incognito-alerts', [BrowserActivityController::class, 'getIncognitoAlerts']);
    Route::patch('/browser-activity/incognito-alerts/{alertId}/acknowledge', [BrowserActivityController::class, 'acknowledgeAlert']);

    // Session management (Admin/Teacher only)
    Route::post('/monitoring-sessions/start', [BrowserActivityController::class, 'startSession']);
    Route::post('/monitoring-sessions/{sessionId}/end', [BrowserActivityController::class, 'endSession']);
    Route::get('/monitoring-sessions', [BrowserActivityController::class, 'getSessions']);

    // Erase stored monitoring history only — no tab/browser close (Admin only)
    Route::post('/browser-activity/student/{studentId}/clear-history', [BrowserActivityController::class, 'clearStudentHistory']);

    // Force close student browser (Admin/Teacher only)
    Route::post('/browser-activity/force-close/{studentId}', [BrowserActivityController::class, 'forceCloseBrowser']);
    // Force close specific student tab (Admin/Teacher only)
    Route::post('/browser-activity/force-close-tab/{studentId}', [BrowserActivityController::class, 'forceCloseTab']);

    // Lab Computer Management (hostname-to-room mapping)
    Route::get('/lab-computers', [LabComputerController::class, 'index']);
    Route::post('/lab-computers', [LabComputerController::class, 'store']);
    Route::patch('/lab-computers/{id}', [LabComputerController::class, 'update']);
    Route::delete('/lab-computers/{id}', [LabComputerController::class, 'destroy']);
    Route::get('/lab-computers/rooms', [LabComputerController::class, 'rooms']);

    // Lab Gateway Management (gateway-to-room mapping)
    Route::get('/lab-gateways', [LabGatewayController::class, 'index']);
    Route::post('/lab-gateways', [LabGatewayController::class, 'store']);
    Route::patch('/lab-gateways/{id}', [LabGatewayController::class, 'update']);
    Route::delete('/lab-gateways/{id}', [LabGatewayController::class, 'destroy']);
});

