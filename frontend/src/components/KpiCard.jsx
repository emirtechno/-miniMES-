const KpiCard = ({ title, value, icon: Icon, accent, valueColor }) => {
  return (
    <div className="kpi-card">
      <div>
        <div className="kpi-title">{title}</div>
        <div className="kpi-value" style={{ color: valueColor || '#0f172a' }}>{value}</div>
      </div>
      <div className="kpi-icon-box" style={{ backgroundColor: accent.bg, color: accent.color }}>
        <Icon size={24} />
      </div>
    </div>
  );
};

export default KpiCard;
