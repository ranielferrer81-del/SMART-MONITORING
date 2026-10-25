import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  fetchLabGateways,
  fetchLabRooms,
  fetchUnmappedGateways,
  createLabGateway,
  updateLabGateway,
  deleteLabGateway,
} from '../../../api/client';

export default function LabManagementSection({ setToast }) {
  const [gateways, setGateways] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [unmappedGateways, setUnmappedGateways] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');

  // Form state for creating a new laboratory
  const [form, setForm] = useState({
    gateway_ip: '',
    laboratory_room: '',
    description: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);

  // Edit modal state
  const [editingGateway, setEditingGateway] = useState(null);
  const [editForm, setEditForm] = useState({
    gateway_ip: '',
    laboratory_room: '',
    description: '',
  });
  const [editErrors, setEditErrors] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Expanded computers list per card
  const [expandedLabId, setExpandedLabId] = useState(null);

  // Common quick room templates for suggestions
  const defaultRoomSuggestions = [
    'Laboratory 1',
    'Laboratory 2',
    'Laboratory 3',
    'Multimedia Lab',
    'Computer Lab A',
    'Computer Lab B',
    'Programming Lab',
    'Network & Hardware Lab',
  ];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [gwRes, roomsRes, unmappedRes] = await Promise.all([
        fetchLabGateways(),
        fetchLabRooms(),
        fetchUnmappedGateways(),
      ]);

      if (gwRes.ok) {
        setGateways(gwRes.data || []);
      } else {
        showToast(gwRes.message || 'Failed to load gateways', 'error');
      }

      if (roomsRes.ok) {
        setRooms(roomsRes.data || []);
      }

      if (unmappedRes.ok) {
        setUnmappedGateways(unmappedRes.data || []);
      }
    } catch (err) {
      console.error('Error loading lab data:', err);
      showToast('Error loading laboratory information', 'error');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showToast = (message, type = 'success') => {
    if (typeof setToast === 'function') {
      setToast({ show: true, message, type });
      setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3500);
    }
  };

  // Merge unique room suggestions
  const combinedRoomSuggestions = useMemo(() => {
    const set = new Set([...rooms, ...defaultRoomSuggestions]);
    return Array.from(set);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms]);

  // Filtered gateways based on search
  const filteredGateways = useMemo(() => {
    if (!search.trim()) return gateways;
    const q = search.toLowerCase();
    return gateways.filter(
      (gw) =>
        gw.laboratory_room?.toLowerCase().includes(q) ||
        gw.gateway_ip?.toLowerCase().includes(q) ||
        gw.description?.toLowerCase().includes(q)
    );
  }, [gateways, search]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalLabs = new Set(gateways.map((g) => g.laboratory_room)).size;
    const totalGateways = gateways.length;
    const activeLabs = gateways.filter((g) => (g.active_sessions_count || 0) > 0).length;
    const totalComputers = gateways.reduce((sum, g) => sum + (g.computers_count || 0), 0);
    return { totalLabs, totalGateways, activeLabs, totalComputers };
  }, [gateways]);

  // Validate IPv4
  const isValidIpv4 = (ip) => {
    const regex = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
    return regex.test(ip.trim());
  };

  const handleCreateGateway = async (e) => {
    e?.preventDefault();
    const errors = {};

    if (!form.gateway_ip?.trim()) {
      errors.gateway_ip = 'Gateway IP is required';
    } else if (!isValidIpv4(form.gateway_ip)) {
      errors.gateway_ip = 'Invalid IPv4 address format (e.g., 192.168.1.1)';
    }

    if (!form.laboratory_room?.trim()) {
      errors.laboratory_room = 'Laboratory name is required';
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    try {
      const res = await createLabGateway(form);
      if (res.ok) {
        showToast(`Laboratory "${form.laboratory_room}" added with gateway ${form.gateway_ip}!`);
        setForm({ gateway_ip: '', laboratory_room: '', description: '' });
        setShowAddForm(false);
        await loadData();
      } else {
        showToast(res.message || 'Failed to add laboratory gateway', 'error');
      }
    } catch (err) {
      showToast('Network error while saving laboratory', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickMapUnmapped = (unmappedIp) => {
    setForm((prev) => ({
      ...prev,
      gateway_ip: unmappedIp,
    }));
    setShowAddForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openEditModal = (gw) => {
    setEditingGateway(gw);
    setEditForm({
      gateway_ip: gw.gateway_ip,
      laboratory_room: gw.laboratory_room,
      description: gw.description || '',
    });
    setEditErrors({});
  };

  const closeEditModal = () => {
    setEditingGateway(null);
    setEditErrors({});
  };

  const handleSaveEdit = async (e) => {
    e?.preventDefault();
    if (!editingGateway) return;

    const errors = {};
    if (!editForm.gateway_ip?.trim()) {
      errors.gateway_ip = 'Gateway IP is required';
    } else if (!isValidIpv4(editForm.gateway_ip)) {
      errors.gateway_ip = 'Invalid IPv4 address format';
    }

    if (!editForm.laboratory_room?.trim()) {
      errors.laboratory_room = 'Laboratory name is required';
    }

    setEditErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSavingEdit(true);
    try {
      const res = await updateLabGateway(editingGateway.id, editForm);
      if (res.ok) {
        showToast(`Updated laboratory "${editForm.laboratory_room}" successfully!`);
        closeEditModal();
        await loadData();
      } else {
        showToast(res.message || 'Failed to update laboratory', 'error');
      }
    } catch (err) {
      showToast('Network error while updating laboratory', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteGateway = async (gw) => {
    const confirmMsg = `Are you sure you want to delete the gateway mapping "${gw.gateway_ip}" for "${gw.laboratory_room}"?\n\nPCs connecting from this gateway will display as "Unknown Lab (${gw.gateway_ip})".`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await deleteLabGateway(gw.id);
      if (res.ok) {
        showToast(`Gateway mapping for "${gw.laboratory_room}" removed.`);
        await loadData();
      } else {
        showToast(res.message || 'Failed to delete gateway mapping', 'error');
      }
    } catch (err) {
      showToast('Network error while deleting gateway', 'error');
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner & Header */}
      <div className="overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-white/70 to-slate-50/50 p-6 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:from-slate-900/80 dark:to-slate-950/90 dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.55)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-md shadow-rose-500/25">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </span>
              <div>
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 sm:text-2xl">
                  Laboratory & Gateway Management
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                  Map default gateway router IPs to laboratory rooms for automatic computer and student session detection.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-100 dark:border-slate-700/80 dark:bg-slate-800/80 dark:text-slate-200 dark:hover:bg-slate-700 sm:text-sm"
              title="Refresh laboratory data"
            >
              <svg
                className={`h-4 w-4 ${loading ? 'animate-spin text-rose-500' : 'text-slate-500'}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setShowAddForm((prev) => !prev)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-4 py-2.5 text-xs font-semibold text-white shadow-md shadow-rose-500/25 transition hover:from-rose-500 hover:to-red-500 hover:shadow-lg sm:text-sm"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={showAddForm ? 'M6 18L18 6M6 6l12 12' : 'M12 4v16m8-8H4'}
                />
              </svg>
              <span>{showAddForm ? 'Close Form' : 'Add Laboratory'}</span>
            </button>
          </div>
        </div>

        {/* Quick KPI stats */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
          <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-3.5 backdrop-blur dark:border-slate-800 dark:bg-slate-800/40">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Labs</span>
            <div className="mt-1 text-2xl font-extrabold text-slate-800 dark:text-slate-100">{stats.totalLabs}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-3.5 backdrop-blur dark:border-slate-800 dark:bg-slate-800/40">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Mapped Gateways</span>
            <div className="mt-1 text-2xl font-extrabold text-rose-600 dark:text-rose-400">{stats.totalGateways}</div>
          </div>
          <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-3.5 backdrop-blur dark:border-slate-800 dark:bg-slate-800/40">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Active Online Labs</span>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">{stats.activeLabs}</span>
              {stats.activeLabs > 0 && (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                </span>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200/60 bg-white/60 p-3.5 backdrop-blur dark:border-slate-800 dark:bg-slate-800/40">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tracked PCs</span>
            <div className="mt-1 text-2xl font-extrabold text-slate-800 dark:text-slate-100">{stats.totalComputers}</div>
          </div>
        </div>
      </div>

      {/* Unmapped Gateways Alert / Quick Mapping */}
      {unmappedGateways.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-amber-300 bg-amber-50/90 p-4 shadow-sm backdrop-blur dark:border-amber-900/60 dark:bg-amber-950/40">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-800 dark:bg-amber-900/70 dark:text-amber-200">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </span>
              <div>
                <h4 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                  Unmapped Gateways Detected from Connected Computers ({unmappedGateways.length})
                </h4>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                  Student computers are active on these gateways, but no laboratory has been assigned yet. Click "Map to
                  Lab" to configure them.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {unmappedGateways.map((ug) => (
                <button
                  key={ug.gateway_ip}
                  type="button"
                  onClick={() => handleQuickMapUnmapped(ug.gateway_ip)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-900 shadow-sm transition hover:bg-amber-100 hover:text-amber-950 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-200 dark:hover:bg-slate-800"
                >
                  <span className="font-mono">{ug.gateway_ip}</span>
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
                    {ug.computer_count || ug.session_count || 1} PC
                  </span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold">+ Map</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Manual Laboratory Adding Form */}
      {showAddForm && (
        <div className="overflow-hidden rounded-3xl border border-rose-200/70 bg-gradient-to-br from-white/90 via-rose-50/30 to-white/90 p-6 shadow-xl backdrop-blur-xl dark:border-rose-900/40 dark:from-slate-900/90 dark:via-slate-900/70 dark:to-slate-950/90">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-4 dark:border-slate-800">
            <div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Add New Laboratory Mapping</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Specify the router's default gateway IP and the laboratory name where computers are located.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleCreateGateway} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Laboratory Name Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Laboratory Name <span className="text-rose-500">*</span>
                </label>
                <div className="mt-1.5 relative">
                  <input
                    type="text"
                    list="laboratory-room-options"
                    value={form.laboratory_room}
                    onChange={(e) => {
                      setForm({ ...form, laboratory_room: e.target.value });
                      if (formErrors.laboratory_room) setFormErrors({ ...formErrors, laboratory_room: null });
                    }}
                    placeholder="e.g., Laboratory 1 or Multimedia Lab"
                    className={`w-full rounded-xl border bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:border-rose-400 ${
                      formErrors.laboratory_room
                        ? 'border-rose-500'
                        : 'border-slate-200/80 dark:border-slate-700/80'
                    }`}
                  />
                  <datalist id="laboratory-room-options">
                    {combinedRoomSuggestions.map((room) => (
                      <option key={room} value={room} />
                    ))}
                  </datalist>
                </div>
                {formErrors.laboratory_room && (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.laboratory_room}</p>
                )}

                {/* Quick select chips */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                  <span className="text-[11px] font-medium">Suggestions:</span>
                  {combinedRoomSuggestions.slice(0, 5).map((room) => (
                    <button
                      key={room}
                      type="button"
                      onClick={() => setForm({ ...form, laboratory_room: room })}
                      className="rounded-md border border-slate-200 bg-white/70 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:border-rose-300 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-rose-500"
                    >
                      {room}
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Gateway IP Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Default Gateway IP <span className="text-rose-500">*</span>
                </label>
                <div className="mt-1.5">
                  <input
                    type="text"
                    value={form.gateway_ip}
                    onChange={(e) => {
                      setForm({ ...form, gateway_ip: e.target.value });
                      if (formErrors.gateway_ip) setFormErrors({ ...formErrors, gateway_ip: null });
                    }}
                    placeholder="e.g., 192.168.1.1 or 192.168.110.1"
                    className={`w-full font-mono rounded-xl border bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:border-rose-400 ${
                      formErrors.gateway_ip ? 'border-rose-500' : 'border-slate-200/80 dark:border-slate-700/80'
                    }`}
                  />
                </div>
                {formErrors.gateway_ip ? (
                  <p className="mt-1 text-xs text-rose-500">{formErrors.gateway_ip}</p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    The IP address of the router / default gateway serving this physical lab network.
                  </p>
                )}
              </div>
            </div>

            {/* Description / Location Notes */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Description / Notes <span className="text-xs font-normal text-slate-400">(Optional)</span>
              </label>
              <div className="mt-1.5">
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="e.g., Main Computer Center 2nd Floor, Room 204 (Subnet 192.168.1.0/24)"
                  className="w-full rounded-xl border border-slate-200/80 bg-white/80 px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:border-slate-700/80 dark:bg-slate-800/80 dark:text-slate-100 dark:focus:border-rose-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setForm({ gateway_ip: '', laboratory_room: '', description: '' });
                  setShowAddForm(false);
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-rose-500/20 transition hover:from-rose-500 hover:to-red-500 hover:shadow-lg disabled:opacity-50"
              >
                {submitting && (
                  <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
                <span>Save Laboratory</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Laboratories List & Search */}
      <div className="overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-white/70 to-slate-50/50 shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-white/10 dark:from-slate-900/80 dark:to-slate-950/90 dark:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.55)]">
        <div className="h-1 w-full bg-gradient-to-r from-red-500 via-rose-500 to-rose-400" aria-hidden />

        <div className="p-4 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              Configured Laboratories ({filteredGateways.length})
            </h3>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search lab, gateway IP..."
                className="w-full rounded-xl border border-slate-200/80 bg-white/70 py-2 pl-9 pr-4 text-sm text-slate-800 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:border-slate-700/80 dark:bg-slate-800/70 dark:text-slate-100 dark:focus:border-rose-400"
              />
              <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {/* Laboratories Grid Cards */}
          {loading && gateways.length === 0 ? (
            <div className="py-12 text-center text-slate-500 dark:text-slate-400">
              <svg className="mx-auto h-8 w-8 animate-spin text-rose-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="mt-3 text-sm font-medium">Loading laboratories...</p>
            </div>
          ) : filteredGateways.length === 0 ? (
            <div className="py-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                  />
                </svg>
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                {search ? 'No laboratories match your search' : 'No laboratories configured yet'}
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {search
                  ? 'Try adjusting your search keywords'
                  : 'Click "Add Laboratory" above to map your first router gateway.'}
              </p>
              {!search && (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-rose-500/20"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Add First Laboratory</span>
                </button>
              )}
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
              {filteredGateways.map((gw) => {
                const isExpanded = expandedLabId === gw.id;
                const activeCount = gw.active_sessions_count || 0;
                const compCount = gw.computers_count || 0;
                const computersList = gw.computers || [];

                return (
                  <div
                    key={gw.id}
                    className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900/60"
                  >
                    {/* Active Sessions Ribbon */}
                    {activeCount > 0 && (
                      <div className="absolute right-0 top-0 flex items-center gap-1.5 rounded-bl-xl bg-emerald-500 px-3 py-1 text-[11px] font-bold text-white shadow-sm">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75"></span>
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-white"></span>
                        </span>
                        <span>{activeCount} Active Online</span>
                      </div>
                    )}

                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                          </svg>
                        </span>
                        <div>
                          <h4 className="text-base font-bold text-slate-800 dark:text-slate-100">
                            {gw.laboratory_room}
                          </h4>
                          {gw.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                              {gw.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(gw)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                          title="Edit laboratory mapping"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteGateway(gw)}
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                          title="Delete laboratory mapping"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Gateway IP & Subnet Badge */}
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-1.5 dark:border-slate-700/80 dark:bg-slate-800/80">
                        <svg className="h-4 w-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                          />
                        </svg>
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Default Gateway:</span>
                        <span className="font-mono text-xs font-bold text-slate-800 dark:text-slate-100">
                          {gw.gateway_ip}
                        </span>
                      </div>

                      <div className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-1.5 dark:border-slate-700/80 dark:bg-slate-800/80">
                        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        </svg>
                        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                          {compCount} {compCount === 1 ? 'Workstation' : 'Workstations'}
                        </span>
                      </div>
                    </div>

                    {/* Expandable Workstations List */}
                    {compCount > 0 && (
                      <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800/70">
                        <button
                          type="button"
                          onClick={() => setExpandedLabId(isExpanded ? null : gw.id)}
                          className="flex w-full items-center justify-between text-xs font-semibold text-rose-600 hover:text-rose-700 dark:text-rose-400"
                        >
                          <span>{isExpanded ? 'Hide Registered PCs' : `View Registered PCs (${compCount})`}</span>
                          <svg
                            className={`h-4 w-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>

                        {isExpanded && (
                          <div className="mt-2.5 flex flex-wrap gap-1.5 animate-fadeIn">
                            {computersList.map((c) => (
                              <span
                                key={c.id || c.computer_name}
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200/90 bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                              >
                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                                <span className="font-mono font-semibold">{c.computer_name}</span>
                                {c.display_name && c.display_name !== c.computer_name && (
                                  <span className="text-slate-400">({c.display_name})</span>
                                )}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Laboratory Modal */}
      {editingGateway && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/40 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-4 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                Edit Laboratory Mapping
              </h3>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Laboratory Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  list="edit-laboratory-room-options"
                  value={editForm.laboratory_room}
                  onChange={(e) => {
                    setEditForm({ ...editForm, laboratory_room: e.target.value });
                    if (editErrors.laboratory_room) setEditErrors({ ...editErrors, laboratory_room: null });
                  }}
                  className={`mt-1.5 w-full rounded-xl border bg-white px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:bg-slate-800 dark:text-slate-100 ${
                    editErrors.laboratory_room
                      ? 'border-rose-500'
                      : 'border-slate-200/80 dark:border-slate-700/80'
                  }`}
                />
                <datalist id="edit-laboratory-room-options">
                  {combinedRoomSuggestions.map((room) => (
                    <option key={room} value={room} />
                  ))}
                </datalist>
                {editErrors.laboratory_room && (
                  <p className="mt-1 text-xs text-rose-500">{editErrors.laboratory_room}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Default Gateway IP <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={editForm.gateway_ip}
                  onChange={(e) => {
                    setEditForm({ ...editForm, gateway_ip: e.target.value });
                    if (editErrors.gateway_ip) setEditErrors({ ...editErrors, gateway_ip: null });
                  }}
                  className={`mt-1.5 w-full font-mono rounded-xl border bg-white px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:bg-slate-800 dark:text-slate-100 ${
                    editErrors.gateway_ip ? 'border-rose-500' : 'border-slate-200/80 dark:border-slate-700/80'
                  }`}
                />
                {editErrors.gateway_ip && (
                  <p className="mt-1 text-xs text-rose-500">{editErrors.gateway_ip}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Description / Notes
                </label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  placeholder="Optional details or location notes"
                  className="mt-1.5 w-full rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 dark:border-slate-700/80 dark:bg-slate-800 dark:text-slate-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-rose-500/20 transition hover:from-rose-500 hover:to-red-500 hover:shadow-lg disabled:opacity-50"
                >
                  {savingEdit && (
                    <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  )}
                  <span>Save Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
