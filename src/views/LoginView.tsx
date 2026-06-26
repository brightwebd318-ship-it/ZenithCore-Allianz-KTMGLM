import React, { useState } from 'react';
import { ShieldAlert, LogIn, Lock, Mail, Activity } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { dataService } from '../services/dataService';

interface LoginViewProps {
  onLoginSuccess: () => void;
  onOpenOnboarding: () => void;
  isSystemAdmin?: boolean;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess, onOpenOnboarding, isSystemAdmin = false }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isSupabaseConfigured && supabase) {
        // Authenticate with live Supabase Auth
        const { error: authErr } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password,
        });
        if (authErr) throw authErr;
        try {
          await dataService.addAuditTrail('CONSENT_CHANGED', `User logged in successfully via Supabase Auth: ${email.trim()}`);
        } catch (auditErr) {
          console.warn("Failed to log auth audit trail:", auditErr);
        }
        onLoginSuccess();
      } else {
        // Simulate Login in offline Mock Mode
        const localUsersData = localStorage.getItem('zenith_users');
        const users = localUsersData ? JSON.parse(localUsersData) : [];
        
        // Default seeded developer credentials for easy mock test access
        const defaultAdmin = {
          email: 'dibin@zenithcore.com',
          password: 'password',
        };

        const matchedUser = users.find(
          (u: any) => u.email.toLowerCase() === email.trim().toLowerCase() && 
                      (u.password === password || password === 'password')
        );

        const isDefaultDev = email.trim().toLowerCase() === defaultAdmin.email && password === defaultAdmin.password;

        if (matchedUser || isDefaultDev) {
          // Check if account is suspended/paused in mock mode
          let matchedUserId: string | null = null;
          if (isDefaultDev) {
            matchedUserId = 'u1111111-1111-1111-1111-111111111111';
          } else if (matchedUser) {
            matchedUserId = matchedUser.id;
          }

          if (matchedUserId) {
            const mockStatusesData = localStorage.getItem('zenith_mock_auth_statuses');
            const mockStatuses = mockStatusesData ? JSON.parse(mockStatusesData) : [];
            const status = mockStatuses.find((s: any) => s.id === matchedUserId);
            if (status && status.paused) {
              throw new Error('This account has been paused/suspended by an administrator.');
            }
          }

          // Write a simulated session active token
          localStorage.setItem('zenith_session', JSON.stringify({
            email: email.trim().toLowerCase(),
            loggedIn: true,
          }));
          try {
            await dataService.addAuditTrail('CONSENT_CHANGED', `User logged in successfully via Mock Mode: ${email.trim()}`);
          } catch (auditErr) {
            console.warn("Failed to log auth audit trail:", auditErr);
          }
          onLoginSuccess();
        } else {
          throw new Error('Invalid credentials. (Mock fallback is: dibin@zenithcore.com / password)');
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Invalid email or password. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F4F7F9] dark:bg-[#0B0F19] p-4 font-sans transition-colors duration-200">
      
      {/* Decorative Blur Orbs */}
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-brand-400/20 dark:bg-brand-500/10 rounded-full blur-3xl -z-10 animate-pulse duration-4000" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-emerald-400/15 dark:bg-emerald-500/5 rounded-full blur-3xl -z-10" />

      {/* Main Glassmorphic Card */}
      <div className="w-full max-w-md bg-white/80 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-200/80 dark:border-slate-800/80 p-8 shadow-2xl transition-all duration-300">
        
        {/* Brand Header */}
        <div className="flex flex-col items-center justify-center mb-8">
          <img 
            src="/logo.png" 
            alt="Zenith Core Alliance Logo" 
            className="h-14 w-auto object-contain mb-2"
          />
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">
            Clinical SaaS Portal
          </p>
        </div>

        {/* Info alerts */}
        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl bg-red-50 border border-red-200/50 p-4 text-sm text-red-700 dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-400">
            <ShieldAlert className="h-5 w-5 flex-shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
            <div>
              <span className="font-bold">Access Denied:</span>
              <p className="mt-0.5 leading-relaxed text-xs">{error}</p>
            </div>
          </div>
        )}

        {!isSupabaseConfigured && (
          <div className="mb-6 p-3 bg-brand-50 border border-brand-100 rounded-lg text-brand-700 dark:bg-brand-950/10 dark:border-brand-900/30 dark:text-brand-400 text-center text-xs">
            Running in <strong>Mock Preview Mode</strong>. Access with default developer credentials or onboarding accounts.
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
              Email Address
            </label>
            <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="h-4 w-4" />
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white dark:bg-slate-950/40 text-slate-900 dark:text-white pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                placeholder="doctor@zenithcore.com"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Account Password
              </label>
            </div>
            <div className="relative rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white dark:bg-slate-950/40 text-slate-900 dark:text-white pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
                placeholder="••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-brand-500 text-white font-bold py-3 hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:opacity-50 transition-all shadow-md shadow-brand-500/10 cursor-pointer"
          >
            {loading ? (
              <span>Verifying identity...</span>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                <span>Sign In Securely</span>
              </>
            )}
          </button>
        </form>

        {/* Footer Actions - restricted to system admin */}
        {isSystemAdmin && (
          <div className="mt-8 pt-6 border-t border-slate-200/60 dark:border-slate-800/60 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Clinic tenant not configured yet?
            </p>
            <button
              onClick={onOpenOnboarding}
              className="mt-1 text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition-colors focus:outline-none cursor-pointer"
            >
              Launch Clinic Onboarding Wizard
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
