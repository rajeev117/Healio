import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// PlatformConfig (provider app) — admin-controlled settings.
// Feature toggles come from ONE table: `features` (enabled = ON for everyone).
// Banners keep their own table (content, not a switch). Defaults permissive.
// Helper names (isFlagOn / isLive / isFeatureAvailable) are kept for
// backward compatibility — they all read the same unified `features` list.
// ─────────────────────────────────────────────────────────────────────────────

const Ctx = createContext(null);

export function PlatformConfigProvider({ children }) {
  const [features, setFeatures] = useState([]);
  const [banners, setBanners]   = useState([]);
  const [loaded, setLoaded]     = useState(false);

  const load = useCallback(async () => {
    try {
      const [ft, bn] = await Promise.all([
        supabase.from('features').select('key, name, enabled, category, app'),
        supabase.from('banners').select('*').eq('enabled', true).in('app', ['provider', 'both']),
      ]);
      if (ft.data) setFeatures(ft.data);
      if (bn.data) setBanners(bn.data);
    } catch (e) { /* keep defaults */ }
    finally { setLoaded(true); }
  }, []);

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => { load(); });
    return () => sub?.subscription?.unsubscribe?.();
  }, [load]);

  const findFeature = (idOrName) => {
    if (!idOrName) return null;
    const needle = String(idOrName).toLowerCase();
    return features.find(f => f.key?.toLowerCase() === needle || f.name?.toLowerCase() === needle) || null;
  };
  const isEnabled = (idOrName) => {
    const f = findFeature(idOrName);
    return f ? !!f.enabled : true;
  };
  const isFlagOn = isEnabled;
  const isLive   = isEnabled;
  const isFeatureAvailable = (flagName, killName) =>
    isEnabled(flagName) && (killName ? isEnabled(killName) : true);
  const getBanners = () => banners;

  return (
    <Ctx.Provider value={{ loaded, features, banners, isEnabled, isFlagOn, isLive, isFeatureAvailable, getBanners, reload: load }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePlatformConfig() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    return {
      loaded: false, features: [], banners: [],
      isEnabled: () => true, isFlagOn: () => true, isLive: () => true, isFeatureAvailable: () => true,
      getBanners: () => [], reload: () => {},
    };
  }
  return ctx;
}
