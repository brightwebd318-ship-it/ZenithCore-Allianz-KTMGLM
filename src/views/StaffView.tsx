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
      
      await dataService.addUser({
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

      // Clear
      setFullName('');
      setEmail('');
      setMedNo('');
      setAuthUserId('');
      setShowAddForm(false);
      
      await dataService.addAuditTrail('FINANCIAL_MUTATION', `Added new staff directory profile: ${fullName}`);
      triggerRefresh();
    } catch (err) {
      console.error(err);
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
                      <span className="text-[10px] bg-slate-50 border border-slate-150 rounded px-2 py-0.5 font-bold uppercase text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
                        {user.position_role}
                      </span>
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
                  <button
                    onClick={() => handleStartEdit(user)}
                    className="mt-4 w-full bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg py-1.5 text-[11px] font-bold transition-all flex items-center justify-center space-x-1"
                  >
                    <Edit2 className="h-3.5 w-3.5 text-brand-500" />
                    <span>Edit Profile Details</span>
                  </button>
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

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Supabase Auth User ID (UUID) - Optional</label>
                <input
                  type="text"
                  value={authUserId}
                  onChange={(e) => setAuthUserId(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  placeholder="45c110da-136b-4e12-b9cf-72b217316719"
                />
                <span className="block text-[10px] text-slate-400 mt-1 leading-normal">
                  Provide this if the staff member needs to log in. Register them first in the Supabase Auth panel and paste their User ID here.
                </span>
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

    </div>
  );
};
