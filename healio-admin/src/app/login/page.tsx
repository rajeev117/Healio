'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Enter your email and password.');
      return;
    }
    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError(authError.message || 'Invalid email or password.');
      setLoading(false);
      return;
    }

    // AdminShell's auth listener will detect the session and allow access.
    router.replace('/dashboard');
  };

  return (
    <div className="min-h-screen bg-surface-2 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-800 text-2xl">H</span>
          </div>
          <h1 className="text-2xl font-800 text-text">Healio Admin</h1>
          <p className="text-sm text-text-secondary mt-1">Sign in to your admin portal</p>
        </div>

        {/* Card */}
        <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-700 text-text mb-1.5">Email address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@healio.in"
                autoComplete="email"
                className="w-full px-3 py-2.5 bg-surface-2 border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-700 text-text mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-3 py-2.5 pr-10 bg-surface-2 border border-border rounded-lg text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 bg-danger-soft border border-danger/20 rounded-lg">
                <p className="text-xs font-600 text-danger">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                'w-full py-2.5 bg-primary text-white text-sm font-700 rounded-lg transition-colors',
                loading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-primary-hover'
              )}
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Security note */}
        <div className="flex items-center justify-center gap-1.5 mt-4">
          <Shield className="w-3.5 h-3.5 text-text-muted" />
          <p className="text-[11px] text-text-muted">Secured — Super Admin access only</p>
        </div>
      </div>
    </div>
  );
}
