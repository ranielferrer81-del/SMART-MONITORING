<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\QuizAiService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class QuizController extends Controller
{
    /** Extra seconds allowed after the timer hits zero (network latency on submit). */
    private const SUBMIT_GRACE_SECONDS = 20;

    // ───────────────────────── helpers ─────────────────────────

    private function teacher(): object
    {
        $user = Auth::user();
        if (! $user || ! in_array($user->role ?? '', ['teacher', 'admin'], true)) {
            abort(response()->json(['ok' => false, 'message' => 'Only teachers can manage quizzes.'], 403));
        }

        return $user;
    }

    private function student(): object
    {
        $user = Auth::user();
        if (! $user || ($user->role ?? '') !== 'student') {
            abort(response()->json(['ok' => false, 'message' => 'Only students can take quizzes.'], 403));
        }

        return $user;
    }

    private function ownedQuiz(int $id, object $user): object
    {
        $quiz = DB::table('quizzes')->where('id', $id)->first();
        if (! $quiz) {
            abort(response()->json(['ok' => false, 'message' => 'Quiz not found.'], 404));
        }
        if (($user->role ?? '') === 'teacher' && (int) $quiz->teacher_user_id !== (int) $user->id) {
            abort(response()->json(['ok' => false, 'message' => 'Unauthorized.'], 403));
        }

        return $quiz;
    }

    private function assertTeacherOwnsSubject(?int $subjectId, object $user): void
    {
        if (! $subjectId) {
            abort(response()->json(['ok' => false, 'message' => 'Please choose a subject.'], 422));
        }
        $subject = DB::table('subjects')->where('id', $subjectId)->first();
        if (! $subject) {
            abort(response()->json(['ok' => false, 'message' => 'Subject not found.'], 404));
        }
        if (($user->role ?? '') === 'teacher' && (int) $subject->teacher_user_id !== (int) $user->id) {
            abort(response()->json(['ok' => false, 'message' => 'You do not teach this subject.'], 403));
        }
    }

    /** @return array<int,array<string,mixed>> */
    private function validatedQuestions(Request $request): array
    {
        $request->validate([
            'questions' => ['required', 'array', 'min:1', 'max:60'],
            'questions.*.question_text' => ['required', 'string', 'max:2000'],
            'questions.*.options' => ['required', 'array', 'min:2', 'max:6'],
            'questions.*.options.*' => ['required', 'string', 'max:500'],
            'questions.*.correct_answer' => ['required', 'string', 'max:500'],
            'questions.*.explanation' => ['nullable', 'string', 'max:2000'],
            'questions.*.points' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $out = [];
        foreach ($request->input('questions') as $i => $q) {
            $options = array_values(array_map('strval', $q['options']));
            if (count(array_unique($options)) !== count($options)) {
                abort(response()->json(['ok' => false, 'message' => 'Question ' . ($i + 1) . ' has duplicate options.'], 422));
            }
            if (! in_array((string) $q['correct_answer'], $options, true)) {
                abort(response()->json(['ok' => false, 'message' => 'Question ' . ($i + 1) . ': the correct answer must be one of the options.'], 422));
            }
            $out[] = [
                'question_text' => trim((string) $q['question_text']),
                'options' => json_encode($options, JSON_UNESCAPED_UNICODE),
                'correct_answer' => (string) $q['correct_answer'],
                'explanation' => isset($q['explanation']) ? (string) $q['explanation'] : null,
                'points' => (int) ($q['points'] ?? 1),
                'order_index' => $i,
            ];
        }

        return $out;
    }

    private function enrolledStudentIds(int $subjectId): array
    {
        return DB::table('subject_enrollments')
            ->where('subject_id', $subjectId)
            ->where('status', 'active')
            ->pluck('student_id')
            ->map(fn ($v) => (int) $v)
            ->all();
    }

    private function serializeQuestion(object $q, bool $withAnswer): array
    {
        $row = [
            'id' => (int) $q->id,
            'question_text' => $q->question_text,
            'options' => json_decode($q->options, true) ?: [],
            'points' => (int) $q->points,
            'order_index' => (int) $q->order_index,
        ];
        if ($withAnswer) {
            $row['correct_answer'] = $q->correct_answer;
            $row['explanation'] = $q->explanation;
        }

        return $row;
    }

    private function serializeQuiz(object $quiz, array $extra = []): array
    {
        return array_merge([
            'id' => (int) $quiz->id,
            'subject_id' => $quiz->subject_id !== null ? (int) $quiz->subject_id : null,
            'title' => $quiz->title,
            'description' => $quiz->description,
            'module_filename' => $quiz->module_filename,
            'time_limit_minutes' => (int) $quiz->time_limit_minutes,
            'passing_percentage' => (int) $quiz->passing_percentage,
            'status' => $quiz->status,
            'started_at' => $quiz->started_at,
            'ended_at' => $quiz->ended_at,
            'created_at' => $quiz->created_at,
        ], $extra);
    }

    // ───────────────────────── teacher endpoints ─────────────────────────

    public function index(Request $request)
    {
        $user = $this->teacher();

        $query = DB::table('quizzes as q')
            ->leftJoin('subjects as s', 's.id', '=', 'q.subject_id')
            ->select('q.*', 's.code as subject_code', 's.name as subject_name')
            ->selectRaw('(select count(*) from quiz_questions qq where qq.quiz_id = q.id) as question_count')
            ->selectRaw("(select count(*) from quiz_attempts qa where qa.quiz_id = q.id and qa.status <> 'in_progress') as completed_count")
            ->selectRaw("(select count(*) from quiz_attempts qa where qa.quiz_id = q.id and qa.status = 'in_progress') as in_progress_count");

        if (($user->role ?? '') === 'teacher') {
            $query->where('q.teacher_user_id', $user->id);
        }
        if ($request->filled('subject_id')) {
            $query->where('q.subject_id', (int) $request->query('subject_id'));
        }

        $rows = $query->orderByDesc('q.id')->get()->map(function ($q) {
            return $this->serializeQuiz($q, [
                'subject_code' => $q->subject_code,
                'subject_name' => $q->subject_name,
                'question_count' => (int) $q->question_count,
                'completed_count' => (int) $q->completed_count,
                'in_progress_count' => (int) $q->in_progress_count,
            ]);
        });

        return response()->json(['ok' => true, 'data' => $rows]);
    }

    public function show(int $id)
    {
        $user = $this->teacher();
        $quiz = $this->ownedQuiz($id, $user);
        $questions = DB::table('quiz_questions')->where('quiz_id', $id)->orderBy('order_index')->get()
            ->map(fn ($q) => $this->serializeQuestion($q, true));

        return response()->json(['ok' => true, 'data' => $this->serializeQuiz($quiz, ['questions' => $questions])]);
    }

    public function generate(Request $request, QuizAiService $ai)
    {
        $this->teacher();

        @set_time_limit(180);
        $request->validate([
            'module_text' => ['nullable', 'string', 'max:200000'],
            'module_file' => ['nullable', 'file', 'max:51200'],
            'question_count' => ['nullable', 'integer', 'min:1', 'max:30'],
            'difficulty' => ['nullable', 'in:easy,medium,hard'],
            'title' => ['nullable', 'string', 'max:255'],
        ], [
            'module_file.uploaded' => 'The module file could not be uploaded. If the file is larger than 50MB, please choose a smaller file or copy and paste the lesson text directly into the "Paste Notes / Text" tab.',
            'module_file.max' => 'The module file must not exceed 50MB.',
            'module_file.file' => 'The uploaded module must be a valid file.',
        ]);

        $text = trim((string) $request->input('module_text', ''));
        $filename = null;
        $pdfBase64 = null;

        if ($request->hasFile('module_file')) {
            $file = $request->file('module_file');
            $filename = $file->getClientOriginalName();
            $ext = strtolower($file->getClientOriginalExtension());
            if (in_array($ext, ['txt', 'md', 'csv'], true)) {
                $text = trim($text . "\n\n" . (string) file_get_contents($file->getRealPath()));
            } elseif ($ext === 'docx') {
                $text = trim($text . "\n\n" . $this->extractDocxText($file->getRealPath()));
            } elseif ($ext === 'pdf') {
                $pdfBase64 = base64_encode((string) file_get_contents($file->getRealPath()));
                $extracted = $this->extractPdfText($file->getRealPath());
                if ($extracted !== '') {
                    $text = trim($text . "\n\n" . $extracted);
                }
            } else {
                return response()->json([
                    'ok' => false,
                    'message' => 'Unsupported file type. Upload a .pdf, .docx, .txt, or .md file, or paste the module text.',
                ], 422);
            }
        }

        if (mb_strlen($text) < 120 && empty($pdfBase64)) {
            return response()->json([
                'ok' => false,
                'message' => 'Module content is too short. Paste or upload at least a few paragraphs.',
            ], 422);
        }

        $effectiveTitle = trim((string) $request->input('title', ''));
        if ($effectiveTitle === '' && ! empty($filename)) {
            $effectiveTitle = preg_replace('/\.[^.]+$/', '', $filename);
            $effectiveTitle = trim(preg_replace('/\s*\(Presentation\)\s*/i', '', $effectiveTitle));
        }

        $result = $ai->generate(
            $text,
            (int) $request->input('question_count', 10),
            (string) $request->input('difficulty', 'medium'),
            $effectiveTitle ?: null,
            $pdfBase64
        );

        if (count($result['questions']) === 0) {
            return response()->json([
                'ok' => false,
                'message' => 'Could not generate questions from this content. Try adding more detailed text.',
            ], 422);
        }

        return response()->json([
            'ok' => true,
            'data' => [
                'source' => $result['source'],
                'title' => $result['title'],
                'module_filename' => $filename,
                'questions' => $result['questions'],
            ],
        ]);
    }

    private function extractDocxText(string $path): string
    {
        if (! class_exists(\ZipArchive::class)) {
            return '';
        }
        $zip = new \ZipArchive();
        if ($zip->open($path) !== true) {
            return '';
        }
        $xml = $zip->getFromName('word/document.xml');
        $zip->close();
        if (! is_string($xml)) {
            return '';
        }
        $xml = preg_replace('/<\/w:p>/', "\n", $xml) ?? $xml;

        return trim(html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_XML1, 'UTF-8'));
    }

    private function extractPdfText(string $path): string
    {
        // 1. Use pdftotext (poppler-utils) when available for 100% accurate text extraction
        if (function_exists('exec')) {
            $cmd = 'pdftotext ' . escapeshellarg($path) . ' - 2>/dev/null';
            $lines = [];
            $rc = 0;
            @exec($cmd, $lines, $rc);
            if ($rc === 0 && ! empty($lines)) {
                $txt = trim(implode("\n", $lines));
                if (mb_strlen($txt) >= 40) {
                    return $txt;
                }
            }
        }

        $content = @file_get_contents($path);
        if ($content === false || $content === '') {
            return '';
        }

        $text = '';
        $parseStream = function (string $data) use (&$text) {
            if (preg_match_all('/BT[\s\r\n]+(.*?)(?=ET)/s', $data, $matches)) {
                foreach ($matches[1] as $block) {
                    if (preg_match_all('/\((.*?)\)\s*T[jJ]/s', $block, $tMatches)) {
                        $text .= implode(' ', $tMatches[1]) . "\n";
                    } elseif (preg_match_all('/\[(.*?)\]\s*TJ/s', $block, $tjMatches)) {
                        foreach ($tjMatches[1] as $tj) {
                            if (preg_match_all('/\((.*?)\)/s', $tj, $sub)) {
                                $text .= implode('', $sub[1]) . ' ';
                            }
                        }
                        $text .= "\n";
                    }
                }
            }
        };

        $parseStream($content);

        if (function_exists('gzuncompress') && preg_match_all('/stream[\r\n]+(.*?)[\r\n]+endstream/s', $content, $streamMatches)) {
            foreach ($streamMatches[1] as $stream) {
                $uncompressed = @gzuncompress($stream);
                if ($uncompressed !== false && is_string($uncompressed)) {
                    $parseStream($uncompressed);
                }
            }
        }

        $text = preg_replace('/[^\P{C}\n\t]+/u', ' ', $text) ?? $text;
        $text = preg_replace('/[ \t]+/', ' ', $text) ?? $text;

        return trim($text);
    }

    public function store(Request $request)
    {
        $user = $this->teacher();

        $data = $request->validate([
            'subject_id' => ['required', 'integer'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'module_filename' => ['nullable', 'string', 'max:255'],
            'time_limit_minutes' => ['nullable', 'integer', 'min:0', 'max:300'],
            'passing_percentage' => ['nullable', 'integer', 'min:0', 'max:100'],
        ]);
        $this->assertTeacherOwnsSubject((int) $data['subject_id'], $user);
        $questions = $this->validatedQuestions($request);

        $quizId = DB::transaction(function () use ($data, $user, $questions) {
            $id = DB::table('quizzes')->insertGetId([
                'teacher_user_id' => $user->id,
                'subject_id' => (int) $data['subject_id'],
                'title' => trim($data['title']),
                'description' => $data['description'] ?? null,
                'module_filename' => $data['module_filename'] ?? null,
                'time_limit_minutes' => (int) ($data['time_limit_minutes'] ?? 15),
                'passing_percentage' => (int) ($data['passing_percentage'] ?? 60),
                'status' => 'draft',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            foreach ($questions as $q) {
                DB::table('quiz_questions')->insert($q + ['quiz_id' => $id, 'created_at' => now(), 'updated_at' => now()]);
            }

            return $id;
        });

        return response()->json(['ok' => true, 'data' => ['id' => $quizId]], 201);
    }

    public function update(Request $request, int $id)
    {
        $user = $this->teacher();
        $quiz = $this->ownedQuiz($id, $user);

        if ($quiz->status !== 'draft') {
            return response()->json(['ok' => false, 'message' => 'Only draft quizzes can be edited.'], 409);
        }

        $data = $request->validate([
            'subject_id' => ['required', 'integer'],
            'title' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'time_limit_minutes' => ['nullable', 'integer', 'min:0', 'max:300'],
            'passing_percentage' => ['nullable', 'integer', 'min:0', 'max:100'],
        ]);
        $this->assertTeacherOwnsSubject((int) $data['subject_id'], $user);
        $questions = $this->validatedQuestions($request);

        DB::transaction(function () use ($id, $data, $questions) {
            DB::table('quizzes')->where('id', $id)->update([
                'subject_id' => (int) $data['subject_id'],
                'title' => trim($data['title']),
                'description' => $data['description'] ?? null,
                'time_limit_minutes' => (int) ($data['time_limit_minutes'] ?? 15),
                'passing_percentage' => (int) ($data['passing_percentage'] ?? 60),
                'updated_at' => now(),
            ]);
            DB::table('quiz_questions')->where('quiz_id', $id)->delete();
            foreach ($questions as $q) {
                DB::table('quiz_questions')->insert($q + ['quiz_id' => $id, 'created_at' => now(), 'updated_at' => now()]);
            }
        });

        return response()->json(['ok' => true]);
    }

    public function destroy(int $id)
    {
        $user = $this->teacher();
        $quiz = $this->ownedQuiz($id, $user);

        if ($quiz->status === 'active') {
            return response()->json(['ok' => false, 'message' => 'End the quiz before deleting it.'], 409);
        }
        DB::table('quizzes')->where('id', $id)->delete();

        return response()->json(['ok' => true]);
    }

    public function start(int $id)
    {
        $user = $this->teacher();
        $quiz = $this->ownedQuiz($id, $user);

        if ($quiz->status === 'active') {
            return response()->json(['ok' => false, 'message' => 'This quiz is already running.'], 409);
        }
        if ($quiz->status === 'closed') {
            return response()->json(['ok' => false, 'message' => 'This quiz was already closed. Duplicate it to run again.'], 409);
        }
        if (! DB::table('quiz_questions')->where('quiz_id', $id)->exists()) {
            return response()->json(['ok' => false, 'message' => 'Add at least one question first.'], 422);
        }
        if (! $quiz->subject_id) {
            return response()->json(['ok' => false, 'message' => 'Quiz has no subject.'], 422);
        }
        $other = DB::table('quizzes')->where('subject_id', $quiz->subject_id)->where('status', 'active')->first();
        if ($other) {
            return response()->json(['ok' => false, 'message' => 'Another quiz ("' . $other->title . '") is already running for this subject.'], 409);
        }

        DB::table('quizzes')->where('id', $id)->update([
            'status' => 'active',
            'started_at' => now(),
            'ended_at' => null,
            'updated_at' => now(),
        ]);

        return response()->json(['ok' => true]);
    }

    public function end(int $id)
    {
        $user = $this->teacher();
        $quiz = $this->ownedQuiz($id, $user);

        if ($quiz->status !== 'active') {
            return response()->json(['ok' => false, 'message' => 'Quiz is not running.'], 409);
        }

        DB::transaction(function () use ($id) {
            DB::table('quizzes')->where('id', $id)->update([
                'status' => 'closed',
                'ended_at' => now(),
                'updated_at' => now(),
            ]);
            // Anyone still answering is released; they get timed_out with whatever (nothing) was saved.
            DB::table('quiz_attempts')
                ->where('quiz_id', $id)
                ->where('status', 'in_progress')
                ->update([
                    'status' => 'timed_out',
                    'submitted_at' => now(),
                    'total_points' => (int) DB::table('quiz_questions')->where('quiz_id', $id)->sum('points'),
                    'updated_at' => now(),
                ]);
        });

        return response()->json(['ok' => true]);
    }

    public function proctor(int $id)
    {
        $user = $this->teacher();
        $quiz = $this->ownedQuiz($id, $user);

        $studentIds = $quiz->subject_id ? $this->enrolledStudentIds((int) $quiz->subject_id) : [];
        $attempts = DB::table('quiz_attempts')->where('quiz_id', $id)->get()->keyBy('student_user_id');

        // Include anyone who attempted even if later unenrolled.
        $allIds = array_values(array_unique(array_merge($studentIds, $attempts->keys()->map(fn ($k) => (int) $k)->all())));
        $users = $allIds === [] ? collect() : DB::table('users')->whereIn('id', $allIds)->get()->keyBy('id');

        $rows = [];
        foreach ($allIds as $sid) {
            $u = $users->get($sid);
            if (! $u) {
                continue;
            }
            $a = $attempts->get($sid);
            $rows[] = [
                'student_id' => (int) $sid,
                'full_name' => $u->full_name ?? $u->name ?? $u->email,
                'email' => $u->email ?? null,
                'status' => $a ? $a->status : 'not_started',
                'score' => $a ? (int) $a->score : null,
                'total_points' => $a ? (int) $a->total_points : null,
                'percentage' => $a ? (float) $a->percentage : null,
                'passed' => $a && $a->status !== 'in_progress' ? ((float) $a->percentage >= (int) $quiz->passing_percentage) : null,
                'started_at' => $a->started_at ?? null,
                'submitted_at' => $a->submitted_at ?? null,
            ];
        }
        usort($rows, fn ($x, $y) => strcasecmp((string) $x['full_name'], (string) $y['full_name']));

        $done = array_filter($rows, fn ($r) => in_array($r['status'], ['completed', 'timed_out'], true));
        $avg = count($done) ? round(array_sum(array_map(fn ($r) => (float) $r['percentage'], $done)) / count($done), 1) : null;

        return response()->json([
            'ok' => true,
            'data' => [
                'quiz' => $this->serializeQuiz($quiz),
                'summary' => [
                    'enrolled' => count($studentIds),
                    'not_started' => count(array_filter($rows, fn ($r) => $r['status'] === 'not_started')),
                    'in_progress' => count(array_filter($rows, fn ($r) => $r['status'] === 'in_progress')),
                    'finished' => count($done),
                    'average_percentage' => $avg,
                ],
                'students' => $rows,
            ],
        ]);
    }

    // ───────────────────────── student endpoints ─────────────────────────

    /** Fetches (and begins) the attempt for the student's currently active quiz. */
    public function studentView(int $id)
    {
        $user = $this->student();
        $quiz = DB::table('quizzes')->where('id', $id)->first();

        if (! $quiz || $quiz->status !== 'active' || ! $quiz->subject_id
            || ! in_array((int) $user->id, $this->enrolledStudentIds((int) $quiz->subject_id), true)) {
            return response()->json(['ok' => false, 'message' => 'This quiz is not available.'], 404);
        }

        $attempt = DB::table('quiz_attempts')->where('quiz_id', $id)->where('student_user_id', $user->id)->first();
        if ($attempt && $attempt->status !== 'in_progress') {
            return response()->json(['ok' => false, 'message' => 'You have already completed this quiz.', 'already_completed' => true], 409);
        }
        if (! $attempt) {
            $total = (int) DB::table('quiz_questions')->where('quiz_id', $id)->sum('points');
            try {
                DB::table('quiz_attempts')->insert([
                    'quiz_id' => $id,
                    'student_user_id' => $user->id,
                    'status' => 'in_progress',
                    'total_points' => $total,
                    'started_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } catch (\Throwable $e) {
                // Unique-key race (two heartbeats at once): fall through and read the existing row.
            }
            $attempt = DB::table('quiz_attempts')->where('quiz_id', $id)->where('student_user_id', $user->id)->first();
        }

        $limitSeconds = (int) $quiz->time_limit_minutes * 60;
        $remaining = null;
        if ($limitSeconds > 0) {
            $elapsed = now()->diffInSeconds(\Illuminate\Support\Carbon::parse($attempt->started_at), true);
            $remaining = max(0, $limitSeconds - (int) $elapsed);
        }

        $questions = DB::table('quiz_questions')->where('quiz_id', $id)->orderBy('order_index')->get()
            ->map(fn ($q) => $this->serializeQuestion($q, false));

        return response()->json([
            'ok' => true,
            'data' => [
                'quiz' => [
                    'id' => (int) $quiz->id,
                    'title' => $quiz->title,
                    'description' => $quiz->description,
                    'time_limit_minutes' => (int) $quiz->time_limit_minutes,
                    'passing_percentage' => (int) $quiz->passing_percentage,
                ],
                'remaining_seconds' => $remaining,
                'questions' => $questions,
            ],
        ]);
    }

    public function submit(Request $request, int $id)
    {
        $user = $this->student();
        $request->validate(['answers' => ['nullable', 'array']]);

        $quiz = DB::table('quizzes')->where('id', $id)->first();
        $attempt = DB::table('quiz_attempts')->where('quiz_id', $id)->where('student_user_id', $user->id)->first();

        if (! $quiz || ! $attempt) {
            return response()->json(['ok' => false, 'message' => 'No active attempt found.'], 404);
        }

        if ($attempt->status !== 'in_progress') {
            // Idempotent: a retry or teacher-ended quiz just returns the stored result.
            return response()->json(['ok' => true, 'data' => $this->resultPayload($quiz, $attempt)]);
        }

        $answers = (array) $request->input('answers', []);
        $questions = DB::table('quiz_questions')->where('quiz_id', $id)->get();

        $score = 0;
        $total = 0;
        $clean = [];
        foreach ($questions as $q) {
            $total += (int) $q->points;
            $given = $answers[$q->id] ?? $answers[(string) $q->id] ?? null;
            if (is_string($given)) {
                $clean[$q->id] = $given;
                if ($given === $q->correct_answer) {
                    $score += (int) $q->points;
                }
            }
        }

        $status = 'completed';
        $limitSeconds = (int) $quiz->time_limit_minutes * 60;
        if ($limitSeconds > 0) {
            $elapsed = (int) now()->diffInSeconds(\Illuminate\Support\Carbon::parse($attempt->started_at), true);
            if ($elapsed > $limitSeconds + self::SUBMIT_GRACE_SECONDS) {
                $status = 'timed_out';
            }
        }
        $percentage = $total > 0 ? round(($score / $total) * 100, 2) : 0;

        // Late submissions still count the answers that were given, but are flagged timed_out.
        DB::table('quiz_attempts')->where('id', $attempt->id)->update([
            'status' => $status,
            'score' => $score,
            'total_points' => $total,
            'percentage' => $percentage,
            'submitted_answers' => json_encode($clean),
            'submitted_at' => now(),
            'updated_at' => now(),
        ]);

        $attempt = DB::table('quiz_attempts')->where('id', $attempt->id)->first();

        return response()->json(['ok' => true, 'data' => $this->resultPayload($quiz, $attempt)]);
    }

    private function resultPayload(object $quiz, object $attempt): array
    {
        return [
            'status' => $attempt->status,
            'score' => (int) $attempt->score,
            'total_points' => (int) $attempt->total_points,
            'percentage' => (float) $attempt->percentage,
            'passed' => (float) $attempt->percentage >= (int) $quiz->passing_percentage,
            'passing_percentage' => (int) $quiz->passing_percentage,
        ];
    }

    /**
     * Used by the heartbeat: the active quiz the student still has to finish (or null).
     */
    public static function pendingQuizForStudent(int $studentId): ?object
    {
        return DB::table('quizzes as q')
            ->join('subject_enrollments as se', 'se.subject_id', '=', 'q.subject_id')
            ->leftJoin('subjects as s', 's.id', '=', 'q.subject_id')
            ->where('se.student_id', $studentId)
            ->where('se.status', 'active')
            ->where('q.status', 'active')
            ->whereNotExists(function ($sub) use ($studentId) {
                $sub->select(DB::raw(1))
                    ->from('quiz_attempts as qa')
                    ->whereColumn('qa.quiz_id', 'q.id')
                    ->where('qa.student_user_id', $studentId)
                    ->whereIn('qa.status', ['completed', 'timed_out']);
            })
            ->select('q.id', 'q.title', 'q.time_limit_minutes', 's.code as subject_code', 's.name as subject_name')
            ->selectRaw('(select count(*) from quiz_questions qq where qq.quiz_id = q.id) as total_questions')
            ->orderByDesc('q.id')
            ->first();
    }
}
