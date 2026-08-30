import React, { createContext, useContext, useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// AuthContext — stores who is logged in and what role they have
//
// Roles:
//   'hospital_admin'    → full hospital dashboard (current Home)
//   'doctor'            → their appointments, patients, prescriptions
//   'opd_assistant'     → appointment queue, check-in flow
//   'pharmacy_assistant'→ pharmacy orders queue
//
// When Supabase is connected, lookupRole() replaces the mock below with:
//   const { data } = await supabase.from('staff').select('*').eq('phone', phone).single();
//   if (data) return { role: data.role, ... }
//   const { data: org } = await supabase.from('organisations').select('*').eq('admin_phone', phone).single();
//   if (org) return { role: 'hospital_admin', ... }
// ─────────────────────────────────────────────────────────────────────────────

const AuthContext = createContext(null);

export const ROLES = {
  HOSPITAL_ADMIN:     'hospital_admin',
  DOCTOR:             'doctor',
  OPD_ASSISTANT:      'opd_assistant',
  PHARMACY_ASSISTANT: 'pharmacy_assistant',
  LAB_TECHNICIAN:     'lab_technician',
  NURSE:              'nurse',              // stored as 'nurse' in DB — homecare assistant role
  HOMECARE_ASSISTANT: 'homecare_assistant', // future-proof alias

  // Standalone providers — not staff of a hospital, but the organisation itself.
  // Derived from organisations.type in resolveRole(), NOT from staff_role: an
  // independent lab is an org with type 'diagnostic', a pharmacy type 'pharmacy',
  // and a solo practitioner a one-doctor org of type 'clinic'.
  INDEPENDENT_LAB:      'independent_lab',
  INDEPENDENT_PHARMACY: 'independent_pharmacy',
  INDEPENDENT_DOCTOR:   'independent_doctor',

  // Their own auth identities, with no organisation at all.
  RMP:                'rmp',
  PATIENT:            'patient',
};

// ── Mock role lookup ─────────────────────────────────────────────────────────
// Replace this entire function with Supabase query when credentials are ready.
// The structure it returns must stay the same.
export async function lookupRole(phone) {
  // Simulate network delay
  await new Promise(r => setTimeout(r, 800));

  // → const { data: staff } = await supabase
  //     .from('staff')
  //     .select('id, name, role, staff_id, hospital_id, organisations(name, city)')
  //     .eq('phone', phone)
  //     .eq('status', 'active')
  //     .single();
  //
  // → if (staff) return {
  //     userId:     staff.id,
  //     staffId:    staff.staff_id,
  //     name:       staff.name,
  //     role:       staff.role,           // 'doctor' | 'opd_assistant' | 'pharmacy_assistant'
  //     hospitalId: staff.hospital_id,
  //     hospitalName: staff.organisations.name,
  //     hospitalCity: staff.organisations.city,
  //   };
  //
  // → const { data: org } = await supabase
  //     .from('organisations')
  //     .select('id, name, city')
  //     .eq('admin_phone', phone)
  //     .single();
  //
  // → if (org) return {
  //     userId:      null,
  //     staffId:     null,
  //     name:        org.name,
  //     role:        'hospital_admin',
  //     hospitalId:  org.id,
  //     hospitalName: org.name,
  //     hospitalCity: org.city,
  //   };
  //
  // → return null; // phone not registered

  // MOCK — everyone is hospital_admin until Supabase
  return {
    userId:       null,
    staffId:      null,
    name:         'Healio Hospital',
    role:         ROLES.HOSPITAL_ADMIN,
    hospitalId:   'HOSP-2451',
    hospitalName: 'Healio Hospital',
    hospitalCity: 'Kolkata',
  };
}

// ── Provider ─────────────────────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user,        setUser]        = useState(null);
  const [sessionReady, setSessionReady] = useState(false);
  // user shape: { userId, staffId, name, role, hospitalId, hospitalName, hospitalCity }

  // On mount: restore a persisted Supabase session so the user doesn't have
  // to log in again every time the app is launched.
  // Hard timeout — if the session check hangs, unblock and show Welcome. Kept
  // generous (10s) because resolveRole() runs sequential lookups and the
  // 'patient' branch is the last/slowest one; a shorter cap raced ahead of it,
  // leaving a logged-in patient stranded on the auth screen after launch.
  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      setSessionReady(true);
    };

    const timer = setTimeout(finish, 10000);

    (async () => {
      try {
        const { supabase, resolveRole } = await import('../lib/supabase');
        const { useStore } = await import('../lib/store');
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const userData = await resolveRole();
          if (userData) {
            setUser(userData);
            // Hydrate real data in the background — don't await so the app opens fast
            useStore.getState().hydrateFromSupabase();
          }
        }
      } catch (_) {
        // Session missing or network error — go to Welcome
      } finally {
        clearTimeout(timer);
        finish();
      }
    })();

    return () => clearTimeout(timer);
  }, []);

  const login  = (userData) => setUser(userData);
  const logout = () => setUser(null);

  // Show a brief spinner while checking stored session — never a blank screen
  if (!sessionReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#821c03" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
