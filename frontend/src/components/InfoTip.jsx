import { Info } from 'lucide-react';

/** Shop-floor araç ipuçları için küçük satır içi yardımcı. */
const InfoTip = ({ text, className = '' }) => (
  <span
    className={`inline-flex items-center gap-1 text-[color:var(--color-muted)] ${className}`}
    title={text}
  >
    <Info size={14} aria-hidden="true" />
    <span className="sr-only">{text}</span>
  </span>
);

export default InfoTip;
