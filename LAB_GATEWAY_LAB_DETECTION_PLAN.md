# Lab Detection Implementation Checklist (Project-Specific)

This file is the execution checklist for adding reliable `PC + Laboratory` detection in this repo.

It is intentionally different from `implementation_plan.md.resolved`: this one is task-oriented, file-oriented, and rollout-oriented.

---

## Final Behavior We Want

When two students use the same hostname in different labs, dashboard still shows:

- `PC1 - Laboratory 1`
- `PC1 - Laboratory 2`

by using `computer_name + gateway_ip` instead of hostname only.

---

## Scope and Non-Scope

### In scope
- backend schema + API changes
- desktop and extension heartbeat payload updates
- monitoring UI data usage update
- backward compatibility during rollout

### Not in scope (for now)
- forcing campus network redesign
- advanced network device integration (switch port lookup)

---

## Network Preconditions (Must Validate First)

Gateway-based detection works only if lab paths have distinct network identity.

Pass condition:
- student PCs in different labs have different default gateway IPs (or at least different subnets/VLANs).

Fallback condition:
- if all labs share one gateway, system will show `Unknown Lab` unless manually mapped by other methods.

---

## Phase 1 - Backend Database

### 1.1 Add `lab_gateways` table

Create migration:
- `Backend-Laravel/database/migrations/*_create_lab_gateways_table.php`

Columns:
- `id`
- `gateway_ip` string(45), unique
- `laboratory_room` string(255)
- `description` nullable string(255)
- timestamps

### 1.2 Update `lab_computers` uniqueness model

Create migration:
- `Backend-Laravel/database/migrations/*_update_lab_computers_for_composite_identity.php`

Changes:
- remove global unique on `computer_name`
- add optional `display_name`
- add composite unique on `computer_name + laboratory_room`

### 1.3 Add `gateway_ip` to sessions

Create migration:
- `Backend-Laravel/database/migrations/*_add_gateway_ip_to_monitoring_sessions_table.php`

Changes:
- add nullable `gateway_ip` string(45)
- optional index on `gateway_ip`

---

## Phase 2 - Backend API/Logic

### 2.1 Add Lab Gateway model/controller

Files:
- `Backend-Laravel/app/Models/LabGateway.php` (new)
- `Backend-Laravel/app/Http/Controllers/Api/LabGatewayController.php` (new)

### 2.2 Register routes

File:
- `Backend-Laravel/routes/api.php`

Endpoints:
- `GET /api/lab-gateways`
- `POST /api/lab-gateways`
- `PATCH /api/lab-gateways/{id}`
- `DELETE /api/lab-gateways/{id}`

Access:
- admin for write endpoints
- admin/teacher for read endpoint (optional by policy)

### 2.3 Update heartbeat processing

File:
- `Backend-Laravel/app/Http/Controllers/Api/BrowserActivityController.php`

Changes in `heartbeat()`:
- accept `gateway_ip` from request
- store `computer_name` and `gateway_ip` in `monitoring_sessions`
- resolve `laboratory_room` from `lab_gateways` by `gateway_ip`
- keep backward compatibility when `gateway_ip` is missing

### 2.4 Update online-students response

Same file:
- `BrowserActivityController.php`

Changes in `getOnlineStudents()`:
- return `computer_name`
- return `gateway_ip`
- return `laboratory_room`
- return `display_name` when available
- fallback to `Unknown Lab` when mapping not found

---

## Phase 3 - Desktop App

### 3.1 Read gateway IP

Files:
- `Desktop-App/electron/main.ts`
- `Desktop-App/electron/monitoring-server.cjs`

Add dependency:
- `default-gateway`

Behavior:
- resolve current IPv4 default gateway once on login/start and refresh when needed

### 3.2 Send gateway in direct heartbeat

File:
- `Desktop-App/electron/monitoring-server.cjs`

Change payload for:
- `POST /api/browser-activity/heartbeat`

Add:
- `gateway_ip`

### 3.3 Expose gateway to extension

File:
- `Desktop-App/electron/monitoring-server.cjs`

Change `/monitoring-credentials` response:
- include `gatewayIp`

---

## Phase 4 - Chrome Extension

File:
- `chrome-extension/background.js`

Changes:
- add storage key for gateway IP
- persist gateway IP from desktop credentials
- include `gateway_ip` in heartbeat payload
- keep current behavior if gateway not available (send null)

---

## Phase 5 - Frontend Monitoring UI

Primary file:
- `myreactapp-React/src/components/BrowserMonitoringDashboard.js`

Changes:
- render `display_name || computer_name` for computer column
- render `laboratory_room || "Unknown Lab"` for lab column
- optional combined label formatting

Optional admin management UI (if implemented now):
- create section/page for gateway mappings CRUD

---

## API Contract Update (Heartbeat)

Request body accepted by backend:

```json
{
  "computer_name": "PC1",
  "gateway_ip": "192.168.2.1",
  "open_tabs": []
}
```

Compatibility rule:
- if `gateway_ip` is absent, backend must still accept request and keep session alive.

---

## Rollout Sequence (Do In This Order)

1. deploy backend migrations
2. deploy backend API updates (compatible with old clients)
3. release desktop app update (sends gateway_ip)
4. release extension update (sends gateway_ip every heartbeat)
5. seed/admin-configure `lab_gateways`
6. enable stricter validations (optional final step)

---

## Acceptance Tests

### Test A - Distinct labs, same hostname
1. map `192.168.1.1 -> Laboratory 1`
2. map `192.168.2.1 -> Laboratory 2`
3. send student A heartbeat: `PC1 + 192.168.1.1`
4. send student B heartbeat: `PC1 + 192.168.2.1`
5. verify dashboard shows two different labs correctly

### Test B - Unknown gateway fallback
1. send heartbeat with unmapped gateway
2. verify dashboard still shows student online
3. lab displays `Unknown Lab` (and/or raw gateway)

### Test C - Backward compatibility
1. send heartbeat with only `computer_name`
2. verify no 4xx validation break
3. verify session still updates

---

## Risks and Mitigations

- Same gateway across all labs -> cannot auto-detect lab  
  Mitigation: keep fallback label + manual mapping policy.

- Extension/Desktop version mismatch during deployment  
  Mitigation: backend remains backward compatible until all clients are updated.

- Duplicate hostname ambiguity persists if gateway missing  
  Mitigation: prioritize desktop + extension rollout before strict enforcement.

---

## Final Decisions Locked (Mar 24, 2026)

These decisions are confirmed and must be followed during implementation.

1. Keep using `computer_name` as the field name (no rename to `hostname` for now).
2. `computer_name` values remain like `PC1`, `PC2`, `PC3`, etc.
3. `GET` visibility for laboratory info is for both `admin` and `teacher` roles.
4. Auto-discovery is ON:
   - if a new PC sends heartbeat from a mapped gateway, system resolves the correct `laboratory_room`.
   - if the PC is not yet in `lab_computers`, it can still be shown and optionally auto-added.
5. Unknown-lab UI fallback must use Option B format:
   - `Unknown Lab (<gateway_ip>)`
   - example: `Unknown Lab (192.168.99.1)`
