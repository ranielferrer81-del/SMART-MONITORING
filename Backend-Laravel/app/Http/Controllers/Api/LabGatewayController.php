<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LabGateway;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class LabGatewayController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();

        if (!in_array($user->role, ['admin', 'teacher'], true)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = LabGateway::query();

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('gateway_ip', 'like', "%{$search}%")
                    ->orWhere('laboratory_room', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        return response()->json(
            $query->orderBy('laboratory_room')->orderBy('gateway_ip')->get()
        );
    }

    public function store(Request $request)
    {
        $user = Auth::user();

        if ($user->role !== 'admin') {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'gateway_ip' => 'required|ip|unique:lab_gateways,gateway_ip',
            'laboratory_room' => 'required|string|max:255',
            'description' => 'nullable|string|max:255',
        ]);

        $gateway = LabGateway::create([
            'gateway_ip' => trim($request->gateway_ip),
            'laboratory_room' => trim($request->laboratory_room),
            'description' => $request->description ? trim($request->description) : null,
        ]);

        return response()->json(['success' => true, 'gateway' => $gateway], 201);
    }

    public function update(Request $request, int $id)
    {
        $user = Auth::user();

        if ($user->role !== 'admin') {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $gateway = LabGateway::findOrFail($id);

        $request->validate([
            'gateway_ip' => 'sometimes|required|ip|unique:lab_gateways,gateway_ip,' . $id,
            'laboratory_room' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string|max:255',
        ]);

        if ($request->has('gateway_ip')) {
            $gateway->gateway_ip = trim($request->gateway_ip);
        }
        if ($request->has('laboratory_room')) {
            $gateway->laboratory_room = trim($request->laboratory_room);
        }
        if ($request->exists('description')) {
            $gateway->description = $request->description ? trim($request->description) : null;
        }

        $gateway->save();

        return response()->json(['success' => true, 'gateway' => $gateway]);
    }

    public function destroy(int $id)
    {
        $user = Auth::user();

        if ($user->role !== 'admin') {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $gateway = LabGateway::findOrFail($id);
        $gateway->delete();

        return response()->json(['success' => true, 'message' => 'Lab gateway mapping deleted successfully.']);
    }
}
