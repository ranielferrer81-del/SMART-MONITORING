<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IncognitoAlert extends Model
{
    protected $fillable = [
        'student_user_id',
        'detected_at',
        'session_id',
        'is_acknowledged',
    ];

    protected $casts = [
        'detected_at' => 'datetime',
        'is_acknowledged' => 'boolean',
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
