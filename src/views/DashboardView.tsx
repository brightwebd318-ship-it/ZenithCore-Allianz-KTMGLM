import React, { useEffect, useState } from 'react';
import {
  Users,
  Calendar,
  IndianRupee,
  ArrowRight,
  Award
} from 'lucide-react';
import { dataService } from '../services/dataService';
import type { Tenant, User as StaffUser } from '../services/dataService';

interface DashboardViewProps {
  tenant: Tenant | null;
  setActiveTab: (tab: any) => void;
  triggerRefreshKey: number;
  currentUser: StaffUser | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ tenant, setActiveTab, triggerRefreshKey, currentUser }) => {
  const [stats, setStats] = useState({
    patientsCount: 0,
    appointmentsCount: 0,
    revenue: 0,
    myCompletedCount: 0,
    myCompletedHours: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const patients = await dataService.getPatients();
        const appointments = await dataService.getScheduledSessions();
        const invoices = await dataService.getInvoices();

        // Calculate stats
        const totalRevenue = invoices
          .filter((inv) => String(inv.payment_status).toUpperCase() === 'PAID')
          .reduce((sum, inv) => sum + inv.total_amount, 0);

        // Count appointments today in local timezone
        const todayLocalStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
        const todaySessions = appointments.filter((app) => {
          const appLocalDate = new Date(app.start_time).toLocaleDateString('sv-SE');
          return appLocalDate === todayLocalStr;
        }).length;

        // Count my completed sessions and hours
        const myCompletedSessions = appointments.filter(
          (app) => app.practitioner_id === currentUser?.id && app.status === 'completed'
        );
        const myCompletedCount = myCompletedSessions.length;
        const myCompletedHours = myCompletedSessions.reduce((sum, app) => {
          if (!app.start_time || !app.end_time) return sum;
          const durationMs = new Date(app.end_time).getTime() - new Date(app.start_time).getTime();
          if (isNaN(durationMs) || durationMs <= 0) return sum;
          const durationHours = durationMs / (1000 * 60 * 60);
          return sum + durationHours;
        }, 0);

        setStats({
          patientsCount: patients.length,
          appointmentsCount: todaySessions,
          revenue: totalRevenue,
          myCompletedCount,
          myCompletedHours,
        });
      } catch (err) {
        console.error('Failed to load dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [triggerRefreshKey, currentUser]);

  return (
    <div className="space-y-6">
      
      {/* Welcome Message Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:bg-[#111827] dark:border-slate-800 flex items-center justify-between shadow-sm relative overflow-hidden transition-all duration-200">
        <div className="z-10">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Welcome back, Dibin!
          </h1>
        </div>
        <div className="absolute right-0 top-0 h-32 w-32 bg-brand-500/10 rounded-full blur-xl -mr-10 -mt-10" />
      </div>

      {/* Stats Cards Section */}
      <div className={`grid grid-cols-1 gap-6 ${currentUser?.position_role === 'Admin' ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2'}`}>
        
        {/* Total Patients Card (Admin Only) */}
        {currentUser?.position_role === 'Admin' && (
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
        )}

        {/* Sessions Today Card (Everyone Sees) */}
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

        {/* Earnings Card (Admin Only) */}
        {currentUser?.position_role === 'Admin' && (
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
            <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-450">
              <IndianRupee className="h-6 w-6" />
            </div>
          </div>
        )}

        {/* Staff Performance Card (Everyone Sees Their Own) */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 dark:bg-[#111827] dark:border-slate-800 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">My Completed Log</span>
            <div className="mt-2 space-y-1">
              <div className="text-sm font-bold text-slate-700 dark:text-slate-350">
                Sessions: <span className="text-2xl font-extrabold text-slate-900 dark:text-white ml-1">{loading ? '...' : stats.myCompletedCount}</span>
              </div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-350">
                Hours: <span className="text-2xl font-extrabold text-slate-900 dark:text-white ml-1">{loading ? '...' : stats.myCompletedHours.toFixed(1)}</span> <span className="text-xs font-normal text-slate-400 ml-0.5">hrs</span>
              </div>
            </div>
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400">
            <Award className="h-6 w-6" />
          </div>
        </div>

      </div>

    </div>
  );
};
