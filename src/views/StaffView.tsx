import React, { useEffect, useState } from 'react';
import { UserCheck, Shield, Plus, Edit2 } from 'lucide-react';
import { dataService } from '../services/dataService';
import type { User as StaffUser } from '../services/dataService';

interface StaffViewProps {
  triggerRefresh: () => void;
  triggerRefreshKey: number;
}

export const StaffView: React.FC<StaffViewProps> = ({ triggerRefresh, triggerRefreshKey }) => {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<StaffUser | null>(null);

  // New Staff member form
  const [showAddForm, setShowAddForm] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'Admin' | 'Senior Therapist' | 'Receptionist'>('Senior Therapist');
  const [medNo, setMedNo] = useState('');
  const [baseSalary, setBaseSalary] = useState(45000);
  const [bonusEnabled, setBonusEnabled] = useState(true);
  const [authUserId, setAuthUserId] = useState('');
  const [authStatuses, setAuthStatuses] = useState<Array<{ id: string; exists: boolean; paused: boolean }>>([]);
  const [createLoginAccount, setCreateLoginAccount] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');

  // Existing staff account creation prompt modal
  const [promptPasswordUser, setPromptPasswordUser] = useState<StaffUser | null>(null);
  const [promptPasswordText, setPromptPasswordText] = useState('');

  // Edit Staff member form
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'Admin' | 'Senior Therapist' | 'Receptionist'>('Senior Therapist');
  const [editMedNo, setEditMedNo] = useState('');
  const [editBaseSalary, setEditBaseSalary] = useState(45000);
  const [editBonusEnabled, setEditBonusEnabled] = useState(true);

  const loadStaffData = async () => {
    try {
      const data = await dataService.getUsers();
      setStaffList(data);
      const curUser = await dataService.getCurrentUser();
      setCurrentUser(curUser);
      if (curUser?.position_role === 'Admin') {
        const statuses = await dataService.getAuthUsersStatus();
        setAuthStatuses(statuses);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaffData();
  }, [triggerRefreshKey]);

  const canManageStaff = currentUser?.can_manage_staff || currentUser?.position_role === 'Admin';

  const handleToggleFlag = async (userId: string, flag: keyof StaffUser) => {
    if (!canManageStaff) {
      alert("Permission denied. Only staff managers or administrators can edit clearances.");
      return;
    }

    const user = staffList.find((u) => u.id === userId);
    if (!user) return;

    try {
      const nextValue = !user[flag];
      const updates = { [flag]: nextValue };
      await dataService.updateUserPermissions(userId, updates);
      await dataService.addAuditTrail('CONSENT_CHANGED', `Updated security clearance '${flag}' to ${nextValue} for staff: ${user.full_name}`);
      triggerRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;

    try {
      // Determine default permissions based on role
      const isAdmin = role === 'Admin';
      const isTherapist = role === 'Senior Therapist';
      
      const createdStaff = await dataService.addUser({
        id: authUserId.trim() || undefined,
        email,
        full_name: fullName,
        position_role: role,
        medical_council_registration_no: medNo,
        can_view_personal_data: true,
        can_view_medical_history: isAdmin || isTherapist,
        can_manage_finance: isAdmin || role === 'Receptionist',
        can_print_generate_invoice: true,
        can_manage_staff: isAdmin,
        base_salary_monthly: baseSalary,
        bonus_system_enabled: bonusEnabled,
        resource_fhir: {
          resourceType: 'Practitioner',
          active: true,
          name: [{ text: fullName }],
        },
      });

      // Optionally create Supabase Auth credentials and link
      if (createLoginAccount && loginPassword.trim()) {
        await dataService.createStaffAuthUser(
          email,
          loginPassword,
          fullName,
          role,
          createdStaff.id
        );
        await dataService.addAuditTrail('FINANCIAL_MUTATION', `Created Supabase login account for new staff: ${fullName}`);
      }

      // Clear
      setFullName('');
      setEmail('');
      setMedNo('');
      setAuthUserId('');
      setCreateLoginAccount(false);
      setLoginPassword('');
      setShowAddForm(false);
      
      await dataService.addAuditTrail('FINANCIAL_MUTATION', `Added new staff directory profile: ${fullName}`);
      triggerRefresh();
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to add staff profile or create login credentials.");
    }
  };

  const handleStartEdit = (user: StaffUser) => {
    setEditingUser(user);
    setEditFullName(user.full_name);
    setEditEmail(user.email);
    setEditRole(user.position_role);
    setEditMedNo(user.medical_council_registration_no || '');
    setEditBaseSalary(user.base_salary_monthly || 0);
    setEditBonusEnabled(!!user.bonus_system_enabled);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await dataService.updateUserPermissions(editingUser.id, {
        full_name: editFullName,
        email: editEmail,
        position_role: editRole,
        medical_council_registration_no: editMedNo,
        base_salary_monthly: editBaseSalary,
        bonus_system_enabled: editBonusEnabled,
      });
      await dataService.addAuditTrail('CONSENT_CHANGED', `Admin edited staff profile details for: ${editFullName}`);
      setEditingUser(null);
      triggerRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center text-slate-900 dark:text-white font-outfit">
          <UserCheck className="h-5 w-5 mr-2 text-brand-500" /> Clinic Staff Directory
        </h2>
        
        {canManageStaff && (
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center bg-brand-500 hover:bg-brand-600 text-white text-xs font-bold px-3.5 py-2 rounded-lg shadow transition-colors"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Directory Profile
          </button>
        )}
      </div>

      {/* Grid of Users */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <p className="text-slate-400 text-sm">Loading clinic directory...</p>
        ) : staffList.length === 0 ? (
          <p className="text-slate-400 text-sm">No profiles found.</p>
        ) : (
          staffList.map((user) => (
            <div
              key={user.id}
              className="bg-white rounded-xl border border-slate-200 shadow-sm dark:bg-[#111827] dark:border-slate-800 p-6 flex flex-col justify-between hover:border-slate-350 transition-colors"
            >
              <div>
                {/* User Header Profile */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3.5">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {user.full_name[0]}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 dark:text-white">{user.full_name}</h4>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        <span className="text-[10px] bg-slate-50 border border-slate-150 rounded px-2 py-0.5 font-bold uppercase text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                          {user.position_role}
                        </span>
                        {currentUser?.position_role === 'Admin' && (() => {
                          const status = authStatuses.find(s => s.id === user.id);
                          if (!status || !status.exists) {
                            return (
                              <span className="text-[10px] bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-500 dark:bg-slate-800/40 dark:border-slate-700 dark:text-slate-400">
                                No Login Account
                              </span>
                            );
                          }
                          if (status.paused) {
                            return (
                              <span className="text-[10px] bg-red-50 border border-red-200 rounded px-1.5 py-0.5 font-bold text-red-600 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400">
                                Paused Account
                              </span>
                            );
                          }
                          return (
                            <span className="text-[10px] bg-emerald-50 border border-emerald-150 rounded px-1.5 py-0.5 font-bold text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400">
                              Active Account
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                  
                  {user.medical_council_registration_no && (
                    <span className="text-[9px] font-mono text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded dark:border-slate-800" title="Medical Registration Number">
                      {user.medical_council_registration_no}
                    </span>
                  )}
                </div>

                <div className="mt-4 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                  <p>Email: <strong className="text-slate-700 dark:text-slate-300">{user.email}</strong></p>
                  <p>Base Salary: <strong className="text-slate-700 dark:text-slate-300">₹{user.base_salary_monthly.toLocaleString('en-IN')}/mo</strong></p>
                  <p>Session Bonus: <strong className="text-slate-700 dark:text-slate-300">{user.bonus_system_enabled ? 'Enabled' : 'Disabled'}</strong></p>
                </div>

                {canManageStaff && (
                  <div className="space-y-1.5">
                    <button
                      onClick={() => handleStartEdit(user)}
                      className="mt-4 w-full bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg py-1.5 text-[11px] font-bold transition-all flex items-center justify-center space-x-1"
                    >
                      <Edit2 className="h-3.5 w-3.5 text-brand-500" />
                      <span>Edit Profile Details</span>
                    </button>
                    
                    {currentUser?.position_role === 'Admin' && (() => {
                      const status = authStatuses.find(s => s.id === user.id);
                      if (!status || !status.exists) {
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setPromptPasswordUser(user);
                              setPromptPasswordText('');
                            }}
                            className="w-full bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-705 rounded-lg py-1.5 text-[11px] font-bold transition-all flex items-center justify-center space-x-1 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-400 dark:hover:bg-blue-900/60"
                          >
                            <span>🔑 Create Account</span>
                          </button>
                        );
                      }
                      if (status.paused) {
                        return (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await dataService.pauseStaffAuthUser(user.id, false);
                                await dataService.addAuditTrail('CONSENT_CHANGED', `Resumed/reactivated login access for staff: ${user.full_name}`);
                                triggerRefresh();
                              } catch (err: any) {
                                alert(err?.message || "Failed to resume account.");
                              }
                            }}
                            className="w-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-705 rounded-lg py-1.5 text-[11px] font-bold transition-all flex items-center justify-center space-x-1 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-400 dark:hover:bg-emerald-900/60"
                          >
                            <span>▶️ Resume Account</span>
                          </button>
                        );
                      }
                      return (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await dataService.pauseStaffAuthUser(user.id, true);
                              await dataService.addAuditTrail('CONSENT_CHANGED', `Suspended/paused login access for staff: ${user.full_name}`);
                              triggerRefresh();
                            } catch (err: any) {
                              alert(err?.message || "Failed to pause account.");
                            }
                          }}
                          className="w-full bg-orange-50 hover:bg-orange-150 border border-orange-250 text-orange-705 rounded-lg py-1.5 text-[11px] font-bold transition-all flex items-center justify-center space-x-1 dark:bg-orange-950/20 dark:border-orange-900/40 dark:text-orange-400 dark:hover:bg-orange-900/60"
                        >
                          <span>⏸️ Pause Account</span>
                        </button>
                      );
                    })()}
                  </div>
                )}

                {/* Security Flags Toggle Matrix */}
                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-500 mb-2">
                    <Shield className="h-4 w-4 text-brand-500" />
                    <span>Access & Security Matrix</span>
                  </div>

                  <div className="space-y-2.5">
                    
                    {/* can_view_personal_data */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Read Demographics</span>
                      <button
                        onClick={() => handleToggleFlag(user.id, 'can_view_personal_data')}
                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none ${
                          !canManageStaff ? 'opacity-50 cursor-not-allowed' : ''
                        } ${
                          user.can_view_personal_data ? 'bg-brand-500' : 'bg-slate-250 dark:bg-slate-700'
                        }`}
                        disabled={!canManageStaff}
                      >
                        <span className={`${user.can_view_personal_data ? 'translate-x-4' : 'translate-x-0.5'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} />
                      </button>
                    </div>

                    {/* can_view_medical_history */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Read Medical Logs</span>
                      <button
                        onClick={() => handleToggleFlag(user.id, 'can_view_medical_history')}
                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none ${
                          !canManageStaff ? 'opacity-50 cursor-not-allowed' : ''
                        } ${
                          user.can_view_medical_history ? 'bg-brand-500' : 'bg-slate-250 dark:bg-slate-700'
                        }`}
                        disabled={!canManageStaff}
                      >
                        <span className={`${user.can_view_medical_history ? 'translate-x-4' : 'translate-x-0.5'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} />
                      </button>
                    </div>

                    {/* can_manage_finance */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Manage Financial Outlays</span>
                      <button
                        onClick={() => handleToggleFlag(user.id, 'can_manage_finance')}
                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none ${
                          !canManageStaff ? 'opacity-50 cursor-not-allowed' : ''
                        } ${
                          user.can_manage_finance ? 'bg-brand-500' : 'bg-slate-250 dark:bg-slate-700'
                        }`}
                        disabled={!canManageStaff}
                      >
                        <span className={`${user.can_manage_finance ? 'translate-x-4' : 'translate-x-0.5'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} />
                      </button>
                    </div>

                    {/* can_print_generate_invoice */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Generate Invoices</span>
                      <button
                        onClick={() => handleToggleFlag(user.id, 'can_print_generate_invoice')}
                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none ${
                          !canManageStaff ? 'opacity-50 cursor-not-allowed' : ''
                        } ${
                          user.can_print_generate_invoice ? 'bg-brand-500' : 'bg-slate-250 dark:bg-slate-700'
                        }`}
                        disabled={!canManageStaff}
                      >
                        <span className={`${user.can_print_generate_invoice ? 'translate-x-4' : 'translate-x-0.5'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} />
                      </button>
                    </div>

                    {/* can_manage_staff */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Manage Staff & Clearances</span>
                      <button
                        onClick={() => handleToggleFlag(user.id, 'can_manage_staff')}
                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none ${
                          !canManageStaff ? 'opacity-50 cursor-not-allowed' : ''
                        } ${
                          user.can_manage_staff ? 'bg-brand-500' : 'bg-slate-250 dark:bg-slate-700'
                        }`}
                        disabled={!canManageStaff}
                      >
                        <span className={`${user.can_manage_staff ? 'translate-x-4' : 'translate-x-0.5'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} />
                      </button>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Staff modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md dark:bg-slate-900 dark:border-slate-800 overflow-hidden animate-in fade-in">
            <div className="bg-brand-500 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">Add Staff Directory Profile</h3>
              <button onClick={() => setShowAddForm(false)} className="text-white/85 hover:text-white text-xs font-semibold">Close</button>
            </div>
            
            <form onSubmit={handleAddStaff} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  placeholder="Dr. Ananya Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  placeholder="ananya@zenithcore.com"
                />
              </div>

              <div className="border border-slate-150 dark:border-slate-800 rounded-lg p-3.5 bg-slate-50 dark:bg-slate-900/40 space-y-3.5">
                <div className="flex items-center space-x-2">
                  <input
                    id="createLoginAccountCheck"
                    type="checkbox"
                    checked={createLoginAccount}
                    onChange={(e) => setCreateLoginAccount(e.target.checked)}
                    className="h-4 w-4 text-brand-500 rounded border-slate-300 bg-white"
                  />
                  <label htmlFor="createLoginAccountCheck" className="text-xs font-bold text-slate-700 dark:text-slate-305">
                    Create Supabase Login Account Automatically
                  </label>
                </div>
                
                {createLoginAccount && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Account Login Password</label>
                    <input
                      type="password"
                      required={createLoginAccount}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-850 dark:text-slate-200"
                      placeholder="••••••••"
                      minLength={6}
                    />
                    <span className="block text-[10px] text-slate-400 mt-1 leading-normal">
                      Must be at least 6 characters. Credentials will be created in Supabase Auth instantly.
                    </span>
                  </div>
                )}
                
                {!createLoginAccount && (
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Or Link Pre-existing Auth User ID (UUID)</label>
                    <input
                      type="text"
                      value={authUserId}
                      onChange={(e) => setAuthUserId(e.target.value)}
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                      placeholder="45c110da-136b-4e12-b9cf-72b217316719"
                    />
                    <span className="block text-[10px] text-slate-400 mt-1 leading-normal">
                      Optional manual linkage to an already existing user in your Supabase Auth dashboard.
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Position / Role</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as any)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-850 dark:text-slate-200"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Senior Therapist">Senior Therapist</option>
                    <option value="Receptionist">Receptionist</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Medical Registration #</label>
                  <input
                    type="text"
                    value={medNo}
                    onChange={(e) => setMedNo(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    placeholder="IMR/KAR-283910"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monthly Salary (₹)</label>
                  <input
                    type="number"
                    min={1000}
                    required
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(parseInt(e.target.value) || 0)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-850 dark:text-slate-200"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-5">
                  <input
                    id="bonusCheck"
                    type="checkbox"
                    checked={bonusEnabled}
                    onChange={(e) => setBonusEnabled(e.target.checked)}
                    className="h-4 w-4 text-brand-500 rounded border-slate-300 bg-white"
                  />
                  <label htmlFor="bonusCheck" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Session Bonuses</label>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow"
                >
                  Create Directory Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md dark:bg-slate-900 dark:border-slate-800 overflow-hidden animate-in fade-in">
            <div className="bg-brand-500 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">Edit Staff Directory Profile</h3>
              <button onClick={() => setEditingUser(null)} className="text-white/85 hover:text-white text-xs font-semibold">Close</button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  placeholder="Dr. Ananya Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  placeholder="ananya@zenithcore.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Position / Role</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-850 dark:text-slate-200"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Senior Therapist">Senior Therapist</option>
                    <option value="Receptionist">Receptionist</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Medical Registration #</label>
                  <input
                    type="text"
                    value={editMedNo}
                    onChange={(e) => setEditMedNo(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    placeholder="IMR/KAR-283910"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Monthly Salary (₹)</label>
                  <input
                    type="number"
                    min={1000}
                    required
                    value={editBaseSalary}
                    onChange={(e) => setEditBaseSalary(parseInt(e.target.value) || 0)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-850 dark:text-slate-200"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-5">
                  <input
                    id="editBonusCheck"
                    type="checkbox"
                    checked={editBonusEnabled}
                    onChange={(e) => setEditBonusEnabled(e.target.checked)}
                    className="h-4 w-4 text-brand-500 rounded border-slate-300 bg-white"
                  />
                  <label htmlFor="editBonusCheck" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Session Bonuses</label>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold shadow"
                >
                  Save Profile Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Existing Staff Password Prompt Modal */}
      {promptPasswordUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md dark:bg-slate-900 dark:border-slate-800 overflow-hidden animate-in fade-in">
            <div className="bg-brand-500 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">Create Login Account for {promptPasswordUser.full_name}</h3>
              <button onClick={() => setPromptPasswordUser(null)} className="text-white/85 hover:text-white text-xs font-semibold">Close</button>
            </div>
            
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!promptPasswordText.trim()) return;
                try {
                  await dataService.createStaffAuthUser(
                    promptPasswordUser.email,
                    promptPasswordText,
                    promptPasswordUser.full_name,
                    promptPasswordUser.position_role,
                    promptPasswordUser.id
                  );
                  await dataService.addAuditTrail('FINANCIAL_MUTATION', `Created Supabase login account for existing staff: ${promptPasswordUser.full_name}`);
                  setPromptPasswordUser(null);
                  setPromptPasswordText('');
                  triggerRefresh();
                } catch (err: any) {
                  alert(err?.message || "Failed to create Supabase auth account.");
                }
              }}
              className="p-6 space-y-4"
            >
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal mb-3">
                  This will generate new credentials in Supabase Auth linked to the email <strong>{promptPasswordUser.email}</strong>. The user will be able to log in using this password immediately.
                </p>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Set Password</label>
                <input
                  type="password"
                  required
                  value={promptPasswordText}
                  onChange={(e) => setPromptPasswordText(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-850 dark:text-slate-200"
                  placeholder="••••••••"
                  minLength={6}
                />
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setPromptPasswordUser(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold shadow"
                >
                  Create login credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
