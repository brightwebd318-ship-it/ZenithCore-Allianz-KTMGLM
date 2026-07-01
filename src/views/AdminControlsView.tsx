import React, { useState, useEffect } from 'react';
import {
  Download,
  Database,
  CheckCircle,
  ShieldAlert,
  Search,
  Clock,
  Trash2,
  AlertTriangle,
  HardDrive
} from 'lucide-react';
import { dataService } from '../services/dataService';
import type { SystemAuditTrail, User as StaffUser, Tenant } from '../services/dataService';
import { isSupabaseConfigured } from '../services/supabaseClient';

interface AdminControlsViewProps {
  triggerRefresh: () => void;
}

export const AdminControlsView: React.FC<AdminControlsViewProps> = ({ triggerRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  


  // Tenant Resource metrics state
  const [quota, setQuota] = useState({
    used_db_storage_mb: 0,
    max_db_storage_mb: 50,
    used_file_storage_mb: 0,
    max_file_storage_mb: 200,
  });

  // Forensic Audit Trail States
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [auditTrails, setAuditTrails] = useState<SystemAuditTrail[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [filterAction, setFilterAction] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [tenantSettings, setTenantSettings] = useState<Tenant | null>(null);

  const loadAdminData = async () => {
    setLoadingLogs(true);
    try {
      const userProfile = await dataService.getCurrentUser();
      setCurrentUser(userProfile);
      
      const trails = await dataService.getAuditTrails();
      setAuditTrails(trails);

      const metrics = await dataService.getTenantResourceMetrics();
      setQuota(metrics);

      const tenant = await dataService.getTenant();
      setTenantSettings(tenant);
    } catch (err) {
      console.error('Failed to load admin logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  if (currentUser && currentUser.position_role !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-red-200 rounded-xl dark:bg-[#111827] dark:border-red-950/20 max-w-xl mx-auto mt-12 shadow-lg">
        <AlertTriangle className="h-12 w-12 text-red-500 mb-4 animate-bounce" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Access Denied</h3>
        <p className="text-xs text-slate-500 dark:text-slate-450 mt-2 max-w-md">
          This panel is restricted to system administrators with full security clearance. All unauthorized access attempts are forensically logged.
        </p>
      </div>
    );
  }

  const triggerDownload = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 1. MANUAL SYSTEM BACKUP CONSOLE
  const handleGenerateBackup = async () => {
    setLoading(true);
    setSuccessMsg(null);
    
    try {
      // Simulate generating a full SQL file of current state
      const tenant = await dataService.getTenant();
      const users = await dataService.getUsers();
      const patients = await dataService.getPatients();
      const invoices = await dataService.getInvoices();
      const inventory = await dataService.getInventory();

      const stamp = new Date().toISOString().split('T')[0];
      
      let sqlDump = `-- ZenithCore Medical SaaS Database Backup
-- Tenant ID: ${tenant.id} (${tenant.business_name})
-- Generated At: ${new Date().toLocaleString('en-IN')}
-- PostgreSQL Dump Utility compatible

CREATE DATABASE IF NOT EXISTS zenithcore_alliance;
\\c zenithcore_alliance

`;

      // Structure definitions
      sqlDump += `-- Table structures
CREATE TABLE tenants (id UUID PRIMARY KEY, business_name VARCHAR, business_type VARCHAR, subdomain VARCHAR, max_db_storage_mb DECIMAL, max_file_storage_mb DECIMAL);
CREATE TABLE users (id UUID PRIMARY KEY, tenant_id UUID, email VARCHAR, full_name VARCHAR, position_role VARCHAR);
CREATE TABLE patients (id UUID PRIMARY KEY, tenant_id UUID, abha_number VARCHAR, abha_address VARCHAR, consent_given BOOLEAN);
CREATE TABLE invoices (id VARCHAR PRIMARY KEY, tenant_id UUID, patient_id UUID, total_amount DECIMAL, payment_status VARCHAR);
CREATE TABLE inventory_items (id UUID PRIMARY KEY, tenant_id UUID, item_name VARCHAR, stock_count INT, unit_price DECIMAL, sellable_via_invoice BOOLEAN);

`;

      // Packaged inserts of current state
      users.forEach(u => {
        sqlDump += `INSERT INTO users (id, tenant_id, email, full_name, position_role) VALUES ('${u.id}', '${u.tenant_id}', '${u.email}', '${u.full_name}', '${u.position_role}');\n`;
      });
      patients.forEach(p => {
        sqlDump += `INSERT INTO patients (id, tenant_id, abha_number, abha_address, consent_given) VALUES ('${p.id}', '${p.tenant_id}', '${p.abha_number}', '${p.abha_address}', ${p.consent_given});\n`;
      });
      invoices.forEach(inv => {
        sqlDump += `INSERT INTO invoices (id, tenant_id, patient_id, total_amount, payment_status) VALUES ('${inv.id}', '${inv.tenant_id}', '${inv.patient_id}', ${inv.total_amount}, '${inv.payment_status}');\n`;
      });
      inventory.forEach(item => {
        sqlDump += `INSERT INTO inventory_items (id, tenant_id, item_name, stock_count, unit_price, sellable_via_invoice) VALUES ('${item.id}', '${item.tenant_id}', '${item.item_name}', ${item.stock_count}, ${item.unit_price}, ${item.sellable_via_invoice});\n`;
      });

      // Trigger download of backup file
      triggerDownload(sqlDump, `zenithcore_backup_${stamp}.sql`, 'text/sql');
      
      await dataService.addAuditTrail('FINANCIAL_MUTATION', 'Generated full SQL system backup file');
      setSuccessMsg('Unified system SQL backup payload compiled and downloaded successfully!');
      triggerRefresh();
      loadAdminData();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 2. DATA DELETION / CLEANUP ACTIONS
  const handleTruncateAuditTrails = async () => {
    try {
      await dataService.truncateAuditTrails();
      setSuccessMsg('Forensic System Audit Trails deleted successfully.');
      triggerRefresh();
      loadAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadLogs = () => {
    if (auditTrails.length === 0) {
      alert("No audit logs available to download.");
      return;
    }
    
    let logContent = `Zenith Core Alliance - System Audit Log File\n`;
    logContent += `Generated At: ${new Date().toLocaleString('en-IN')}\n`;
    logContent += `========================================================\n\n`;
    
    auditTrails.forEach((trail) => {
      const timeStr = new Date(trail.created_at).toISOString();
      logContent += `[${timeStr}] [${trail.action_type}] ${trail.description} (By: ${trail.performed_by})\n`;
    });
    
    const stamp = new Date().toISOString().split('T')[0];
    triggerDownload(logContent, `zenith_audit_trail_${stamp}.log`, 'text/plain');
  };

  return (
    <div className="space-y-8">
      
      {/* Alert header */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-xl dark:bg-emerald-950/20 dark:border-emerald-900/30 flex items-start space-x-3 shadow-sm">
          <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <div>
            <h4 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Operation Succeeded</h4>
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5 font-semibold">{successMsg}</p>
          </div>
        </div>
      )}

      {/* Storage, Health, and Settings Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Storage Meter Monitor */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-brand-500" />
              <h3 className="font-bold text-slate-900 dark:text-white">Tenant Resource Quotas</h3>
            </div>
            <span className="text-[10px] bg-brand-50 border border-brand-100 px-2.5 py-0.5 rounded font-bold text-brand-600 dark:bg-brand-950/20 dark:border-brand-900/30">
              Clinical Vault Limits
            </span>
          </div>

          <div className="mt-5 space-y-5">
            {/* Database progress bar */}
            <div>
              <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                <span className="flex items-center"><Database className="h-3.5 w-3.5 mr-1 text-indigo-500" /> Database Storage ({parseFloat(((quota.used_db_storage_mb / quota.max_db_storage_mb) * 100).toFixed(1))}% Used)</span>
                <span>{quota.used_db_storage_mb} MB / {quota.max_db_storage_mb} MB</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3.5 dark:bg-slate-800 overflow-hidden flex">
                <div
                  style={{ width: `${Math.min(parseFloat(((quota.used_db_storage_mb / quota.max_db_storage_mb) * 100).toFixed(1)), 100)}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    parseFloat(((quota.used_db_storage_mb / quota.max_db_storage_mb) * 100).toFixed(1)) > 85 ? 'bg-red-500' : parseFloat(((quota.used_db_storage_mb / quota.max_db_storage_mb) * 100).toFixed(1)) > 60 ? 'bg-amber-500' : 'bg-brand-500'
                  }`}
                />
              </div>
            </div>

            {/* File Storage progress bar */}
            <div>
              <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                <span className="flex items-center"><HardDrive className="h-3.5 w-3.5 mr-1 text-pink-500" /> File Vault Storage ({parseFloat(((quota.used_file_storage_mb / quota.max_file_storage_mb) * 100).toFixed(1))}% Used)</span>
                <span>{quota.used_file_storage_mb} MB / {quota.max_file_storage_mb} MB</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3.5 dark:bg-slate-800 overflow-hidden flex">
                <div
                  style={{ width: `${Math.min(parseFloat(((quota.used_file_storage_mb / quota.max_file_storage_mb) * 100).toFixed(1)), 100)}%` }}
                  className={`h-full rounded-full transition-all duration-500 ${
                    parseFloat(((quota.used_file_storage_mb / quota.max_file_storage_mb) * 100).toFixed(1)) > 85 ? 'bg-red-500' : parseFloat(((quota.used_file_storage_mb / quota.max_file_storage_mb) * 100).toFixed(1)) > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
              </div>
            </div>

            <div className="text-[11px] leading-relaxed text-slate-400 bg-slate-50 p-3 rounded-lg dark:bg-slate-800/35">
              💡 <strong>Storage tip:</strong> File vault quota increases when uploading PDF reports or clinic expenses. Deleting clinical log records (DGHS compliant soft-deletion archiving) releases storage dynamically.
            </div>
          </div>
        </div>

        {/* Clinic Default Settings Card */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 pb-4 border-b border-slate-100 dark:border-slate-800">
              <Clock className="h-5 w-5 text-indigo-500" />
              <h3 className="font-bold text-slate-950 dark:text-white">Clinic Settings</h3>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-450 uppercase mb-1.5 dark:text-slate-450">
                  Default Session Duration
                </label>
                <select
                  value={tenantSettings?.session_duration_minutes || 45}
                  onChange={async (e) => {
                    const newDur = parseInt(e.target.value) || 45;
                    try {
                      const updated = await dataService.updateTenant({ session_duration_minutes: newDur });
                      setTenantSettings(updated);
                      await dataService.addAuditTrail(
                        'FINANCIAL_MUTATION',
                        `Updated clinic default session duration to ${newDur} minutes`
                      );
                      alert(`Clinic default session duration updated to ${newDur} minutes.`);
                    } catch (err: any) {
                      console.error("Failed to update session duration:", err);
                      alert("Error updating session duration. If you are using a live database, please ensure you have run the migration:\n\nALTER TABLE tenants ADD COLUMN IF NOT EXISTS session_duration_minutes INT DEFAULT 45;");
                    }
                  }}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 text-xs px-2.5 py-1.5 bg-white dark:bg-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="15">15 mins</option>
                  <option value="30">30 mins</option>
                  <option value="45">45 mins</option>
                  <option value="60">60 mins</option>
                  <option value="75">75 mins</option>
                  <option value="90">90 mins</option>
                  <option value="120">120 mins</option>
                </select>
                <p className="text-[10px] text-slate-450 mt-2">
                  Used globally to calculate total time worked from scheduled session counts.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Manual System Backup Console Card (Full Width) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-4">
        <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <Database className="h-5 w-5 text-brand-500" />
          <h3 className="font-bold text-slate-900 dark:text-white">Manual System Backup Console</h3>
        </div>
        
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
          Compile and package structure schemas along with active table rows into a unified SQL database state file. Ideal for localized offline archiving.
        </p>

        <button
          onClick={handleGenerateBackup}
          disabled={loading}
          className="inline-flex items-center bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow transition-all disabled:opacity-50 font-semibold"
        >
          <Download className="h-4 w-4 mr-2" />
          {loading ? 'Compiling Schema...' : 'Generate Full System Backup (.sql)'}
        </button>
      </div>

      {/* 4. Forensic Audit Trail Lookup Section (Full Width at Bottom) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-slate-800 space-y-3 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="h-5 w-5 text-red-500 animate-pulse" />
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">Forensic System Audit Trail</h3>
              <p className="text-xs text-slate-450 dark:text-slate-500 font-medium">Compliance verification and digital access logs</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3">
            {/* Download and Purge Buttons */}
            <button
              onClick={handleDownloadLogs}
              className="flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-3 py-1.5 rounded-lg border border-slate-200 transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-slate-350 dark:hover:bg-slate-700/50"
              title="Download all forensic logs as a text file"
            >
              <Download className="h-3.5 w-3.5 mr-1.5 text-brand-500" />
              <span>Download Log</span>
            </button>

            <button
              onClick={() => {
                if (confirm("Are you absolutely sure you want to delete all forensic audit logs? Download the log file first to save a backup!")) {
                  handleTruncateAuditTrails();
                }
              }}
              className="flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-650 font-bold text-xs px-3 py-1.5 rounded-lg border border-red-100 transition-all dark:bg-red-950/20 dark:border-red-900/30 dark:text-red-405"
              title="Delete all logs from the database to save space"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5 text-red-500" />
              <span>Delete Logs</span>
            </button>

            {/* Search Input */}
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-3.5 w-3.5 text-slate-400" />
              </span>
              <input
                type="text"
                placeholder="Search description/performer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500 w-full sm:w-56"
              />
            </div>

            {/* Action Type Filter Dropdown */}
            <select
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
              className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            >
              <option value="ALL">All Actions</option>
              <option value="SEARCH">SEARCH</option>
              <option value="READ_PATIENT">READ_PATIENT</option>
              <option value="FINANCIAL_MUTATION">FINANCIAL_MUTATION</option>
              <option value="CONSENT_CHANGED">CONSENT_CHANGED</option>
            </select>
          </div>
        </div>

        {/* Audit Trails Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-450 uppercase tracking-wider border-b border-slate-200 dark:bg-slate-855 dark:border-slate-800 font-mono">
                <th className="px-4 py-3">Timestamp (IST)</th>
                <th className="px-4 py-3">Action Type</th>
                <th className="px-4 py-3">Details / Digital Trail Description</th>
                <th className="px-4 py-3">Performed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700 dark:divide-slate-800 dark:text-slate-300">
              {loadingLogs ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-slate-450 font-medium">Loading forensic logs...</td>
                </tr>
              ) : (
                (() => {
                  const filteredTrails = auditTrails.filter((trail) => {
                    const matchesAction = filterAction === 'ALL' || trail.action_type === filterAction;
                    const matchesSearch =
                      trail.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      trail.performed_by.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      trail.action_type.toLowerCase().includes(searchQuery.toLowerCase());
                    return matchesAction && matchesSearch;
                  });

                  if (filteredTrails.length === 0) {
                    return (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-slate-450 font-medium">No matching audit logs found.</td>
                      </tr>
                    );
                  }

                  return filteredTrails.map((trail) => {
                    let badgeClass = '';
                    switch (trail.action_type) {
                      case 'SEARCH':
                        badgeClass = 'bg-blue-100 text-blue-800 dark:bg-blue-950/20 dark:text-blue-400';
                        break;
                      case 'READ_PATIENT':
                        badgeClass = 'bg-purple-100 text-purple-800 dark:bg-purple-950/20 dark:text-purple-400';
                        break;
                      case 'FINANCIAL_MUTATION':
                        badgeClass = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400';
                        break;
                      case 'CONSENT_CHANGED':
                        badgeClass = 'bg-amber-100 text-amber-800 dark:bg-amber-950/20 dark:text-amber-400';
                        break;
                      default:
                        badgeClass = 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400';
                    }

                    const formattedTime = new Date(trail.created_at).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    });

                    return (
                      <tr key={trail.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                        <td className="px-4 py-3.5 font-mono text-slate-500 dark:text-slate-450 font-medium text-[11px] whitespace-nowrap">
                          {formattedTime}
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[9px] font-extrabold uppercase font-mono tracking-wider ${badgeClass}`}>
                            {trail.action_type}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                          {trail.description}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-white font-mono text-[11px]">
                          {trail.performed_by}
                        </td>
                      </tr>
                    );
                  });
                })()
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
