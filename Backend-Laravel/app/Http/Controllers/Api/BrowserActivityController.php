<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use App\Models\BrowserActivity;
use App\Models\MonitoringSession;
use App\Models\IncognitoAlert;
use App\Models\LabComputer;
use App\Models\LabGateway;
use Illuminate\Support\Facades\Validator;

class BrowserActivityController extends Controller
{
    /**
     * Validate and filter desktop telemetry (optional JSON body key "desktop").
     * Chrome extension does not send this key — device_info.desktop is unchanged.
     *
     * @return array<string, mixed>
     */
    private function validatedDesktopTelemetry(Request $request): array
    {
        if (! $request->has('desktop')) {
            return [];
        }

        $validated = Validator::make($request->all(), [
            'desktop' => ['required', 'array'],
            'desktop.app_version' => ['nullable', 'string', 'max:120'],
            'desktop.electron_version' => ['nullable', 'string', 'max:80'],
            'desktop.platform' => ['nullable', 'string', 'max:80'],
            'desktop.current_screen' => ['nullable', 'string', 'max:64'],
            'desktop.screen_entered_at' => ['nullable', 'date'],
            'desktop.monitoring_ready_at' => ['nullable', 'date'],
            'desktop.client_reported_at' => ['nullable', 'date'],
        ])->validate();

        $desktop = isset($validated['desktop']) && is_array($validated['desktop']) ? $validated['desktop'] : [];

        return array_filter(
            $desktop,
            static fn ($v) => $v !== null && $v !== ''
        );
    }

    /**
     * Shallow-merge desktop patch into monitoring_sessions.device_info.
     *
     * @param  array<string, mixed>|null  $deviceInfo
     * @param  array<string, mixed>  $desktopPatch
     * @return array<string, mixed>
     */
    private function mergeDesktopIntoDeviceInfo($deviceInfo, array $desktopPatch): array
    {
        $base = is_array($deviceInfo) ? $deviceInfo : [];
        $cur = isset($base['desktop']) && is_array($base['desktop']) ? $base['desktop'] : [];
        foreach ($desktopPatch as $k => $v) {
            if ($v === '' || $v === null) {
                continue;
            }
            $cur[$k] = $v;
        }
        $base['desktop'] = $cur;

        return $base;
    }

    /**
     * Log browser activity from Chrome extension
     */
    public function logActivity(Request $request)
    {
        $request->validate([
            'url' => 'required|string',
            'page_title' => 'nullable|string|max:500',
            'visit_timestamp' => 'required|date',
            'tab_id' => 'nullable|string|max:50',
            'is_incognito' => 'boolean',
        ]);

        $user = Auth::user();

        // Only students can log activities
        if ($user->role !== 'student') {
            return response()->json(['error' => 'Only students can log browser activity'], 403);
        }

        // Get active session for this student
        $activeSession = MonitoringSession::where('student_user_id', $user->id)
            ->where('is_active', true)
            ->latest('session_start')
            ->first();

        $activity = BrowserActivity::create([
            'student_user_id' => $user->id,
            'url' => $request->url,
            'page_title' => $request->page_title,
            'visit_timestamp' => $request->visit_timestamp,
            'tab_id' => $request->tab_id,
            'is_incognito' => $request->is_incognito ?? false,
            'session_id' => $activeSession?->id,
        ]);

        return response()->json([
            'success' => true,
            'activity_id' => $activity->id,
        ]);
    }

    /**
     * Log incognito mode detection
     */
    public function logIncognitoAlert(Request $request)
    {
        $user = Auth::user();

        if ($user->role !== 'student') {
            return response()->json(['error' => 'Only students can log alerts'], 403);
        }

        $activeSession = MonitoringSession::where('student_user_id', $user->id)
            ->where('is_active', true)
            ->latest('session_start')
            ->first();

        $alert = IncognitoAlert::create([
            'student_user_id' => $user->id,
            'detected_at' => now(),
            'session_id' => $activeSession?->id,
        ]);

        return response()->json([
            'success' => true,
            'alert_id' => $alert->id,
        ]);
    }

    /**
     * Heartbeat to keep session alive
     */
    public function heartbeat(Request $request)
    {
        $user = Auth::user();

        if ($user->role !== 'student') {
            return response()->json(['error' => 'Only students can send heartbeats'], 403);
        }

        $request->validate([
            'computer_name' => 'nullable|string|max:255',
            'gateway_ip' => 'nullable|ip',
        ]);

        $desktopPatch = $this->validatedDesktopTelemetry($request);

        // Keep backward compatibility: both fields are optional.
        $computerName = $request->input('computer_name');
        $gatewayIp = $request->input('gateway_ip');
        $labContext = $this->resolveLabContext($computerName, $gatewayIp, true);
        $hasComputerNameColumn = Schema::hasColumn('monitoring_sessions', 'computer_name');
        $hasGatewayIpColumn = Schema::hasColumn('monitoring_sessions', 'gateway_ip');
        $hasLaboratoryRoomColumn = Schema::hasColumn('monitoring_sessions', 'laboratory_room');

        // Get or create active session
        $activeSession = MonitoringSession::where('student_user_id', $user->id)
            ->where('is_active', true)
            ->latest('session_start')
            ->first();

        if ($activeSession) {
            $hasChanges = false;

            if (
                $hasComputerNameColumn &&
                $computerName &&
                $activeSession->computer_name !== $labContext['computer_name']
            ) {
                $activeSession->computer_name = $labContext['computer_name'];
                $hasChanges = true;
            }

            if (
                $hasGatewayIpColumn &&
                $gatewayIp !== null &&
                $activeSession->gateway_ip !== $labContext['gateway_ip']
            ) {
                $activeSession->gateway_ip = $labContext['gateway_ip'];
                $hasChanges = true;
            }

            if (
                $hasLaboratoryRoomColumn &&
                $gatewayIp !== null &&
                $activeSession->laboratory_room !== $labContext['laboratory_room']
            ) {
                $activeSession->laboratory_room = $labContext['laboratory_room'];
                $hasChanges = true;
            }

            if ($desktopPatch !== [] && Schema::hasColumn('monitoring_sessions', 'device_info')) {
                $merged = $this->mergeDesktopIntoDeviceInfo($activeSession->device_info, $desktopPatch);
                $before = json_encode($activeSession->device_info ?? []);
                $after = json_encode($merged);
                if ($before !== $after) {
                    $activeSession->device_info = $merged;
                    $hasChanges = true;
                }
            }

            if ($hasChanges) {
                $activeSession->save();
            } else {
                $activeSession->touch(); // Updates updated_at
            }
        } else {
            // Auto-start a session if none exists
            $payload = [
                'student_user_id' => $user->id,
                'session_start' => now(),
                'is_active' => true,
                'session_name' => 'Auto-started Session',
                'created_by' => $user->id,
            ];
            if ($hasComputerNameColumn) {
                $payload['computer_name'] = $labContext['computer_name'];
            }
            if ($hasGatewayIpColumn) {
                $payload['gateway_ip'] = $labContext['gateway_ip'];
            }
            if ($hasLaboratoryRoomColumn) {
                $payload['laboratory_room'] = $labContext['laboratory_room'];
            }

            if ($desktopPatch !== [] && Schema::hasColumn('monitoring_sessions', 'device_info')) {
                $payload['device_info'] = $this->mergeDesktopIntoDeviceInfo(null, $desktopPatch);
            }

            $activeSession = MonitoringSession::create($payload);
        }

        return response()->json(['success' => true]);
    }

    /**
     * End current user's monitoring session (called on logout)
     */
    public function endMySession(Request $request)
    {
        $user = Auth::user();

        if ($user->role !== 'student') {
            return response()->json(['error' => 'Only students can end their session'], 403);
        }

        // End all active sessions for this student
        $updated = MonitoringSession::where('student_user_id', $user->id)
            ->where('is_active', true)
            ->update([
                'is_active' => false,
                'session_end' => now(),
            ]);

        // Revoke the current access token to prevent 'ghost' heartbeats
        // from the Chrome Extension creating new stray sessions.
        $user->currentAccessToken()->delete();

        return response()->json([
            'success' => true,
            'sessions_ended' => $updated
        ]);
    }

    /**
     * Get list of currently online students
     */
    public function getOnlineStudents(Request $request)
    {
        $user = Auth::user();

        if (!in_array($user->role, ['admin', 'teacher'])) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Students active in the last 2 minutes
        $threshold = now()->subMinutes(2);

        $query = MonitoringSession::where('is_active', true)
            ->where('updated_at', '>=', $threshold)
            ->with('student');

        // If teacher, filter by their students
        if ($user->role === 'teacher') {
            $studentIds = DB::table('subject_enrollments')
                ->join('subjects', 'subjects.id', '=', 'subject_enrollments.subject_id')
                ->where('subjects.teacher_user_id', $user->id)
                ->pluck('subject_enrollments.student_id');

            $query->whereIn('student_user_id', $studentIds);
        }

        $sessions = $query->get();

        // Map to student objects with session info, profile picture, and lab info
        $onlineStudents = $sessions->map(function ($session) {
            $student = $session->student;

            // Skip if student relationship is null
            if (!$student) {
                return null;
            }

            // Get profile picture from student_profiles table
            $profile = DB::table('student_profiles')
                ->where('user_id', $student->id)
                ->select('profile_picture')
                ->first();

            $student->last_seen = $session->updated_at;
            $student->current_session_id = $session->id;
            $student->profile_picture = $profile ? $profile->profile_picture : null;

            $labContext = $this->resolveLabContext($session->computer_name, $session->gateway_ip, false);
            $student->computer_name = $session->computer_name;
            $student->gateway_ip = $session->gateway_ip;
            $student->display_name = $labContext['display_name'];
            $student->laboratory_room = $labContext['laboratory_room'];

            $deviceInfo = $session->device_info;
            $desktop = is_array($deviceInfo) && isset($deviceInfo['desktop']) && is_array($deviceInfo['desktop'])
                ? $deviceInfo['desktop']
                : [];
            $student->monitoring_session_start = $session->session_start
                ? $session->session_start->toIso8601String()
                : null;
            $student->desktop_telemetry = $desktop !== [] ? $desktop : null;

            return $student;
        })->filter()->unique('id')->values();

        return response()->json($onlineStudents);
    }

    /**
     * Get my monitoring status (Student only)
     */
    public function getMyStatus(Request $request)
    {
        $user = Auth::user();

        if ($user->role !== 'student') {
            return response()->json(['error' => 'Only students can check status'], 403);
        }

        $session = MonitoringSession::where('student_user_id', $user->id)
            ->where('is_active', true)
            ->latest('session_start')
            ->first();

        return response()->json([
            'is_active' => $session ? true : false,
            'last_heartbeat' => $session ? $session->updated_at : null,
            'is_extension_connected' => $session && $session->updated_at >= now()->subMinutes(2)
        ]);
    }

    /**
     * Get browser activity for a specific student (Admin/Teacher only)
     */
    public function getStudentActivity(Request $request, int $studentId)
    {
        $user = Auth::user();

        // Students can only view their OWN activity (for receiving close commands)
        // Teachers and admins can view any student's activity
        if ($user->role === 'student') {
            // Students can ONLY access their own data
            if ($user->id !== $studentId) {
                return response()->json(['error' => 'Unauthorized - students can only view their own activity'], 403);
            }
        } elseif ($user->role === 'teacher') {
            // Teachers can only view students they teach
            $hasStudent = DB::table('subject_enrollments')
                ->join('subjects', 'subjects.id', '=', 'subject_enrollments.subject_id')
                ->where('subjects.teacher_user_id', $user->id)
                ->where('subject_enrollments.student_id', $studentId)
                ->exists();

            if (!$hasStudent) {
                return response()->json(['error' => 'You do not teach this student'], 403);
            }
        } elseif ($user->role !== 'admin') {
            // Only students, teachers, and admins can access this endpoint
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = BrowserActivity::where('student_user_id', $studentId)
            ->with(['student', 'session']);

        // Same table holds real visits and pending extension commands (FORCE_CLOSE_*). Students must still
        // receive those rows for the Chrome extension; admin/teacher history UI should not show them.
        if (in_array($user->role, ['admin', 'teacher'], true)) {
            $query->whereNotIn('url', ['FORCE_CLOSE_COMMAND', 'FORCE_CLOSE_TAB_COMMAND']);
        }

        // Apply filters
        if ($request->has('session_id')) {
            $query->where('session_id', $request->session_id);
        }

        if ($request->has('start_date')) {
            $query->where('visit_timestamp', '>=', $request->start_date);
        }

        if ($request->has('end_date')) {
            $query->where('visit_timestamp', '<=', $request->end_date);
        }

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('url', 'like', "%{$search}%")
                    ->orWhere('page_title', 'like', "%{$search}%");
            });
        }

        $activities = $query->orderBy('visit_timestamp', 'desc')
            ->paginate($request->per_page ?? 50);

        return response()->json($activities);
    }

    /**
     * Get student's currently open tabs
     */
    public function getStudentOpenTabs(Request $request, int $studentId)
    {
        $user = Auth::user();

        if (!in_array($user->role, ['admin', 'teacher'])) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // If teacher, verify they teach this student
        if ($user->role === 'teacher') {
            $hasStudent = DB::table('subject_enrollments')
                ->join('subjects', 'subjects.id', '=', 'subject_enrollments.subject_id')
                ->where('subjects.teacher_user_id', $user->id)
                ->where('subject_enrollments.student_id', $studentId)
                ->exists();

            if (!$hasStudent) {
                return response()->json(['error' => 'You do not teach this student'], 403);
            }
        }

        // Get active session with open tabs
        $activeSession = MonitoringSession::where('student_user_id', $studentId)
            ->where('is_active', true)
            ->latest('session_start')
            ->first();

        if (!$activeSession || !$activeSession->open_tabs) {
            return response()->json([]);
        }

        $openTabs = json_decode($activeSession->open_tabs, true);
        return response()->json($openTabs ?: []);
    }

    /**
     * Get real-time activity feed (Admin/Teacher only)
     */
    public function getRealtimeActivity(Request $request)
    {
        $user = Auth::user();

        if (!in_array($user->role, ['admin', 'teacher'])) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = BrowserActivity::with(['student', 'session'])
            ->whereNotIn('url', ['FORCE_CLOSE_COMMAND', 'FORCE_CLOSE_TAB_COMMAND']);

        // If teacher, only show their students
        if ($user->role === 'teacher') {
            $studentIds = DB::table('subject_enrollments')
                ->join('subjects', 'subjects.id', '=', 'subject_enrollments.subject_id')
                ->where('subjects.teacher_user_id', $user->id)
                ->pluck('subject_enrollments.student_id');

            $query->whereIn('student_user_id', $studentIds);
        }

        // Only show recent activities (last 5 minutes)
        $query->where('visit_timestamp', '>=', now()->subMinutes(5));

        $activities = $query->orderBy('visit_timestamp', 'desc')
            ->limit(100)
            ->get();

        return response()->json($activities);
    }

    /**
     * Get incognito alerts (Admin/Teacher only)
     */
    public function getIncognitoAlerts(Request $request)
    {
        $user = Auth::user();

        if (!in_array($user->role, ['admin', 'teacher'])) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = IncognitoAlert::with(['student', 'session']);

        // If teacher, only show their students
        if ($user->role === 'teacher') {
            $studentIds = DB::table('subject_enrollments')
                ->join('subjects', 'subjects.id', '=', 'subject_enrollments.subject_id')
                ->where('subjects.teacher_user_id', $user->id)
                ->pluck('subject_enrollments.student_id');

            $query->whereIn('student_user_id', $studentIds);
        }

        // Filter by session if provided
        if ($request->has('session_id')) {
            $query->where('session_id', $request->session_id);
        }

        // Only unacknowledged by default
        if (!$request->has('show_all')) {
            $query->where('is_acknowledged', false);
        }

        $alerts = $query->orderBy('detected_at', 'desc')
            ->paginate($request->per_page ?? 20);

        return response()->json($alerts);
    }

    /**
     * Acknowledge incognito alert
     */
    public function acknowledgeAlert(Request $request, int $alertId)
    {
        $user = Auth::user();

        if (!in_array($user->role, ['admin', 'teacher'])) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $alert = IncognitoAlert::findOrFail($alertId);

        // If teacher, verify they teach this student
        if ($user->role === 'teacher') {
            $hasStudent = DB::table('subject_enrollments')
                ->join('subjects', 'subjects.id', '=', 'subject_enrollments.subject_id')
                ->where('subjects.teacher_user_id', $user->id)
                ->where('subject_enrollments.student_id', $alert->student_user_id)
                ->exists();

            if (!$hasStudent) {
                return response()->json(['error' => 'Unauthorized'], 403);
            }
        }

        $alert->update(['is_acknowledged' => true]);

        return response()->json(['success' => true]);
    }

    /**
     * Start a monitoring session
     */
    public function startSession(Request $request)
    {
        $request->validate([
            'student_user_id' => 'required|exists:users,id',
            'session_name' => 'nullable|string|max:255',
        ]);

        $user = Auth::user();

        if (!in_array($user->role, ['admin', 'teacher'])) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // End any existing active sessions for this student
        MonitoringSession::where('student_user_id', $request->student_user_id)
            ->where('is_active', true)
            ->update([
                'is_active' => false,
                'session_end' => now(),
            ]);

        $session = MonitoringSession::create([
            'student_user_id' => $request->student_user_id,
            'session_start' => now(),
            'is_active' => true,
            'session_name' => $request->session_name,
            'created_by' => $user->id,
        ]);

        return response()->json([
            'success' => true,
            'session' => $session,
        ]);
    }

    /**
     * End a monitoring session
     */
    public function endSession(Request $request, int $sessionId)
    {
        $user = Auth::user();

        if (!in_array($user->role, ['admin', 'teacher'])) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $session = MonitoringSession::findOrFail($sessionId);

        $session->update([
            'is_active' => false,
            'session_end' => now(),
        ]);

        return response()->json([
            'success' => true,
            'session' => $session,
        ]);
    }

    /**
     * Get all sessions (Admin/Teacher only)
     */
    public function getSessions(Request $request)
    {
        $user = Auth::user();

        if (!in_array($user->role, ['admin', 'teacher'])) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = MonitoringSession::with(['student', 'creator']);

        // If teacher, only show sessions they created or for their students
        if ($user->role === 'teacher') {
            $studentIds = DB::table('subject_enrollments')
                ->join('subjects', 'subjects.id', '=', 'subject_enrollments.subject_id')
                ->where('subjects.teacher_user_id', $user->id)
                ->pluck('subject_enrollments.student_id');

            $query->where(function ($q) use ($user, $studentIds) {
                $q->where('created_by', $user->id)
                    ->orWhereIn('student_user_id', $studentIds);
            });
        }

        // Filter by active status
        if ($request->has('is_active')) {
            $query->where('is_active', $request->is_active);
        }

        $sessions = $query->orderBy('session_start', 'desc')
            ->paginate($request->per_page ?? 20);

        return response()->json($sessions);
    }

    /**
     * Delete stored monitoring history for a student without closing tabs or sending commands (Admin only).
     */
    public function clearStudentHistory(Request $request, int $studentId)
    {
        $user = Auth::user();

        if ($user->role !== 'admin') {
            return response()->json(['error' => 'Only administrators can erase monitoring history'], 403);
        }

        $deletedCount = BrowserActivity::where('student_user_id', $studentId)
            ->whereNotIn('url', ['FORCE_CLOSE_COMMAND', 'FORCE_CLOSE_TAB_COMMAND'])
            ->delete();

        return response()->json([
            'success' => true,
            'message' => 'Monitoring history removed from storage. Student browsers were not affected.',
            'deleted_count' => $deletedCount,
        ]);
    }

    /**
     * Force close student browser (Admin/Teacher only)
     */
    public function forceCloseBrowser(Request $request, int $studentId)
    {
        $user = Auth::user();

        if (!in_array($user->role, ['admin', 'teacher'])) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // If teacher, verify they teach this student
        if ($user->role === 'teacher') {
            $hasStudent = DB::table('subject_enrollments')
                ->join('subjects', 'subjects.id', '=', 'subject_enrollments.subject_id')
                ->where('subjects.teacher_user_id', $user->id)
                ->where('subject_enrollments.student_id', $studentId)
                ->exists();

            if (!$hasStudent) {
                return response()->json(['error' => 'You do not teach this student'], 403);
            }
        }

        // Delete ALL browser activity history for this student to free up space
        $deletedCount = BrowserActivity::where('student_user_id', $studentId)
            ->where('url', '!=', 'FORCE_CLOSE_COMMAND')
            ->where('url', '!=', 'FORCE_CLOSE_TAB_COMMAND')
            ->delete();

        // Create a special browser activity entry to signal force close
        BrowserActivity::create([
            'student_user_id' => $studentId,
            'url' => 'FORCE_CLOSE_COMMAND',
            'page_title' => 'Force Close Browser',
            'visit_timestamp' => now(),
            'is_incognito' => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'All history deleted and browser exit command sent',
            'deleted_count' => $deletedCount
        ]);
    }

    /**
     * Force close specific student tab (Admin/Teacher only)
     */
    public function forceCloseTab(Request $request, int $studentId)
    {
        $request->validate([
            'activity_id' => 'required|integer',
            'url' => 'required|string',
        ]);

        $user = Auth::user();

        if (!in_array($user->role, ['admin', 'teacher'])) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // If teacher, verify they teach this student
        if ($user->role === 'teacher') {
            $hasStudent = DB::table('subject_enrollments')
                ->join('subjects', 'subjects.id', '=', 'subject_enrollments.subject_id')
                ->where('subjects.teacher_user_id', $user->id)
                ->where('subject_enrollments.student_id', $studentId)
                ->exists();

            if (!$hasStudent) {
                return response()->json(['error' => 'You do not teach this student'], 403);
            }
        }

        // Delete the browser activity record to free up space
        $deleted = BrowserActivity::where('id', $request->activity_id)
            ->where('student_user_id', $studentId)
            ->delete();

        if (!$deleted) {
            return response()->json(['error' => 'Activity record not found'], 404);
        }

        // Create a special command entry to signal tab close
        BrowserActivity::create([
            'student_user_id' => $studentId,
            'url' => 'FORCE_CLOSE_TAB_COMMAND',
            'page_title' => $request->url,
            'visit_timestamp' => now(),
            'is_incognito' => false,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'History deleted and tab close command sent',
            'deleted' => true
        ]);
    }

    /**
     * Clear executed force close commands so they don't loop
     */
    public function clearCommands(Request $request)
    {
        $user = Auth::user();
        if (!$user || $user->role !== 'student') {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $deletedCount = BrowserActivity::where('student_user_id', $user->id)
            ->whereIn('url', ['FORCE_CLOSE_COMMAND', 'FORCE_CLOSE_TAB_COMMAND'])
            ->delete();

        return response()->json([
            'success' => true,
            'message' => 'Commands cleared successfully',
            'deleted_count' => $deletedCount
        ]);
    }

    private function resolveLabContext(?string $computerName, ?string $gatewayIp, bool $autoDiscover): array
    {
        $normalizedComputerName = $computerName ? strtoupper(trim($computerName)) : null;
        $normalizedGatewayIp = $gatewayIp ? trim($gatewayIp) : null;
        $hasLabGatewaysTable = Schema::hasTable('lab_gateways');
        $hasLabComputersTable = Schema::hasTable('lab_computers');

        $mappedLabRoom = null;
        if ($normalizedGatewayIp && $hasLabGatewaysTable) {
            $mappedLabRoom = LabGateway::where('gateway_ip', $normalizedGatewayIp)->value('laboratory_room');
        }

        $displayName = null;
        $resolvedLabRoom = $mappedLabRoom;
        $knownComputerRoom = null;

        if ($normalizedComputerName && $mappedLabRoom && $hasLabComputersTable) {
            $labComputer = LabComputer::where('computer_name', $normalizedComputerName)
                ->where('laboratory_room', $mappedLabRoom)
                ->first();

            if ($labComputer) {
                $displayName = $labComputer->display_name ?: $labComputer->computer_name;
            } elseif ($autoDiscover) {
                $labComputer = LabComputer::firstOrCreate(
                    [
                        'computer_name' => $normalizedComputerName,
                        'laboratory_room' => $mappedLabRoom,
                    ],
                    [
                        'display_name' => $normalizedComputerName,
                    ]
                );
                $displayName = $labComputer->display_name;
            }
        }

        // If gateway is unknown/unmapped, still try to resolve from existing computer registry.
        if ($normalizedComputerName && !$displayName && $hasLabComputersTable) {
            $knownComputer = LabComputer::where('computer_name', $normalizedComputerName)
                ->orderByDesc('updated_at')
                ->first();
            if ($knownComputer) {
                $displayName = $knownComputer->display_name ?: $knownComputer->computer_name;
                $knownComputerRoom = $knownComputer->laboratory_room ?: null;
            }
        }

        if (!$resolvedLabRoom && $knownComputerRoom) {
            $resolvedLabRoom = $knownComputerRoom;
        }

        if (!$resolvedLabRoom) {
            $resolvedLabRoom = $normalizedGatewayIp
                ? "Unknown Lab ({$normalizedGatewayIp})"
                : 'Unknown Lab';
        }

        return [
            'computer_name' => $normalizedComputerName,
            'gateway_ip' => $normalizedGatewayIp,
            'laboratory_room' => $resolvedLabRoom,
            'display_name' => $displayName ?: $normalizedComputerName,
        ];
    }
}
