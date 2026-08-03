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

const unwrapList = (response) => (
  response.data?.success ? response.data.data : (response.data || [])
);

export const getApiErrorMessage = (error, fallback = 'İşlem tamamlanamadı.') => {
  const data = error?.response?.data;
  if (data?.detail) return data.detail;
  if (data?.title) return data.title;
  if (data?.message) return data.message;
  if (data?.errors) {
    const validationErrors = Array.isArray(data.errors)
      ? data.errors
      : Object.values(data.errors).flat();
    if (validationErrors.length) return validationErrors.join(' ');
  }
  return error?.message || fallback;
};

export const login = async (username, password) => {
  const response = await apiClient.post('/Auth/login', { username, password });
  return response.data;
};

export const fetchCurrentUser = async () => {
  const response = await apiClient.get('/Auth/me');
  return response.data;
};

export const fetchProductionRecords = async () => {
  const response = await apiClient.get('/Uretim');
  return unwrapList(response);
};

export const fetchDeletedProductionRecords = async () => {
  const response = await apiClient.get('/Uretim/deleted');
  return unwrapList(response);
};

export const createProductionRecord = async (payload) => {
  const response = await apiClient.post('/Uretim', payload);
  return response.data;
};

export const updateProductionRecord = async (id, payload) => {
  const response = await apiClient.put(`/Uretim/${id}`, payload);
  return response.data;
};

export const deleteProductionRecord = async (id) => {
  const response = await apiClient.delete(`/Uretim/${id}`);
  return response.data;
};

export const restoreProductionRecord = async (id) => {
  const response = await apiClient.put(`/Uretim/restore/${id}`);
  return response.data;
};

export const hardDeleteProductionRecord = async (id) => {
  const response = await apiClient.delete(`/Uretim/hard-delete/${id}`);
  return response.data;
};

export const fetchAlarms = async () => {
  const response = await apiClient.get('/Alarm');
  return unwrapList(response);
};

export const createAlarm = async (payload) => {
  const response = await apiClient.post('/Alarm', payload);
  return response.data;
};

export const acknowledgeAlarm = async (id) => {
  const response = await apiClient.put(`/Alarm/acknowledge/${id}`);
  return response.data;
};

export const deleteAlarm = async (id) => {
  const response = await apiClient.delete(`/Alarm/${id}`);
  return response.data;
};

export const fetchWorkOrders = async () => {
  const response = await apiClient.get('/WorkOrder');
  return unwrapList(response);
};

export const createWorkOrder = async (payload) => {
  const response = await apiClient.post('/WorkOrder', payload);
  return response.data;
};

export const advanceWorkOrder = async (id) => {
  const response = await apiClient.put(`/WorkOrder/${id}/advance`);
  return response.data;
};

export const fetchBatches = async () => {
  const response = await apiClient.get('/Batch');
  return unwrapList(response);
};

export const fetchMachineMetrics = async () => {
  const response = await apiClient.get('/MachineMetrics');
  return unwrapList(response);
};

export const fetchLatestOee = async (stationId) => {
  const response = await apiClient.get(`/Oee/latest/${encodeURIComponent(stationId)}`);
  return response.data;
};

export const fetchUsers = async () => {
  const response = await apiClient.get('/Users');
  return response.data || [];
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
