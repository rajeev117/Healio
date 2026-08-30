import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STRINGS } from '../i18n/strings';

// ─────────────────────────────────────────────────────────────────────────────
// LanguageContext — stores the user's preferred app language.
//
// The choice is persisted to AsyncStorage and loaded on launch so the
// "Choose Language" screen only blocks the first run; afterwards the app goes
// straight to Welcome/login. NOTE: this stores the preference only — the app's
// strings are not yet translated, so changing it has no visible effect until an
// i18n layer is added on top of `language`.
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'healio.provider.language';

export const LANGUAGES = [
  { code: 'en', native: 'English' },
  { code: 'hi', native: 'हिंदी (Hindi)' },
  { code: 'bn', native: 'বাংলা (Bengali)' },
];

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(null); // language code, or null until chosen
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) setLanguageState(saved);
      } catch (_) {
        // storage unavailable — fall through to the language picker
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const setLanguage = async (code) => {
    setLanguageState(code);
    try { await AsyncStorage.setItem(STORAGE_KEY, code); } catch (_) {}
  };

  // Translate a UI string key. Falls back English → raw key, so a missing
  // hi/bn entry never blanks out. Only static interface text is keyed — names
  // and medical data are rendered from the DB as-is (English) and never passed
  // here. `vars` fills {placeholders}; injected values (e.g. names) pass through.
  const t = useCallback((key, vars) => {
    const lang = language || 'en';
    let str = (STRINGS[lang] && STRINGS[lang][key]) ?? STRINGS.en[key] ?? key;
    if (vars) {
      str = str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
    }
    return str;
  }, [language]);

  // Brief spinner while reading the stored preference — avoids a flash of the
  // language picker for users who already chose one.
  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#821c03" />
      </View>
    );
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, languageChosen: !!language, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
