const KpiCard = ({ title, value, icon: Icon, accent, valueColor }) => (
  <div className="mes-surface flex items-center justify-between gap-3 p-4">
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-[color:var(--color-muted)]">{title}</div>
      <div className="font-display mt-1 text-3xl font-semibold" style={{ color: valueColor || '#0b1220' }}>{value}</div>
    </div>
    <div
      className="flex h-12 w-12 items-center justify-center rounded-xl"
      style={{ backgroundColor: accent.bg, color: accent.color }}
    >
      <Icon size={22} />
    </div>
  </div>
);

export default KpiCard;
