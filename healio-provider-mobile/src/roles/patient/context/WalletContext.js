import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabase';

const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [balance, setBalance] = useState(0);

  // Load the logged-in patient's real wallet balance from Supabase.
  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('wallets').select('balance').eq('patient_id', user.id).maybeSingle();
      if (data) setBalance(Number(data.balance) || 0);
    } catch (e) { /* keep current */ }
  }, []);

  useEffect(() => {
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    return () => sub?.subscription?.unsubscribe?.();
  }, [load]);

  // Top up — updates local state AND persists to the real wallet.
  // `meta` carries what the checkout flow captured (instrument + label); the
  // transaction is flagged is_test since no real gateway is wired up yet.
  const addBalance = async (amount, meta = {}) => {
    setBalance((prev) => prev + amount);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('wallets').select('balance').eq('patient_id', user.id).maybeSingle();
      const next = (Number(data?.balance) || 0) + amount;
      await supabase.from('wallets').update({ balance: next }).eq('patient_id', user.id);
      await supabase.from('transactions').insert({
        patient_id: user.id,
        type: 'topup',
        amount,
        status: 'completed',
        method: meta.method || 'upi',
        description: meta.description || 'Wallet top-up',
        reference_type: 'wallet_topup',
        is_test: true,
      });
    } catch (e) { /* local already updated */ }
  };

  // Spend from the wallet — the mirror of addBalance, used by the booking and
  // order checkouts. Recorded as a negative transaction so the wallet history
  // renders it as a debit.
  const deductBalance = async (amount, meta = {}) => {
    setBalance((prev) => Math.max(0, prev - amount));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('wallets').select('balance').eq('patient_id', user.id).maybeSingle();
      const next = Math.max(0, (Number(data?.balance) || 0) - amount);
      await supabase.from('wallets').update({ balance: next }).eq('patient_id', user.id);
      await supabase.from('transactions').insert({
        patient_id: user.id,
        type: 'payment',
        amount: -amount,
        status: 'completed',
        method: 'wallet',
        description: meta.description || 'Wallet payment',
        reference_type: meta.referenceType || null,
        is_test: true,
      });
    } catch (e) { /* local already updated */ }
  };

  const hasPremiumAccess = balance >= 50;

  return (
    <WalletContext.Provider value={{
      balance, setBalance, addBalance, deductBalance, hasPremiumAccess, reloadWallet: load,
    }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => useContext(WalletContext);
