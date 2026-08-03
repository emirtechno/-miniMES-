import { PERSONA_LIST } from '../context/PersonaContext';

/**
 * Clickable header role badges that switch UI persona + route.
 */
const PersonaSwitcher = ({ persona, onSelect }) => (
  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Görünüm rolü">
    {PERSONA_LIST.map((item) => {
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

export default PersonaSwitcher;
