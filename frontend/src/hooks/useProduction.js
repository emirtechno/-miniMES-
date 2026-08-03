import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createProductionRecord,
  deleteProductionRecord,
  fetchDeletedProductionRecords,
  fetchProductionRecords,
  getApiErrorMessage,
  hardDeleteProductionRecord,
  restoreProductionRecord,
  updateProductionRecord,
} from '../services/api';
import { useNonOverlappingPolling } from './useNonOverlappingPolling';
import { DEFAULT_STATION, STATIONS } from '../constants/stations';

export function useProduction({
  isAuthenticated,
  canViewDeleted,
  canAddRecord,
  autoRefresh,
  factorySimulationActive,
  notify,
  confirm,
}) {
  const [records, setRecords] = useState([]);
  const [nextProductionCursor, setNextProductionCursor] = useState(null);
  const [loadingMoreRecords, setLoadingMoreRecords] = useState(false);
  const [deletedRecords, setDeletedRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [error, setError] = useState(null);
  const [deletedError, setDeletedError] = useState(null);
  const [urun20liKod, setUrun20liKod] = useState('');
  const [malzeme12liKod, setMalzeme12liKod] = useState('');
  const [istasyonAdi, setIstasyonAdi] = useState('');
  const [kaliteDurumu, setKaliteDurumu] = useState('OK');
  const urunInputRef = useRef(null);
  const malzemeInputRef = useRef(null);
  const productionRequestIdRef = useRef(0);

  const fetchRecords = useCallback(async (signal, { background = false } = {}) => {
    const requestId = ++productionRequestIdRef.current;
    try {
      if (!background) setLoading(true);
      const page = await fetchProductionRecords({ signal });
      if (requestId !== productionRequestIdRef.current) return;
      const activeItems = page.items.filter((r) => !(r?.isDeleted ?? r?.IsDeleted ?? false));
      if (background) {
        setRecords((current) => {
          const latestIds = new Set(activeItems.map((record) => record.id));
          return [...activeItems, ...current.filter((record) => !latestIds.has(record.id))];
        });
      } else {
        setRecords(activeItems);
        setNextProductionCursor(page.nextCursor);
      }
      setError(null);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      if (requestId === productionRequestIdRef.current) {
        setError(getApiErrorMessage(err, 'API bağlantısı başarısız oldu.'));
      }
      console.error(err);
    } finally {
      if (!background && requestId === productionRequestIdRef.current) setLoading(false);
    }
  }, []);

  const loadMoreRecords = useCallback(async () => {
    if (!nextProductionCursor || loadingMoreRecords) return;
    setLoadingMoreRecords(true);
    try {
      const page = await fetchProductionRecords({ cursor: nextProductionCursor });
      setRecords((current) => {
        const ids = new Set(current.map((record) => record.id));
        return [...current, ...page.items.filter((record) => !ids.has(record.id))];
      });
      setNextProductionCursor(page.nextCursor);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Daha fazla kayıt yüklenemedi.'));
    } finally {
      setLoadingMoreRecords(false);
    }
  }, [loadingMoreRecords, nextProductionCursor]);

  const fetchDeletedRecords = useCallback(async (signal) => {
    try {
      setDeletedLoading(true);
      const page = await fetchDeletedProductionRecords({ signal });
      setDeletedRecords(page.items);
      setDeletedError(null);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      setDeletedError(getApiErrorMessage(err, 'Silinen kayıtlar alınamadı.'));
      console.error(err);
    } finally {
      setDeletedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    const controller = new AbortController();
    fetchRecords(controller.signal);
    if (canViewDeleted) fetchDeletedRecords(controller.signal);
    return () => controller.abort();
  }, [isAuthenticated, canViewDeleted, fetchRecords, fetchDeletedRecords]);

  useNonOverlappingPolling(
    (signal) => fetchRecords(signal, { background: true }),
    {
      enabled: isAuthenticated && autoRefresh,
      intervalMs: 10000,
      runImmediately: false,
    },
  );

  useNonOverlappingPolling(async (signal) => {
    const timestamp = Date.now().toString();
    const random7 = Math.floor(1000000 + Math.random() * 9000000).toString();
    await createProductionRecord({
      urun20liKod: timestamp + random7,
      malzeme12liKod: Math.floor(100000000000 + Math.random() * 900000000000).toString(),
      istasyonAdi: STATIONS[Math.floor(Math.random() * STATIONS.length)],
      kaliteDurumu: Math.random() > 0.15 ? 'OK' : 'NOK',
      uretimTarihi: new Date().toISOString(),
    }, { signal });
    await fetchRecords(signal, { background: true });
  }, {
    enabled: factorySimulationActive && canAddRecord,
    intervalMs: 15000,
    runImmediately: false,
  });

  const generateRandomBarcodes = useCallback(() => {
    if (!canAddRecord) {
      notify('Kayıt ekleme yetkiniz yok.', 'error');
      return;
    }
    const timestamp = Date.now().toString();
    const random7 = Math.floor(1000000 + Math.random() * 9000000).toString();
    setUrun20liKod(timestamp + random7);
    setMalzeme12liKod(Math.floor(100000000000 + Math.random() * 900000000000).toString());
    setIstasyonAdi(STATIONS[Math.floor(Math.random() * STATIONS.length)]);
    setKaliteDurumu(Math.random() > 0.15 ? 'OK' : 'NOK');
  }, [canAddRecord, notify]);

  const handleAddRecord = useCallback(async (event) => {
    event.preventDefault();
    if (!canAddRecord) {
      notify('Seçili kullanıcı şu anda üretim kaydı ekleyemez.', 'error');
      return;
    }
    try {
      await createProductionRecord({
        urun20liKod,
        malzeme12liKod,
        istasyonAdi: istasyonAdi || DEFAULT_STATION,
        kaliteDurumu,
        uretimTarihi: new Date().toISOString(),
      });
      setUrun20liKod('');
      setMalzeme12liKod('');
      setIstasyonAdi('');
      setKaliteDurumu('OK');
      await fetchRecords();
      if (canViewDeleted) await fetchDeletedRecords();
      urunInputRef.current?.focus();
    } catch (err) {
      notify(getApiErrorMessage(err, 'Kayıt eklenirken bir sorun oluştu.'), 'error');
      console.error(err);
    }
  }, [canAddRecord, canViewDeleted, fetchDeletedRecords, fetchRecords, istasyonAdi, kaliteDurumu, malzeme12liKod, notify, urun20liKod]);

  const handleDelete = useCallback(async (id) => {
    if (!(await confirm(`ID: ${id} kaydını silmek istediğinize emin misiniz?`))) return;
    try {
      const res = await deleteProductionRecord(id);
      if (res.success !== false) {
        await fetchRecords();
        if (canViewDeleted) await fetchDeletedRecords();
      } else {
        notify(`Silme Başarısız: ${res.message}`, 'error');
      }
    } catch (err) {
      notify(getApiErrorMessage(err, 'Silme işlemi başarısız.'), 'error');
      console.error(err);
    }
  }, [canViewDeleted, confirm, fetchDeletedRecords, fetchRecords, notify]);

  const handleHardDelete = useCallback(async (recordOrId) => {
    const id = typeof recordOrId === 'object' ? (recordOrId.id || recordOrId.Id) : recordOrId;
    if (!id) {
      notify('Hata: Silinecek kaydın ID bilgisi okunamadı!', 'error');
      return;
    }
    if (!(await confirm(`ID: ${id} kaydı veritabanından KALICI OLARAK silinecektir. Bu işlem geri alınamaz! Onaylıyor musunuz?`))) return;
    try {
      const res = await hardDeleteProductionRecord(id);
      if (res && res.success !== false) {
        if (canViewDeleted) await fetchDeletedRecords();
      } else {
        notify(`Kalıcı Silme Başarısız: ${res?.message || 'Sunucu hatası'}`, 'error');
      }
    } catch (err) {
      notify(getApiErrorMessage(err, 'Kalıcı silme işlemi başarısız.'), 'error');
      console.error(err);
    }
  }, [canViewDeleted, confirm, fetchDeletedRecords, notify]);

  const handleRestore = useCallback(async (recordOrId) => {
    const id = typeof recordOrId === 'object' ? (recordOrId.id || recordOrId.Id) : recordOrId;
    if (!id) {
      notify('Hata: Geri yüklenecek kaydın ID bilgisi okunamadı!', 'error');
      return;
    }
    try {
      const res = await restoreProductionRecord(id);
      if (res && res.success !== false) {
        await fetchRecords();
        if (canViewDeleted) await fetchDeletedRecords();
      } else {
        notify(`Geri Yükleme Başarısız: ${res?.message || 'Sunucu hatası'}`, 'error');
      }
    } catch (err) {
      notify(getApiErrorMessage(err, 'Geri yükleme işlemi başarısız.'), 'error');
      console.error(err);
    }
  }, [canViewDeleted, fetchDeletedRecords, fetchRecords, notify]);

  const handleToggleQuality = useCallback(async (record) => {
    const newStatus = record.kaliteDurumu === 'OK' ? 'NOK' : 'OK';
    try {
      const res = await updateProductionRecord(record.id, {
        ...record,
        kaliteDurumu: newStatus,
      });
      if (res.success !== false) {
        await fetchRecords();
        if (canViewDeleted) await fetchDeletedRecords();
      } else {
        notify(`Güncelleme Başarısız: ${res.message}`, 'error');
      }
    } catch (err) {
      notify(getApiErrorMessage(err, 'Güncelleme başarısız.'), 'error');
      console.error(err);
    }
  }, [canViewDeleted, fetchDeletedRecords, fetchRecords, notify]);

  return {
    records,
    loading,
    error,
    nextProductionCursor,
    loadingMoreRecords,
    loadMoreRecords,
    fetchRecords,
    deletedRecords,
    deletedLoading,
    deletedError,
    form: {
      urun20liKod,
      malzeme12liKod,
      istasyonAdi,
      kaliteDurumu,
      setUrun20liKod,
      setMalzeme12liKod,
      setIstasyonAdi,
      setKaliteDurumu,
      urunInputRef,
      malzemeInputRef,
      onSubmit: handleAddRecord,
      onGenerateRandom: generateRandomBarcodes,
    },
    handleDelete,
    handleHardDelete,
    handleRestore,
    handleToggleQuality,
  };
}
