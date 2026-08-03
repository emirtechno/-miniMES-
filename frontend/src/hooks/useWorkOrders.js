import { useCallback, useEffect, useState } from 'react';
import {
  advanceWorkOrder,
  createWorkOrder,
  fetchBatches,
  fetchWorkOrders,
  getApiErrorMessage,
} from '../services/api';

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
    handleAdvanceWorkOrder,
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
