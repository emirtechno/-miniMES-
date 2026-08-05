import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import CardHeader from './CardHeader';
import { getApiErrorMessage, resetShopFloorData } from '../services/api';
import { useNotify } from '../context/NotificationContext';

const CONFIRM_WORD = 'SIFIRLA';

/**
 * Admin danger-zone: wipe telemetry / sessions so Andon OEE can rebuild cleanly.
 */
const ShopFloorResetPanel = () => {
  const { notify, confirm } = useNotify();
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const handleReset = async () => {
    if (phrase.trim() !== CONFIRM_WORD) {
      notify(`Onay için kutuya ${CONFIRM_WORD} yazın.`, 'error');
      return;
    }

    const ok = await confirm(
      'Tüm shop-floor telemetrisi, vardiya oturumları, alarmlar ve WO/lot ilerleme sayaçları silinecek. Kullanıcılar ve ürün kataloğu kalır. Emin misiniz?',
    );
    if (!ok) return;

    setBusy(true);
    try {
      const result = await resetShopFloorData({ confirmation: CONFIRM_WORD });
      setLastResult(result);
      setPhrase('');
      notify(
        `Shop-floor sıfırlandı · ${result.machineMetricsDeleted ?? 0} metrik, ${result.shiftSessionsDeleted ?? 0} oturum silindi. Yeni Vardiya Başlat ile temiz OEE birikir.`,
        'success',
      );
    } catch (error) {
      notify(getApiErrorMessage(error, 'Sıfırlama başarısız.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mes-surface border border-red-200 p-5">
      <CardHeader
        icon={Trash2}
        title="Shop-floor verisini sıfırla"
        subtitle="Andon / katalog OEE’yi eski duruş birikiminden temizlemek için. Identity kullanıcıları silinmez."
      />
      <p className="mes-helper mt-0">
        Silinenler: MachineMetrics, ScrapLogs, Alarmlar, ShiftSession’lar, DowntimeEvents,
        üretim kayıtları; WO/lot ilerleme sayaçları 0’lanır. Sonra Operatör Panelinden yeni oturum açın —
        sim daha gerçekçi OEE üretecek şekilde ayarlıdır.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-sm font-medium">
          Onay (<code className="text-xs">{CONFIRM_WORD}</code>)
          <input
            className="mes-input"
            value={phrase}
            onChange={(event) => setPhrase(event.target.value)}
            placeholder={CONFIRM_WORD}
            autoComplete="off"
            disabled={busy}
          />
        </label>
        <button
          type="button"
          className="mes-btn-danger"
          disabled={busy || phrase.trim() !== CONFIRM_WORD}
          onClick={handleReset}
        >
          <Trash2 size={16} />
          {busy ? 'Sıfırlanıyor…' : 'Veriyi sıfırla'}
        </button>
      </div>
      {lastResult && (
        <p className="mes-helper mb-0 mt-3">
          Son sıfırlama: {lastResult.resetAt ? new Date(lastResult.resetAt).toLocaleString('tr-TR') : '—'}
          {' · '}metrik {lastResult.machineMetricsDeleted}
          {' · '}oturum {lastResult.shiftSessionsDeleted}
          {' · '}alarm {lastResult.alarmsDeleted}
        </p>
      )}
    </section>
  );
};

export default ShopFloorResetPanel;
