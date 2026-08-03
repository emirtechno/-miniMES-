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

const fetchPage = async (path, { cursor, limit = 50, signal } = {}) => {
  const response = await apiClient.get(path, {
    params: { cursor: cursor || undefined, limit },
    signal,
  });
  return unwrapPage(response);
};

export const getApiErrorMessage = (error, fallback = 'İşlem tamamlanamadı.') => {
  const data = error?.response?.data;
  if (data?.errors) {
    const validationErrors = Array.isArray(data.errors)
      ? data.errors
      : Object.values(data.errors).flat().filter(Boolean);
    if (validationErrors.length) return validationErrors.join(' · ');
  }
  if (data?.detail) return data.detail;
  if (data?.title && data.title !== 'One or more validation errors occurred.') return data.title;
  if (data?.message) return data.message;
  return error?.message || fallback;
};

/** Collect all ASP.NET validation error strings for multi-line UI display. */
export const getApiValidationErrors = (error) => {
  const data = error?.response?.data;
  if (!data?.errors) return [];
  if (Array.isArray(data.errors)) return data.errors.filter(Boolean);
  return Object.entries(data.errors).flatMap(([field, messages]) => {
    const list = Array.isArray(messages) ? messages : [messages];
    return list.filter(Boolean).map((message) => (field && field !== '' ? `${field}: ${message}` : message));
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

export const fetchMachineMetrics = async ({ stationId, cursor, limit = 50, signal } = {}) => {
  const response = await apiClient.get('/MachineMetrics', {
    params: {
      stationId: stationId && stationId !== 'Tümü' ? stationId : undefined,
      cursor: cursor || undefined,
      limit,
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

/** Live Stream / PLC ingest — batch Actual/Good/Downtime tick. */
export const createMachineMetric = async (payload, { signal } = {}) => {
  const response = await apiClient.post('/MachineMetrics', payload, { signal });
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

export const fetchOeeStations = async ({ signal } = {}) => {
  const response = await apiClient.get('/Oee/stations', { signal });
  return response.data || [];
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
