<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BrowserActivity extends Model
{
    protected $fillable = [
        'student_user_id',
        'url',
        'page_title',
        'visit_timestamp',
        'duration_seconds',
        'tab_id',
        'is_incognito',
        'session_id',
    ];

    protected $casts = [
        'visit_timestamp' => 'datetime',
        'is_incognito' => 'boolean',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_user_id');
    }

    public function session()
    {
        return $this->belongsTo(MonitoringSession::class, 'session_id');
    }
}
