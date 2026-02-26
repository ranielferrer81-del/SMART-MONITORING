<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LabComputer extends Model
{
    protected $fillable = [
        'computer_name',
        'laboratory_room',
    ];
}
