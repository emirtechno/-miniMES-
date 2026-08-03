/** Standard shop-floor shift schedules (display labels for HMI). */
export const SHIFT_SCHEDULES = [
  {
    code: 'SHIFT_A',
    label: 'Vardiya A [08:00 - 16:00]',
    name: 'Vardiya A',
    window: '08:00 - 16:00',
  },
  {
    code: 'SHIFT_B',
    label: 'Vardiya B [16:00 - 00:00]',
    name: 'Vardiya B',
    window: '16:00 - 00:00',
  },
  {
    code: 'SHIFT_C',
    label: 'Vardiya C [00:00 - 08:00]',
    name: 'Vardiya C',
    window: '00:00 - 08:00',
  },
];

export const getShiftLabel = (code) => (
  SHIFT_SCHEDULES.find((shift) => shift.code === code)?.label || code || '—'
);
