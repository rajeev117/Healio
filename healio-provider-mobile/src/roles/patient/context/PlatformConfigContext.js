import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../services/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// PlatformConfig — single source of truth for admin-controlled settings.
//
// Feature toggles now come from ONE table: `features`. Each row is a simple
// on/off switch (enabled = true → everyone gets it). Banners and pricing keep
// their own tables because they are content/values, not switches.
//
// Defaults are permissive (true) so a missing/failed config never hides things.
// Helper names (isFlagOn / isLive / isFeatureAvailable / categories) are kept
// for backward compatibility — they all read the same unified `features` list.
// ─────────────────────────────────────────────────────────────────────────────

const PlatformConfigContext = createContext(null);

export function PlatformConfigProvider({ children }) {
  const [features, setFeatures]     = useState([]);   // unified toggle rows
  const [banners, setBanners]       = useState([]);
  const [pricing, setPricing]       = useState([]);
  const [loaded, setLoaded]         = useState(false);

  const load = useCallback(async () => {
    try {
      const [ft, bn, pr] = await Promise.all([
        supabase.from('features').select('key, name, enabled, category, app'),
        supabase.from('banners').select('*').eq('enabled', true).in('app', ['patient', 'both']),
        supabase.from('pricing_rules').select('*'),
      ]);
      if (ft.data) setFeatures(ft.data);
      if (bn.data) setBanners(bn.data);
      if (pr.data) setPricing(pr.data);
    } catch (e) {
      // keep defaults — app still works
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    // Reload whenever auth changes (e.g. right after login).
    const { data: sub } = supabase.auth.onAuthStateChange(() => { load(); });
    return () => sub?.subscription?.unsubscribe?.();
  }, [load]);

  // ── Lookup helpers (default permissive) ──────────────────────────────────────
  // Match a feature by its key OR its display name (case-insensitive).
  const findFeature = (idOrName) => {
    if (!idOrName) return null;
    const needle = String(idOrName).toLowerCase();
    return features.find(f => f.key?.toLowerCase() === needle || f.name?.toLowerCase() === needle) || null;
  };

  // Primary API: is this feature on for everyone?
  const isEnabled = (idOrName) => {
    const f = findFeature(idOrName);
    return f ? !!f.enabled : true;
  };

  // Backward-compatible aliases — all map to the same unified check.
  const isFlagOn = isEnabled;
  const isLive   = isEnabled;
  const isFeatureAvailable = (flagName, killName) =>
    isEnabled(flagName) && (killName ? isEnabled(killName) : true);

  // Enabled patient service tiles (formerly service_categories).
  const categories = features.filter(f => f.category === 'service' && f.enabled);

  const getBanners = (position) =>
    position ? banners.filter(b => b.position === position) : banners;

  // Returns { basePrice, platformFee, total } for a service name, or null.
  const getPrice = (serviceName) => {
    const r = pricing.find(p => p.service?.toLowerCase() === String(serviceName).toLowerCase());
    if (!r) return null;
    const base = Number(r.base_price || 0);
    const fee  = Number(r.platform_fee || 0);
    return { basePrice: base, platformFee: fee, total: base + fee };
  };

  const value = {
    loaded, features, banners, pricing, categories,
    isEnabled, isFlagOn, isLive, isFeatureAvailable, getBanners, getPrice, reload: load,
  };

  return (
    <PlatformConfigContext.Provider value={value}>
      {children}
    </PlatformConfigContext.Provider>
  );
}

export function usePlatformConfig() {
  const ctx = useContext(PlatformConfigContext);
  // Safe fallback if used outside the provider
  if (!ctx) {
    return {
      loaded: false, features: [], banners: [], pricing: [], categories: [],
      isEnabled: () => true, isFlagOn: () => true, isLive: () => true, isFeatureAvailable: () => true,
      getBanners: () => [], getPrice: () => null, reload: () => {},
    };
  }
  return ctx;
}
