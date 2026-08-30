import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  loadActiveProfile, getActiveProfile, setActiveProfile as persistActiveProfile,
  subscribeActiveProfile, SELF_PROFILE,
} from '../services/activeProfile';

const ActiveProfileContext = createContext({
  profile: SELF_PROFILE,
  ready: false,
  switchProfile: async () => {},
});

export function ActiveProfileProvider({ children }) {
  const [profile, setProfile] = useState(getActiveProfile());
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    loadActiveProfile().then((p) => { if (mounted) { setProfile(p); setReady(true); } });
    const unsub = subscribeActiveProfile((p) => { if (mounted) setProfile(p); });
    return () => { mounted = false; unsub(); };
  }, []);

  const switchProfile = useCallback((next) => persistActiveProfile(next), []);

  return (
    <ActiveProfileContext.Provider value={{ profile, ready, switchProfile }}>
      {children}
    </ActiveProfileContext.Provider>
  );
}

export const useActiveProfile = () => useContext(ActiveProfileContext);
