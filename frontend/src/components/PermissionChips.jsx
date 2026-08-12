import { getPermissionHint, getPermissionLabel } from '../constants/permissions';

/**
 * Ham virgülle ayrılmış kodlar yerine yapılandırılmış yetki rozetleri.
 */
const PermissionChips = ({ permissions = [], compact = false }) => {
  if (!permissions.length) {
    return <span className="mes-pill-neutral">Salt okunur</span>;
  }

  return (
    <ul className={`m-0 flex list-none flex-wrap gap-1.5 p-0 ${compact ? '' : 'max-w-xl'}`}>
      {permissions.map((code) => (
        <li key={code}>
          <span
            className="mes-pill bg-sky-50 text-sky-900 ring-1 ring-sky-200"
            title={getPermissionHint(code) || code}
          >
            {getPermissionLabel(code)}
          </span>
        </li>
      ))}
    </ul>
  );
};

export default PermissionChips;
