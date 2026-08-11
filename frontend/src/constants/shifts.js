/** Standart shop-floor vardiya çizelgesi — backend ShiftCatalog ile aynı olmalı (UTC saatleri). */
export const SHIFT_SCHEDULES = [
  {
    code: 'SHIFT_A',
    label: 'Vardiya A [06:00 - 14:00]',
    name: 'Vardiya A',
    window: '06:00 - 14:00',
  },
  {
    code: 'SHIFT_B',
    label: 'Vardiya B [14:00 - 22:00]',
    name: 'Vardiya B',
    window: '14:00 - 22:00',
  },
  {
    code: 'SHIFT_C',
    label: 'Vardiya C [22:00 - 06:00]',
    name: 'Vardiya C',
    window: '22:00 - 06:00',
  },
];

export const getShiftLabel = (code) => (
  SHIFT_SCHEDULES.find((shift) => shift.code === code)?.label || code || '—'
);

/** UTC zaman damgası için güncel katalog vardiya kodu (backend ShiftCatalog.ResolveForUtc ile aynı). */
export const resolveShiftCodeForUtc = (date = new Date()) => {
  const hour = date instanceof Date ? date.getUTCHours() : new Date(date).getUTCHours();
  if (hour >= 6 && hour < 14) return 'SHIFT_A';
  if (hour >= 14 && hour < 22) return 'SHIFT_B';
  return 'SHIFT_C';
};
