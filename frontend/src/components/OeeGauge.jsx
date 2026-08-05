import { useId } from 'react';

/**
 * Dark neon semi-circular OEE speedometer for Andon.
 * Value color bands: ≥85 green, ≥45 & <85 yellow, <45 red, null idle.
 * Arc stays cyan→magenta regardless of tone.
 */

/** Green from this value up (inclusive). */
const GREEN_MIN = 85;
/** Yellow/warn from this value up (inclusive); below is red. */
const YELLOW_MIN = 45;

/** Neon accents for needle + % readout (arc gradient is fixed). */
const TONE_COLORS = {
  good: '#2DFF8A',
  warn: '#FFE566',
  bad: '#FF4D6D',
  idle: '#5B7A8A',
};

const CX = 100;
/** Arc / needle pivot — sits just above the digital % readout. */
const CY = 102;
const R = 74;
const TRACK_R = 74;
/** Needle shaft reaches near the inner edge of the arc track. */
const NEEDLE_LEN = 64;
/** Small gap from pivot so the shaft starts just above the % text. */
const NEEDLE_HUB = 6;
/** Arrowhead length along the shaft. */
const TIP_LEN = 9;

/** Polar → SVG coords; 0° = right, 180° = left; y increases downward. */
function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy - r * Math.sin(rad),
  };
}

/** Value 0..100 → gauge angle 180° (left) → 0° (right). */
function valueToAngle(value) {
  const v = Math.max(0, Math.min(100, value));
  return 180 - (v / 100) * 180;
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const start = polar(cx, cy, r, startAngle);
  const end = polar(cx, cy, r, endAngle);
  const sweep = startAngle > endAngle ? 1 : 0;
  const large = Math.abs(startAngle - endAngle) > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} ${sweep} ${end.x} ${end.y}`;
}

/** Coerce API/numberish values; null/NaN/non-finite → null (idle). */
function coerceOeeValue(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function oeeTone(value) {
  const n = coerceOeeValue(value);
  if (n == null) return 'idle';
  if (n >= GREEN_MIN) return 'good';
  if (n >= YELLOW_MIN) return 'warn';
  return 'bad';
}

function buildTicks() {
  const ticks = [];
  for (let i = 0; i <= 20; i += 1) {
    const value = i * 5;
    const major = value % 25 === 0;
    ticks.push({ value, major });
  }
  return ticks;
}

/** Arrowhead polygon at `tip`, pointing along `angleDeg` (same polar convention). */
function arrowHeadPoints(tip, angleDeg, len = TIP_LEN, halfW = 3.6) {
  const rad = (angleDeg * Math.PI) / 180;
  // Unit toward tip (from pivot): (cos, -sin). Base sits back along shaft.
  const bx = tip.x - len * Math.cos(rad);
  const by = tip.y + len * Math.sin(rad);
  // Perpendicular in screen space
  const px = halfW * Math.sin(rad);
  const py = halfW * Math.cos(rad);
  return `${tip.x},${tip.y} ${bx - px},${by - py} ${bx + px},${by + py}`;
}

const TICKS = buildTicks();

export default function OeeGauge({
  value,
  className = '',
  label = 'OEE',
  ariaLabel: ariaLabelProp,
}) {
  const uid = useId().replace(/:/g, '');
  const glowId = `oee-glow-${uid}`;
  const softGlowId = `oee-soft-${uid}`;
  const arcGradId = `oee-arc-${uid}`;

  const numeric = coerceOeeValue(value);
  const hasValue = numeric != null;
  const clamped = hasValue ? Math.max(0, Math.min(100, numeric)) : 0;
  const tone = oeeTone(hasValue ? clamped : null);
  const accent = TONE_COLORS[tone];
  const needleAngle = hasValue ? valueToAngle(clamped) : 180;
  const needleBase = polar(CX, CY, NEEDLE_HUB, needleAngle);
  const needleTip = polar(CX, CY, NEEDLE_LEN, needleAngle);
  const shaftEnd = polar(CX, CY, NEEDLE_LEN - TIP_LEN + 1.5, needleAngle);
  const display = hasValue ? `%${clamped.toFixed(1)}` : '—';
  const ariaLabel = ariaLabelProp
    || (hasValue ? `${label} ${clamped.toFixed(1)} yüzde` : `${label} veri yok`);

  const tickLines = TICKS.map(({ value: tick, major }) => {
    const ang = valueToAngle(tick);
    const outer = polar(CX, CY, R - 5, ang);
    const inner = polar(CX, CY, R - (major ? 18 : 11), ang);
    return { key: tick, major, outer, inner };
  });

  return (
    <div
      className={`oee-gauge oee-gauge--${tone}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={ariaLabel}
      style={{ '--oee-gauge-accent': accent }}
    >
      <svg
        className="oee-gauge__svg"
        viewBox="0 0 200 148"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/* userSpaceOnUse: percentage filter regions collapse on thin lines (zero bbox height). */}
          <filter
            id={glowId}
            filterUnits="userSpaceOnUse"
            x="-10"
            y="-10"
            width="220"
            height="170"
          >
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter
            id={softGlowId}
            filterUnits="userSpaceOnUse"
            x="-10"
            y="-10"
            width="220"
            height="170"
          >
            <feGaussianBlur stdDeviation="4.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <linearGradient id={arcGradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00F2FF" stopOpacity="0.85" />
            <stop offset="55%" stopColor="#00F2FF" />
            <stop offset="82%" stopColor="#7B5CFF" />
            <stop offset="100%" stopColor="#FF2BD6" />
          </linearGradient>
        </defs>

        {/* Recessed dark track */}
        <path
          className="oee-gauge__track"
          d={describeArc(CX, CY, TRACK_R, 180, 0)}
          fill="none"
          stroke="rgba(8, 14, 22, 0.95)"
          strokeWidth="16"
          strokeLinecap="round"
        />
        <path
          d={describeArc(CX, CY, TRACK_R, 180, 0)}
          fill="none"
          stroke="rgba(0, 242, 255, 0.08)"
          strokeWidth="16"
          strokeLinecap="round"
        />

        {/* Soft bloom under neon arc */}
        <path
          d={describeArc(CX, CY, TRACK_R, 180, 0)}
          fill="none"
          stroke={`url(#${arcGradId})`}
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.35"
          filter={`url(#${softGlowId})`}
        />

        {/* Neon cyan → magenta arc */}
        <path
          className="oee-gauge__arc"
          d={describeArc(CX, CY, TRACK_R, 180, 0)}
          fill="none"
          stroke={`url(#${arcGradId})`}
          strokeWidth="5.5"
          strokeLinecap="round"
          filter={`url(#${glowId})`}
        />

        {/* Inner highlight hairline */}
        <path
          d={describeArc(CX, CY, TRACK_R - 1.5, 180, 0)}
          fill="none"
          stroke="rgba(255, 255, 255, 0.35)"
          strokeWidth="1"
          strokeLinecap="round"
          opacity="0.55"
        />

        {tickLines.map(({ key, major, outer, inner }) => (
          <line
            key={key}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke={major ? 'rgba(0, 242, 255, 0.95)' : 'rgba(0, 242, 255, 0.5)'}
            strokeWidth={major ? 2 : 1.1}
            strokeLinecap="round"
            filter={major ? `url(#${glowId})` : undefined}
          />
        ))}

        {/* Needle: pivot just above % → tip on arc. Drawn in absolute coords (no CSS rotate). */}
        {hasValue && (
          <g className="oee-gauge__needle">
            {/* Soft neon bloom under shaft */}
            <line
              x1={needleBase.x}
              y1={needleBase.y}
              x2={needleTip.x}
              y2={needleTip.y}
              stroke={accent}
              strokeWidth="8"
              strokeLinecap="round"
              opacity="0.28"
              filter={`url(#${softGlowId})`}
            />
            {/* Visible shaft (çubuk) — thick enough for TV Andon */}
            <line
              className="oee-gauge__needle-shaft"
              x1={needleBase.x}
              y1={needleBase.y}
              x2={shaftEnd.x}
              y2={shaftEnd.y}
              stroke={accent}
              strokeWidth="3.2"
              strokeLinecap="round"
              filter={`url(#${glowId})`}
            />
            {/* Arrow tip on the arc */}
            <polygon
              className="oee-gauge__needle-tip"
              points={arrowHeadPoints(needleTip, needleAngle)}
              fill={accent}
              filter={`url(#${glowId})`}
            />
            {/* Subtle pivot dot — no big hub */}
            <circle
              cx={CX}
              cy={CY}
              r="2.2"
              fill={accent}
              opacity="0.85"
              filter={`url(#${glowId})`}
            />
          </g>
        )}
      </svg>

      <div className="oee-gauge__value" aria-hidden="true">
        {/* Inline color so % never stays green when CSS var cascade loses to .andon-shell */}
        <strong style={{ color: accent }}>{display}</strong>
      </div>
    </div>
  );
}

export {
  GREEN_MIN as OEE_GREEN_MIN,
  YELLOW_MIN as OEE_YELLOW_MIN,
  oeeTone,
};
