<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Response;
use Illuminate\Support\Facades\Storage;

class StorageController extends Controller
{
    public function serve($path)
    {
        $filePath = storage_path('app/public/' . $path);

        if (!file_exists($filePath)) {
            abort(404, 'File not found');
        }

        $mimeType = mime_content_type($filePath);
        $fileContents = file_get_contents($filePath);

        return Response::make($fileContents, 200, [
            'Content-Type' => $mimeType,
            'Content-Length' => filesize($filePath),
            'Cache-Control' => 'public, max-age=31536000',
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => 'GET, OPTIONS',
            'Access-Control-Allow-Headers' => 'Content-Type, Authorization',
        ]);
    }
}
