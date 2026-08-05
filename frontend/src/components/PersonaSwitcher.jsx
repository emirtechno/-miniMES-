/**
 * Compact horizontal segment control for UI persona switching.
 * Only personas allowed for the JWT user are shown.
 */
const PersonaSwitcher = ({ persona, onSelect, allowedPersonas }) => {
  const items = allowedPersonas?.length ? allowedPersonas : [];
  if (items.length <= 1) return null;

  return (
    <div className="mes-persona-switch" role="group" aria-label="Görünüm rolü">
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
