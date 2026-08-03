/**
 * Unified card header with optional right-aligned action toolbar.
 */
const CardHeader = ({ icon: Icon, title, subtitle, actions, className = '' }) => (
  <div className={`mes-card-header ${className}`}>
    <div className="flex min-w-0 items-start gap-2">
      {Icon ? <Icon size={20} className="mt-0.5 shrink-0 text-[color:var(--color-vestel)]" /> : null}
      <div className="min-w-0">
        <div className="mes-section-title m-0 truncate">{title}</div>
        {subtitle ? <p className="mes-helper mt-0.5 mb-0">{subtitle}</p> : null}
      </div>
    </div>
    {actions ? <div className="mes-card-actions">{actions}</div> : null}
  </div>
);

export default CardHeader;
