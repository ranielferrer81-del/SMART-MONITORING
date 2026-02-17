<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$output = '';

// Check teachers in database
$teachers = DB::table('users')
    ->where('role', 'teacher')
    ->get();

$output .= "Total teachers in database: " . $teachers->count() . "\n\n";

if ($teachers->count() > 0) {
    $output .= "Teachers found:\n";
    foreach ($teachers as $teacher) {
        $output .= "- ID: {$teacher->id}, Name: {$teacher->full_name}, Email: {$teacher->email}, Active: " . ($teacher->is_active ? 'Yes' : 'No') . "\n";
    }
} else {
    $output .= "No teachers found in the database.\n";
    $output .= "\nThis is the issue! You need to create teacher accounts first.\n";
}

// Also check teacher_profiles table
$output .= "\n--- Teacher Profiles ---\n";
$profiles = DB::table('teacher_profiles')->get();
$output .= "Total teacher profiles: " . $profiles->count() . "\n";

if ($profiles->count() > 0) {
    foreach ($profiles as $profile) {
        $output .= "- User ID: {$profile->user_id}, Teacher #: {$profile->teacher_number}, Dept: {$profile->department}\n";
    }
}

// Test the API endpoint directly
$output .= "\n--- Testing API Endpoint ---\n";
$teachersFromApi = DB::table('users as u')
    ->leftJoin('teacher_profiles as tp', 'tp.user_id', '=', 'u.id')
    ->select('u.id', 'u.full_name', 'u.email', 'u.is_active', 'u.created_at', 'tp.teacher_number', 'tp.department', 'tp.specialization', 'tp.profile_picture')
    ->where('u.role', 'teacher')
    ->orderBy('u.created_at', 'desc')
    ->get();

$output .= "API query returned: " . $teachersFromApi->count() . " teachers\n";
if ($teachersFromApi->count() > 0) {
    $output .= "Sample teacher from API query:\n";
    $output .= json_encode($teachersFromApi->first(), JSON_PRETTY_PRINT) . "\n";
}

echo $output;
file_put_contents(__DIR__ . '/teacher_check_results.txt', $output);
echo "\n\nResults also saved to teacher_check_results.txt\n";
