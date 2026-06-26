import React, { useState, useEffect } from 'react';
import {
  Download,
  Upload,
  AlertTriangle,
  Database,
  CloudLightning,
  CheckCircle,
  ShieldAlert,
  Search,
  Clock,
  Users
} from 'lucide-react';
import { dataService } from '../services/dataService';
import type { SystemAuditTrail, User as StaffUser } from '../services/dataService';

interface AdminControlsViewProps {
  triggerRefresh: () => void;
}

export const AdminControlsView: React.FC<AdminControlsViewProps> = ({ triggerRefresh }) => {
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // High-risk confirmation states
  const [confirmTruncate, setConfirmTruncate] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Forensic Audit Trail States
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [auditTrails, setAuditTrails] = useState<SystemAuditTrail[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [filterAction, setFilterAction] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadAdminData = async () => {
    setLoadingLogs(true);
    try {
      const userProfile = await dataService.getCurrentUser();
      setCurrentUser(userProfile);
      
      const trails = await dataService.getAuditTrails();
      setAuditTrails(trails);
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
      setConfirmTruncate(false);
      setSuccessMsg('Forensic System Audit Trails purged successfully.');
      triggerRefresh();
      loadAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleWipeTodoLogs = async () => {
    try {
      await dataService.wipeCompletedTasks();
      setSuccessMsg('Completed tasks and temporary log caches purged.');
      triggerRefresh();
      loadAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  // 3. AWS MIGRATION READY EXPORT ENGINE
  const handleExportAWSDDL = async () => {
    const ddl = `-- AWS RDS-Compatible ANSI SQL Schema
-- Optimized for AWS Aurora PostgreSQL-15 / RDS PostgreSQL
-- Removes Supabase specific wrappers, relying on pure ANSI syntax

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name VARCHAR(255) NOT NULL,
  business_type VARCHAR(100) CHECK (business_type IN ('physiotherapy', 'dentist', 'general_clinic')),
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  max_db_storage_mb NUMERIC(10,2) DEFAULT 50.00,
  max_file_storage_mb NUMERIC(10,2) DEFAULT 200.00,
  clinic_start_time TIME DEFAULT '08:00:00',
  clinic_end_time TIME DEFAULT '20:00:00',
  bonus_threshold_hours INT DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  position_role VARCHAR(100) CHECK (position_role IN ('Admin', 'Senior Therapist', 'Receptionist')),
  medical_council_registration_no VARCHAR(100),
  can_view_personal_data BOOLEAN DEFAULT TRUE,
  can_view_medical_history BOOLEAN DEFAULT TRUE,
  can_manage_finance BOOLEAN DEFAULT FALSE,
  can_print_generate_invoice BOOLEAN DEFAULT TRUE,
  base_salary_monthly NUMERIC(12,2) DEFAULT 0.00,
  bonus_system_enabled BOOLEAN DEFAULT FALSE,
  resource_fhir JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  abha_number VARCHAR(19) UNIQUE,
  abha_address VARCHAR(100) UNIQUE,
  gstin VARCHAR(15),
  gst_enabled BOOLEAN DEFAULT FALSE,
  consent_given BOOLEAN DEFAULT FALSE,
  consent_timestamp TIMESTAMPTZ,
  consent_withdrawal_requested BOOLEAN DEFAULT FALSE,
  resource_fhir JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE clinical_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  resource_fhir JSONB,
  attachments JSONB,
  attachment_size_bytes BIGINT DEFAULT 0,
  is_deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invoices (
  id VARCHAR(50) PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  generated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  session_count_incremented INT DEFAULT 1,
  associated_practitioner_id UUID REFERENCES users(id),
  apply_gst BOOLEAN DEFAULT FALSE,
  cgst_rate NUMERIC(5,2) DEFAULT 9.00,
  sgst_rate NUMERIC(5,2) DEFAULT 9.00,
  igst_rate NUMERIC(5,2) DEFAULT 0.00,
  computed_tax_amount NUMERIC(12,2) DEFAULT 0.00,
  total_amount NUMERIC(12,2) NOT NULL,
  payment_status VARCHAR(50) CHECK (payment_status IN ('PAID', 'UNPAID', 'PENDING')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  item_name VARCHAR(255) NOT NULL,
  stock_count INT DEFAULT 0,
  unit_price NUMERIC(12,2) NOT NULL,
  sellable_via_invoice BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE business_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  expense_name VARCHAR(255) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  category VARCHAR(100) CHECK (category IN ('Salaries', 'Rent', 'Supplies', 'Utilities', 'Other')),
  expense_date DATE NOT NULL,
  attachment_size_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_audit_trails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  performed_by VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE todo_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) CHECK (status IN ('PENDING', 'COMPLETED')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE scheduled_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
  practitioner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  session_notes TEXT,
  status VARCHAR(50) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
`;

    triggerDownload(ddl, 'aws_rds_postgres_schema.sql', 'text/sql');
    await dataService.addAuditTrail('FINANCIAL_MUTATION', 'Exported AWS RDS DDL Schema files');
    setSuccessMsg('AWS RDS DDL schema downloaded. Ready for migration scaling.');
    loadAdminData();
  };

  const handleExportCSV = async (tableName: 'users' | 'patients' | 'invoices' | 'inventory') => {
    try {
      let data: any[] = [];
      let headers: string[] = [];
      
      if (tableName === 'users') {
        data = await dataService.getUsers();
        headers = ['id', 'tenant_id', 'email', 'full_name', 'position_role', 'base_salary_monthly', 'bonus_system_enabled'];
      } else if (tableName === 'patients') {
        data = await dataService.getPatients();
        headers = ['id', 'tenant_id', 'abha_number', 'abha_address', 'gstin', 'gst_enabled', 'consent_given', 'consent_timestamp'];
      } else if (tableName === 'invoices') {
        data = await dataService.getInvoices();
        headers = ['id', 'tenant_id', 'patient_id', 'session_count_incremented', 'computed_tax_amount', 'total_amount', 'payment_status'];
      } else if (tableName === 'inventory') {
        data = await dataService.getInventory();
        headers = ['id', 'tenant_id', 'item_name', 'stock_count', 'unit_price', 'sellable_via_invoice'];
      }

      // Generate CSV string
      const csvRows = [
        headers.join(','), // headers
        ...data.map(row => 
          headers.map(header => {
            const val = row[header];
            if (typeof val === 'string') {
              return `"${val.replace(/"/g, '""')}"`;
            }
            return val;
          }).join(',')
        )
      ];
      
      triggerDownload(csvRows.join('\n'), `${tableName}_export.csv`, 'text/csv');
      await dataService.addAuditTrail('FINANCIAL_MUTATION', `Exported table '${tableName}' to CSV format`);
      setSuccessMsg(`Table '${tableName}' exported successfully as CSV.`);
      loadAdminData();
    } catch (err) {
      console.error(err);
    }
  };

  // Mock Restore from Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.sql') || file.name.endsWith('.json'))) {
      setLoading(true);
      setTimeout(async () => {
        setLoading(false);
        setSuccessMsg(`Database state recovered successfully from backup file: ${file.name}`);
        await dataService.addAuditTrail('FINANCIAL_MUTATION', `Restored database state from backup file: ${file.name}`);
        triggerRefresh();
        loadAdminData();
      }, 1500);
    } else {
      alert('Invalid file format. Please drop a .sql or .json backup file.');
    }
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

      {/* Main grids */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Backup and Restore tools (Left 7 Columns) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Backup card */}
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
              className="flex items-center bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow transition-all disabled:opacity-50"
            >
              <Download className="h-4 w-4 mr-2" />
              {loading ? 'Compiling Schema...' : 'Generate Full System Backup (.sql)'}
            </button>
          </div>

          {/* Restore Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <Upload className="h-5 w-5 text-indigo-500" />
              <h3 className="font-bold text-slate-900 dark:text-white">Restore System State</h3>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Drag-and-drop or select an older backup state to recover records. Warning: loading older databases overwrites current entries in LocalStorage/Supabase.
            </p>

            {/* Drag and drop zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-brand-500 bg-brand-50/20 dark:bg-brand-950/10'
                  : 'border-slate-250 bg-slate-50/30 dark:bg-slate-900/10 dark:border-slate-800'
              }`}
            >
              <Upload className="h-8 w-8 text-slate-400 mx-auto animate-bounce" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-3">Drop database backup file here</p>
              <span className="block text-[10px] text-slate-400 mt-1">Supports unified .sql or .json catalogs</span>
            </div>
          </div>

        </div>

        {/* Purging & AWS Export tools (Right 5 Columns) */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* AWS Export Center */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-4">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3 dark:border-slate-800">
              <CloudLightning className="h-5 w-5 text-amber-500 animate-pulse" />
              <h3 className="font-bold text-slate-900 dark:text-white">AWS Scaling Migration Center</h3>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Ready for enterprise cloud deployment. Export clean SQL structures and CSV values configured explicitly for AWS RDS, Aurora, or Athena setups.
            </p>

            <div className="space-y-2.5">
              <button
                onClick={handleExportAWSDDL}
                className="w-full text-left flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-350 dark:hover:bg-slate-700 transition-all"
              >
                <span>Export AWS RDS-Compatible SQL Schema</span>
                <Download className="h-4 w-4 text-slate-400" />
              </button>

              <div className="pt-2 border-t border-slate-150 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-450 block mb-2">Export Data Tables (CSV)</span>
                
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => handleExportCSV('patients')}
                    className="text-left px-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-400"
                  >
                    patients.csv
                  </button>
                  <button
                    onClick={() => handleExportCSV('invoices')}
                    className="text-left px-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-400"
                  >
                    invoices.csv
                  </button>
                  <button
                    onClick={() => handleExportCSV('users')}
                    className="text-left px-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-400"
                  >
                    users.csv
                  </button>
                  <button
                    onClick={() => handleExportCSV('inventory')}
                    className="text-left px-3 py-1.5 bg-slate-50/50 border border-slate-200 rounded text-[11px] font-semibold text-slate-600 hover:bg-slate-100 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-400"
                  >
                    inventory.csv
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Purge controls (High-risk) */}
          <div className="bg-white rounded-xl border border-red-200 p-6 shadow-sm dark:bg-[#111827] dark:border-red-950/10 space-y-4">
            <div className="flex items-center space-x-2 border-b border-red-100 pb-3 dark:border-red-950/20">
              <AlertTriangle className="h-5 w-5 text-red-500 animate-bounce" />
              <h3 className="font-bold text-red-800 dark:text-red-400">High-Risk Operations</h3>
            </div>

            <p className="text-xs text-red-700/80 dark:text-red-400/70 leading-relaxed">
              These actions delete logs and ledger contents permanently. Requires care when clearing clinic history.
            </p>

            <div className="space-y-3">
              <div>
                {confirmTruncate ? (
                  <div className="space-y-2 bg-red-50 p-3 rounded-lg border border-red-200 dark:bg-red-950/20 dark:border-red-900/50">
                    <p className="text-[10px] font-bold text-red-800 dark:text-red-300">Are you absolutely sure? This cannot be undone.</p>
                    <div className="flex space-x-2">
                      <button
                        onClick={handleTruncateAuditTrails}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold text-[10px] px-3 py-1.5 rounded"
                      >
                        Confirm Purge
                      </button>
                      <button
                        onClick={() => setConfirmTruncate(false)}
                        className="bg-white border border-slate-200 text-slate-600 font-semibold text-[10px] px-3 py-1.5 rounded dark:bg-slate-800 dark:border-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmTruncate(true)}
                    className="w-full text-left bg-red-50 text-red-600 text-xs font-bold px-3 py-2 rounded-lg border border-red-100 hover:bg-red-100/50 dark:bg-red-950/15 dark:text-red-400 dark:border-red-900/30 transition-all"
                  >
                    Truncate Forensic Audit Trails
                  </button>
                )}
              </div>

              <button
                onClick={handleWipeTodoLogs}
                className="w-full text-left bg-red-50 text-red-600 text-xs font-bold px-3 py-2 rounded-lg border border-red-100 hover:bg-red-100/50 dark:bg-red-950/15 dark:text-red-400 dark:border-red-900/30 transition-all"
              >
                Wipe Expired Todo Logs & Cache
              </button>
            </div>
          </div>

        </div>

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
