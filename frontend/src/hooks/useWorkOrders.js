import { useCallback, useEffect, useState } from 'react';
import {
  advanceWorkOrder,
  createWorkOrder,
  fetchBatches,
  fetchWorkOrders,
  getApiErrorMessage,
  advanceBatch,
  reopenBatch,
  updateBatchProgress,
} from '../services/api';
import { ACTIVE_STATION_DEFINITIONS, DEFAULT_STATION } from '../constants/stations';

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
  const [batchBusyId, setBatchBusyId] = useState(null);

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

  const handleWorkOrderSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (!canManageWorkOrders) {
      notify('İş emri oluşturma yetkiniz yok (Saha Müdürü yetkisi gereklidir).', 'error');
      return;
    }
    try {
      await createWorkOrder({
        orderNo: workOrderForm.orderNo,
        product: workOrderForm.product,
        station: workOrderForm.station,
        quantity: Number(workOrderForm.quantity),
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

  const handleAdvanceBatch = useCallback(async (batch) => {
    if (!canManageWorkOrders) {
      notify('Parti durumu değiştirme yetkiniz yok.', 'error');
      return;
    }
    try {
      setBatchBusyId(batch.id);
      const updated = await advanceBatch(batch.id);
      setBatches((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      notify('Parti durumu güncellendi.', 'success');
    } catch (err) {
      notify(getApiErrorMessage(err, 'Parti ilerletilemedi.'), 'error');
    } finally {
      setBatchBusyId(null);
    }
  }, [canManageWorkOrders, notify]);

  const handleReopenBatch = useCallback(async (batch) => {
    if (!canManageWorkOrders) {
      notify('Parti geri alma yetkiniz yok.', 'error');
      return;
    }
    try {
      setBatchBusyId(batch.id);
      const updated = await reopenBatch(batch.id);
      setBatches((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      notify('Parti İşlemde durumuna alındı (Geri Al).', 'success');
    } catch (err) {
      notify(getApiErrorMessage(err, 'Parti geri alınamadı.'), 'error');
    } finally {
      setBatchBusyId(null);
    }
  }, [canManageWorkOrders, notify]);

  const handleUpdateBatchProgress = useCallback(async (batch, producedQuantity) => {
    if (!canManageWorkOrders) {
      notify('Parti miktarı güncelleme yetkiniz yok.', 'error');
      return;
    }
    try {
      setBatchBusyId(batch.id);
      const updated = await updateBatchProgress(batch.id, { producedQuantity });
      setBatches((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err) {
      notify(getApiErrorMessage(err, 'Parti ilerlemesi güncellenemedi.'), 'error');
    } finally {
      setBatchBusyId(null);
    }
  }, [canManageWorkOrders, notify]);

  return {
    workOrders,
    batches,
    loadWorkOrders,
    loadBatches,
    handleAdvanceWorkOrder,
    handleCreateSampleWorkOrder,
    handleAdvanceBatch,
    handleReopenBatch,
    handleUpdateBatchProgress,
    creatingSample,
    batchBusyId,
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
