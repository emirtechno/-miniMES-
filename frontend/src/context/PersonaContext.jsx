import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const PERSONA_KEY = 'mm_active_persona';

export const PERSONA_LIST = [
  { id: 'operator', label: 'Operator', path: '/operator' },
  { id: 'admin', label: 'Admin', path: '/fabrika' },
  { id: 'it-admin', label: 'IT Admin', path: '/fabrika' },
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

/**
 * UI persona switcher (does not change JWT roles). Drives layout/route preference.
 */
export const PersonaProvider = ({ children, defaultPersona = 'admin' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [persona, setPersonaState] = useState(() => readStoredPersona(defaultPersona));

  useEffect(() => {
    sessionStorage.setItem(PERSONA_KEY, persona);
  }, [persona]);

  // Keep badge selection aligned when user navigates via sidebar links.
  useEffect(() => {
    if (location.pathname === '/operator' && persona !== 'operator') {
      setPersonaState('operator');
    } else if (location.pathname === '/fabrika' && persona === 'operator') {
      setPersonaState('admin');
    }
  }, [location.pathname, persona]);

  const setPersona = useCallback((nextId) => {
    const def = PERSONA_LIST.find((item) => item.id === nextId);
    if (!def) return;
    setPersonaState(def.id);
    navigate(def.path);
  }, [navigate]);

  const value = useMemo(() => {
    const personaDef = PERSONA_LIST.find((item) => item.id === persona) || PERSONA_LIST[1];
    return {
      persona,
      personaDef,
      isOperatorPersona: persona === 'operator',
      isExecutivePersona: persona === 'admin' || persona === 'it-admin',
      setPersona,
    };
  }, [persona, setPersona]);

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
