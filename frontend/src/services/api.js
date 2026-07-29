import axios from 'axios';

const API_BASE_URL = (import.meta.env.VITE_MES_API_URL || 'http://localhost:58504/api').replace(/\/Uretim$/, '');
const URETIM_API_URL = `${API_BASE_URL}/Uretim`;
const ALARM_API_URL = `${API_BASE_URL}/Alarm`;
const WORKORDER_API_URL = `${API_BASE_URL}/WorkOrder`;

// Fallbacks for environments where IIS Express or Kestrel port differs
const ALARM_FALLBACK_URLS = [
  ALARM_API_URL,
  'http://localhost:58504/api/Alarm',
  'http://localhost:58600/api/Alarm'
];

const WORKORDER_FALLBACK_URLS = [
  WORKORDER_API_URL,
  'http://localhost:58504/api/WorkOrder',
  'http://localhost:58600/api/WorkOrder'
];

// ==========================================
// 🏭 ÜRETİM SERVİSLERİ (PRODUCTION)
// ==========================================
export const fetchProductionRecords = async () => {
  const response = await axios.get(URETIM_API_URL);
  return response.data;
};

export const fetchDeletedProductionRecords = async () => {
  const response = await axios.get(`${URETIM_API_URL}/deleted`);
  return response.data;
};

export const createProductionRecord = async (payload) => {
  const response = await axios.post(URETIM_API_URL, payload);
  return response.data;
};

export const updateProductionRecord = async (id, payload) => {
  const response = await axios.put(`${URETIM_API_URL}/${id}`, payload);
  return response.data;
};

export const deleteProductionRecord = async (id) => {
  const response = await axios.delete(`${URETIM_API_URL}/${id}`);
  return response.data;
};

export const restoreProductionRecord = async (id) => {
  const response = await axios.put(`${URETIM_API_URL}/restore/${id}`);
  return response.data;
};

// ==========================================
// 🚨 ALARM SERVİSLERİ
// ==========================================
export const fetchAlarms = async () => {
  let lastError;
  for (const url of ALARM_FALLBACK_URLS) {
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
};

export const acknowledgeAlarm = async (id) => {
  let lastError;
  for (const base of ALARM_FALLBACK_URLS) {
    try {
      const response = await axios.put(`${base}/acknowledge/${id}`);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
};

export const createAlarm = async (payload) => {
  let lastError;
  for (const url of ALARM_FALLBACK_URLS) {
    try {
      const response = await axios.post(url, payload);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
};

// ==========================================
// 📋 İŞ EMRİ SERVİSLERİ (WORK ORDERS)
// ==========================================
export const fetchWorkOrders = async () => {
  let lastError;
  for (const url of WORKORDER_FALLBACK_URLS) {
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
};

export const createWorkOrder = async (payload) => {
  let lastError;
  for (const url of WORKORDER_FALLBACK_URLS) {
    try {
      const response = await axios.post(url, payload);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
};

export const advanceWorkOrder = async (id) => {
  let lastError;
  for (const base of WORKORDER_FALLBACK_URLS) {
    try {
      const response = await axios.put(`${base}/${id}/advance`);
      return response.data;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
};