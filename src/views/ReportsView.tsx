import React, { useEffect, useState, useRef } from 'react';
import {
  BarChart3,
  Database,
  HardDrive,
  Activity,
  UserCheck,
  Award,
  Clock
} from 'lucide-react';
import { dataService } from '../services/dataService';
import type { SystemAuditTrail, User as StaffUser, ScheduledSession } from '../services/dataService';

interface ReportsViewProps {
  triggerRefresh: () => void;
  triggerRefreshKey: number;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ triggerRefresh, triggerRefreshKey }) => {
  const [auditTrails, setAuditTrails] = useState<SystemAuditTrail[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  
  // Filters
  const [auditFilter, setAuditFilter] = useState<string>('ALL');

  // Quota state
  const [quota, setQuota] = useState({
    used_db_storage_mb: 0,
    max_db_storage_mb: 50,
    used_file_storage_mb: 0,
    max_file_storage_mb: 200,
  });

  const loadReportsData = async () => {
    try {
      const trails = await dataService.getAuditTrails();
      setAuditTrails(trails);
      
      const metrics = await dataService.getTenantResourceMetrics();
      setQuota(metrics);

      const staff = await dataService.getUsers();
      setStaffList(staff);

      const sess = await dataService.getScheduledSessions();
      setSessions(sess);
    } catch (err) {
      console.error('Failed to load reports view data:', err);
    }
  };

  const hasLoggedView = useRef(false);

  useEffect(() => {
    loadReportsData();
    if (!hasLoggedView.current) {
      hasLoggedView.current = true;
      dataService.addAuditTrail(
        'READ_PATIENT',
        'Accessed clinical reports dashboard and forensic audit records'
      ).catch((err) => console.error("Failed to log reports access:", err));
    }
  }, [triggerRefreshKey]);

  // Percentages calculations
  const dbPercentage = parseFloat(((quota.used_db_storage_mb / quota.max_db_storage_mb) * 100).toFixed(1));
  const filePercentage = parseFloat(((quota.used_file_storage_mb / quota.max_file_storage_mb) * 100).toFixed(1));

  // Filtered audit trails
  const filteredAudits = auditFilter === 'ALL'
    ? auditTrails
    : auditTrails.filter(trail => trail.action_type === auditFilter);

  // Helper to get productivity statistics for a practitioner
  const getProductivityForStaff = (staffId: string) => {
    const staffSessions = sessions.filter(s => s.practitioner_id === staffId);
    const scheduledCount = staffSessions.filter(s => s.status === 'scheduled' || !s.status).length;
    const completedCount = staffSessions.filter(s => s.status === 'completed').length;
    const cancelledCount = staffSessions.filter(s => s.status === 'cancelled').length;

    let completedHours = 0;
    staffSessions.forEach((s) => {
      if (s.status === 'completed' && s.start_time && s.end_time) {
        const start = new Date(s.start_time).getTime();
        const end = new Date(s.end_time).getTime();
        const hrs = (end - start) / (1000 * 60 * 60);
        if (hrs > 0) completedHours += hrs;
      }
    });

    return {
      total: staffSessions.length,
      scheduled: scheduledCount,
      completed: completedCount,
      cancelled: cancelledCount,
      hours: completedHours
    };
  };

  return (
    <div className="space-y-8">
      
      {/* 1. Quota Metering Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 dark:border-slate-800 mb-4">
            <Database className="h-5 w-5 text-brand-500" />
            <h4 className="font-bold text-slate-900 dark:text-white">Database Storage Meter (tenant_resource_metrics)</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>Used MB / Allowed Capacity</span>
              <span>{quota.used_db_storage_mb} MB / {quota.max_db_storage_mb} MB ({dbPercentage}% Used)</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3.5 overflow-hidden flex">
              <div
                style={{ width: `${Math.min(dbPercentage, 105)}%` }}
                className={`h-full rounded-full transition-all duration-500 ${
                  dbPercentage > 80 ? 'bg-red-500' : 'bg-brand-500'
                }`}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 dark:border-slate-800 mb-4">
            <HardDrive className="h-5 w-5 text-indigo-500" />
            <h4 className="font-bold text-slate-900 dark:text-white">File Vault Storage Meter (tenant_resource_metrics)</h4>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400">
              <span>Used MB / Allowed Capacity</span>
              <span>{quota.used_file_storage_mb} MB / {quota.max_file_storage_mb} MB ({filePercentage}% Used)</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3.5 overflow-hidden flex">
              <div
                style={{ width: `${Math.min(filePercentage, 105)}%` }}
                className={`h-full rounded-full transition-all duration-500 ${
                  filePercentage > 80 ? 'bg-red-500' : 'bg-emerald-500'
                }`}
              />
            </div>
          </div>
        </div>

      </div>

      {/* 2. Clinical Productivity & Hours Report */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <Activity className="h-5 w-5 text-emerald-500" />
          <h3 className="font-bold text-slate-900 dark:text-white">Clinical Productivity & Hours Report</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:bg-slate-850 dark:border-slate-800">
                <th className="px-4 py-3">Practitioner</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-center">Total Sessions</th>
                <th className="px-4 py-3 text-center">Scheduled</th>
                <th className="px-4 py-3 text-center">Completed</th>
                <th className="px-4 py-3 text-center">Cancelled</th>
                <th className="px-4 py-3 text-right">Completed Clinical Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-350">
              {staffList.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-6 text-slate-400 italic">No practitioners registered in directory.</td>
                </tr>
              ) : (
                staffList.map((practitioner) => {
                  const stats = getProductivityForStaff(practitioner.id);
                  return (
                    <tr key={practitioner.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                      <td className="px-4 py-3 font-bold text-slate-900 dark:text-white flex items-center space-x-2.5">
                        <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-655 dark:bg-slate-800 dark:text-slate-300">
                          {practitioner.full_name[0].toUpperCase()}
                        </div>
                        <span>{practitioner.full_name}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold">
                        <span className="px-2 py-0.5 bg-slate-50 border border-slate-150 rounded text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 text-[10px] font-bold">
                          {practitioner.position_role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-600 dark:text-slate-400">{stats.total}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400 rounded-full font-bold font-mono">
                          {stats.scheduled}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-450 rounded-full font-bold font-mono">
                          {stats.completed}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-455 rounded-full font-bold font-mono">
                          {stats.cancelled}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-extrabold text-slate-900 dark:text-white text-xs">
                        <span className="flex items-center justify-end space-x-1">
                          <Clock className="h-3.5 w-3.5 text-teal-500 inline-block" />
                          <span>{stats.hours.toFixed(1)} hrs</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Forensic Audit Trails Lookup */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 dark:border-slate-800 space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-indigo-500" />
            <h3 className="font-bold text-slate-900 dark:text-white">Forensic Audit Trail Lookup</h3>
          </div>

          {/* Action filters */}
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-semibold">Filter:</span>
            <select
              value={auditFilter}
              onChange={(e) => setAuditFilter(e.target.value)}
              className="rounded border border-slate-200 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Event Traces</option>
              <option value="SEARCH">SEARCH</option>
              <option value="READ_PATIENT">READ_PATIENT</option>
              <option value="FINANCIAL_MUTATION">FINANCIAL_MUTATION</option>
              <option value="CONSENT_CHANGED">CONSENT_CHANGED</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:bg-slate-850 dark:border-slate-800">
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3">Event Type</th>
                <th className="px-4 py-3">Auditable Activity description</th>
                <th className="px-4 py-3">Operator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-350">
              {filteredAudits.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-6 text-slate-400 italic">No audit trail logs match filter selection.</td>
                </tr>
              ) : (
                filteredAudits.map((trail) => {
                  const stamp = new Date(trail.created_at).toLocaleString('en-IN');
                  
                  return (
                    <tr key={trail.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10">
                      <td className="px-4 py-3 font-mono text-slate-450 dark:text-slate-500">{stamp}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded font-extrabold text-[9px] uppercase border ${
                          trail.action_type === 'CONSENT_CHANGED'
                            ? 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/10 dark:border-amber-900/30'
                            : trail.action_type === 'FINANCIAL_MUTATION'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/10 dark:border-emerald-900/30'
                            : trail.action_type === 'READ_PATIENT'
                            ? 'bg-brand-50 border-brand-200 text-brand-850 dark:bg-brand-950/10 dark:border-brand-900/30'
                            : 'bg-slate-50 border-slate-200 text-slate-655 dark:bg-slate-850'
                        }`}>
                          {trail.action_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-850 dark:text-slate-200">{trail.description}</td>
                      <td className="px-4 py-3 font-bold">{trail.performed_by}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
