<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Drop the auto-enrollment trigger if it exists
        DB::statement('DROP TRIGGER IF EXISTS `subjects_ai_auto_enroll`');
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Recreate the trigger if needed (for rollback)
        // Note: This is the original trigger code - only uncomment if you need to rollback
        /*
        DB::statement("
            DELIMITER $$
            CREATE TRIGGER `subjects_ai_auto_enroll` AFTER INSERT ON `subjects` FOR EACH ROW BEGIN
              INSERT INTO subject_enrollments (subject_id, student_id, enrolled_at, status)
              SELECT NEW.id, u.id, NOW(), 'active'
              FROM users u
              JOIN student_profiles sp ON sp.user_id = u.id
              WHERE u.role = 'student' 
                AND sp.course = NEW.course 
                AND sp.section = NEW.section
                AND u.is_active = 1
                AND NOT EXISTS (
                  SELECT 1 FROM subject_enrollments se 
                  WHERE se.subject_id = NEW.id AND se.student_id = u.id
                );
            END$$
            DELIMITER ;
        ");
        */
    }
};
