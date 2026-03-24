<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use App\Models\LabComputer;

class LabComputerController extends Controller
{
    /**
     * List all lab computer mappings (Admin/Teacher)
     */
    public function index(Request $request)
    {
        $user = Auth::user();

        if (!in_array($user->role, ['admin', 'teacher'], true)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = LabComputer::query();

        // Optional filter by laboratory room
        if ($request->has('laboratory_room')) {
            $query->where('laboratory_room', $request->laboratory_room);
        }

        // Optional search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('computer_name', 'like', "%{$search}%")
                    ->orWhere('display_name', 'like', "%{$search}%")
                    ->orWhere('laboratory_room', 'like', "%{$search}%");
            });
        }

        $computers = $query->orderBy('laboratory_room')
            ->orderBy('computer_name')
            ->get();

        return response()->json($computers);
    }

    /**
     * Create a new lab computer mapping (Admin only)
     */
    public function store(Request $request)
    {
        $user = Auth::user();

        if ($user->role !== 'admin') {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'computer_name' => 'required|string|max:255',
            'display_name' => 'nullable|string|max:255',
            'laboratory_room' => 'required|string|max:255',
        ]);

        $normalizedComputerName = strtoupper(trim($request->computer_name));
        $normalizedLabRoom = trim($request->laboratory_room);

        $exists = LabComputer::where('computer_name', $normalizedComputerName)
            ->where('laboratory_room', $normalizedLabRoom)
            ->exists();

        if ($exists) {
            return response()->json([
                'error' => 'This computer name already exists in the selected laboratory room.'
            ], 422);
        }

        $computer = LabComputer::create([
            'computer_name' => $normalizedComputerName,
            'display_name' => $request->display_name ? trim($request->display_name) : $normalizedComputerName,
            'laboratory_room' => $normalizedLabRoom,
        ]);

        return response()->json([
            'success' => true,
            'computer' => $computer,
        ], 201);
    }

    /**
     * Update a lab computer mapping (Admin only)
     */
    public function update(Request $request, int $id)
    {
        $user = Auth::user();

        if ($user->role !== 'admin') {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $computer = LabComputer::findOrFail($id);

        $request->validate([
            'computer_name' => 'sometimes|required|string|max:255',
            'display_name' => 'nullable|string|max:255',
            'laboratory_room' => 'sometimes|required|string|max:255',
        ]);

        $nextComputerName = $request->has('computer_name')
            ? strtoupper(trim($request->computer_name))
            : $computer->computer_name;
        $nextLabRoom = $request->has('laboratory_room')
            ? trim($request->laboratory_room)
            : $computer->laboratory_room;

        $exists = LabComputer::where('computer_name', $nextComputerName)
            ->where('laboratory_room', $nextLabRoom)
            ->where('id', '!=', $id)
            ->exists();

        if ($exists) {
            return response()->json([
                'error' => 'This computer name already exists in the selected laboratory room.'
            ], 422);
        }

        if ($request->has('computer_name')) {
            $computer->computer_name = $nextComputerName;
        }

        if ($request->has('laboratory_room')) {
            $computer->laboratory_room = $nextLabRoom;
        }

        if ($request->exists('display_name')) {
            $computer->display_name = $request->display_name ? trim($request->display_name) : $computer->computer_name;
        }

        $computer->save();

        return response()->json([
            'success' => true,
            'computer' => $computer,
        ]);
    }

    /**
     * Delete a lab computer mapping (Admin only)
     */
    public function destroy(int $id)
    {
        $user = Auth::user();

        if ($user->role !== 'admin') {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $computer = LabComputer::findOrFail($id);
        $computer->delete();

        return response()->json([
            'success' => true,
            'message' => 'Lab computer mapping deleted successfully.',
        ]);
    }

    /**
     * Get a list of distinct laboratory rooms (Admin/Teacher)
     */
    public function rooms(Request $request)
    {
        $user = Auth::user();

        if (!in_array($user->role, ['admin', 'teacher'])) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $rooms = LabComputer::select('laboratory_room')
            ->distinct()
            ->orderBy('laboratory_room')
            ->pluck('laboratory_room');

        return response()->json($rooms);
    }
}
