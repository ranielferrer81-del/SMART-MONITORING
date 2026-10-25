import { api } from './client';

/**
 * Fetch all configured lab gateway mappings
 * @param {string} search - Optional search query
 */
export async function fetchLabGateways(search = '') {
  try {
    const params = {};
    if (search && search.trim()) {
      params.search = search.trim();
    }
    const response = await api.get('/lab-gateways', { params });
    return { ok: true, data: response.data || [] };
  } catch (error) {
    const message = error.response?.data?.error || error.response?.data?.message || 'Failed to load lab gateways';
    return { ok: false, message, error };
  }
}

/**
 * Fetch distinct laboratory rooms across gateways and computers
 */
export async function fetchLabRooms() {
  try {
    const response = await api.get('/lab-gateways/rooms');
    return { ok: true, data: response.data || [] };
  } catch (error) {
    return { ok: false, data: [] };
  }
}

/**
 * Fetch unmapped gateways detected from active or recent student sessions
 */
export async function fetchUnmappedGateways() {
  try {
    const response = await api.get('/lab-gateways/unmapped');
    return { ok: true, data: response.data || [] };
  } catch (error) {
    return { ok: false, data: [] };
  }
}

/**
 * Create a new lab gateway mapping (Admin only)
 * @param {Object} payload - { gateway_ip, laboratory_room, description }
 */
export async function createLabGateway(payload) {
  try {
    const response = await api.post('/lab-gateways', {
      gateway_ip: payload.gateway_ip?.trim(),
      laboratory_room: payload.laboratory_room?.trim(),
      description: payload.description ? payload.description.trim() : null,
    });
    return { ok: true, data: response.data?.gateway || response.data };
  } catch (error) {
    let message = 'Failed to create lab gateway mapping';
    const errData = error.response?.data;
    if (errData?.errors && typeof errData.errors === 'object') {
      const first = Object.values(errData.errors).flat()[0];
      if (first) message = first;
    } else if (errData?.error) {
      message = errData.error;
    } else if (errData?.message) {
      message = errData.message;
    }
    return { ok: false, message, error };
  }
}

/**
 * Update an existing lab gateway mapping (Admin only)
 * @param {number|string} id - Lab Gateway ID
 * @param {Object} payload - { gateway_ip, laboratory_room, description }
 */
export async function updateLabGateway(id, payload) {
  try {
    const cleanPayload = {};
    if (payload.gateway_ip !== undefined) cleanPayload.gateway_ip = payload.gateway_ip.trim();
    if (payload.laboratory_room !== undefined) cleanPayload.laboratory_room = payload.laboratory_room.trim();
    if (payload.description !== undefined) {
      cleanPayload.description = payload.description ? payload.description.trim() : null;
    }

    const response = await api.patch(`/lab-gateways/${id}`, cleanPayload);
    return { ok: true, data: response.data?.gateway || response.data };
  } catch (error) {
    let message = 'Failed to update lab gateway mapping';
    const errData = error.response?.data;
    if (errData?.errors && typeof errData.errors === 'object') {
      const first = Object.values(errData.errors).flat()[0];
      if (first) message = first;
    } else if (errData?.error) {
      message = errData.error;
    } else if (errData?.message) {
      message = errData.message;
    }
    return { ok: false, message, error };
  }
}

/**
 * Delete a lab gateway mapping (Admin only)
 * @param {number|string} id - Lab Gateway ID
 */
export async function deleteLabGateway(id) {
  try {
    const response = await api.delete(`/lab-gateways/${id}`);
    return { ok: true, data: response.data };
  } catch (error) {
    const message = error.response?.data?.error || error.response?.data?.message || 'Failed to delete lab gateway mapping';
    return { ok: false, message, error };
  }
}
