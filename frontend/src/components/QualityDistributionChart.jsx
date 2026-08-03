import { memo, useMemo } from 'react';
import { PieChart as PieIcon } from 'lucide-react';
import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

const GRADIENTS = [
  { id: 'okGradient', from: '#34d399', to: '#059669' },
  { id: 'nokGradient', from: '#fb7185', to: '#e11d48' },
];

const RADIAN = Math.PI / 180;

const renderPercentLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (!percent || percent < 0.04) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" className="text-xs font-bold">
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

/**
 * Modern quality doughnut with % labels, gradient fills, and detailed hover tooltips.
 */
const QualityDistributionChart = ({ data = [], totalCount = 0 }) => {
  const chartData = useMemo(
    () => data.map((entry, index) => ({
      ...entry,
      fill: `url(#${GRADIENTS[index % GRADIENTS.length].id})`,
    })),
    [data],
  );

  return (
    <section className="mes-surface flex flex-col p-5">
      <div className="mb-3 flex items-center gap-2">
        <PieIcon className="text-[color:var(--color-vestel)]" size={20} />
        <div>
          <span className="mes-section-title">Kalite Dağılım Grafiği</span>
          <p className="mes-helper mt-0.5 mb-0">OK / NOK oranları — üzerine gelince adet detayı</p>
        </div>
      </div>
      <div className="min-h-[280px] w-full flex-1">
        {totalCount === 0 ? (
          <p className="pt-20 text-center text-[color:var(--color-muted)]">Grafik için henüz veri yok.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <defs>
                {GRADIENTS.map((g) => (
                  <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={g.from} />
                    <stop offset="100%" stopColor={g.to} />
                  </linearGradient>
                ))}
              </defs>
              <Pie
                data={chartData}
                cx="50%"
                cy="48%"
                innerRadius={58}
                outerRadius={92}
                paddingAngle={3}
                dataKey="value"
                stroke="#fff"
                strokeWidth={2}
                labelLine={false}
                label={renderPercentLabel}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => {
                  const pct = totalCount > 0 ? ((Number(value) / totalCount) * 100).toFixed(1) : '0.0';
                  return [`${value} adet (${pct}%)`, name];
                }}
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid #d7dee8',
                  boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
                }}
              />
              <Legend
                verticalAlign="bottom"
                height={40}
                formatter={(value, entry) => {
                  const count = entry?.payload?.value ?? 0;
                  const pct = totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : '0.0';
                  return `${value}: ${count} (%${pct})`;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
};

export default memo(QualityDistributionChart);
