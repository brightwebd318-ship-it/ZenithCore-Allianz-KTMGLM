import React, { useEffect, useState } from 'react';
import {
  Banknote,
  Clock,
  Calendar,
  Coins,
  Award,
  CheckCircle,
  TrendingUp,
  User,
  ShieldAlert
} from 'lucide-react';
import { dataService } from '../services/dataService';
import type { User as StaffUser, Tenant, BusinessExpense } from '../services/dataService';

interface SalaryViewProps {
  triggerRefresh: () => void;
  triggerRefreshKey: number;
}

export const SalaryView: React.FC<SalaryViewProps> = ({ triggerRefresh, triggerRefreshKey }) => {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [expenses, setExpenses] = useState<BusinessExpense[]>([]);

  // Month select state (YYYY-MM format, defaulting to June 2026 based on workspace time context)
  const [targetMonth, setTargetMonth] = useState('2026-06');

  // Hour Threshold Settings State
  const [thresholdInput, setThresholdInput] = useState(100);
  const [savingThreshold, setSavingThreshold] = useState(false);

  // Global Bonus Mode Toggle state
  const [globalBonusMode, setGlobalBonusMode] = useState(true);

  // Computed payroll details per staff
  const [payrollDetails, setPayrollDetails] = useState<Record<string, {
    base_salary: number;
    sessions_conducted: number;
    clinical_hours: number;
    bonus_multiplier: number;
    computed_bonus: number;
    total_payout: number;
  }>>({});

  const loadSalaryData = async () => {
    setLoading(true);
    try {
      const curUser = await dataService.getCurrentUser();
      setCurrentUser(curUser);

      const curTenant = await dataService.getTenant();
      setTenant(curTenant);
      if (curTenant && curTenant.bonus_threshold_hours !== undefined) {
        setThresholdInput(curTenant.bonus_threshold_hours);
      }

      const exps = await dataService.getExpenses();
      setExpenses(exps);

      const staff = await dataService.getUsers();
      setStaffList(staff);

      // Fetch payout details for each staff member for the target month
      const details: typeof payrollDetails = {};
      for (const member of staff) {
        try {
          const res = await dataService.calculateMonthlyPayout(member.id, targetMonth);
          details[member.id] = res;
        } catch (err) {
          console.error(`Failed to calculate payout for user ${member.id}:`, err);
        }
      }
      setPayrollDetails(details);
    } catch (err) {
      console.error('Failed to load salary view data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSalaryData();
  }, [triggerRefreshKey, targetMonth]);

  const canManageStaff = currentUser?.can_manage_staff || currentUser?.position_role === 'Admin';

  // Toggle individual bonus system eligibility
  const handleToggleBonusSystem = async (userId: string, currentVal: boolean) => {
    if (!canManageStaff) {
      alert("Permission denied. Only staff managers or administrators can edit bonus configurations.");
      return;
    }

    try {
      await dataService.updateUserPermissions(userId, {
        bonus_system_enabled: !currentVal
      });
      await dataService.addAuditTrail(
        'FINANCIAL_MUTATION',
        `Toggled individual bonus system eligibility for user: ${staffList.find(u => u.id === userId)?.full_name} to ${!currentVal}`
      );
      triggerRefresh();
    } catch (err) {
      console.error("Failed to toggle user bonus eligibility:", err);
    }
  };

  // Save modified hour threshold
  const handleSaveThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageStaff) return;
    setSavingThreshold(true);
    try {
      await dataService.updateTenant({ bonus_threshold_hours: thresholdInput });
      await dataService.addAuditTrail(
        'FINANCIAL_MUTATION',
        `Updated clinic monthly salary bonus hours threshold to ${thresholdInput} hours`
      );
      triggerRefresh();
    } catch (err) {
      console.error("Failed to update bonus threshold hours:", err);
    } finally {
      setSavingThreshold(false);
    }
  };

  // Record salary payment into expenses
  const handleRecordPayment = async (member: StaffUser, amount: number) => {
    if (!canManageStaff) return;
    
    const formattedAmount = amount.toLocaleString('en-IN');
    const confirmPay = window.confirm(`Confirm recording salary payout of ₹${formattedAmount} to ${member.full_name} for ${targetMonth}?`);
    if (!confirmPay) return;

    try {
      // Determine last day of target month for expense date alignment
      const [year, month] = targetMonth.split('-');
      const lastDay = new Date(parseInt(year), parseInt(month), 0).getDate();
      const expenseDate = `${targetMonth}-${String(lastDay).padStart(2, '0')}`;

      await dataService.addExpense({
        expense_name: `Salary Payout - ${member.full_name} (${targetMonth})`,
        amount: amount,
        category: 'Salaries',
        expense_date: expenseDate,
        attachment_size_bytes: 0
      });

      await dataService.addAuditTrail(
        'FINANCIAL_MUTATION',
        `Recorded salary payment of ₹${amount} to ${member.full_name} for the month of ${targetMonth}`
      );

      triggerRefresh();
    } catch (err) {
      console.error("Failed to record salary payment:", err);
    }
  };

  // Filter staff whose DOJ (created_at) is at or before the selected targetMonth
  const visibleStaff = staffList.filter((member) => {
    if (!member.created_at) return true;
    const dojMonth = member.created_at.substring(0, 7); // "YYYY-MM"
    return targetMonth >= dojMonth;
  });

  // Calculations for KPI Cards
  let totalBaseSalary = 0;
  let totalClinicalHours = 0;
  let totalSessions = 0;
  let totalBonusValue = 0;
  let totalPayoutValue = 0;

  visibleStaff.forEach((member) => {
    const details = payrollDetails[member.id];
    if (details) {
      totalBaseSalary += details.base_salary;
      totalClinicalHours += details.clinical_hours;
      totalSessions += details.sessions_conducted;
      
      // Calculate bonus based on global toggle and individual flag
      const bonusForMember = (globalBonusMode && member.bonus_system_enabled) ? details.computed_bonus : 0;
      totalBonusValue += bonusForMember;
      totalPayoutValue += details.base_salary + bonusForMember;
    }
  });

  return (
    <div className="space-y-6">
      
      {/* 1. View Header with Month & Global Toggle */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-white rounded-xl border border-slate-200 p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-4 md:space-y-0">
        <div className="flex items-center space-x-3">
          <div className="h-10 w-10 bg-brand-500/10 text-brand-500 rounded-lg flex items-center justify-center dark:bg-brand-500/20">
            <Banknote className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white font-outfit">
              Staff Salary Ledger
            </h2>
            <p className="text-xs text-slate-405 dark:text-slate-400">
              Calculate base pay, therapist clinical time bonuses, and track overall monthly outlays.
            </p>
          </div>
        </div>

        {/* Filters and Toggle */}
        <div className="flex flex-wrap items-center gap-4">
          
          {/* Hours Limit Threshold config (Admins only) */}
          {canManageStaff && (
            <form onSubmit={handleSaveThreshold} className="flex items-center space-x-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg">
              <span className="text-xs font-bold text-slate-500 uppercase">Limit:</span>
              <input
                type="number"
                min={0}
                max={500}
                value={thresholdInput}
                onChange={(e) => setThresholdInput(parseInt(e.target.value) || 0)}
                className="w-12 rounded border border-slate-250 px-1 py-0.5 text-center text-xs bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
              />
              <span className="text-[11px] font-semibold text-slate-400">hrs</span>
              <button
                type="submit"
                disabled={savingThreshold}
                className="text-[10px] bg-brand-500 hover:bg-brand-600 text-white font-bold px-2 py-0.5 rounded transition-all shadow-xs"
              >
                {savingThreshold ? '...' : 'Save'}
              </button>
            </form>
          )}

          {/* Target Month Input */}
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-slate-450 dark:text-slate-400" />
            <input
              type="month"
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              className="rounded border border-slate-200 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
            />
          </div>

          {/* Global Bonus Mode Toggle */}
          <div className="flex items-center space-x-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg">
            <span className="text-xs font-bold text-slate-655 dark:text-slate-300 flex items-center space-x-1">
              <Award className="h-4 w-4 text-amber-500" />
              <span>Bonus Mode Toggle</span>
            </span>
            <button
              onClick={() => {
                setGlobalBonusMode(!globalBonusMode);
                dataService.addAuditTrail(
                  'FINANCIAL_MUTATION',
                  `Switched global session bonus mode to ${!globalBonusMode}`
                ).catch(err => console.error(err));
              }}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                globalBonusMode ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
              }`}
              id="bonus-mode-toggle"
            >
              <span
                className={`${
                  globalBonusMode ? 'translate-x-6' : 'translate-x-1'
                } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
              />
            </button>
            <span className={`text-[10px] font-bold ${globalBonusMode ? 'text-emerald-500' : 'text-slate-400'}`}>
              {globalBonusMode ? 'ACTIVE' : 'MUTED'}
            </span>
          </div>
        </div>
      </div>

      {/* 2. KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Payroll Cost */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm dark:bg-[#111827] dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase dark:text-slate-400">Total Payroll Cost</span>
            <Coins className="h-5 w-5 text-brand-500" />
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit">
              ₹{totalPayoutValue.toLocaleString('en-IN')}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">
              For {new Date(targetMonth + '-02').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>

        {/* Total Base Salary */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm dark:bg-[#111827] dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase dark:text-slate-400">Base Salary Commitments</span>
            <Banknote className="h-5 w-5 text-indigo-500" />
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit">
              ₹{totalBaseSalary.toLocaleString('en-IN')}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">
              Guaranteed fixed outlays
            </p>
          </div>
        </div>

        {/* Total Session Bonus Pool */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm dark:bg-[#111827] dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase dark:text-slate-400">Computed Bonuses</span>
            <Award className="h-5 w-5 text-amber-500 animate-pulse" />
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit">
              ₹{totalBonusValue.toLocaleString('en-IN')}
            </h3>
            <p className="text-[10px] text-slate-400 mt-1">
              {globalBonusMode ? 'Calculated into total payouts' : 'Muted (Bonus Mode is Off)'}
            </p>
          </div>
        </div>

        {/* Clinical Hours Completed */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm dark:bg-[#111827] dark:border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-450 uppercase dark:text-slate-400">Conducted Clinical Time</span>
            <Clock className="h-5 w-5 text-teal-500" />
          </div>
          <div className="mt-2.5">
            <h3 className="text-2xl font-black text-slate-900 dark:text-white font-outfit">
              {totalClinicalHours.toFixed(1)} hrs
            </h3>
            <p className="text-[10px] text-slate-400 mt-1 flex items-center space-x-1">
              <TrendingUp className="h-3 w-3 text-emerald-500" />
              <span>Conducted in {totalSessions} completed slots</span>
            </p>
          </div>
        </div>
      </div>

      {/* 3. Staff Payout Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm dark:bg-[#111827] dark:border-slate-800 overflow-hidden">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Individual Monthly Payroll Breakdown</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">List of clinic employees, clinical contributions, and final outlays.</p>
          </div>
          {!canManageStaff && (
            <div className="flex items-center space-x-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-3 py-1 rounded-lg font-semibold">
              <ShieldAlert className="h-4 w-4" />
              <span>Read-Only Access</span>
            </div>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-250 dark:bg-slate-850 dark:border-slate-800">
                <th className="px-5 py-4">Staff Member</th>
                <th className="px-5 py-4">Position</th>
                <th className="px-5 py-4 text-right">Base Salary</th>
                <th className="px-5 py-4 text-center">Completed Sessions</th>
                <th className="px-5 py-4 text-center">Clinical Hours</th>
                <th className="px-5 py-4 text-center">Bonus System</th>
                <th className="px-5 py-4 text-right">Hourly Bonus</th>
                <th className="px-5 py-4 text-right font-extrabold text-slate-900 dark:text-white">Total Payout</th>
                <th className="px-5 py-4 text-center">Payment Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-350">
              {loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400 italic">Recalculating ledger records...</td>
                </tr>
              ) : visibleStaff.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400 italic">No staff profiles found.</td>
                </tr>
              ) : (
                visibleStaff.map((member) => {
                  const details = payrollDetails[member.id] || {
                    base_salary: member.base_salary_monthly || 0,
                    sessions_conducted: 0,
                    clinical_hours: 0,
                    bonus_multiplier: member.bonus_system_enabled ? Math.round((member.base_salary_monthly || 0) / 100) : 0,
                    computed_bonus: 0,
                    total_payout: member.base_salary_monthly || 0,
                  };

                  // Determine session bonus based on global status and employee status
                  const isEligible = member.bonus_system_enabled;
                  const bonusPayout = (globalBonusMode && isEligible) ? details.computed_bonus : 0;
                  const finalPayout = details.base_salary + bonusPayout;

                  // Paid status calculation
                  const payoutLabel = `Salary Payout - ${member.full_name} (${targetMonth})`;
                  const matchedExpense = expenses.find((exp) => {
                    return exp.category === 'Salaries' && exp.expense_name === payoutLabel;
                  });

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/10 transition-colors">
                      {/* Staff Identity */}
                      <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">
                        <div className="flex items-center space-x-3">
                          <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300 text-xs">
                            {member.full_name[0].toUpperCase()}
                          </div>
                          <div>
                            <span className="block font-bold">{member.full_name}</span>
                            <span className="block text-[9px] text-slate-400 font-mono truncate max-w-[150px]">{member.email}</span>
                          </div>
                        </div>
                      </td>

                      {/* Position */}
                      <td className="px-5 py-4 font-semibold">
                        <span className="px-2 py-0.5 bg-slate-50 border border-slate-150 rounded text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 text-[10px] font-bold">
                          {member.position_role}
                        </span>
                      </td>

                      {/* Base Salary */}
                      <td className="px-5 py-4 text-right font-mono font-bold">
                        ₹{details.base_salary.toLocaleString('en-IN')}
                      </td>

                      {/* Done Sessions */}
                      <td className="px-5 py-4 text-center font-bold">
                        <span className="bg-slate-50 border border-slate-150 text-slate-650 dark:bg-slate-800/50 dark:border-slate-700 dark:text-slate-400 px-2 py-0.5 rounded-full font-mono">
                          {details.sessions_conducted}
                        </span>
                      </td>

                      {/* Clinical Hours */}
                      <td className="px-5 py-4 text-center font-semibold font-mono text-slate-600 dark:text-slate-300">
                        {details.clinical_hours.toFixed(1)} hrs
                      </td>

                      {/* Individual Bonus Toggle switch */}
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => handleToggleBonusSystem(member.id, isEligible)}
                          className={`relative inline-flex h-4.5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                            !canManageStaff ? 'opacity-50 cursor-not-allowed' : ''
                          } ${
                            isEligible ? 'bg-amber-500' : 'bg-slate-250 dark:bg-slate-700'
                          }`}
                          disabled={!canManageStaff}
                          title={isEligible ? 'Bonus System Enabled' : 'Bonus System Disabled'}
                        >
                          <span className={`${isEligible ? 'translate-x-4.5' : 'translate-x-0.5'} inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform`} />
                        </button>
                      </td>

                      {/* Hourly Bonus Payout */}
                      <td className="px-5 py-4 text-right font-mono font-bold text-slate-500 dark:text-slate-400">
                        {bonusPayout > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-450">+₹{bonusPayout.toLocaleString('en-IN')}</span>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600">₹0</span>
                        )}
                      </td>

                      {/* Total Payout */}
                      <td className={`px-5 py-4 text-right font-mono font-extrabold bg-slate-50/20 dark:bg-slate-800/10 text-sm ${
                        matchedExpense ? 'text-emerald-600 dark:text-emerald-400 font-black' : 'text-slate-900 dark:text-white'
                      }`}>
                        ₹{finalPayout.toLocaleString('en-IN')}
                      </td>

                      {/* Payment Status Action */}
                      <td className="px-5 py-4 text-center">
                        {matchedExpense ? (
                          <span className="inline-flex items-center space-x-1 text-[10px] text-emerald-700 dark:text-emerald-405 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-1 rounded-lg font-bold border border-emerald-200 dark:border-emerald-900/30">
                            <CheckCircle className="h-3 w-3 text-emerald-500" />
                            <span>Paid ({matchedExpense.expense_date})</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => handleRecordPayment(member, finalPayout)}
                            disabled={!canManageStaff}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold text-white shadow transition-all ${
                              canManageStaff
                                ? 'bg-brand-500 hover:bg-brand-600 shadow-brand-500/10'
                                : 'bg-slate-350 dark:bg-slate-700 cursor-not-allowed opacity-50 shadow-none'
                            }`}
                          >
                            Pay Salary
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* 4. Footnote Policy Info */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 dark:bg-slate-900/30 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-start space-x-2.5">
        <span className="text-base">💡</span>
        <div className="leading-relaxed">
          <p className="font-bold text-slate-700 dark:text-slate-300 mb-0.5">Clinic Payroll & Session Bonus Policy</p>
          <p>
            Therapists earn an hourly bonus based on clinical time worked above a threshold of <strong>{tenant?.bonus_threshold_hours || 100} hours</strong>. 
            The hourly rate is computed as <strong>1% of their base monthly salary</strong> (e.g. ₹600/hr for ₹60,000 base pay). 
            Only appointments marked as <strong>Completed/Done</strong> status contribute to clinical time calculations. 
            Admins can toggle the global "Bonus Mode Toggle" to enable/disable bonus additions, and can record salary payments directly into the clinic's expenses log.
          </p>
        </div>
      </div>

    </div>
  );
};
