import React, { useEffect, useState, useRef } from 'react';
import {
  BarChart3,
  Activity,
  UserCheck,
  Award,
  Clock,
  PieChart,
  TrendingUp,
  TrendingDown,
  DollarSign
} from 'lucide-react';
import { dataService, formatHours } from '../services/dataService';
import type { User as StaffUser, ScheduledSession, BusinessExpense, Invoice, ClinicalLog, Tenant } from '../services/dataService';

import { AttendanceView } from './AttendanceView';

interface ReportsViewProps {
  triggerRefresh: () => void;
  triggerRefreshKey: number;
  currentUser: StaffUser | null;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ triggerRefresh, triggerRefreshKey, currentUser }) => {
  const [activeReportTab, setActiveReportTab] = useState<'analytics' | 'attendance'>('analytics');
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [expenses, setExpenses] = useState<BusinessExpense[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clinicalLogs, setClinicalLogs] = useState<ClinicalLog[]>([]);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  
  // Hovered slice for pie chart interactivity
  const [hoveredSlice, setHoveredSlice] = useState<{ name: string; value: number; percentage: number; color: string } | null>(null);

  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [cashflowMonth, setCashflowMonth] = useState<string>('');
  const [isPrintingReport, setIsPrintingReport] = useState(false);

  const handleDownloadPdf = () => {
    setIsPrintingReport(true);
    setTimeout(() => {
      window.print();
      setIsPrintingReport(false);
    }, 500);
  };

  const loadReportsData = async () => {
    try {
      const curTenant = await dataService.getTenant();
      setTenant(curTenant);

      const staff = await dataService.getUsers();
      setStaffList(staff);

      const sess = await dataService.getScheduledSessions();
      setSessions(sess);

      const exps = await dataService.getExpenses();
      setExpenses(exps);

      const invs = await dataService.getInvoices();
      setInvoices(invs);

      const logs = await dataService.getAllClinicalLogs();
      setClinicalLogs(logs);
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

  // Filter invoices and expenses by selected month
  const filteredInvoices = cashflowMonth 
    ? invoices.filter(inv => inv.created_at.startsWith(cashflowMonth))
    : invoices;

  const filteredExpenses = cashflowMonth
    ? expenses.filter(exp => exp.expense_date.startsWith(cashflowMonth))
    : expenses;

  // Financial breakdown computations
  const totalIncome = filteredInvoices
    .filter((inv) => String(inv.payment_status).toUpperCase() === 'PAID')
    .reduce((sum, inv) => sum + inv.total_amount, 0);

  const totalSalaries = filteredExpenses.filter(e => e.category === 'Salaries').reduce((sum, e) => sum + e.amount, 0);
  const totalRent = filteredExpenses.filter(e => e.category === 'Rent').reduce((sum, e) => sum + e.amount, 0);
  const totalSupplies = filteredExpenses.filter(e => e.category === 'Supplies').reduce((sum, e) => sum + e.amount, 0);
  const totalUtilities = filteredExpenses.filter(e => e.category === 'Utilities').reduce((sum, e) => sum + e.amount, 0);
  const totalOther = filteredExpenses.filter(e => e.category === 'Other').reduce((sum, e) => sum + e.amount, 0);

  const totalExpenses = totalSalaries + totalRent + totalSupplies + totalUtilities + totalOther;

  const categories = [
    { name: 'Invoice Income', value: totalIncome, color: '#10B981', type: 'income' },
    { name: 'Salary Payments', value: totalSalaries, color: '#6366F1', type: 'expense' },
    { name: 'Clinic Rent', value: totalRent, color: '#8B5CF6', type: 'expense' },
    { name: 'Electricity & Utilities', value: totalUtilities, color: '#F59E0B', type: 'expense' },
    { name: 'Clinical Supplies', value: totalSupplies, color: '#EC4899', type: 'expense' },
    { name: 'Other Expenses', value: totalOther, color: '#64748B', type: 'expense' }
  ].filter(c => c.value > 0);

  const totalValue = categories.reduce((sum, c) => sum + c.value, 0);

  const radius = 40;
  const strokeWidth = 12;
  const circumference = 2 * Math.PI * radius; // ~251.3
  
  let accumulatedOffset = 0;
  const chartData = categories.map((cat) => {
    const percentage = totalValue > 0 ? (cat.value / totalValue) * 100 : 0;
    const strokeLength = totalValue > 0 ? (cat.value / totalValue) * circumference : 0;
    const strokeOffset = -accumulatedOffset;
    accumulatedOffset += strokeLength;

    return {
      ...cat,
      percentage,
      strokeLength,
      strokeOffset
    };
  });

  const filteredSessions = sessions.filter((s) => {
    if (!s.start_time) return true;
    const sDate = s.start_time.split('T')[0];
    if (fromDate && sDate < fromDate) return false;
    if (toDate && sDate > toDate) return false;
    return true;
  });

  const filteredLogs = clinicalLogs.filter((log) => {
    const logDate = log.resource_fhir?.date || '';
    if (!logDate) return false;
    const sDate = logDate.split('T')[0];
    if (fromDate && sDate < fromDate) return false;
    if (toDate && sDate > toDate) return false;
    return true;
  });

  const totalAppointmentsCount = filteredSessions.length;
  const totalCompletedSessionsCount = filteredLogs.reduce((sum, log) => sum + (Number(log.resource_fhir?.sessions_conducted) || 0), 0);

  // Helper to get productivity statistics for a practitioner
  const getProductivityForStaff = (staffId: string) => {
    const staffSessions = filteredSessions.filter(s => s.practitioner_id === staffId);
    const scheduledCount = staffSessions.filter(s => s.status === 'scheduled' || !s.status).length;
    const cancelledCount = staffSessions.filter(s => s.status === 'cancelled').length;

    const staffLogs = filteredLogs.filter(log => log.author_id === staffId);
    const completedCount = staffLogs.reduce((sum, log) => sum + (Number(log.resource_fhir?.sessions_conducted) || 0), 0);
    const sessionDuration = tenant?.session_duration_minutes || 45;
    const completedHours = (completedCount * sessionDuration) / 60;

    return {
      total: staffSessions.length,
      scheduled: scheduledCount,
      completed: completedCount,
      cancelled: cancelledCount,
      hours: completedHours
    };
  };

  return (
    <div className="space-y-6 relative">
      
      {/* Printable Report Overlay */}
      {isPrintingReport && (
        <div className="fixed inset-0 bg-white z-[9999] p-10 overflow-y-auto text-black print:absolute print:inset-0 print:p-0 print:overflow-visible print:h-auto">
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="text-center border-b pb-4 mb-6">
              <h1 className="text-2xl font-bold font-outfit uppercase">Detailed Cashflow Report</h1>
              <p className="text-sm font-semibold text-slate-600">Period: {cashflowMonth || 'All Time'}</p>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-xl font-bold bg-green-50 text-green-800 px-4 py-2 uppercase">Income (Invoices)</h2>
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-800 uppercase font-bold text-xs">
                    <th className="py-2 px-2">Date</th>
                    <th className="py-2 px-2">Invoice #</th>
                    <th className="py-2 px-2">Patient ID</th>
                    <th className="py-2 px-2 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredInvoices.map(inv => (
                    <tr key={inv.id}>
                      <td className="py-2 px-2">{new Date(inv.created_at).toLocaleDateString()}</td>
                      <td className="py-2 px-2 font-mono">{inv.id.substring(0, 8)}</td>
                      <td className="py-2 px-2 font-mono">{inv.patient_id.substring(0, 8)}...</td>
                      <td className="py-2 px-2 text-right">{(inv.total_amount || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  {filteredInvoices.length === 0 && <tr><td colSpan={4} className="text-center py-4">No income for this period.</td></tr>}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2 border-slate-800">
                    <td colSpan={3} className="py-2 px-2 text-right">Total Income:</td>
                    <td className="py-2 px-2 text-right text-green-700">₹{totalIncome.toLocaleString('en-IN')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="space-y-4">
              <h2 className="text-xl font-bold bg-red-50 text-red-800 px-4 py-2 uppercase mt-8">Expenses & Outflow</h2>
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b-2 border-slate-800 uppercase font-bold text-xs">
                    <th className="py-2 px-2">Date</th>
                    <th className="py-2 px-2">Category</th>
                    <th className="py-2 px-2">Description</th>
                    <th className="py-2 px-2 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredExpenses.map(exp => (
                    <tr key={exp.id}>
                      <td className="py-2 px-2">{exp.expense_date}</td>
                      <td className="py-2 px-2">{exp.category}</td>
                      <td className="py-2 px-2">{exp.expense_name}</td>
                      <td className="py-2 px-2 text-right">{(exp.amount || 0).toLocaleString('en-IN')}</td>
                    </tr>
                  ))}
                  {filteredExpenses.length === 0 && <tr><td colSpan={4} className="text-center py-4">No expenses for this period.</td></tr>}
                </tbody>
                <tfoot>
                  <tr className="font-bold border-t-2 border-slate-800">
                    <td colSpan={3} className="py-2 px-2 text-right">Total Expenses:</td>
                    <td className="py-2 px-2 text-right text-red-700">₹{totalExpenses.toLocaleString('en-IN')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            <div className="mt-8 text-right space-y-2 border-t pt-4">
              <p className="text-lg font-bold">Net Balance: <span className={(totalIncome - totalExpenses) >= 0 ? 'text-green-700' : 'text-red-700'}>₹{(totalIncome - totalExpenses).toLocaleString('en-IN')}</span></p>
              <p className="text-xs text-slate-500">Report generated on {new Date().toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Premium Report Sub-Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-2">
        <button
          onClick={() => setActiveReportTab('analytics')}
          className={`flex items-center space-x-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeReportTab === 'analytics'
              ? 'border-brand-500 text-brand-500'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>Financials & Productivity</span>
        </button>
        <button
          onClick={() => setActiveReportTab('attendance')}
          className={`flex items-center space-x-2 py-3 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer ${
            activeReportTab === 'attendance'
              ? 'border-brand-500 text-brand-500'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white'
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Attendance Reports</span>
        </button>
      </div>

      {activeReportTab === 'attendance' ? (
        <AttendanceView
          triggerRefresh={triggerRefresh}
          triggerRefreshKey={triggerRefreshKey}
          currentUser={currentUser}
        />
      ) : (
        <div className="space-y-8 animate-fade-in">
          {/* 2. Interactive Cashflow & Expenses Distribution (Pie chart) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center space-x-2">
                <PieChart className="h-5 w-5 text-indigo-500" />
                <h3 className="font-bold text-slate-900 dark:text-white font-outfit">Cashflow & Financial Allocations Distribution</h3>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="month"
                  value={cashflowMonth}
                  onChange={(e) => setCashflowMonth(e.target.value)}
                  className="px-3 py-1.5 border border-slate-200 rounded text-xs text-slate-800 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-200"
                  title="Filter by month"
                />
                <button
                  onClick={handleDownloadPdf}
                  className="px-3 py-1.5 bg-brand-500 text-white font-bold rounded text-xs shadow hover:bg-brand-600 transition-colors"
                >
                  Download PDF
                </button>
              </div>
            </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          
          {/* Donut Chart (SVG) - Left 5 columns */}
          <div className="md:col-span-5 flex justify-center">
            <div className="relative h-48 w-48 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                {/* Empty / Background circle */}
                <circle
                  cx="60"
                  cy="60"
                  r={radius}
                  fill="transparent"
                  stroke="#E2E8F0"
                  strokeWidth={strokeWidth}
                  className="dark:stroke-slate-800"
                />
                
                {chartData.map((slice, idx) => (
                  <circle
                    key={idx}
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="transparent"
                    stroke={slice.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${slice.strokeLength} ${circumference}`}
                    strokeDashoffset={slice.strokeOffset}
                    strokeLinecap="round"
                    className="transition-all duration-300 cursor-pointer hover:stroke-[14px]"
                    onMouseEnter={() => setHoveredSlice({
                      name: slice.name,
                      value: slice.value,
                      percentage: slice.percentage,
                      color: slice.color
                    })}
                    onMouseLeave={() => setHoveredSlice(null)}
                  />
                ))}
              </svg>

              {/* Central Text HUD */}
              {hoveredSlice ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
                  <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider leading-tight">
                    {hoveredSlice.name}
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white mt-1">
                    ₹{hoveredSlice.value.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                    {hoveredSlice.percentage.toFixed(1)}%
                  </span>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center p-2">
                  <span className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">
                    Total Volume
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white mt-1">
                    ₹{totalValue.toLocaleString('en-IN')}
                  </span>
                  <span className="text-[10px] font-semibold text-emerald-500 mt-0.5">
                    Hover slices
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Legend Table - Right 7 columns */}
          <div className="md:col-span-7 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* Financial Summaries */}
              <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 dark:bg-emerald-950/10 dark:border-emerald-900/30 flex items-center space-x-3">
                <div className="h-10 w-10 bg-emerald-500 rounded-lg flex items-center justify-center text-white shrink-0">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block truncate">Paid Income</span>
                  <h4 className="text-base font-black text-slate-900 dark:text-white mt-0.5 truncate">
                    ₹{totalIncome.toLocaleString('en-IN')}
                  </h4>
                </div>
              </div>

              <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 dark:bg-rose-950/10 dark:border-rose-900/30 flex items-center space-x-3">
                <div className="h-10 w-10 bg-rose-500 rounded-lg flex items-center justify-center text-white shrink-0">
                  <TrendingDown className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block truncate">Total Outlays</span>
                  <h4 className="text-base font-black text-slate-900 dark:text-white mt-0.5 truncate">
                    ₹{totalExpenses.toLocaleString('en-IN')}
                  </h4>
                </div>
              </div>
            </div>

            {/* List breakdown */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/30 dark:bg-slate-900/30 px-3 py-1">
              {chartData.map((slice, idx) => {
                const isHovered = hoveredSlice?.name === slice.name;
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between py-2 transition-colors cursor-pointer ${
                      isHovered ? 'bg-slate-100/50 dark:bg-slate-800 px-2 rounded-lg -mx-2' : ''
                    }`}
                    onMouseEnter={() => setHoveredSlice({
                      name: slice.name,
                      value: slice.value,
                      percentage: slice.percentage,
                      color: slice.color
                    })}
                    onMouseLeave={() => setHoveredSlice(null)}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: slice.color }} />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-350 truncate">
                        {slice.name}
                      </span>
                      {slice.type === 'income' ? (
                        <span className="text-[9px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.2 rounded dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-400 shrink-0">
                          INFLOW
                        </span>
                      ) : (
                        <span className="text-[9px] font-extrabold uppercase bg-rose-50 text-rose-700 border border-rose-100 px-1.5 py-0.2 rounded dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-455 shrink-0">
                          OUTFLOW
                        </span>
                      )}
                    </div>
                    
                    <div className="text-right flex items-center space-x-3 shrink-0 pl-2">
                      <span className="text-xs font-mono font-extrabold text-slate-900 dark:text-white">
                        ₹{slice.value.toLocaleString('en-IN')}
                      </span>
                      <span className="text-[10px] font-mono text-slate-450 font-bold w-12 text-right">
                        {slice.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      {/* 3. Clinical Productivity & Hours Report */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3 dark:border-slate-800 space-y-2 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <Activity className="h-5 w-5 text-emerald-500" />
            <h3 className="font-bold text-slate-900 dark:text-white">Clinical Productivity & Hours Report</h3>
          </div>
          
          <div className="flex items-center space-x-2 text-xs">
            <div className="flex items-center space-x-1">
              <span className="text-slate-400 font-bold">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-slate-400 font-bold">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-slate-800 dark:text-slate-200 focus:outline-none"
              />
            </div>
            {(fromDate || toDate) && (
              <button
                onClick={() => {
                  setFromDate('');
                  setToDate('');
                }}
                className="text-red-500 hover:text-red-650 font-bold uppercase text-[10px]"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Summary metrics for productivity */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2">
          <div className="bg-slate-50 dark:bg-slate-800/20 p-4 rounded-xl border border-slate-150 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Total Appointments</span>
              <h4 className="text-xl font-black text-slate-900 dark:text-white mt-1">
                {totalAppointmentsCount}
              </h4>
            </div>
            <div className="h-9 w-9 bg-blue-50 dark:bg-blue-950/20 rounded-lg flex items-center justify-center">
              <Activity className="h-5 w-5 text-blue-500" />
            </div>
          </div>
          <div className="bg-slate-50 dark:bg-slate-800/20 p-4 rounded-xl border border-slate-150 dark:border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Total Completed Sessions</span>
              <h4 className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                {totalCompletedSessionsCount}
              </h4>
            </div>
            <div className="h-9 w-9 bg-emerald-50 dark:bg-emerald-950/20 rounded-lg flex items-center justify-center">
              <UserCheck className="h-5 w-5 text-emerald-500" />
            </div>
          </div>
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
                          <span>{formatHours(stats.hours)}</span>
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
        </div>
      )}
    </div>
  );
};
