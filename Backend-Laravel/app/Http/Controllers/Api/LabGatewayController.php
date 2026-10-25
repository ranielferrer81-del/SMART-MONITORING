<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LabGateway;
use App\Models\LabComputer;
use App\Models\MonitoringSession;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class LabGatewayController extends Controller
{
    public function index(Request $request)
    {
        $user = Auth::user();

        if (!in_array($user->role, ['admin', 'teacher'], true)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $query = LabGateway::query();

        if ($request->has('search') && !empty($request->search)) {
            $search = trim($request->search);
            $query->where(function ($q) use ($search) {
                $q->where('gateway_ip', 'like', "%{$search}%")
                    ->orWhere('laboratory_room', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $gateways = $query->orderBy('laboratory_room')->orderBy('gateway_ip')->get();

        $hasLabComputersTable = Schema::hasTable('lab_computers');
        $hasSessionsTable = Schema::hasTable('monitoring_sessions');

        $gateways->transform(function ($gw) use ($hasLabComputersTable, $hasSessionsTable) {
            $computers = [];
            if ($hasLabComputersTable) {
                $computers = LabComputer::where('laboratory_room', $gw->laboratory_room)
                    ->orderBy('computer_name')
                    ->get(['id', 'computer_name', 'display_name']);
            }
            $activeCount = 0;
            if ($hasSessionsTable) {
                $activeCount = MonitoringSession::where('is_active', true)
                    ->where(function ($q) use ($gw) {
                        $q->where('gateway_ip', $gw->gateway_ip)
                          ->orWhere('laboratory_room', $gw->laboratory_room);
                    })
                    ->count();
            }

            $gw->computers_count = count($computers);
            $gw->computers = $computers;
            $gw->active_sessions_count = $activeCount;
            return $gw;
        });

        return response()->json($gateways);
    }

    public function rooms(Request $request)
    {
        $user = Auth::user();

        if (!in_array($user->role, ['admin', 'teacher'], true)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $gatewayRooms = LabGateway::distinct()->pluck('laboratory_room')->toArray();
        $computerRooms = Schema::hasTable('lab_computers')
            ? LabComputer::distinct()->pluck('laboratory_room')->toArray()
            : [];

        $allRooms = array_values(array_unique(array_filter(array_merge($gatewayRooms, $computerRooms))));
        sort($allRooms);

        return response()->json($allRooms);
    }

    public function unmapped(Request $request)
    {
        $user = Auth::user();

        if (!in_array($user->role, ['admin', 'teacher'], true)) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        if (!Schema::hasTable('monitoring_sessions') || !Schema::hasColumn('monitoring_sessions', 'gateway_ip')) {
            return response()->json([]);
        }

        $mappedGateways = LabGateway::pluck('gateway_ip')->filter()->all();

        $unmapped = MonitoringSession::whereNotNull('gateway_ip')
            ->where('gateway_ip', '!=', '')
            ->whereNotIn('gateway_ip', $mappedGateways)
            ->select(
                'gateway_ip',
                DB::raw('count(*) as session_count'),
                DB::raw('count(distinct computer_name) as computer_count'),
                DB::raw('max(updated_at) as last_seen')
            )
            ->groupBy('gateway_ip')
            ->orderByDesc('last_seen')
            ->get();

        return response()->json($unmapped);
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
