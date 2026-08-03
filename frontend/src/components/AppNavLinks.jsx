import { Link, useLocation } from 'react-router-dom';

/** Sidebar / mobile nav links — declared outside render to satisfy react-hooks/static-components. */
export default function AppNavLinks({ items, onNavigate }) {
  const location = useLocation();

  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {items.map(({ to, label, icon: Icon, match }) => {
        const active = match(location.pathname);
        return (
          <li key={to}>
            <Link
              to={to}
              className="mes-nav-link"
              aria-current={active ? 'page' : undefined}
              onClick={() => onNavigate?.()}
            >
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
