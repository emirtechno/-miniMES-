import { CheckCircle2, Package, XCircle } from 'lucide-react';

const formatTimestamp = (value) => {
  if (!value) return 'Zaman yok';
  try {
    return new Date(value).toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(value);
  }
};

const shortCode = (value, fallback = '—') => {
  if (!value) return fallback;
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
};

/**
 * Professional recent-records list for station / dashboard widgets.
 */
const RecentRecordsList = ({ records = [], emptyText = 'Henüz kayıt yok.' }) => {
  if (!records.length) {
    return (
      <p className="rounded-lg border border-dashed border-[color:var(--color-line)] bg-slate-50 px-4 py-6 text-center text-sm text-[color:var(--color-muted)]">
        {emptyText}
      </p>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-2 p-0">
      {records.map((record) => {
        const isOk = record.kaliteDurumu === 'OK';
        return (
          <li
            key={record.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-[color:var(--color-line)] bg-slate-50/70 px-3 py-2.5"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  isOk ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}
                aria-hidden="true"
              >
                <Package size={16} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[color:var(--color-ink)]" title={record.urun20liKod}>
                  Ürün {shortCode(record.urun20liKod)}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[color:var(--color-muted)]">
                  <span title={record.malzeme12liKod}>Malzeme {shortCode(record.malzeme12liKod)}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={record.uretimTarihi || undefined}>{formatTimestamp(record.uretimTarihi)}</time>
                </div>
              </div>
            </div>
            <span className={isOk ? 'mes-pill-ok' : 'mes-pill-nok'}>
              {isOk ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
              {isOk ? 'Başarılı' : 'Hatalı'}
            </span>
          </li>
        );
      })}
    </ul>
  );
};

export default RecentRecordsList;
