<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\AdminAccountController;
use App\Http\Controllers\Api\TeacherStudentController;
use App\Http\Controllers\Api\SubjectController;
use App\Http\Controllers\Api\StudentProfileController;
use App\Http\Controllers\Api\TeacherProfileController;
use App\Http\Controllers\Api\BrowserActivityController;

Route::post('/login', [AuthController::class, 'login']);
Route::post('/validate-barcode', [AuthController::class, 'validateBarcode']);
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

    // Force close student browser (Admin/Teacher only)
    Route::post('/browser-activity/force-close/{studentId}', [BrowserActivityController::class, 'forceCloseBrowser']);
    // Force close specific student tab (Admin/Teacher only)
    Route::post('/browser-activity/force-close-tab/{studentId}', [BrowserActivityController::class, 'forceCloseTab']);
});

