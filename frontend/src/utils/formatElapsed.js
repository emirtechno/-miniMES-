/** Format elapsed duration from a start ISO timestamp to nowTick ms. */
export const formatElapsed = (startedAt, nowTick = Date.now()) => {
  if (!startedAt) return '—';
  const elapsedMs = Math.max(0, nowTick - new Date(startedAt).getTime());
  const mins = Math.floor(elapsedMs / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const s = Math.floor((elapsedMs % 60000) / 1000);
  if (h > 0) return `${h}sa ${m}dk`;
  if (mins > 0) return `${m}dk ${s}sn`;
  return `${s}sn`;
};
