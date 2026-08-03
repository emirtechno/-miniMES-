import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const PERSONA_KEY = 'mm_active_persona';

export const PERSONA_LIST = [
  { id: 'operator', label: 'Operatör', path: '/operator', requiresAnyRole: ['Operator', 'Admin'] },
  { id: 'admin', label: 'Yönetici', path: '/fabrika', requiresAnyRole: ['Admin'] },
  { id: 'it-admin', label: 'IT Yönetici', path: '/fabrika', requiresAnyRole: ['Admin'] },
];

const PersonaContext = createContext(null);

const readStoredPersona = (fallback) => {
  try {
    const stored = sessionStorage.getItem(PERSONA_KEY);
    if (PERSONA_LIST.some((item) => item.id === stored)) return stored;
  } catch {
    // ignore
  }
  return fallback;
};

const personaAllowed = (personaId, roles = []) => {
  const def = PERSONA_LIST.find((item) => item.id === personaId);
  if (!def) return false;
  if (!def.requiresAnyRole?.length) return true;
  return def.requiresAnyRole.some((role) => roles.includes(role));
};

/**
 * UI persona switcher (does not change JWT roles). Options are gated by real JWT roles.
 */
export const PersonaProvider = ({ children, defaultPersona = 'admin', roles = [] }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const allowedPersonas = useMemo(
    () => PERSONA_LIST.filter((item) => personaAllowed(item.id, roles)),
    [roles],
  );
  const safeDefault = allowedPersonas.some((item) => item.id === defaultPersona)
    ? defaultPersona
    : (allowedPersonas[0]?.id || 'operator');

  const [persona, setPersonaState] = useState(() => {
    const stored = readStoredPersona(safeDefault);
    return personaAllowed(stored, roles) ? stored : safeDefault;
  });

  useEffect(() => {
    if (!personaAllowed(persona, roles)) {
      setPersonaState(safeDefault);
    }
  }, [persona, roles, safeDefault]);

  useEffect(() => {
    sessionStorage.setItem(PERSONA_KEY, persona);
  }, [persona]);

  useEffect(() => {
    if (location.pathname === '/operator' && persona !== 'operator' && personaAllowed('operator', roles)) {
      setPersonaState('operator');
    } else if (location.pathname === '/fabrika' && persona === 'operator' && personaAllowed('admin', roles)) {
      setPersonaState('admin');
    }
  }, [location.pathname, persona, roles]);

  const setPersona = useCallback((nextId) => {
    const def = allowedPersonas.find((item) => item.id === nextId);
    if (!def) return;
    setPersonaState(def.id);
    navigate(def.path);
  }, [allowedPersonas, navigate]);

  const value = useMemo(() => {
    const personaDef = allowedPersonas.find((item) => item.id === persona) || allowedPersonas[0] || PERSONA_LIST[0];
    return {
      persona: personaDef.id,
      personaDef,
      allowedPersonas,
      isOperatorPersona: personaDef.id === 'operator',
      isExecutivePersona: personaDef.id === 'admin' || personaDef.id === 'it-admin',
      setPersona,
    };
  }, [persona, setPersona, allowedPersonas]);

  return (
    <PersonaContext.Provider value={value}>
      {children}
    </PersonaContext.Provider>
  );
};

export const usePersona = () => {
  const ctx = useContext(PersonaContext);
  if (!ctx) {
    throw new Error('usePersona must be used within PersonaProvider');
  }
  return ctx;
};
