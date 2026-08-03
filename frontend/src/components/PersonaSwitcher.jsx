/**
 * Clickable header role badges that switch UI persona + route.
 * Only personas allowed for the JWT user are shown.
 */
const PersonaSwitcher = ({ persona, onSelect, allowedPersonas }) => {
  const items = allowedPersonas?.length ? allowedPersonas : [];
  if (items.length <= 1) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Görünüm rolü">
      {items.map((item) => {
        const active = persona === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={`mes-persona-badge ${active ? 'mes-persona-badge-active' : ''}`}
            aria-pressed={active}
            title={`${item.label} görünümüne geç`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};

export default PersonaSwitcher;
