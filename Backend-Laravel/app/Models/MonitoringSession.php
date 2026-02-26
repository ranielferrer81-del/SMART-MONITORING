<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MonitoringSession extends Model
{
    protected $fillable = [
        'student_user_id',
        'session_start',
        'session_end',
        'device_info',
        'computer_name',
        'is_active',
        'session_name',
        'created_by',
    ];

    protected $casts = [
        'session_start' => 'datetime',
        'session_end' => 'datetime',
        'device_info' => 'array',
        'is_active' => 'boolean',
    ];

    public function student()
    {
        return $this->belongsTo(User::class, 'student_user_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function activities()
    {
        return $this->hasMany(BrowserActivity::class, 'session_id');
    }

    public function incognitoAlerts()
    {
        return $this->hasMany(IncognitoAlert::class, 'session_id');
    }
}
