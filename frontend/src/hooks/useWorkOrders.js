import { useCallback, useEffect, useState } from 'react';
import {
  advanceWorkOrder,
  createWorkOrder,
  deleteWorkOrder,
  fetchWorkOrders,
  getApiErrorMessage,
  restoreDeletedWorkOrder,
  restoreWorkOrder,
} from '../services/api';
import { ACTIVE_STATION_DEFINITIONS, DEFAULT_STATION } from '../constants/stations';
import { useNonOverlappingPolling } from './useNonOverlappingPolling';

const SAMPLE_PRODUCTS = [
  'Montaj Kiti A',
  'Elektronik Kart B',
  'Paketleme Ünitesi C',
  'Final Kontrol Ürünü D',
];

// NEDEN: İş emri listesi + advance/arşiv/soft-delete tek hook'ta. Backend WO-only (lot/batch yok).
// NASIL: scope=active + scope=history paralel çekilir; 8 sn poll; silince toast ile restore-deleted.
export function useWorkOrders({
  isAuthenticated,
  canManageWorkOrders,
  notify,
}) {
  const [workOrders, setWorkOrders] = useState([]);
  const [historyWorkOrders, setHistoryWorkOrders] = useState([]);
  const [workOrderForm, setWorkOrderForm] = useState({
    orderNo: '',
    product: '',
    station: '',
    quantity: '',
  });
  const [creatingSample, setCreatingSample] = useState(false);

  const loadWorkOrders = useCallback(async (signal) => {
    try {
      // NEDEN: Aktif pano (Arşivlendi hariç) + geçmiş (yalnız Arşivlendi) ayrı tutulur — soft-delete listede yok.
      const [activePage, historyPage] = await Promise.all([
        fetchWorkOrders({ signal, scope: 'active' }),
        fetchWorkOrders({ signal, scope: 'history' }),
      ]);
      setWorkOrders(activePage.items);
      setHistoryWorkOrders(historyPage.items);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.error(err);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const controller = new AbortController();
    loadWorkOrders(controller.signal);
    return () => controller.abort();
  }, [isAuthenticated, loadWorkOrders]);

  useNonOverlappingPolling(
    async (signal) => {
      await loadWorkOrders(signal);
    },
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

  // NEDEN: advance = Bekliyor→…→Arşivlendi tek adım; RowVersion iyimser kilit (409 olursa UI yeniler).
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

  // NEDEN: Arşivlendi → Tamamlandı (geçmişten geri). Soft-delete geri alma handleUndoDeletedWorkOrder'da.
  const handleRestoreWorkOrder = useCallback(async (order) => {
    if (!canManageWorkOrders) {
      notify('İş emri durumunu değiştirme yetkiniz yok.', 'error');
      return;
    }
    try {
      await restoreWorkOrder(order.id, order.rowVersion);
      await loadWorkOrders();
    } catch (err) {
      notify(getApiErrorMessage(err, 'İş emri geçmişten geri alınamadı.'), 'error');
      console.error(err);
    }
  }, [canManageWorkOrders, loadWorkOrders, notify]);

  const handleUndoDeletedWorkOrder = useCallback(async (deleted) => {
    try {
      await restoreDeletedWorkOrder(deleted.id, deleted.rowVersion);
      notify('İş emri geri alındı.', 'success');
      await loadWorkOrders();
    } catch (err) {
      notify(getApiErrorMessage(err, 'İş emri geri alınamadı.'), 'error');
      console.error(err);
    }
  }, [loadWorkOrders, notify]);

  // NEDEN: Hard-delete yok — DELETE soft-delete (DeletedAt). Toast'taki "Geri al" → restore-deleted.
  const handleDeleteWorkOrder = useCallback(async (order) => {
    if (!canManageWorkOrders) {
      notify('İş emri silme yetkiniz yok.', 'error');
      return;
    }
    try {
      const deleted = await deleteWorkOrder(order.id, order.rowVersion);
      await loadWorkOrders();
      notify('İş emri silindi', 'info', {
        actionLabel: 'Geri al',
        durationMs: 12000,
        onAction: () => {
          void handleUndoDeletedWorkOrder(deleted);
        },
      });
    } catch (err) {
      notify(getApiErrorMessage(err, 'İş emri silinemedi.'), 'error');
      console.error(err);
    }
  }, [canManageWorkOrders, handleUndoDeletedWorkOrder, loadWorkOrders, notify]);

  return {
    workOrders,
    historyWorkOrders,
    loadWorkOrders,
    handleAdvanceWorkOrder,
    handleRestoreWorkOrder,
    handleDeleteWorkOrder,
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
