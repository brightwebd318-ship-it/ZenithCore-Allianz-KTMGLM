import React, { useEffect, useState } from 'react';
import { UserCheck, Shield, Plus, Edit2, Trash2, MoreVertical, Settings } from 'lucide-react';
import { dataService } from '../services/dataService';
import type { User as StaffUser } from '../services/dataService';

interface StaffViewProps {
  triggerRefresh: () => void;
  triggerRefreshKey: number;
  currentUser: StaffUser | null;
}

export const StaffView: React.FC<StaffViewProps> = ({ triggerRefresh, triggerRefreshKey, currentUser }) => {
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Status filter state
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Paused' | 'Inactive'>('All');

  // New Staff member form
  const [showAddForm, setShowAddForm] = useState(false);
  const [tabsExpanded, setTabsExpanded] = useState(false);
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
  const [selectedTabs, setSelectedTabs] = useState<string[]>(['Dashboard', 'Patients', 'Appointments', 'Tasks', 'Reports']);

  // Mobile, Aadhaar, Address, and Emergency Contact State hooks
  const [mobileNumber, setMobileNumber] = useState('');
  const [address, setAddress] = useState('');
  const [aadhaar, setAadhaar] = useState('');
  const [primaryContactName, setPrimaryContactName] = useState('');
  const [primaryContactPhone, setPrimaryContactPhone] = useState('');

  // Existing staff account creation prompt modal
  const [promptPasswordUser, setPromptPasswordUser] = useState<StaffUser | null>(null);
  const [promptPasswordText, setPromptPasswordText] = useState('');

  // Dropdown & Modal states
  const [openDropdownStaffId, setOpenDropdownStaffId] = useState<string | null>(null);
  const [securityModalUser, setSecurityModalUser] = useState<StaffUser | null>(null);

  // Edit Staff member form
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'Admin' | 'Senior Therapist' | 'Receptionist'>('Senior Therapist');
  const [editMedNo, setEditMedNo] = useState('');
  const [editBaseSalary, setEditBaseSalary] = useState(45000);
  const [editBonusEnabled, setEditBonusEnabled] = useState(true);

  // Edit Mobile, Aadhaar, Address, and Emergency Contact State hooks
  const [editMobileNumber, setEditMobileNumber] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editAadhaar, setEditAadhaar] = useState('');
  const [editPrimaryContactName, setEditPrimaryContactName] = useState('');
  const [editPrimaryContactPhone, setEditPrimaryContactPhone] = useState('');

  const loadStaffData = async () => {
    try {
      const data = await dataService.getUsers();
      setStaffList(data);
      if (currentUser?.position_role === 'Admin') {
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

  const handleToggleActive = async (userId: string) => {
    if (!canManageStaff) {
      alert("Permission denied. Only staff managers or administrators can edit clearances.");
      return;
    }

    const user = staffList.find((u) => u.id === userId);
    if (!user) return;

    try {
      const currentActive = user.resource_fhir?.active !== false;
      const nextActive = !currentActive;
      const updatedResourceFhir = {
        ...(user.resource_fhir || {}),
        active: nextActive,
      };
      
      await dataService.updateUserPermissions(userId, { resource_fhir: updatedResourceFhir });
      await dataService.addAuditTrail('CONSENT_CHANGED', `Marked staff member ${user.full_name} as ${nextActive ? 'Active' : 'Inactive (No longer valid)'}`);
      triggerRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const defaultTabsForRole = (roleName: string) => {
    if (roleName === 'Admin') {
      return ['Dashboard', 'Patients', 'Appointments', 'Tasks', 'Salary', 'Billing', 'Inventory', 'Staff', 'Reports'];
    } else if (roleName === 'Senior Therapist') {
      return ['Dashboard', 'Patients', 'Appointments', 'Tasks', 'Reports'];
    } else {
      return ['Dashboard', 'Patients', 'Appointments', 'Tasks', 'Billing', 'Inventory'];
    }
  };

  const handleToggleTab = async (userId: string, tabName: string) => {
    if (!canManageStaff) {
      alert("Permission denied. Only staff managers or administrators can edit clearances.");
      return;
    }

    const user = staffList.find((u) => u.id === userId);
    if (!user) return;

    const currentResource = user.resource_fhir || {};
    const currentTabs: string[] = currentResource.enabled_tabs || defaultTabsForRole(user.position_role);

    let newTabs: string[];
    if (currentTabs.includes(tabName)) {
      newTabs = currentTabs.filter((t) => t !== tabName);
    } else {
      newTabs = [...currentTabs, tabName];
    }

    const updatedResource = {
      ...currentResource,
      enabled_tabs: newTabs,
    };

    try {
      await dataService.updateUserPermissions(userId, {
        resource_fhir: updatedResource,
      });
      await dataService.addAuditTrail(
        'CONSENT_CHANGED',
        `Updated tab visibility for staff ${user.full_name}. Enabled tabs: ${newTabs.join(', ')}`
      );
      triggerRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteStaff = async (userId: string, name: string) => {
    if (!canManageStaff) {
      alert("Permission denied. Only staff managers or administrators can delete records.");
      return;
    }

    if (!confirm(`Are you absolutely sure you want to delete ${name}? This will remove their clinical profile and credentials permanently.`)) {
      return;
    }

    try {
      await dataService.deleteStaffUser(userId);
      await dataService.addAuditTrail('CONSENT_CHANGED', `Deleted staff directory profile and login credentials for: ${name}`);
      triggerRefresh();
    } catch (err: any) {
      alert(err.message || "Failed to delete staff member.");
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
        can_manage_attendance: isAdmin || role === 'Receptionist',
        base_salary_monthly: baseSalary,
        bonus_system_enabled: bonusEnabled,
        resource_fhir: {
          resourceType: 'Practitioner',
          active: true,
          name: [{ text: fullName }],
          enabled_tabs: selectedTabs,
          mobile: mobileNumber,
          address: address,
          aadhaar: aadhaar,
          primary_contact_name: primaryContactName,
          primary_contact_phone: primaryContactPhone,
        },
      });

      // Optionally create Supabase Auth credentials and link
      let finalUserId = createdStaff.id;
      if (createLoginAccount && loginPassword.trim()) {
        const newId = await dataService.createStaffAuthUser(
          email,
          loginPassword,
          fullName,
          role,
          createdStaff.id
        );
        finalUserId = newId;
        await dataService.addAuditTrail('FINANCIAL_MUTATION', `Created Supabase login account for new staff: ${fullName}`);
        
        // Optimistically update auth statuses
        setAuthStatuses((prev) => [
          ...prev.filter(s => s.id !== createdStaff.id && s.id !== newId),
          { id: newId, exists: true, paused: false }
        ]);
      }

      // Clear
      setFullName('');
      setEmail('');
      setMedNo('');
      setAuthUserId('');
      setCreateLoginAccount(false);
      setLoginPassword('');
      setShowAddForm(false);
      setMobileNumber('');
      setAddress('');
      setAadhaar('');
      setPrimaryContactName('');
      setPrimaryContactPhone('');
      
      await dataService.addAuditTrail('FINANCIAL_MUTATION', `Added new staff directory profile: ${fullName}`);
      
      // Optimistically update the user list with the new ID
      const updatedStaff = { ...createdStaff, id: finalUserId };
      setStaffList((prev) => [
        ...prev.filter(u => u.id !== createdStaff.id),
        updatedStaff
      ]);

      setTimeout(() => {
        triggerRefresh();
      }, 500);
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

    // Read details from user profile JSON
    const fhir = user.resource_fhir || {};
    setEditMobileNumber(fhir.mobile || '');
    setEditAddress(fhir.address || '');
    setEditAadhaar(fhir.aadhaar || '');
    setEditPrimaryContactName(fhir.primary_contact_name || '');
    setEditPrimaryContactPhone(fhir.primary_contact_phone || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const updatedResource = {
        ...(editingUser.resource_fhir || {}),
        name: [{ text: editFullName }],
        mobile: editMobileNumber,
        address: editAddress,
        aadhaar: editAadhaar,
        primary_contact_name: editPrimaryContactName,
        primary_contact_phone: editPrimaryContactPhone,
      };

      await dataService.updateUserPermissions(editingUser.id, {
        full_name: editFullName,
        email: editEmail,
        position_role: editRole,
        medical_council_registration_no: editMedNo,
        base_salary_monthly: editBaseSalary,
        bonus_system_enabled: editBonusEnabled,
        resource_fhir: updatedResource,
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

      {/* Filters Toolbar */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-50 border border-slate-200/80 p-2 rounded-xl dark:bg-slate-900/50 dark:border-slate-800">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider pl-2 mr-2">Filter Accounts:</span>
        {(['All', 'Active', 'Paused', 'Inactive'] as const).map((filter) => {
          const isActive = statusFilter === filter;
          return (
            <button
              key={filter}
              onClick={() => setStatusFilter(filter)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-xs ${
                isActive
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-350 dark:hover:bg-slate-750'
              }`}
            >
              {filter}
            </button>
          );
        })}
      </div>

      {/* Grid of Users */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {loading ? (
          <p className="text-slate-400 text-sm">Loading clinic directory...</p>
        ) : staffList.length === 0 ? (
          <p className="text-slate-400 text-sm">No profiles found.</p>
        ) : (
          (() => {
            const filteredStaff = staffList.filter((user) => {
              const status = authStatuses.find((s) => s.id === user.id);
              const isPaused = status?.paused === true;
              const isActiveVal = user.resource_fhir?.active !== false;

              if (statusFilter === 'Active') {
                return isActiveVal && !isPaused;
              }
              if (statusFilter === 'Paused') {
                return isPaused && isActiveVal;
              }
              if (statusFilter === 'Inactive') {
                return !isActiveVal;
              }
              return true; // All
            });

            if (filteredStaff.length === 0) {
              return (
                <div className="col-span-full text-center py-12 border border-slate-200 border-dashed rounded-xl bg-white dark:bg-[#111827] dark:border-slate-800">
                  <p className="text-slate-400 text-xs">No staff accounts match the selected filter.</p>
                </div>
              );
            }

            return filteredStaff.map((user) => {
              const isActiveVal = user.resource_fhir?.active !== false;

              return (
                <div
                  key={user.id}
                  className={`bg-white rounded-xl border shadow-sm dark:bg-[#111827] p-6 flex flex-col justify-between hover:border-slate-350 transition-colors ${
                    !isActiveVal
                      ? 'opacity-55 grayscale border-slate-200 bg-slate-50/50 dark:opacity-40 dark:border-slate-850'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div>
                    {/* User Header Profile */}
                    <div className="flex items-start justify-between relative">
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
                            {!isActiveVal && (
                              <span className="text-[10px] bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-bold text-slate-500 dark:bg-slate-800/40 dark:border-slate-700 dark:text-slate-400">
                                Inactive
                              </span>
                            )}
                            {isActiveVal && currentUser?.position_role === 'Admin' && (() => {
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
                                <span className="text-[10px] bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5 font-bold text-emerald-600 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-400">
                                  Active Account
                                </span>
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {/* Dropdown Options Button */}
                      {canManageStaff && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setOpenDropdownStaffId(openDropdownStaffId === user.id ? null : user.id)}
                            className="p-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-500 transition-colors dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                            title="Staff options"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {openDropdownStaffId === user.id && (
                            <div className="absolute right-0 mt-1.5 w-44 rounded-lg border border-slate-200 bg-white shadow-xl py-1 z-20 dark:bg-slate-950 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-350">
                              <button
                                type="button"
                                onClick={() => {
                                  handleStartEdit(user);
                                  setOpenDropdownStaffId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center space-x-1.5"
                              >
                                <Edit2 className="h-3 w-3 text-brand-500" />
                                <span>Edit Profile Details</span>
                              </button>

                              {/* Only visible to Admin */}
                              {currentUser?.position_role === 'Admin' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSecurityModalUser(user);
                                    setOpenDropdownStaffId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center space-x-1.5"
                                >
                                  <Shield className="h-3 w-3 text-indigo-500" />
                                  <span>Access & Security</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  handleToggleActive(user.id);
                                  setOpenDropdownStaffId(null);
                                }}
                                className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center space-x-1.5"
                              >
                                <span>{isActiveVal ? '🚫 Mark Inactive' : '✅ Mark Active'}</span>
                              </button>

                              {isActiveVal && (() => {
                                const status = authStatuses.find(s => s.id === user.id);
                                if (!status || !status.exists) {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setPromptPasswordUser(user);
                                        setPromptPasswordText('');
                                        setOpenDropdownStaffId(null);
                                      }}
                                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center space-x-1.5"
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
                                        setOpenDropdownStaffId(null);
                                        try {
                                          await dataService.pauseStaffAuthUser(user.id, false);
                                          await dataService.addAuditTrail('CONSENT_CHANGED', `Resumed/reactivated login access for staff: ${user.full_name}`);
                                          triggerRefresh();
                                        } catch (err: any) {
                                          alert(err?.message || "Failed to resume account.");
                                        }
                                      }}
                                      className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center space-x-1.5"
                                    >
                                      <span>▶️ Resume Account</span>
                                    </button>
                                  );
                                }
                                return (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setOpenDropdownStaffId(null);
                                      try {
                                        await dataService.pauseStaffAuthUser(user.id, true);
                                        await dataService.addAuditTrail('CONSENT_CHANGED', `Suspended/paused login access for staff: ${user.full_name}`);
                                        triggerRefresh();
                                      } catch (err: any) {
                                        alert(err?.message || "Failed to pause account.");
                                      }
                                    }}
                                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900 flex items-center space-x-1.5"
                                  >
                                    <span>⏸️ Pause Account</span>
                                  </button>
                                );
                              })()}

                              {/* Only visible to Admin */}
                              {currentUser?.position_role === 'Admin' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    handleDeleteStaff(user.id, user.full_name);
                                    setOpenDropdownStaffId(null);
                                  }}
                                  className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-655 dark:text-red-400 dark:hover:bg-red-950/20 border-t border-slate-105 dark:border-slate-800 flex items-center space-x-1.5 mt-1 pt-1.5 font-bold"
                                >
                                  <Trash2 className="h-3 w-3" />
                                  <span>Delete Account</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                      
                      {user.medical_council_registration_no && (
                        <span className="text-[9px] font-mono text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded dark:border-slate-800" title="Medical Registration Number">
                          {user.medical_council_registration_no}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <p>Email: <strong className="text-slate-700 dark:text-slate-300">{user.email}</strong></p>
                      {user.resource_fhir?.mobile && (
                        <p>Mobile: <strong className="text-slate-700 dark:text-slate-300">{currentUser?.can_view_personal_data ? user.resource_fhir.mobile : '••••••••••'}</strong></p>
                      )}
                      {user.resource_fhir?.aadhaar && (
                        <p>Aadhaar: <strong className="text-slate-700 dark:text-slate-300">{currentUser?.can_view_personal_data ? user.resource_fhir.aadhaar : '•••• •••• ••••'}</strong></p>
                      )}
                      {user.resource_fhir?.address && (
                        <p>Address: <strong className="text-slate-700 dark:text-slate-300">{currentUser?.can_view_personal_data ? user.resource_fhir.address : '••••••••••••••••'}</strong></p>
                      )}
                      {user.resource_fhir?.primary_contact_name && (
                        <p>Primary Contact: <strong className="text-slate-700 dark:text-slate-300">{user.resource_fhir.primary_contact_name} ({currentUser?.can_view_personal_data ? (user.resource_fhir.primary_contact_phone || 'No phone') : '••••••••••'})</strong></p>
                      )}
                      <p>Base Salary: <strong className="text-slate-700 dark:text-slate-300">₹{user.base_salary_monthly.toLocaleString('en-IN')}/mo</strong></p>
                      <p>Session Bonus: <strong className="text-slate-700 dark:text-slate-300">{user.bonus_system_enabled ? 'Enabled' : 'Disabled'}</strong></p>
                    </div>
                  </div>
                );
              });
            })()
        )}
      </div>

      {/* Add Staff modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-2xl dark:bg-slate-900 dark:border-slate-800 overflow-hidden animate-in fade-in">
            <div className="bg-brand-500 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">Add Staff Directory Profile</h3>
              <button onClick={() => setShowAddForm(false)} className="text-white/85 hover:text-white text-xs font-semibold">Close</button>
            </div>
            
            <form onSubmit={handleAddStaff} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
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
                    placeholder="ananya@PraxDoc.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mobile Number</label>
                  <input
                    type="text"
                    required
                    pattern="[0-9]{10}"
                    title="Must be a 10 digit number"
                    minLength={10}
                    maxLength={10}
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    placeholder="e.g. 9876543210"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Aadhaar Card Number (Optional)</label>
                  <input
                    type="text"
                    pattern="[0-9]{12}"
                    title="Must be exactly 12 digits if provided"
                    minLength={12}
                    maxLength={12}
                    value={aadhaar}
                    onChange={(e) => setAadhaar(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    placeholder="e.g. 123456789012"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Residential Address</label>
                <textarea
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  placeholder="e.g. Flat 101, Residency Layout, Mumbai"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Primary Emergency Contact Name</label>
                  <input
                    type="text"
                    required
                    value={primaryContactName}
                    onChange={(e) => setPrimaryContactName(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    placeholder="e.g. Spouse/Parent Name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Primary Emergency Contact Phone</label>
                  <input
                    type="text"
                    required
                    pattern="[0-9]{10}"
                    title="Must be a 10 digit number"
                    minLength={10}
                    maxLength={10}
                    value={primaryContactPhone}
                    onChange={(e) => setPrimaryContactPhone(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    placeholder="e.g. 9999988888"
                  />
                </div>
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

              <div className="border border-slate-150 dark:border-slate-800 rounded-lg p-3.5 bg-slate-50 dark:bg-slate-900/40 space-y-2">
                <button
                  type="button"
                  onClick={() => setTabsExpanded(!tabsExpanded)}
                  className="flex items-center justify-between w-full text-xs font-bold text-slate-500 uppercase focus:outline-none"
                >
                  <span>Visible Navigation Tabs ({selectedTabs.length} selected)</span>
                  <span className="text-slate-400">{tabsExpanded ? '▲' : '▼'}</span>
                </button>
                {tabsExpanded && (
                  <div className="max-h-28 overflow-y-auto border-t border-slate-200 dark:border-slate-700 mt-2 pt-2 pr-1">
                    <div className="grid grid-cols-3 gap-2">
                      {['Dashboard', 'Patients', 'Appointments', 'Tasks', 'Salary', 'Billing', 'Inventory', 'Staff', 'Reports'].map((tab) => (
                        <label key={tab} className="flex items-center space-x-2 text-xs text-slate-650 dark:text-slate-350 font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedTabs.includes(tab)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTabs((prev) => [...prev, tab]);
                              } else {
                                setSelectedTabs((prev) => prev.filter((t) => t !== tab));
                              }
                            }}
                            className="h-3.5 w-3.5 text-brand-500 rounded border-slate-300 dark:border-slate-750 bg-white"
                          />
                          <span>{tab}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <span className="block text-[10px] text-slate-400 dark:text-slate-550 leading-normal pt-1">
                  Only the checked tabs will be visible in the sidebar navigation menu for this user account.
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Position / Role</label>
                  <select
                    value={role}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setRole(val);
                      setSelectedTabs(defaultTabsForRole(val));
                    }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md dark:bg-slate-900 dark:border-slate-800 overflow-hidden animate-in fade-in">
            <div className="bg-brand-500 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm">Edit Staff Directory Profile</h3>
              <button onClick={() => setEditingUser(null)} className="text-white/85 hover:text-white text-xs font-semibold">Close</button>
            </div>
            
            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
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
                  placeholder="ananya@PraxDoc.com"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Mobile Number</label>
                  <input
                    type="text"
                    required
                    value={editMobileNumber}
                    onChange={(e) => setEditMobileNumber(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Aadhaar Card Number</label>
                  <input
                    type="text"
                    required
                    value={editAadhaar}
                    onChange={(e) => setEditAadhaar(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    placeholder="e.g. 1234-5678-9012"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Residential Address</label>
                <textarea
                  required
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                  placeholder="e.g. Flat 101, Residency Layout, Mumbai"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Primary Emergency Contact Name</label>
                  <input
                    type="text"
                    required
                    value={editPrimaryContactName}
                    onChange={(e) => setEditPrimaryContactName(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    placeholder="e.g. Spouse/Parent Name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Primary Emergency Contact Phone</label>
                  <input
                    type="text"
                    required
                    value={editPrimaryContactPhone}
                    onChange={(e) => setEditPrimaryContactPhone(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    placeholder="e.g. +91 99999 88888"
                  />
                </div>
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
                  const newId = await dataService.createStaffAuthUser(
                    promptPasswordUser.email,
                    promptPasswordText,
                    promptPasswordUser.full_name,
                    promptPasswordUser.position_role,
                    promptPasswordUser.id
                  );
                  await dataService.addAuditTrail('FINANCIAL_MUTATION', `Created Supabase login account for existing staff: ${promptPasswordUser.full_name}`);
                  
                  // Optimistically update state
                  setAuthStatuses((prev) => [
                    ...prev.filter(s => s.id !== promptPasswordUser.id && s.id !== newId),
                    { id: newId, exists: true, paused: false }
                  ]);
                  setStaffList((prev) =>
                    prev.map((u) => (u.id === promptPasswordUser.id ? { ...u, id: newId } : u))
                  );

                  setPromptPasswordUser(null);
                  setPromptPasswordText('');
                  
                  setTimeout(() => {
                    triggerRefresh();
                  }, 500);
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

      {/* Access & Security Modal (Admin Only) */}
      {securityModalUser && (() => {
        const user = staffList.find(u => u.id === securityModalUser.id) || securityModalUser;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs">
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md dark:bg-slate-900 dark:border-slate-800 overflow-hidden animate-in fade-in max-h-[85vh] flex flex-col">
              <div className="bg-brand-500 text-white px-6 py-4 flex justify-between items-center flex-shrink-0">
                <div className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <h3 className="font-bold text-sm">Access & Security Settings</h3>
                </div>
                <button onClick={() => setSecurityModalUser(null)} className="text-white/85 hover:text-white text-xs font-semibold">Close</button>
              </div>
              
              <div className="p-6 overflow-y-auto space-y-5">
                <div>
                  <h4 className="font-bold text-slate-850 dark:text-white text-sm">{user.full_name}</h4>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider mt-0.5">{user.position_role} Permissions</p>
                </div>

                {/* Access & Security Matrix */}
                <div className="space-y-3">
                  <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Access & Security Matrix</span>
                  <div className="space-y-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800">
                    
                    {/* can_view_personal_data */}
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-600 dark:text-slate-400 font-medium">Read Personal Data</span>
                      <button
                        onClick={() => handleToggleFlag(user.id, 'can_view_personal_data')}
                        className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors focus:outline-none ${
                          !canManageStaff ? 'opacity-50 cursor-not-allowed' : ''
                        } ${
                          user.can_view_personal_data ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'
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
                          user.can_view_medical_history ? 'bg-brand-500' : 'bg-slate-200 dark:bg-slate-700'
                        }`}
                        disabled={!canManageStaff}
                      >
                        <span className={`${user.can_view_medical_history ? 'translate-x-4' : 'translate-x-0.5'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} />
                      </button>
                    </div>


                  </div>
                </div>

                {/* Tab Navigation Access Matrix */}
                <div className="space-y-3">
                  <span className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Navigation Tabs Visibility</span>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 bg-slate-50 dark:bg-slate-850 rounded-xl p-3.5 border border-slate-100 dark:border-slate-800">
                    {['Dashboard', 'Patients', 'Appointments', 'Tasks', 'Salary', 'Billing', 'Inventory', 'Staff', 'Reports'].map((tab) => {
                      const currentResource = user.resource_fhir || {};
                      const currentTabs: string[] = currentResource.enabled_tabs || defaultTabsForRole(user.position_role);
                      const isTabEnabled = currentTabs.includes(tab);

                      return (
                        <div key={tab} className="flex justify-between items-center text-[11px]">
                          <span className="text-slate-600 dark:text-slate-400 font-medium">{tab}</span>
                          <button
                            onClick={() => handleToggleTab(user.id, tab)}
                            className={`relative inline-flex h-3.5 w-7 items-center rounded-full transition-colors focus:outline-none ${
                              !canManageStaff ? 'opacity-50 cursor-not-allowed' : ''
                            } ${
                              isTabEnabled ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                            disabled={!canManageStaff}
                          >
                            <span className={`${isTabEnabled ? 'translate-x-3.5' : 'translate-x-0.5'} inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform`} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-end p-6 border-t border-slate-100 dark:border-slate-800 flex-shrink-0 bg-slate-50 dark:bg-slate-900/40">
                <button
                  type="button"
                  onClick={() => setSecurityModalUser(null)}
                  className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-lg text-xs font-bold shadow"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        );
      })()}
      
    </div>
  );
};
