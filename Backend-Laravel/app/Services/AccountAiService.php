<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Service to parse registrar student rosters from text, CSV, PDF, or images.
 *
 * Supports:
 *   1. Google Gemini API (Multimodal / JSON output via Google AI Studio)
 *   2. Groq Cloud (Llama 3.3 70B)
 *   3. Offline heuristic rule-based CSV/Text parser (zero config, works without internet or API key)
 */
class AccountAiService
{
    /**
     * Parse raw text or file into normalized student accounts.
     *
     * @return array{source:string, students:array<int,array{full_name:string,student_number:string,course:string,section:string,email:string}>}
     */
    public function parseRoster(
        string $rawText,
        ?string $fileMime = null,
        ?string $fileBase64 = null,
        string $defaultCourse = 'BSIT',
        string $defaultSection = '3-A',
        string $emailDomain = 'student.edu'
    ): array {
        $defaultCourse = $this->normalizeCourse($defaultCourse) ?: 'BSIT';
        $defaultSection = trim($defaultSection) !== '' ? trim($defaultSection) : '3-A';

        // 1. Try Google Gemini API (if key configured)
        $geminiKey = env('GEMINI_API_KEY') ?: env('GOOGLE_API_KEY') ?: env('VITE_GEMINI_API_KEY');
        if (! empty($geminiKey) && trim($geminiKey) !== '') {
            $geminiResult = $this->parseWithGemini(
                trim($geminiKey),
                $rawText,
                $fileMime,
                $fileBase64,
                $defaultCourse,
                $defaultSection,
                $emailDomain
            );
            if (! empty($geminiResult['students'])) {
                return $geminiResult;
            }
        }

        // 2. Try Groq API (if key configured and text is provided)
        $groqKey = env('GROQ_API_KEY');
        if (! empty($groqKey) && trim($groqKey) !== '' && trim($rawText) !== '') {
            $groqResult = $this->parseWithGroq(
                trim($groqKey),
                $rawText,
                $defaultCourse,
                $defaultSection,
                $emailDomain
            );
            if (! empty($groqResult['students'])) {
                return $groqResult;
            }
        }

        // 3. Fallback: Offline heuristic / CSV / regex parser
        $offlineStudents = $this->parseOffline($rawText, $defaultCourse, $defaultSection, $emailDomain);

        return [
            'source' => 'offline',
            'students' => $offlineStudents,
        ];
    }

    /**
     * Call Google Gemini API with JSON output mode.
     */
    private function parseWithGemini(
        string $apiKey,
        string $rawText,
        ?string $fileMime,
        ?string $fileBase64,
        string $defaultCourse,
        string $defaultSection,
        string $emailDomain
    ): array {
        try {
            $snippet = mb_substr($rawText, 0, 45000);

            $prompt = <<<PROMPT
You are an academic school registrar assistant.
Analyze the following student roster/enrollment list.
Extract every student record into a clean JSON array of objects.

Strict Requirements:
1. "full_name": Student's clean Title Case name (e.g., "Fatima Perez", "Mark Santos", "Juan M. Dela Cruz"). Remove numbering or stray symbols.
2. "student_number": Student ID or student number as found in the text (e.g. "2024-00101", "20240001001", "19-12345", "C20-0012"). Preserve any hyphens or alphanumeric formatting as given in the roster.
3. "course": Normalize strictly to one of: "BSIT", "BSCS", "BSEMC". (e.g., "Information Technology" -> "BSIT", "Computer Science" -> "BSCS", "EMC" -> "BSEMC"). If missing in the row, use: "{$defaultCourse}".
4. "section": Clean pure section code WITHOUT repeating the course (e.g. "3-Y2-2", "3-A", "1-B"). Do NOT include the course code in the section (e.g., use "3-Y2-2", NOT "BSIT 3-Y2-2") because course is already stored separately. If missing in the row, use: "{$defaultSection}".
5. "email": Valid lowercase email. If an email is listed, clean and use it. If missing, generate one in the format: {student_number}@{$emailDomain}

Students in the same class must have the EXACT same course and section values.
Return ONLY valid JSON matching this schema:
{
  "students": [
    {
      "full_name": "Fatima Perez",
      "student_number": "2024-00101",
      "course": "BSIT",
      "section": "3-Y2-2",
      "email": "fatima.perez@student.edu"
    }
  ]
}

Content to analyze:
\"\"\"
{$snippet}
\"\"\"
PROMPT;

            $models = array_values(array_unique(array_filter([
                env('GEMINI_MODEL', 'gemini-1.5-flash'),
                'gemini-1.5-flash',
                'gemini-2.0-flash',
                'gemini-1.5-pro',
            ])));

            $parts = [
                ['text' => $prompt],
            ];

            if (! empty($fileBase64) && ! empty($fileMime)) {
                $parts[] = [
                    'inlineData' => [
                        'mimeType' => $fileMime,
                        'data' => $fileBase64,
                    ],
                ];
            }

            foreach ($models as $model) {
                $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

                $response = Http::withoutVerifying()
                    ->timeout(60)
                    ->withHeaders(['Content-Type' => 'application/json'])
                    ->post($url, [
                        'contents' => [
                            [
                                'role' => 'user',
                                'parts' => $parts,
                            ],
                        ],
                        'generationConfig' => [
                            'temperature' => 0.1,
                            'responseMimeType' => 'application/json',
                        ],
                    ]);

                if (! $response->successful()) {
                    Log::warning("Gemini parsing failed with model {$model}: " . $response->body());
                    continue;
                }

                $json = $response->json();
                $text = $json['candidates'][0]['content']['parts'][0]['text'] ?? null;
                if (! $text) {
                    continue;
                }

                $clean = $this->stripMarkdownFences($text);
                $decoded = json_decode($clean, true);

                if (is_array($decoded) && isset($decoded['students']) && is_array($decoded['students'])) {
                    $sanitized = $this->sanitizeStudentArray($decoded['students'], $defaultCourse, $defaultSection, $emailDomain);
                    if (! empty($sanitized)) {
                        return [
                            'source' => 'gemini (' . $model . ')',
                            'students' => $sanitized,
                        ];
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::warning('Gemini parse exception: ' . $e->getMessage());
        }

        return ['source' => 'gemini_failed', 'students' => []];
    }

    /**
     * Call Groq API as secondary AI fallback.
     */
    private function parseWithGroq(
        string $apiKey,
        string $rawText,
        string $defaultCourse,
        string $defaultSection,
        string $emailDomain
    ): array {
        try {
            $snippet = mb_substr($rawText, 0, 30000);
            $prompt = <<<PROMPT
Extract student enrollment records into a JSON object: {"students": [{"full_name": "...", "student_number": "...", "course": "BSIT|BSCS|BSEMC", "section": "...", "email": "..."}]}.
Course fallback: {$defaultCourse}. Section fallback: {$defaultSection}.
Content:
{$snippet}
PROMPT;

            $model = env('GROQ_MODEL', 'llama-3.3-70b-versatile');
            $response = Http::withoutVerifying()
                ->timeout(45)
                ->withToken($apiKey)
                ->post('https://api.groq.com/openai/v1/chat/completions', [
                    'model' => $model,
                    'messages' => [
                        ['role' => 'system', 'content' => 'You are an academic parser that outputs ONLY JSON.'],
                        ['role' => 'user', 'content' => $prompt],
                    ],
                    'response_format' => ['type' => 'json_object'],
                    'temperature' => 0.1,
                ]);

            if ($response->successful()) {
                $content = $response->json('choices.0.message.content');
                $decoded = json_decode($this->stripMarkdownFences((string) $content), true);
                if (is_array($decoded) && isset($decoded['students']) && is_array($decoded['students'])) {
                    $sanitized = $this->sanitizeStudentArray($decoded['students'], $defaultCourse, $defaultSection, $emailDomain);
                    if (! empty($sanitized)) {
                        return [
                            'source' => 'groq (' . $model . ')',
                            'students' => $sanitized,
                        ];
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::warning('Groq parse exception: ' . $e->getMessage());
        }

        return ['source' => 'groq_failed', 'students' => []];
    }

    /**
     * Offline rule-based parser for CSV, TSV, or structured raw text.
     */
    public function parseOffline(
        string $rawText,
        string $defaultCourse = 'BSIT',
        string $defaultSection = '3-A',
        string $emailDomain = 'student.edu'
    ): array {
        $lines = preg_split('/\r\n|\r|\n/', trim($rawText));
        if (empty($lines)) {
            return [];
        }

        $students = [];
        $counter = 1;
        $currentYear = date('Y');

        foreach ($lines as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#')) {
                continue;
            }

            // Skip header lines
            $lower = strtolower($line);
            if (
                str_contains($lower, 'student name') ||
                str_contains($lower, 'full name') ||
                (str_contains($lower, 'name') && str_contains($lower, 'email')) ||
                (str_contains($lower, 'student') && str_contains($lower, 'course'))
            ) {
                continue;
            }

            if (preg_match('/^(#|name|student\s*name|student\s*id|student\s*#|id\s*number|course|section|email)/i', $line)) {
                continue;
            }

            // Detect separator: tab, comma, semicolon, pipe
            $delimiter = ',';
            if (str_contains($line, "\t")) {
                $delimiter = "\t";
            } elseif (str_contains($line, ';') && ! str_contains($line, ',')) {
                $delimiter = ';';
            } elseif (str_contains($line, '|') && ! str_contains($line, ',')) {
                $delimiter = '|';
            }

            $tokens = str_getcsv($line, $delimiter);
            $tokens = array_values(array_filter(array_map('trim', $tokens), fn ($t) => $t !== ''));

            if (empty($tokens)) {
                continue;
            }

            $extractedEmail = null;
            $extractedStudentNumber = null;
            $extractedCourse = null;
            $extractedSection = null;
            $nameTokens = [];

            foreach ($tokens as $token) {
                // Check if email
                if (filter_var($token, FILTER_VALIDATE_EMAIL)) {
                    $extractedEmail = strtolower($token);
                    continue;
                }

                // Check if student number (e.g. 2024-00123, 20240001001, 19-1234, or numeric sequence)
                if ((preg_match('/^[A-Za-z0-9\-]{4,30}$/', $token) && preg_match('/\d/', $token) && ! $courseMatch) || preg_match('/^\d{5,15}$/', $token)) {
                    $extractedStudentNumber = $token;
                    continue;
                }

                // Check if course
                $courseMatch = $this->normalizeCourse($token);
                if ($courseMatch) {
                    $extractedCourse = $courseMatch;
                    continue;
                }

                // Check if section pattern (e.g. BSIT 3-Y2-2, 3-Y2-2, 3-Y1-2, 3-A, 1-B)
                if (
                    preg_match('/^(?:[A-Za-z]{2,5}\s*)?\d+(?:-[A-Za-z0-9]+)+$/i', $token) ||
                    preg_match('/^\d+-[A-Za-z0-9-]+$/i', $token)
                ) {
                    $extractedSection = strtoupper($token);
                    // If the section includes the course prefix (e.g. "BSIT 3-Y2-2"), also extract the course
                    if (! $extractedCourse) {
                        $parts = preg_split('/\s+/', $extractedSection);
                        if (count($parts) > 1 && $this->normalizeCourse($parts[0])) {
                            $extractedCourse = $this->normalizeCourse($parts[0]);
                        }
                    }
                    continue;
                }

                // Otherwise, treat as name
                $nameTokens[] = $token;
            }

            $fullName = trim(implode(' ', $nameTokens));
            // Remove leading list numbers e.g. "1. Fatima Perez"
            $fullName = preg_replace('/^\d+[\.\-\)]\s*/', '', $fullName);

            if ($fullName === '' && $extractedEmail) {
                $parts = explode('@', $extractedEmail);
                $fullName = ucwords(str_replace(['.', '_', '-'], ' ', $parts[0]));
            }

            if ($fullName === '') {
                continue;
            }

            // Normalize student number (preserve original format, or generate sequential fallback)
            if (! $extractedStudentNumber) {
                $extractedStudentNumber = $currentYear . str_pad((string) $counter, 7, '0', STR_PAD_LEFT);
            } else {
                $extractedStudentNumber = trim((string) $extractedStudentNumber);
            }

            $course = $extractedCourse ?: $defaultCourse;
            $rawSection = $extractedSection ?: $defaultSection;
            $section = $this->cleanSection($rawSection, $course);

            if (! $extractedEmail) {
                $cleanName = strtolower(preg_replace('/[^a-zA-Z0-9]/', '', $fullName));
                $extractedEmail = $extractedStudentNumber . '@' . $emailDomain;
            }

            $students[] = [
                'full_name' => ucwords(strtolower($fullName)),
                'student_number' => (string) $extractedStudentNumber,
                'course' => $course,
                'section' => $section,
                'email' => strtolower($extractedEmail),
            ];

            $counter++;
        }

        return $students;
    }

    /**
     * Sanitize and format student records according to system database constraints.
     */
    private function sanitizeStudentArray(array $rawStudents, string $defaultCourse, string $defaultSection, string $emailDomain): array
    {
        $out = [];
        $counter = 1;
        $currentYear = date('Y');

        foreach ($rawStudents as $item) {
            if (! is_array($item)) {
                continue;
            }

            $name = trim((string) ($item['full_name'] ?? $item['name'] ?? ''));
            // Remove leading list numbers
            $name = preg_replace('/^\d+[\.\-\)]\s*/', '', $name);
            if ($name === '') {
                continue;
            }

            $snRaw = trim((string) ($item['student_number'] ?? $item['student_id'] ?? ''));
            if ($snRaw !== '') {
                $sn = mb_substr($snRaw, 0, 50);
            } else {
                $sn = $currentYear . str_pad((string) $counter, 7, '0', STR_PAD_LEFT);
            }

            $course = $this->normalizeCourse((string) ($item['course'] ?? '')) ?: $defaultCourse;
            $rawSection = trim((string) ($item['section'] ?? '')) ?: $defaultSection;
            $section = $this->cleanSection($rawSection, $course);

            $emailRaw = trim((string) ($item['email'] ?? ''));
            if (filter_var($emailRaw, FILTER_VALIDATE_EMAIL)) {
                $email = strtolower($emailRaw);
            } else {
                $email = $sn . '@' . $emailDomain;
            }

            $out[] = [
                'full_name' => ucwords(strtolower($name)),
                'student_number' => $sn,
                'course' => $course,
                'section' => $section,
                'email' => $email,
            ];

            $counter++;
        }

        return $out;
    }

    /**
     * Clean section code by stripping any redundant course prefix (e.g. "BSIT 3-Y2-2" -> "3-Y2-2").
     */
    public function cleanSection(string $section, ?string $course = null): string
    {
        $clean = trim($section);
        if ($course) {
            $clean = preg_replace('/^' . preg_quote($course, '/') . '\s*[-_]?\s*/i', '', $clean);
        }
        $clean = preg_replace('/^(?:BSIT|BSCS|BSEMC|IT|CS|EMC)\s*[-_]?\s*/i', '', $clean);

        return trim($clean) !== '' ? trim($clean) : trim($section);
    }

    private function normalizeCourse(string $val): ?string
    {
        $v = strtoupper(trim($val));
        if ($v === 'BSIT' || str_contains($v, 'INFORMATION TECHNOLOGY') || $v === 'IT') {
            return 'BSIT';
        }
        if ($v === 'BSCS' || str_contains($v, 'COMPUTER SCIENCE') || $v === 'CS') {
            return 'BSCS';
        }
        if ($v === 'BSEMC' || str_contains($v, 'MULTIMEDIA') || $v === 'EMC') {
            return 'BSEMC';
        }

        return null;
    }

    private function stripMarkdownFences(string $text): string
    {
        $clean = trim($text);
        if (str_starts_with($clean, '```json')) {
            $clean = substr($clean, 7);
        } elseif (str_starts_with($clean, '```')) {
            $clean = substr($clean, 3);
        }
        if (str_ends_with($clean, '```')) {
            $clean = substr($clean, 0, -3);
        }

        return trim($clean);
    }

    /**
     * Extract plain text from a Microsoft Word (.docx) file.
     */
    public function extractTextFromDocx(string $filePath): ?string
    {
        if (! class_exists('\ZipArchive') || ! file_exists($filePath)) {
            return null;
        }

        try {
            $zip = new \ZipArchive();
            if ($zip->open($filePath) === true) {
                $xml = $zip->getFromName('word/document.xml');
                $zip->close();
                if ($xml) {
                    $xml = preg_replace('/<\/w:p>/', "\n", $xml);
                    $xml = preg_replace('/<\/w:tr>/', "\n", $xml);
                    $xml = preg_replace('/<\/w:tc>/', "\t", $xml);
                    return trim(strip_tags($xml));
                }
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to extract text from docx: ' . $e->getMessage());
        }

        return null;
    }

    /**
     * Extract tabular text from an Excel (.xlsx) file.
     */
    public function extractTextFromXlsx(string $filePath): ?string
    {
        if (! class_exists('\ZipArchive') || ! file_exists($filePath)) {
            return null;
        }

        try {
            $zip = new \ZipArchive();
            if ($zip->open($filePath) === true) {
                $sharedStrings = [];
                $stringsXml = $zip->getFromName('xl/sharedStrings.xml');
                if ($stringsXml) {
                    $sDom = @simplexml_load_string($stringsXml);
                    if ($sDom) {
                        foreach ($sDom->si as $si) {
                            $sharedStrings[] = (string) ($si->t ?? $si->r->t ?? '');
                        }
                    }
                }

                $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
                $zip->close();
                if ($sheetXml) {
                    $dom = @simplexml_load_string($sheetXml);
                    if ($dom && isset($dom->sheetData->row)) {
                        $lines = [];
                        foreach ($dom->sheetData->row as $row) {
                            $rowCells = [];
                            foreach ($row->c as $c) {
                                $val = (string) $c->v;
                                if ((string) $c['t'] === 's' && isset($sharedStrings[(int) $val])) {
                                    $val = $sharedStrings[(int) $val];
                                }
                                $rowCells[] = $val;
                            }
                            $lines[] = implode("\t", $rowCells);
                        }
                        return implode("\n", $lines);
                    }
                }
            }
        } catch (\Throwable $e) {
            Log::warning('Failed to extract text from xlsx: ' . $e->getMessage());
        }

        return null;
    }
}
