<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ScreenMonitorFrame extends Model
{
    protected $fillable = [
        'student_user_id',
        'monitoring_session_id',
        'storage_path',
        'computer_name',
        'laboratory_room',
        'width',
        'height',
        'captured_at',
    ];

    protected $casts = [
        'captured_at' => 'datetime',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_user_id');
    }

    public function monitoringSession()
    {
        return $this->belongsTo(MonitoringSession::class, 'monitoring_session_id');
    }
}
