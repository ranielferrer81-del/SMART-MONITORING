<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LabGateway extends Model
{
    protected $fillable = [
        'gateway_ip',
        'laboratory_room',
        'description',
    ];
}
