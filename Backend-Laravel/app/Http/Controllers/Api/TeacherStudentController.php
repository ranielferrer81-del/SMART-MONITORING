<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class TeacherStudentController extends Controller
{
    protected function ensureTeacher()
    {
        $authUser = Auth::user();
        if (!$authUser || ($authUser->role ?? 'student') !== 'teacher') {
            abort(response()->json(['ok' => false, 'message' => 'Unauthorized'], 403));
        }
        return $authUser;
    }

    public function indexAll()
    {
        $this->ensureTeacher();

        // Fetch ALL students from all courses
        $students = DB::table('users as u')
            ->leftJoin('student_profiles as sp', 'sp.user_id', '=', 'u.id')
            ->select('u.id', 'u.full_name', 'u.email', 'u.is_active', 'u.created_at', 'sp.student_number', 'sp.section', 'sp.course', 'sp.profile_picture')
            ->where('u.role', 'student')
            ->orderBy('u.created_at', 'desc')
            ->get();

        return response()->json(['ok' => true, 'data' => $students]);
    }

    public function index(string $course)
    {
        $this->ensureTeacher();
        $course = strtoupper($course);
        if (!in_array($course, ['BSIT', 'BSCS', 'BSEMC'])) {
            return response()->json(['ok' => false, 'message' => 'Invalid course'], 422);
        }

        // Prefer normalized per-course views if present
        $view = $course === 'BSIT' ? 'v_students_bsit' : ($course === 'BSCS' ? 'v_students_bscs' : 'v_students_bsemc');
        $viewExists = DB::select("SHOW FULL TABLES WHERE Table_Type = 'VIEW' AND Tables_in_" . DB::getDatabaseName() . " = ?", [$view]);

        if (!empty($viewExists)) {
            $students = DB::table($view . ' as v')
                ->join('users as u', 'u.id', '=', 'v.user_id')
                ->select('u.id', 'u.full_name', 'u.email', 'u.is_active', 'u.created_at', 'v.student_number', 'v.section')
                ->orderBy('u.created_at', 'desc')
                ->get();
        } else {
            // Fallback to student_profiles filtering
            $students = DB::table('users as u')
                ->leftJoin('student_profiles as sp', 'sp.user_id', '=', 'u.id')
                ->select('u.id', 'u.full_name', 'u.email', 'u.is_active', 'u.created_at', 'sp.student_number', 'sp.section', 'sp.course')
                ->where('u.role', 'student')
                ->where(function ($q) use ($course) {
                    $q->whereRaw('UPPER(sp.course) = ?', [$course])
                        ->orWhere(function ($q2) use ($course) {
                            // Map legacy course names to new codes
                            if ($course === 'BSIT')
                                $q2->whereRaw("UPPER(sp.course) LIKE '%INFORMATION TECHNOLOGY%'");
                            if ($course === 'BSCS')
                                $q2->whereRaw("UPPER(sp.course) LIKE '%COMPUTER SCIENCE%'");
                            if ($course === 'BSEMC')
                                $q2->whereRaw("UPPER(sp.course) LIKE '%ENTERTAINMENT AND MULTIMEDIA%' OR UPPER(sp.course) LIKE '%EMC%'");
                        });
                })
                ->orderBy('u.created_at', 'desc')
                ->get();
        }

        return response()->json(['ok' => true, 'data' => $students]);
    }
}


