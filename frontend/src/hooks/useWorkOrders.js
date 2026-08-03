import { useCallback, useEffect, useState } from 'react';
import {
  advanceWorkOrder,
  createWorkOrder,
  fetchBatches,
  fetchWorkOrders,
  getApiErrorMessage,
} from '../services/api';
import { ACTIVE_STATION_DEFINITIONS, DEFAULT_STATION } from '../constants/stations';
import { useNonOverlappingPolling } from './useNonOverlappingPolling';

const SAMPLE_PRODUCTS = [
  'Montaj Kiti A',
  'Elektronik Kart B',
  'Paketleme Ünitesi C',
  'Final Kontrol Lotu D',
];

export function useWorkOrders({
  isAuthenticated,
  canManageWorkOrders,
  notify,
}) {
  const [workOrders, setWorkOrders] = useState([]);
  const [batches, setBatches] = useState([]);
  const [workOrderForm, setWorkOrderForm] = useState({
    orderNo: '',
    product: '',
    station: '',
    quantity: '',
  });
  const [creatingSample, setCreatingSample] = useState(false);

  const loadWorkOrders = useCallback(async (signal) => {
    try {
      const page = await fetchWorkOrders({ signal });
      setWorkOrders(page.items);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.error(err);
    }
  }, []);

  const loadBatches = useCallback(async (signal) => {
    try {
      const page = await fetchBatches({ signal });
      setBatches(page.items);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const controller = new AbortController();
    loadWorkOrders(controller.signal);
    loadBatches(controller.signal);
    return () => controller.abort();
  }, [isAuthenticated, loadBatches, loadWorkOrders]);

  useNonOverlappingPolling(
    (signal) => loadBatches(signal),
    {
      enabled: isAuthenticated,
      intervalMs: 8000,
      runImmediately: false,
    },
  );

  const handleWorkOrderSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (!canManageWorkOrders) {
      notify('İş emri oluşturma yetkiniz yok (Saha Müdürü yetkisi gereklidir).', 'error');
      return;
    }
    const quantity = Number(workOrderForm.quantity);
    if (!Number.isFinite(quantity) || quantity < 1) {
      notify('Miktar 1 veya daha büyük bir sayı olmalıdır.', 'error');
      return;
    }
    try {
      await createWorkOrder({
        orderNo: workOrderForm.orderNo,
        product: workOrderForm.product,
        station: workOrderForm.station,
        quantity,
      });
      setWorkOrderForm({ orderNo: '', product: '', station: '', quantity: '' });
      await loadWorkOrders();
    } catch (err) {
      notify(getApiErrorMessage(err, 'İş emri oluşturulamadı.'), 'error');
      console.error(err);
    }
  }, [canManageWorkOrders, loadWorkOrders, notify, workOrderForm]);

  const handleCreateSampleWorkOrder = useCallback(async () => {
    if (!canManageWorkOrders) {
      notify('İş emri oluşturma yetkiniz yok (Saha Müdürü yetkisi gereklidir).', 'error');
      return;
    }
    try {
      setCreatingSample(true);
      const stamp = Date.now().toString().slice(-6);
      const stations = ACTIVE_STATION_DEFINITIONS.map((s) => s.id);
      await createWorkOrder({
        orderNo: `WO-TEST-${stamp}`,
        product: SAMPLE_PRODUCTS[Math.floor(Math.random() * SAMPLE_PRODUCTS.length)],
        station: stations[Math.floor(Math.random() * stations.length)] || DEFAULT_STATION,
        quantity: 10 + Math.floor(Math.random() * 90),
      });
      notify('Otomatik test iş emri oluşturuldu.', 'success');
      await loadWorkOrders();
    } catch (err) {
      notify(getApiErrorMessage(err, 'Test iş emri oluşturulamadı.'), 'error');
      console.error(err);
    } finally {
      setCreatingSample(false);
    }
  }, [canManageWorkOrders, loadWorkOrders, notify]);

  const handleAdvanceWorkOrder = useCallback(async (order) => {
    if (!canManageWorkOrders) {
      notify('İş emri durumunu değiştirme yetkiniz yok.', 'error');
      return;
    }
    try {
      await advanceWorkOrder(order.id, order.rowVersion);
      await loadWorkOrders();
    } catch (err) {
      notify(getApiErrorMessage(err, 'İş emri durumu güncellenemedi.'), 'error');
      console.error(err);
    }
  }, [canManageWorkOrders, loadWorkOrders, notify]);

  return {
    workOrders,
    batches,
    loadWorkOrders,
    loadBatches,
    handleAdvanceWorkOrder,
    handleCreateSampleWorkOrder,
    creatingSample,
    workOrderForm: {
      values: workOrderForm,
      onFieldChange: (field, value) => setWorkOrderForm((current) => ({ ...current, [field]: value })),
      onSubmit: handleWorkOrderSubmit,
      onDenied: (event) => {
        event?.preventDefault();
        notify('Bu işlem için yetkiniz yok.', 'error');
      },
    },
  };
}
