import React, { useEffect, useState } from 'react';
import {
  Users,
  Calendar,
  IndianRupee,
  Database,
  HardDrive,
  Activity,
  ArrowRight
} from 'lucide-react';
import { dataService } from '../services/dataService';
import type { Tenant } from '../services/dataService';
import { isSupabaseConfigured } from '../services/supabaseClient';

interface DashboardViewProps {
  tenant: Tenant | null;
  setActiveTab: (tab: any) => void;
  triggerRefreshKey: number;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ tenant, setActiveTab, triggerRefreshKey }) => {
  const [stats, setStats] = useState({
    patientsCount: 0,
    appointmentsCount: 0,
    revenue: 0,
  });
  const [quota, setQuota] = useState({
    used_db_storage_mb: 0,
    max_db_storage_mb: 50,
    used_file_storage_mb: 0,
    max_file_storage_mb: 200,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const patients = await dataService.getPatients();
        const appointments = await dataService.getScheduledSessions();
        const invoices = await dataService.getInvoices();
        const metrics = await dataService.getTenantResourceMetrics();

        // Calculate stats
        const totalRevenue = invoices
          .filter((inv) => String(inv.payment_status).toUpperCase() === 'PAID')
          .reduce((sum, inv) => sum + inv.total_amount, 0);

        // Count appointments today
        const todayStr = new Date().toISOString().split('T')[0];
        const todaySessions = appointments.filter((app) => app.start_time.startsWith(todayStr)).length;

        setStats({
          patientsCount: patients.length,
          appointmentsCount: todaySessions || appointments.length,
          revenue: totalRevenue,
        });
        setQuota(metrics);
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [triggerRefreshKey]);

  // Percentage Calculations
  const dbPercentage = parseFloat(((quota.used_db_storage_mb / quota.max_db_storage_mb) * 100).toFixed(1));
  const filePercentage = parseFloat(((quota.used_file_storage_mb / quota.max_file_storage_mb) * 100).toFixed(1));

  return (
    <div className="space-y-6">
      
      {/* Welcome Message Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:bg-[#111827] dark:border-slate-800 flex items-center justify-between shadow-sm relative overflow-hidden transition-all duration-200">
        <div className="z-10">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Welcome back, Dibin!
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1.5 text-sm max-w-xl">
            Workspace active at <span className="font-bold text-slate-800 dark:text-slate-200">{tenant?.business_name || 'Loading Clinic...'}</span>. Here is the operational digest for your medical practice.
          </p>
        </div>
        <div className="absolute right-0 top-0 h-32 w-32 bg-brand-500/10 rounded-full blur-xl -mr-10 -mt-10" />
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Total Patients Card */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 dark:bg-[#111827] dark:border-slate-800 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Active Patients</span>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              {loading ? '...' : stats.patientsCount}
            </h3>
            <button
              onClick={() => setActiveTab('Patients')}
              className="text-brand-550 dark:text-brand-400 hover:text-brand-600 font-bold text-xs mt-2 flex items-center"
            >
              View patient roster <ArrowRight className="h-3 w-3 ml-1" />
            </button>
          </div>
          <div className="h-12 w-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 dark:bg-brand-950/20 dark:text-brand-400">
            <Users className="h-6 w-6" />
          </div>
        </div>

        {/* Sessions Today Card */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 dark:bg-[#111827] dark:border-slate-800 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Appointments Today</span>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              {loading ? '...' : stats.appointmentsCount}
            </h3>
            <button
              onClick={() => setActiveTab('Appointments')}
              className="text-brand-550 dark:text-brand-400 hover:text-brand-600 font-bold text-xs mt-2 flex items-center"
            >
              View shift sessions <ArrowRight className="h-3 w-3 ml-1" />
            </button>
          </div>
          <div className="h-12 w-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 dark:bg-teal-950/20 dark:text-teal-400">
            <Calendar className="h-6 w-6" />
          </div>
        </div>

        {/* Earnings Card */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 dark:bg-[#111827] dark:border-slate-800 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Revenue Collected</span>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 flex items-center">
              <span className="text-slate-500 mr-1 text-2xl">₹</span>
              {loading ? '...' : stats.revenue.toLocaleString('en-IN')}
            </h3>
            <button
              onClick={() => setActiveTab('Billing')}
              className="text-brand-550 dark:text-brand-400 hover:text-brand-600 font-bold text-xs mt-2 flex items-center"
            >
              Go to billing console <ArrowRight className="h-3 w-3 ml-1" />
            </button>
          </div>
          <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
            <IndianRupee className="h-6 w-6" />
          </div>
        </div>

      </div>

      {/* Storage and System Health Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Storage Meter Monitor */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 dark:bg-[#111827] dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-brand-500" />
              <h3 className="font-bold text-slate-950 dark:text-white">Tenant Resource Quotas</h3>
            </div>
            <span className="text-[10px] bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full font-bold text-brand-600 dark:bg-brand-950/30 dark:border-brand-900/30 dark:text-brand-400">
              Computed Real-time
            </span>
          </div>

          <div className="mt-5 space-y-5">
            {/* Database progress bar */}
            <div>
              <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                <span className="flex items-center"><Database className="h-3.5 w-3.5 mr-1 text-indigo-500" /> Database Storage ({dbPercentage}% Used)</span>
                <span>{quota.used_db_storage_mb} MB / {quota.max_db_storage_mb} MB</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3.5 dark:bg-slate-800 overflow-hidden flex">
                <div
                  style={{ width: `${Math.min(dbPercentage, 100)}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    dbPercentage > 85 ? 'bg-red-500' : dbPercentage > 60 ? 'bg-amber-500' : 'bg-brand-500'
                  }`}
                />
              </div>
            </div>

            {/* File Storage progress bar */}
            <div>
              <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                <span className="flex items-center"><HardDrive className="h-3.5 w-3.5 mr-1 text-pink-500" /> File Vault Storage ({filePercentage}% Used)</span>
                <span>{quota.used_file_storage_mb} MB / {quota.max_file_storage_mb} MB</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3.5 dark:bg-slate-800 overflow-hidden flex">
                <div
                  style={{ width: `${Math.min(filePercentage, 100)}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    filePercentage > 85 ? 'bg-red-500' : filePercentage > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
              </div>
            </div>

            <div className="text-[11px] leading-relaxed text-slate-400 bg-slate-50 p-3 rounded-lg dark:bg-slate-800/35">
              💡 <strong>Storage tip:</strong> File vault quota increases when uploading PDF reports or clinic expenses. Deleting clinical log records (DGHS compliant soft-deletion archiving) releases storage dynamically.
            </div>
          </div>
        </div>

        {/* Live Clinic Health Card */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 dark:bg-[#111827] dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-emerald-500" />
                <h3 className="font-bold text-slate-950 dark:text-white">Active System Status</h3>
              </div>
              <span className="flex items-center text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                <span className="h-2 w-2 rounded-full bg-emerald-500 mr-1.5 animate-ping" /> Online
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Indian DPDP Consent Vault</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">ACTIVE & SECURED</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Supabase API Sync Gateway</span>
                <span className="font-bold text-slate-600 dark:text-slate-300">
                  {isSupabaseConfigured ? 'Supabase Schema Connected' : 'Mock Fallback Active'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Real-time Session Listeners</span>
                <span className="font-bold text-brand-600 dark:text-brand-400">ACTIVE</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
            <span className="text-xs text-slate-500 dark:text-slate-400">Need backups or DB maintenance?</span>
            <button
              onClick={() => setActiveTab('Administrative Controls')}
              className="text-xs font-bold text-brand-600 dark:text-brand-400 hover:underline flex items-center"
            >
              Open System Admin <ArrowRight className="h-3 w-3 ml-1" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
