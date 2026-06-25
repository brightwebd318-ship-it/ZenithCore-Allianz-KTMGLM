import React, { useState } from 'react';
import { Briefcase, ShieldCheck, UserCheck, X, Activity, Heart, Stethoscope, Plus, CheckSquare } from 'lucide-react';
import { dataService } from '../services/dataService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  isFirstTimeSetup?: boolean;
  tenantId?: string;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  isOpen,
  onClose,
  onSuccess,
  isFirstTimeSetup = false,
  tenantId,
}) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form States
  const [businessName, setBusinessName] = useState(isFirstTimeSetup ? '' : 'Nirvana Physio & Spine');
  const [businessType, setBusinessType] = useState<'physiotherapy' | 'dentist' | 'general_clinic'>('physiotherapy');
  const [subdomain, setSubdomain] = useState(isFirstTimeSetup ? '' : 'nirvanaphysio');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [tier, setTier] = useState<'Standard' | 'Premium'>('Standard'); // Standard: 50MB DB, 200MB Files. Premium: 250MB DB, 1GB Files.

  const [dpdpConsent, setDpdpConsent] = useState(true);
  const [gstEnabled, setGstEnabled] = useState(true);

  const [adminName, setAdminName] = useState(isFirstTimeSetup ? '' : 'Dibin');
  const [adminEmail, setAdminEmail] = useState(isFirstTimeSetup ? '' : 'dibin.head@nirvana.com');
  const [adminPassword, setAdminPassword] = useState(isFirstTimeSetup ? '' : 'ZenithAdminSecure123');

  // Clinic Logo States
  const [logoType, setLogoType] = useState<'preset' | 'url'>('preset');
  const [logoPreset, setLogoPreset] = useState<string>('blue');
  const [logoUrl, setLogoUrl] = useState<string>('');

  // First-time Setup ID state
  const [supabaseTenantId, setSupabaseTenantId] = useState('');

  React.useEffect(() => {
    const activeId = tenantId || '';
    if (activeId) {
      const stored = localStorage.getItem(`zenith_tenant_logo_${activeId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.type) setLogoType(parsed.type);
          if (parsed.preset) setLogoPreset(parsed.preset);
          if (parsed.url) setLogoUrl(parsed.url);
        } catch (e) {
          console.error('Failed to load logo setup config:', e);
        }
      }
    }
  }, [tenantId, isOpen]);

  if (!isOpen) return null;

  const getDbQuota = () => (tier === 'Standard' ? 50 : 250);
  const getFileQuota = () => (tier === 'Standard' ? 200 : 1000);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < 3) {
      setStep((s) => s + 1);
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (isFirstTimeSetup) {
        if (!supabaseTenantId.trim()) {
          throw new Error("Supabase Tenant ID is required");
        }

        const targetTenantId = supabaseTenantId.trim();

        if (isSupabaseConfigured && supabase) {
          // 1. Verify that the entered tenant ID exists in tenants table
          const { data: tenantData, error: tenantErr } = await supabase
            .from('tenants')
            .select('id, business_name')
            .eq('id', targetTenantId)
            .single();

          if (tenantErr || !tenantData) {
            throw new Error("The entered Tenant ID does not exist in your Supabase database. Please check the ID.");
          }

          // 2. Update the user profile users table to set tenant_id to the entered tenant ID
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user) {
            const { error: uErr } = await supabase
              .from('users')
              .update({ tenant_id: targetTenantId })
              .eq('id', userData.user.id);
            if (uErr) throw uErr;
          }
        } else {
          // Mock mode completion
          const mockTenant = {
            id: targetTenantId,
            business_name: 'Zenith Core Alliance (Mock)',
            business_type: 'physiotherapy' as const,
            subdomain: 'zenithcore',
            max_db_storage_mb: 50,
            max_file_storage_mb: 200,
            clinic_start_time: '08:00',
            clinic_end_time: '20:00',
          };
          localStorage.setItem('tenant', JSON.stringify(mockTenant));
          
          const sessionStr = localStorage.getItem('zenith_session');
          if (sessionStr) {
            const session = JSON.parse(sessionStr);
            const users = localStorage.getItem('zenith_users') ? JSON.parse(localStorage.getItem('zenith_users')!) : [];
            const user = users.find((u: any) => u.email.toLowerCase() === session.email.toLowerCase());
            if (user) {
              user.tenant_id = targetTenantId;
              localStorage.setItem('zenith_users', JSON.stringify(users));
            }
          }
        }
      } else {
        // Standard full tenant initialization
        const newTenant = await dataService.initializeTenant({
          business_name: businessName,
          business_type: businessType,
          subdomain: subdomain,
          clinic_start_time: startTime,
          clinic_end_time: endTime,
          max_db_storage_mb: getDbQuota(),
          max_file_storage_mb: getFileQuota(),
          gst_enabled: gstEnabled,
          consent_given: dpdpConsent,
          admin_name: adminName,
          admin_email: adminEmail,
          admin_password: adminPassword,
        });

        if (newTenant?.id) {
          localStorage.setItem(`zenith_tenant_logo_${newTenant.id}`, JSON.stringify({
            type: logoType,
            preset: logoPreset,
            url: logoUrl
          }));
        }
      }

      // Complete flow
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to complete tenant onboarding. Please verify details.');
    } finally {
      setLoading(false);
    }
  };

  // Helper renders
  const renderPasswordReset = () => (
    <div className="space-y-4">
      <div className="flex items-center space-x-2.5 text-brand-600 dark:text-brand-400 pb-2 border-b border-slate-100 dark:border-slate-800">
        <UserCheck className="h-5 w-5" />
        <h3 className="font-bold text-slate-850 dark:text-white">Step 1: Set Permanent Password</h3>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Your Full Name</label>
        <input
          type="text"
          required
          value={adminName}
          onChange={(e) => setAdminName(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:border-slate-700 focus:outline-none focus:border-brand-500"
          placeholder="e.g. Dr. Jane Doe"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">New Secure Password</label>
        <input
          type="password"
          required
          minLength={6}
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:border-slate-700 focus:outline-none focus:border-brand-500"
          placeholder="Choose a permanent password (min 6 characters)"
        />
      </div>

      <div className="rounded-lg bg-brand-50 border border-brand-100 p-3.5 dark:bg-brand-950/20 dark:border-brand-900/30">
        <h4 className="text-xs font-bold text-brand-800 dark:text-brand-300">Password Change Required</h4>
        <p className="text-xs text-brand-600 dark:text-brand-400/80 mt-1 leading-normal">
          You are logging in with a temporary password pre-provisioned by the software manager. Please choose a permanent secure password for your account.
        </p>
      </div>
    </div>
  );

  const renderClinicalSetup = () => (
    <div className="space-y-4">
      <div className="flex items-center space-x-2.5 text-brand-600 dark:text-brand-400 pb-2 border-b border-slate-100 dark:border-slate-800">
        <Briefcase className="h-5 w-5" />
        <h3 className="font-bold text-slate-850 dark:text-white">
          {isFirstTimeSetup ? 'Step 2: Configure Clinic Profile' : 'Step 1: Clinical Business Configuration'}
        </h3>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Business Name</label>
          <input
            type="text"
            required
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:border-slate-700 focus:outline-none focus:border-brand-500"
            placeholder="e.g. Apollo Physiotherapy"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Business Type</label>
          <select
            value={businessType}
            onChange={(e) => setBusinessType(e.target.value as any)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:border-slate-700 focus:outline-none focus:border-brand-500"
          >
            <option value="physiotherapy">Physiotherapy Clinic</option>
            <option value="dentist">Dentist Office</option>
            <option value="general_clinic">General Clinic / Practitioner</option>
          </select>
        </div>
      </div>

      {!isFirstTimeSetup && (
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Subdomain Name</label>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden dark:border-slate-700">
            <input
              type="text"
              required
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
              className="flex-1 px-3 py-2 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-white focus:outline-none"
              placeholder="myclinic"
            />
            <span className="bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 border-l border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
              .medsaas.in
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Clinic Start Time</label>
          <input
            type="time"
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:border-slate-700 focus:outline-none focus:border-brand-500"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Clinic End Time</label>
          <input
            type="time"
            required
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:border-slate-700 focus:outline-none focus:border-brand-500"
          />
        </div>
      </div>

      <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4 dark:border-brand-900/30 dark:bg-brand-900/10">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-brand-900 dark:text-brand-300">Storage Quota Tier</h4>
            <p className="text-xs text-brand-700 dark:text-brand-400 mt-0.5">
              DB quota: <span className="font-bold">{getDbQuota()}MB</span> | Files: <span className="font-bold">{getFileQuota()}MB</span>
            </p>
          </div>
          <div className="flex items-center bg-white border border-brand-200 rounded-lg p-1 dark:bg-slate-800 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setTier('Standard')}
              className={`px-3 py-1 text-xs font-bold rounded ${tier === 'Standard' ? 'bg-brand-500 text-white' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Standard
            </button>
            <button
              type="button"
              onClick={() => setTier('Premium')}
              className={`px-3 py-1 text-xs font-bold rounded ${tier === 'Premium' ? 'bg-brand-500 text-white' : 'text-slate-600 dark:text-slate-400'}`}
            >
              Premium
            </button>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
        <label className="block text-xs font-bold text-slate-500 uppercase">Clinic Logo Brand</label>
        
        <div className="flex space-x-2 text-xs font-bold mb-2">
          <button
            type="button"
            onClick={() => setLogoType('preset')}
            className={`px-3 py-1.5 rounded-lg border transition-all ${logoType === 'preset' ? 'bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-950/20 dark:border-brand-900/40 dark:text-brand-300' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400'}`}
          >
            Brand Preset
          </button>
          <button
            type="button"
            onClick={() => setLogoType('url')}
            className={`px-3 py-1.5 rounded-lg border transition-all ${logoType === 'url' ? 'bg-brand-50 border-brand-300 text-brand-700 dark:bg-brand-950/20 dark:border-brand-900/40 dark:text-brand-300' : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400'}`}
          >
            Custom Logo URL
          </button>
        </div>

        {logoType === 'preset' ? (
          <div className="grid grid-cols-5 gap-2">
            {[
              { name: 'blue', label: 'Zenith Blue', icon: Activity, bg: 'bg-blue-600' },
              { name: 'teal', label: 'Teal Health', icon: Heart, bg: 'bg-teal-500' },
              { name: 'indigo', label: 'Indigo Care', icon: Stethoscope, bg: 'bg-indigo-650' },
              { name: 'emerald', label: 'Emerald Life', icon: CheckSquare, bg: 'bg-emerald-600' },
              { name: 'amber', label: 'Amber Dental', icon: Plus, bg: 'bg-amber-500' }
            ].map((p) => {
              const Icon = p.icon;
              const isSelected = logoPreset === p.name;
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setLogoPreset(p.name)}
                  className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all space-y-1.5 ${isSelected ? 'border-brand-500 bg-brand-50/20 dark:border-brand-500 dark:bg-brand-950/10' : 'border-slate-200 hover:bg-slate-50 dark:border-slate-750 dark:hover:bg-slate-800/40'}`}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-white ${p.bg}`}>
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-700 dark:text-slate-350 truncate w-full text-center">{p.label}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:border-slate-700 focus:outline-none focus:border-brand-500"
              placeholder="e.g. https://myclinic.com/logo.png"
            />
            {logoUrl && (
              <div className="flex items-center space-x-2 p-2 bg-slate-50 border border-slate-150 rounded-lg dark:bg-slate-800/50 dark:border-slate-850">
                <span className="text-[10px] font-bold text-slate-450 uppercase">Preview:</span>
                <img
                  src={logoUrl}
                  alt="Custom Logo Preview"
                  className="h-8 w-8 object-cover rounded-lg border border-slate-200 dark:border-slate-750 shadow-sm animate-pulse"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const renderFirstTimeSetup = () => (
    <div className="space-y-4">
      <div className="flex items-center space-x-2.5 text-brand-600 dark:text-brand-400 pb-2 border-b border-slate-100 dark:border-slate-800">
        <Activity className="h-5 w-5 animate-pulse" />
        <h3 className="font-bold text-slate-850 dark:text-white">Workspace Identification</h3>
      </div>
      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-1.5">
          Supabase Tenant ID
        </label>
        <input
          type="text"
          required
          value={supabaseTenantId}
          onChange={(e) => setSupabaseTenantId(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:border-slate-700 focus:outline-none focus:border-brand-500 font-mono"
          placeholder="e.g. d1983024-bc48-4cb1-97b7-5f72e9dcfaea"
        />
        <p className="text-[11px] text-slate-450 mt-1.5 leading-relaxed">
          Please enter the UUID for the clinic workspace generated inside the Supabase <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10px] text-slate-600 dark:text-slate-350">tenants</code> table. This binds your account to the workspace data.
        </p>
      </div>
    </div>
  );

  const renderLegalGST = () => (
    <div className="space-y-5">
      <div className="flex items-center space-x-2.5 text-brand-600 dark:text-brand-400 pb-2 border-b border-slate-100 dark:border-slate-800">
        <ShieldCheck className="h-5 w-5" />
        <h3 className="font-bold text-slate-850 dark:text-white">
          {isFirstTimeSetup ? 'Step 3: Legal Compliance & Billing Setup' : 'Step 2: Compliance & Legal Alignment'}
        </h3>
      </div>

      <div className="space-y-4">
        <div className="flex items-start p-4 bg-slate-50 border border-slate-200 rounded-xl dark:bg-slate-800/40 dark:border-slate-800">
          <input
            id="consentCheck"
            type="checkbox"
            checked={dpdpConsent}
            onChange={(e) => setDpdpConsent(e.target.checked)}
            className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 mt-0.5"
          />
          <label htmlFor="consentCheck" className="ml-3 block">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
              DPDP Act 2023 Compliance Consent
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Enable explicit tracking of patient data processing consent. In accordance with the Digital Personal Data Protection (DPDP) Act of India, patients must explicitly opt-in (`patients.consent_given` = true) and retain forensic access timestamps, with immediate withdrawal triggers.
            </span>
          </label>
        </div>

        <div className="flex items-start p-4 bg-slate-50 border border-slate-200 rounded-xl dark:bg-slate-800/40 dark:border-slate-800">
          <input
            id="gstCheck"
            type="checkbox"
            checked={gstEnabled}
            onChange={(e) => setGstEnabled(e.target.checked)}
            className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 mt-0.5"
          />
          <label htmlFor="gstCheck" className="ml-3 block">
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Enable CGST & SGST Split Billing
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              Set billing rules to partition invoices automatically. When activated, all invoices generated for GST-enabled patients will split taxes cleanly (9% Central GST and 9% State GST) outputting calculations directly to the transaction ledger.
            </span>
          </label>
        </div>
      </div>
    </div>
  );

  const renderAdminCreation = () => (
    <div className="space-y-4">
      <div className="flex items-center space-x-2.5 text-brand-600 dark:text-brand-400 pb-2 border-b border-slate-100 dark:border-slate-800">
        <UserCheck className="h-5 w-5" />
        <h3 className="font-bold text-slate-850 dark:text-white">Step 3: Primary Administrator Creation</h3>
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
        <input
          type="text"
          required
          value={adminName}
          onChange={(e) => setAdminName(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:border-slate-700 focus:outline-none focus:border-brand-500"
          placeholder="e.g. Dibin Kumar"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
        <input
          type="email"
          required
          value={adminEmail}
          onChange={(e) => setAdminEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:border-slate-700 focus:outline-none focus:border-brand-500"
          placeholder="e.g. dibin@myclinic.com"
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Account Password</label>
        <input
          type="password"
          required
          minLength={6}
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-white dark:border-slate-700 focus:outline-none focus:border-brand-500"
          placeholder="Choose a password (min 6 characters)"
        />
      </div>

      <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3.5 dark:bg-emerald-950/20 dark:border-emerald-900/30">
        <h4 className="text-xs font-bold text-emerald-800 dark:text-emerald-300">Admin Privileges Seeded</h4>
        <p className="text-xs text-emerald-600 dark:text-emerald-400/80 mt-1 leading-normal">
          Creating this initial user will automatically map their position as <strong>'Admin'</strong> with all security access flags enabled.
        </p>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-gradient-to-r from-brand-600 to-brand-500 px-6 py-4 text-white">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              {isFirstTimeSetup ? 'Link Clinic Workspace' : 'Onboard New Clinic Tenant'}
            </h2>
            <p className="text-xs text-brand-100 mt-0.5">
              {isFirstTimeSetup 
                ? 'Enter your Supabase Tenant ID to initialize your custom workspace' 
                : 'Initialize clinical workspace & administrator profile'}
            </p>
          </div>
          {!isFirstTimeSetup && (
            <button onClick={onClose} className="rounded-full p-1 hover:bg-white/10 transition-colors">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Steps Indicators */}
        {!isFirstTimeSetup && (
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-8 py-3 dark:border-slate-800 dark:bg-slate-800/20">
            <div className={`flex items-center space-x-2 text-xs font-semibold ${step >= 1 ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${step >= 1 ? 'border-brand-600 bg-brand-50 font-bold dark:border-brand-400 dark:bg-brand-900/30' : 'border-slate-300'}`}>1</span>
              <span>Clinical Setup</span>
            </div>
            <div className="h-px w-8 bg-slate-200 dark:bg-slate-700" />
            <div className={`flex items-center space-x-2 text-xs font-semibold ${step >= 2 ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${step >= 2 ? 'border-brand-600 bg-brand-50 font-bold dark:border-brand-400 dark:bg-brand-900/30' : 'border-slate-300'}`}>2</span>
              <span>Legal & GST</span>
            </div>
            <div className="h-px w-8 bg-slate-200 dark:bg-slate-700" />
            <div className={`flex items-center space-x-2 text-xs font-semibold ${step >= 3 ? 'text-brand-600 dark:text-brand-400' : 'text-slate-400'}`}>
              <span className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs ${step >= 3 ? 'border-brand-600 bg-brand-50 font-bold dark:border-brand-400 dark:bg-brand-900/30' : 'border-slate-300'}`}>3</span>
              <span>Admin Creation</span>
            </div>
          </div>
        )}

        {/* Error alert */}
        {error && (
          <div className="mx-6 mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6">
          {/* Conditional Step Layout Rendering */}
          {isFirstTimeSetup ? (
            renderFirstTimeSetup()
          ) : (
            <>
              {step === 1 && renderClinicalSetup()}
              {step === 2 && renderLegalGST()}
              {step === 3 && renderAdminCreation()}
            </>
          )}

          {/* Footer Actions */}
          <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
            <div>
              {!isFirstTimeSetup && step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Back
                </button>
              )}
            </div>
            
            <div className="flex space-x-2">
              {!isFirstTimeSetup && (
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-transparent px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  Cancel
                </button>
              )}

              {isFirstTimeSetup ? (
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {loading ? 'Verifying Workspace...' : 'Link & Initialize'}
                </button>
              ) : step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s + 1)}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 transition-colors"
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {loading ? 'Saving Setup...' : 'Confirm & Complete'}
                </button>
              )}
            </div>
          </div>
        </form>

      </div>
    </div>
  );
};
