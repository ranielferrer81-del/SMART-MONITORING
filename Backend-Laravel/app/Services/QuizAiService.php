<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Generates multiple-choice quiz questions from module text.
 *
 * Supports:
 *   1. Google Gemini API (Free tier via Google AI Studio - gemini-1.5-flash / gemini-2.0-flash)
 *   2. Groq Cloud (Free tier - Llama 3.3 70B / Llama 3 8B)
 *   3. Offline heuristic fallback (zero config, works completely offline without API keys)
 */
class QuizAiService
{
    private const STOPWORDS = [
        'the', 'and', 'for', 'that', 'with', 'this', 'from', 'are', 'was', 'were', 'has', 'have', 'had',
        'not', 'but', 'can', 'will', 'which', 'their', 'there', 'these', 'those', 'such', 'also', 'into',
        'than', 'then', 'them', 'they', 'its', 'been', 'being', 'may', 'more', 'most', 'other', 'some',
        'when', 'where', 'while', 'what', 'who', 'how', 'why', 'about', 'between', 'each', 'both', 'used',
        'using', 'use', 'any', 'all', 'one', 'two', 'many', 'much', 'only', 'over', 'under', 'very', 'your',
        'you', 'our', 'out', 'per', 'via', 'does', 'did', 'should', 'would', 'could', 'because', 'however',
    ];

    /**
     * @return array{source:string, title:string, questions:array<int,array{question_text:string,options:array<int,string>,correct_answer:string,explanation:string}>}
     */
    public function generate(string $moduleText, int $count = 10, string $difficulty = 'medium', ?string $titleHint = null, ?string $pdfBase64 = null): array
    {
        $moduleText = $this->normalize($moduleText);
        $count = max(1, min(30, $count));
        $effectiveTitle = $titleHint !== null && trim($titleHint) !== '' ? trim($titleHint) : $this->guessTitle($moduleText);

        // 1. Try Google Gemini API (if key is configured)
        $geminiKey = env('GEMINI_API_KEY') ?: env('GOOGLE_API_KEY') ?: env('VITE_GEMINI_API_KEY');
        if (! empty($geminiKey) && trim($geminiKey) !== '') {
            $geminiResult = $this->generateWithGemini(trim($geminiKey), $moduleText, $count, $difficulty, $effectiveTitle, $pdfBase64);
            if (! empty($geminiResult['questions'])) {
                return $geminiResult;
            }
        }

        // 2. Try Groq API (if key is configured)
        $groqKey = env('GROQ_API_KEY');
        if (! empty($groqKey) && trim($groqKey) !== '') {
            $groqResult = $this->generateWithGroq(trim($groqKey), $moduleText, $count, $difficulty, $effectiveTitle);
            if (! empty($groqResult['questions'])) {
                return $groqResult;
            }
        }

        // 3. Fallback: Offline rule-based extractor (guarantees a working quiz even without internet or API key)
        $questions = $this->generateOffline($moduleText, $count);

        return [
            'source' => 'offline',
            'title' => $effectiveTitle,
            'questions' => $questions,
        ];
    }

    /**
     * Call Google Gemini API (gemini-1.5-flash / gemini-2.0-flash) with structured JSON output.
     */
    private function generateWithGemini(string $apiKey, string $moduleText, int $count, string $difficulty, string $titleHint, ?string $pdfBase64 = null): array
    {
        try {
            // Trim module text to fit prompt comfortably
            $snippet = mb_substr($moduleText, 0, 45000);

            $prompt = <<<PROMPT
You are an academic university examination creator.
Your task is to analyze the following module lesson content and generate exactly {$count} multiple-choice test questions at {$difficulty} difficulty level.

Module Topic / Title: {$titleHint}

Module Content:
\"\"\"
{$snippet}
\"\"\"

Strict Requirements:
1. Provide exactly {$count} distinct, clear questions testing key concepts from the module text.
2. Each question MUST have exactly 4 choices (options).
3. The "correct_answer" MUST exactly match one of the 4 strings in "options".
4. Provide a brief explanation for why the answer is correct.
5. Return ONLY a valid JSON object matching this schema:
{
  "quiz_title": "...",
  "questions": [
    {
      "question_text": "...",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "Option A",
      "explanation": "..."
    }
  ]
}
PROMPT;

            $models = array_values(array_unique(array_filter([
                env('GEMINI_MODEL', 'gemini-3.7-flash'),
                'gemini-3.7-flash',
                'gemini-3.5-flash-lite',
                'gemini-flash-latest',
                'gemini-3.6-flash',
                'gemini-3.8-flash',
            ])));

            $parts = [
                ['text' => $prompt],
            ];

            if (! empty($pdfBase64)) {
                $parts[] = [
                    'inlineData' => [
                        'mimeType' => 'application/pdf',
                        'data' => $pdfBase64,
                    ],
                ];
            }

            foreach ($models as $model) {
                $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";

                $response = Http::withoutVerifying()
                    ->timeout(120)
                    ->withHeaders(['Content-Type' => 'application/json'])
                    ->post($url, [
                        'contents' => [
                            [
                                'role' => 'user',
                                'parts' => $parts,
                            ],
                        ],
                        'generationConfig' => [
                            'temperature' => 0.2,
                            'responseMimeType' => 'application/json',
                        ],
                    ]);

                if ($response->successful()) {
                    $body = $response->json();
                    $rawText = $body['candidates'][0]['content']['parts'][0]['text'] ?? '';
                    $clean = $this->cleanJsonString($rawText);
                    $decoded = json_decode($clean, true);

                    if (is_array($decoded) && isset($decoded['questions']) && is_array($decoded['questions'])) {
                        $validQuestions = $this->validateAndNormalizeQuestions($decoded['questions']);
                        if (count($validQuestions) > 0) {
                            return [
                                'source' => 'gemini',
                                'title' => ! empty($decoded['quiz_title']) ? trim($decoded['quiz_title']) : $titleHint,
                                'questions' => $validQuestions,
                            ];
                        }
                    }
                } else {
                    Log::warning("Gemini model {$model} failed with status " . $response->status() . ': ' . $response->body());
                }
            }
        } catch (\Throwable $e) {
            Log::warning('Gemini API exception: ' . $e->getMessage());
        }

        return ['questions' => []];
    }

    /**
     * Call Groq Cloud API (Llama 3.3 70B) with JSON mode.
     */
    private function generateWithGroq(string $apiKey, string $moduleText, int $count, string $difficulty, string $titleHint): array
    {
        try {
            $snippet = mb_substr($moduleText, 0, 30000);

            $prompt = <<<PROMPT
You are an academic university examination creator.
Generate exactly {$count} multiple-choice test questions at {$difficulty} difficulty level based on this module:

Module Topic: {$titleHint}

Content:
{$snippet}

Output JSON format only:
{
  "quiz_title": "...",
  "questions": [
    {
      "question_text": "...",
      "options": ["A", "B", "C", "D"],
      "correct_answer": "A",
      "explanation": "..."
    }
  ]
}
PROMPT;

            $response = Http::withoutVerifying()
                ->timeout(60)
                ->withToken($apiKey)
                ->post('https://api.groq.com/openai/v1/chat/completions', [
                    'model' => env('GROQ_MODEL', 'llama-3.3-70b-versatile'),
                    'messages' => [
                        ['role' => 'system', 'content' => 'You are a quiz generation assistant that outputs only valid JSON.'],
                        ['role' => 'user', 'content' => $prompt],
                    ],
                    'response_format' => ['type' => 'json_object'],
                    'temperature' => 0.2,
                ]);

            if ($response->successful()) {
                $body = $response->json();
                $content = $body['choices'][0]['message']['content'] ?? '';
                $clean = $this->cleanJsonString($content);
                $decoded = json_decode($clean, true);

                if (is_array($decoded) && isset($decoded['questions']) && is_array($decoded['questions'])) {
                    $validQuestions = $this->validateAndNormalizeQuestions($decoded['questions']);
                    if (count($validQuestions) > 0) {
                        return [
                            'source' => 'groq',
                            'title' => ! empty($decoded['quiz_title']) ? trim($decoded['quiz_title']) : $titleHint,
                            'questions' => $validQuestions,
                        ];
                    }
                }
            } else {
                Log::warning('Groq API call failed: ' . $response->status() . ' - ' . $response->body());
            }
        } catch (\Throwable $e) {
            Log::warning('Groq API exception: ' . $e->getMessage());
        }

        return ['questions' => []];
    }

    /**
     * Clean markdown code block fences and trailing commas from raw JSON string.
     */
    private function cleanJsonString(string $text): string
    {
        $text = trim($text);
        if (str_starts_with($text, '```json')) {
            $text = substr($text, 7);
        } elseif (str_starts_with($text, '```')) {
            $text = substr($text, 3);
        }
        if (str_ends_with($text, '```')) {
            $text = substr($text, 0, -3);
        }

        return trim($text);
    }

    /**
     * Ensure each generated question conforms to the required structure and integrity.
     */
    private function validateAndNormalizeQuestions(array $rawQuestions): array
    {
        $out = [];
        foreach ($rawQuestions as $q) {
            if (! is_array($q) || empty($q['question_text']) || empty($q['options']) || ! is_array($q['options'])) {
                continue;
            }

            $options = array_values(array_unique(array_filter(array_map('trim', array_map('strval', $q['options'])))));
            if (count($options) < 2) {
                continue;
            }

            $correct = isset($q['correct_answer']) ? trim((string) $q['correct_answer']) : '';

            // If correct_answer doesn't match an option directly, check if it's "A", "B", "C", "D" letter indicator
            if (! in_array($correct, $options, true)) {
                $upper = strtoupper($correct);
                if (in_array($upper, ['A', 'B', 'C', 'D'], true)) {
                    $idx = ord($upper) - ord('A');
                    if (isset($options[$idx])) {
                        $correct = $options[$idx];
                    }
                }
            }

            // Fallback: if still not matching, default to first option
            if (! in_array($correct, $options, true)) {
                $correct = $options[0];
            }

            $out[] = [
                'question_text' => trim((string) $q['question_text']),
                'options' => $options,
                'correct_answer' => $correct,
                'explanation' => isset($q['explanation']) ? trim((string) $q['explanation']) : '',
            ];
        }

        return $out;
    }

    private function normalize(string $text): string
    {
        $text = preg_replace('/[^\P{C}\n\t]+/u', ' ', $text) ?? $text;
        $text = preg_replace('/[ \t]+/', ' ', $text) ?? $text;
        $text = preg_replace('/\n{3,}/', "\n\n", $text) ?? $text;

        return trim($text);
    }

    private function guessTitle(string $text): string
    {
        foreach (preg_split('/\n/', $text) ?: [] as $line) {
            $line = trim($line, " \t#*-");
            if ($line !== '' && mb_strlen($line) <= 80) {
                return $line;
            }
        }

        return 'Module Quiz';
    }

    /**
     * Offline rule-based question extractor.
     */
    private function generateOffline(string $text, int $count): array
    {
        $sentences = preg_split('/(?<=[.!?])\s+|\n+/u', $text) ?: [];
        $sentences = array_values(array_filter(array_map('trim', $sentences), function ($s) {
            $len = mb_strlen($s);
            return $len >= 40 && $len <= 260 && str_word_count($s) >= 7;
        }));

        $pool = [];
        foreach ($sentences as $s) {
            foreach ($this->candidateWords($s) as $w) {
                $pool[mb_strtolower($w)] = $w;
            }
        }
        $pool = array_values($pool);

        if (count($pool) < 4 || count($sentences) === 0) {
            return [];
        }

        $picked = [];
        $total = count($sentences);
        $step = max(1, intdiv($total, $count));
        for ($i = 0; $i < $total && count($picked) < $count; $i += $step) {
            $picked[] = $sentences[$i];
        }
        for ($i = 0; $i < $total && count($picked) < $count; $i++) {
            if (! in_array($sentences[$i], $picked, true)) {
                $picked[] = $sentences[$i];
            }
        }

        $questions = [];
        foreach ($picked as $sentence) {
            $words = $this->candidateWords($sentence);
            if ($words === []) {
                continue;
            }
            usort($words, fn ($a, $b) => mb_strlen($b) <=> mb_strlen($a));
            $answer = $words[0];

            $blanked = preg_replace('/\b' . preg_quote($answer, '/') . '\b/u', '_____', $sentence, 1);
            if ($blanked === null || $blanked === $sentence) {
                continue;
            }

            $distractors = array_values(array_filter($pool, fn ($w) => mb_strtolower($w) !== mb_strtolower($answer)));
            shuffle($distractors);
            $distractors = array_slice($distractors, 0, 3);
            if (count($distractors) < 3) {
                continue;
            }

            $options = array_merge([$answer], $distractors);
            shuffle($options);

            $questions[] = [
                'question_text' => 'Fill in the blank: ' . $blanked,
                'options' => array_values($options),
                'correct_answer' => $answer,
                'explanation' => 'From the module: "' . $sentence . '"',
            ];
        }

        return $questions;
    }

    /**
     * @return array<int,string>
     */
    private function candidateWords(string $sentence): array
    {
        preg_match_all('/\b[\p{L}][\p{L}\-]{3,}\b/u', $sentence, $m);
        $out = [];
        foreach ($m[0] ?? [] as $w) {
            if (in_array(mb_strtolower($w), self::STOPWORDS, true)) {
                continue;
            }
            $out[mb_strtolower($w)] = $w;
        }

        return array_values($out);
    }
}
