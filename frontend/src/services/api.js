import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_MES_API_URL || 'http://localhost:5000/api')
  .replace(/\/+$/, '')
  .replace(/\/Uretim$/, '');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('mm_access_token');
  const expiresAt = sessionStorage.getItem('mm_token_expires_at');
  if (token && expiresAt && new Date(expiresAt) <= new Date()) {
    window.dispatchEvent(new Event('mm:unauthorized'));
    return Promise.reject(new axios.CanceledError('Oturum süresi doldu.'));
  }
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.endsWith('/Auth/login')) {
      window.dispatchEvent(new Event('mm:unauthorized'));
    }
    return Promise.reject(error);
  },
);

const unwrapPage = (response) => {
  const data = response.data || {};
  if (Array.isArray(data)) {
    return { items: data, nextCursor: null };
  }
  return {
    items: data.items || [],
    nextCursor: data.nextCursor || null,
  };
};

const fetchPage = async (path, { cursor, limit = 50, signal, ...extraParams } = {}) => {
  const response = await apiClient.get(path, {
    params: {
      cursor: cursor || undefined,
      limit,
      ...extraParams,
    },
    signal,
  });
  return unwrapPage(response);
};

export const localizeIdentityMessage = (message = '') => {
  const map = [
    [/Passwords must have at least one non alphanumeric character.*/i, 'Parola özel karakter içermelidir (!, ?, # vb.).'],
    [/Passwords must have at least one digit.*/i, 'Parola en az bir rakam (0-9) içermelidir.'],
    [/Passwords must have at least one lowercase.*/i, 'Parola en az bir küçük harf içermelidir.'],
    [/Passwords must have at least one uppercase.*/i, 'Parola en az bir büyük harf içermelidir.'],
    [/Passwords must be at least (\d+) characters.*/i, 'Parola en az $1 karakter olmalıdır.'],
    [/PasswordRequiresNonAlphanumeric/i, 'Parola özel karakter içermelidir (!, ?, # vb.).'],
    [/PasswordRequiresDigit/i, 'Parola en az bir rakam (0-9) içermelidir.'],
    [/PasswordRequiresLower/i, 'Parola en az bir küçük harf içermelidir.'],
    [/PasswordRequiresUpper/i, 'Parola en az bir büyük harf içermelidir.'],
    [/PasswordTooShort/i, 'Parola çok kısa.'],
  ];
  let next = String(message);
  for (const [pattern, replacement] of map) {
    next = next.replace(pattern, replacement);
  }
  return next;
};

const GENERIC_SERVER_DETAIL = 'Hata ayrıntıları sunucu günlüklerine kaydedildi.';

export const getApiErrorMessage = (error, fallback = 'İşlem tamamlanamadı.') => {
  const data = error?.response?.data;
  if (data?.errors) {
    const validationErrors = Array.isArray(data.errors)
      ? data.errors
      : Object.values(data.errors).flat().filter(Boolean);
    if (validationErrors.length) {
      return validationErrors.map((item) => localizeIdentityMessage(item)).join(' · ');
    }
  }
  // Prefer actionable detail; skip the generic "see server logs" placeholder when title is clearer.
  if (data?.detail && data.detail !== GENERIC_SERVER_DETAIL) {
    return localizeIdentityMessage(data.detail);
  }
  if (data?.title && data.title !== 'One or more validation errors occurred.') {
    return localizeIdentityMessage(data.title);
  }
  if (data?.detail) return localizeIdentityMessage(data.detail);
  if (data?.message) return localizeIdentityMessage(data.message);
  return error?.message || fallback;
};

/** Collect all ASP.NET validation error strings for multi-line UI display. */
export const getApiValidationErrors = (error) => {
  const data = error?.response?.data;
  if (!data?.errors) return [];
  if (Array.isArray(data.errors)) return data.errors.filter(Boolean).map(localizeIdentityMessage);
  return Object.entries(data.errors).flatMap(([field, messages]) => {
    const list = Array.isArray(messages) ? messages : [messages];
    return list.filter(Boolean).map((message) => {
      const localized = localizeIdentityMessage(message);
      // Prefer message alone when field is an Identity code.
      if (/^Password/i.test(field) || field === '') return localized;
      return `${field}: ${localized}`;
    });
  });
};

export const login = async (username, password) => {
  const response = await apiClient.post('/Auth/login', { username, password });
  return response.data;
};

export const fetchCurrentUser = async () => {
  const response = await apiClient.get('/Auth/me');
  return response.data;
};

export const fetchAlarms = (options) => fetchPage('/Alarm', options);

export const createAlarm = async (payload) => {
  const response = await apiClient.post('/Alarm', payload);
  return response.data;
};

export const acknowledgeAlarm = async (id) => {
  const response = await apiClient.put(`/Alarm/acknowledge/${id}`);
  return response.data;
};

export const resolveAlarm = async (id) => {
  const response = await apiClient.put(`/Alarm/resolve/${id}`);
  return response.data;
};

/** Soft-resolve via DELETE (backend maps DELETE → resolve; never hard-deletes). */
export const deleteAlarm = async (id) => {
  const response = await apiClient.delete(`/Alarm/${id}`);
  return response.data;
};

export const fetchWorkOrders = (options) => fetchPage('/WorkOrder', options);

export const createWorkOrder = async (payload) => {
  const response = await apiClient.post('/WorkOrder', payload);
  return response.data;
};

export const advanceWorkOrder = async (id, rowVersion) => {
  const response = await apiClient.put(`/WorkOrder/${id}/advance`, { rowVersion });
  return response.data;
};

export const fetchBatches = (options) => fetchPage('/Batch', options);

export const advanceBatch = async (id) => {
  const response = await apiClient.post(`/Batch/${id}/advance`);
  return response.data;
};

export const reopenBatch = async (id) => {
  const response = await apiClient.post(`/Batch/${id}/reopen`);
  return response.data;
};

export const updateBatchProgress = async (id, payload) => {
  const response = await apiClient.put(`/Batch/${id}/progress`, payload);
  return response.data;
};

export const fetchMachineMetrics = async ({
  stationId,
  cursor,
  limit = 50,
  from,
  to,
  signal,
} = {}) => {
  const response = await apiClient.get('/MachineMetrics', {
    params: {
      stationId: stationId && stationId !== 'Tümü' ? stationId : undefined,
      cursor: cursor || undefined,
      limit,
      from: from || undefined,
      to: to || undefined,
    },
    signal,
  });
  return unwrapPage(response);
};

/** Aggregated KPIs from MachineMetrics SSOT (plant + per-station). */
export const fetchTelemetrySummary = async ({ stationId, signal } = {}) => {
  const response = await apiClient.get('/MachineMetrics/summary', {
    params: {
      stationId: stationId && stationId !== 'Tümü' ? stationId : undefined,
    },
    signal,
  });
  return response.data || [];
};

/** PLC / external ingest — batch Actual/Good/Downtime tick (frontend no longer posts ticks). */
export const createMachineMetric = async (payload, { signal } = {}) => {
  const response = await apiClient.post('/MachineMetrics', payload, { signal });
  return response.data;
};

/** Operator scrap — ScrapLog + NOK MachineMetrics tick. */
export const logMachineScrap = async (payload, { signal } = {}) => {
  const response = await apiClient.post('/MachineMetrics/scrap', payload, { signal });
  return response.data;
};

export const fetchActiveShiftSession = async ({ stationId, signal } = {}) => {
  const response = await apiClient.get('/ShiftSession/active', {
    params: { stationId: stationId || undefined },
    signal,
  });
  return response.data || null;
};

/** Plant-wide open ShiftSessions for Andon (one per station, with session-scoped OEE). */
export const fetchShiftSessionBoard = async ({ signal } = {}) => {
  const response = await apiClient.get('/ShiftSession/board', { signal });
  return Array.isArray(response.data) ? response.data : [];
};

export const startShiftSession = async (payload, { signal } = {}) => {
  const response = await apiClient.post('/ShiftSession/start', payload, { signal });
  return response.data;
};

export const startShiftDowntime = async (id, payload, { signal } = {}) => {
  const response = await apiClient.post(`/ShiftSession/${id}/downtime`, payload, { signal });
  return response.data;
};

export const startShiftSetup = async (id, { signal } = {}) => {
  const response = await apiClient.post(`/ShiftSession/${id}/setup`, {}, { signal });
  return response.data;
};

export const resumeShiftSession = async (id, { signal } = {}) => {
  const response = await apiClient.post(`/ShiftSession/${id}/resume`, {}, { signal });
  return response.data;
};

export const endShiftSession = async (id, { signal } = {}) => {
  const response = await apiClient.post(`/ShiftSession/${id}/end`, {}, { signal });
  return response.data;
};

/** Recent ShiftSessions for the current user (includes live/persisted summary). */
export const fetchShiftSessionHistory = async ({ limit = 20, stationId, signal } = {}) => {
  const response = await apiClient.get('/ShiftSession/history', {
    params: {
      limit,
      stationId: stationId || undefined,
    },
    signal,
  });
  return response.data || [];
};

/** Session detail with summary + optional recent MachineMetrics ticks. */
export const fetchShiftSessionDetail = async (id, { tickLimit = 12, signal } = {}) => {
  const response = await apiClient.get(`/ShiftSession/${id}`, {
    params: { tickLimit },
    signal,
  });
  return response.data;
};

export const fetchOeeShifts = async ({ signal } = {}) => {
  const response = await apiClient.get('/Oee/shifts', { signal });
  return response.data || [];
};

export const fetchDowntimeReasons = async ({ signal } = {}) => {
  const response = await apiClient.get('/Oee/downtime-reasons', { signal });
  return response.data || [];
};

export const fetchLatestOee = async (stationId, { signal } = {}) => {
  const response = await apiClient.get(`/Oee/latest/${encodeURIComponent(stationId)}`, { signal });
  return response.data;
};

/** Bulk latest OEE for all stations (single-tick scope). */
export const fetchLatestOeeAll = async ({ signal } = {}) => {
  const response = await apiClient.get('/Oee/latest', { signal });
  return Array.isArray(response.data) ? response.data : [];
};

/** Current shift-window OEE for one station (catalog shift window). */
export const fetchShiftCurrentOee = async (stationId, { signal } = {}) => {
  const response = await apiClient.get(
    `/Oee/shift-current/${encodeURIComponent(stationId)}`,
    { signal },
  );
  return response.data;
};

/** Current shift-window OEE aggregates — preferred by Andon / plant overview. */
export const fetchShiftCurrentOeeAll = async ({ signal } = {}) => {
  const response = await apiClient.get('/Oee/shift-current', { signal });
  return Array.isArray(response.data) ? response.data : [];
};

export const fetchOeeStations = async ({ signal } = {}) => {
  const response = await apiClient.get('/Oee/stations', { signal });
  return response.data || [];
};

/** Runtime factory simulation gate (independent of operator shift). */
export const fetchSimulationStatus = async ({ signal } = {}) => {
  const response = await apiClient.get('/Simulation/status', { signal });
  return response.data;
};

export const setSimulationEnabled = async (payload, { signal } = {}) => {
  const response = await apiClient.put('/Simulation/enabled', payload, { signal });
  return response.data;
};

/** Destructive shop-floor wipe. confirmation must be exactly "SIFIRLA". */
export const resetShopFloorData = async ({ confirmation = 'SIFIRLA', signal } = {}) => {
  const response = await apiClient.post(
    '/Simulation/reset-shop-floor',
    { confirmation },
    { signal },
  );
  return response.data;
};

export const fetchUsers = async () => {
  const response = await apiClient.get('/Users');
  return unwrapPage(response);
};

export const createUser = async (payload) => {
  const response = await apiClient.post('/Users', payload);
  return response.data;
};

export const updateUserRoles = async (id, roles) => {
  const response = await apiClient.put(`/Users/${id}/roles`, { roles });
  return response.data;
};

export const updateUserStatus = async (id, isActive) => {
  const response = await apiClient.put(`/Users/${id}/status`, { isActive });
  return response.data;
};
