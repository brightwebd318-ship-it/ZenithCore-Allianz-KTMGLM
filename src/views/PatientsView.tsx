import React, { useEffect, useState, useRef } from 'react';
import {
  Users,
  Plus,
  ShieldAlert,
  Paperclip,
  CheckCircle2,
  Clock,
  ChevronRight,
  User,
  Archive,
  Search,
  CreditCard,
  Eye
} from 'lucide-react';
import { dataService } from '../services/dataService';
import type { Patient, ClinicalLog, User as StaffUser, Invoice, ScheduledSession } from '../services/dataService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

interface PatientsViewProps {
  triggerRefresh: () => void;
  triggerRefreshKey: number;
  currentUser: StaffUser | null;
}

export const PatientsView: React.FC<PatientsViewProps> = ({ triggerRefresh, triggerRefreshKey, currentUser }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [logs, setLogs] = useState<ClinicalLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealPersonalData, setRevealPersonalData] = useState(false);
  const [patientInvoices, setPatientInvoices] = useState<Invoice[]>([]);
  const [printableInvoice, setPrintableInvoice] = useState<Invoice | null>(null);
  const [patientSessions, setPatientSessions] = useState<ScheduledSession[]>([]);
  const [showInvoices, setShowInvoices] = useState(false);

  // New Patient Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [newGivenName, setNewGivenName] = useState('');
  const [newFamilyName, setNewFamilyName] = useState('');
  const [newGender, setNewGender] = useState('male');
  const [newBirthDate, setNewBirthDate] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  });
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newAbhaNumber, setNewAbhaNumber] = useState('');
  const [newAbhaAddress, setNewAbhaAddress] = useState('');
  const [newGstin, setNewGstin] = useState('');
  const [newGstEnabled, setNewGstEnabled] = useState(false);
  const [newConsentGiven, setNewConsentGiven] = useState(true);

  // New Clinical Log State
  const [newLogSummary, setNewLogSummary] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);

  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const detailsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedPatient && typeof window !== 'undefined' && window.innerWidth < 1024) {
      detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [selectedPatient]);

  useEffect(() => {
    const fetchPatients = async () => {
      setLoading(true);
      try {
        const data = await patientsSearch(searchQuery);
        setPatients(data);
        if (data.length > 0 && !selectedPatient) {
          setSelectedPatient(data[0]);
        }
        const users = await dataService.getUsers();
        setStaffList(users);
      } catch (err) {
        console.error('Error fetching patients:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchPatients();
  }, [searchQuery, triggerRefreshKey]);

  const isAdmin = currentUser?.position_role === 'Admin';
  const canToggleDetails = currentUser?.can_view_personal_data;
  const showDetails = isAdmin || revealPersonalData;

  const lastLoggedPatientId = useRef<string | null>(null);

  useEffect(() => {
    if (selectedPatient) {
      // Reset reveal toggle and invoices toggle on patient change for privacy safety
      setRevealPersonalData(false);
      setShowInvoices(false);
      setPatientInvoices([]);

      // Audit log patient access
      if (selectedPatient.id !== lastLoggedPatientId.current) {
        lastLoggedPatientId.current = selectedPatient.id;
        const givenName = selectedPatient.resource_fhir?.name?.[0]?.given?.[0] || 'Unknown';
        const familyName = selectedPatient.resource_fhir?.name?.[0]?.family || '';
        dataService.addAuditTrail(
          'READ_PATIENT',
          `Accessed patient records/chart for: ${givenName} ${familyName} (ID: ${selectedPatient.id})`
        ).catch(err => console.error("Failed to log patient chart access:", err));
      }

      if (isAdmin || currentUser?.can_view_medical_history) {
        const fetchLogs = async () => {
          try {
            const l = await dataService.getClinicalLogs(selectedPatient.id);
            setLogs(l);
          } catch (err) {
            console.error('Error loading clinical logs:', err);
          }
        };
        fetchLogs();
      } else {
        setLogs([]);
      }
    }
  }, [selectedPatient, currentUser]);

  useEffect(() => {
    if (selectedPatient) {
      const fetchSessions = async () => {
        try {
          const sess = await dataService.getScheduledSessions();
          const filteredSess = sess.filter((s) => s.patient_id === selectedPatient.id);
          setPatientSessions(filteredSess);
        } catch (err) {
          console.error('Error fetching patient sessions:', err);
        }
      };
      fetchSessions();
    } else {
      setPatientSessions([]);
    }
  }, [selectedPatient, triggerRefreshKey]);

  useEffect(() => {
    const fetchInvoicesForPatient = async () => {
      if (!selectedPatient) return;
      try {
        const invs = await dataService.getInvoices();
        const filteredInvs = invs.filter((inv) => inv.patient_id === selectedPatient.id);
        setPatientInvoices(filteredInvs);
      } catch (err) {
        console.error('Error fetching patient invoices:', err);
      }
    };

    if (selectedPatient && showInvoices) {
      fetchInvoicesForPatient();
    } else {
      setPatientInvoices([]);
    }
  }, [selectedPatient, showInvoices, triggerRefreshKey]);

  // Debounce search query audit logging
  useEffect(() => {
    if (!searchQuery.trim()) return;

    const timer = setTimeout(() => {
      dataService.addAuditTrail(
        'SEARCH',
        `Queried patients directory using filter: "${searchQuery}"`
      ).catch((err) => console.error("Failed to log search audit trail:", err));
    }, 1000); // 1 second debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const patientsSearch = async (query: string) => {
    return await dataService.getPatients(query);
  };

  // DPDP Consent Toggle (Withdrawal)
  const handleWithdrawConsent = async (patientId: string) => {
    try {
      const updated = await dataService.updatePatientConsent(patientId, false, true);
      setSelectedPatient(updated);
      await dataService.addAuditTrail('CONSENT_CHANGED', `Patient consent WITHDRAWN for ID: ${patientId}`);
      triggerRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // DPDP Activate Consent
  const handleActivateConsent = async (patientId: string) => {
    try {
      const updated = await dataService.updatePatientConsent(patientId, true, false);
      setSelectedPatient(updated);
      await dataService.addAuditTrail('CONSENT_CHANGED', `Patient consent ACTIVATED for ID: ${patientId}`);
      triggerRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // GST Toggle
  const handleGstToggle = async (patient: Patient) => {
    try {
      const nextGst = !patient.gst_enabled;
      const updated = await dataService.updatePatientGst(patient.id, nextGst, patient.gstin);
      setSelectedPatient(updated);
      await dataService.addAuditTrail('FINANCIAL_MUTATION', `GST status updated for patient ID ${patient.id} to ${nextGst}`);
      triggerRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleViewInvoicePDF = async (invoice: Invoice) => {
    setPrintableInvoice(invoice);
    const patientName = selectedPatient ? `${selectedPatient.resource_fhir?.name?.[0]?.given?.[0]} ${selectedPatient.resource_fhir?.name?.[0]?.family}` : 'Unknown';
    await dataService.addAuditTrail('READ_PATIENT', `Viewed/Printed Invoice PDF (ID: ${invoice.resource_fhir?.identifier?.[0]?.value || invoice.id}) for Patient: ${patientName} (ID: ${invoice.patient_id})`);
  };

  // Add Patient Form Submit
  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const newPatientData = {
        abha_number: newAbhaNumber && newAbhaNumber.trim() !== '' ? newAbhaNumber.trim() : null,
        abha_address: newAbhaAddress && newAbhaAddress.trim() !== '' ? newAbhaAddress.trim() : null,
        gstin: newGstin && newGstin.trim() !== '' ? newGstin.trim() : null,
        gst_enabled: newGstEnabled,
        consent_given: newConsentGiven,
        consent_timestamp: newConsentGiven ? new Date().toISOString() : '',
        consent_withdrawal_requested: false,
        resource_fhir: {
          resourceType: 'Patient',
          name: [{ given: [newGivenName], family: newFamilyName }],
          telecom: [{ system: 'phone', value: newPhone }],
          gender: newGender,
          birthDate: newBirthDate,
          address: [{ text: newAddress }],
        },
      };

      const added = await dataService.addPatient(newPatientData);
      setSelectedPatient(added);
      setShowAddForm(false);
      
      // Clear forms
      setNewGivenName('');
      setNewFamilyName('');
      setNewPhone('');
      setNewAddress('');
      setNewAbhaNumber('');
      setNewAbhaAddress('');
      setNewGstin('');
      
      await dataService.addAuditTrail('FINANCIAL_MUTATION', `Created new patient record for ${newGivenName} ${newFamilyName}`);
      triggerRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // View secure private document via signed URL
  const handleViewPrivateDocument = async (filePath: string, fileName: string) => {
    try {
      if (isSupabaseConfigured && supabase) {
        // Create a temporary signed URL valid for 60 seconds
        const { data, error } = await supabase.storage
          .from('PraxDocu')
          .createSignedUrl(filePath, 60);

        if (error) throw error;
        if (data?.signedUrl) {
          window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
        } else {
          throw new Error("Failed to generate signed URL");
        }
      } else {
        // Mock offline fallback
        const mockUrl = `https://mock-storage.zenithcore.com/PraxDocu/${filePath}`;
        window.open(mockUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err: any) {
      console.error("Error generating signed URL:", err);
      alert(err.message || "Failed to retrieve secure document access token.");
    }
  };

  // Clinical Log add
  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !newLogSummary.trim()) return;
    setUploadingFile(true);

    try {
      let attachments: Array<{ name: string; type: string; size: number; url?: string; filePath?: string }> = [];

      if (selectedFile) {
        const fileExt = selectedFile.name.split('.').pop();
        const filePath = `patients/${selectedPatient.id}/${Date.now()}.${fileExt}`;

        if (isSupabaseConfigured && supabase) {
          const { error: uploadErr } = await supabase.storage
            .from('PraxDocu')
            .upload(filePath, selectedFile);

          if (uploadErr) throw uploadErr;

          const { data: urlData } = supabase.storage
            .from('PraxDocu')
            .getPublicUrl(filePath);

          attachments = [{
            name: selectedFile.name,
            type: selectedFile.type,
            size: selectedFile.size,
            url: urlData.publicUrl,
            filePath: filePath
          }];
        } else {
          // Fallback mock url for offline simulation
          const mockUrl = `https://mock-storage.zenithcore.com/PraxDocu/${filePath}`;
          attachments = [{
            name: selectedFile.name,
            type: selectedFile.type,
            size: selectedFile.size,
            url: mockUrl,
            filePath: filePath
          }];
        }
      }
      
      await dataService.addClinicalLog(selectedPatient.id, newLogSummary, attachments);
      setNewLogSummary('');
      setSelectedFile(null);
      
      // Reload logs
      const updatedLogs = await dataService.getClinicalLogs(selectedPatient.id);
      setLogs(updatedLogs);
      
      await dataService.addAuditTrail('READ_PATIENT', `Added clinical impression with document attachment to patient ID ${selectedPatient.id}`);
      triggerRefresh();
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Failed to upload document. Make sure the 'PraxDocu' bucket exists in Supabase Storage.");
    } finally {
      setUploadingFile(false);
    }
  };

  // Clinical Log soft-delete (with Storage cascade file removal)
  const handleSoftDeleteLog = async (logId: string) => {
    if (!selectedPatient) return;
    const confirmDelete = window.confirm("Are you sure you want to archive this clinical progress log? Linked files in storage will also be deleted.");
    if (!confirmDelete) return;

    try {
      const log = logs.find((l) => l.id === logId);
      if (log && log.attachments && log.attachments.length > 0) {
        const attach = log.attachments[0];
        if (attach.filePath && isSupabaseConfigured && supabase) {
          try {
            await supabase.storage.from('PraxDocu').remove([attach.filePath]);
          } catch (storageErr) {
            console.warn("Storage deletion warning:", storageErr);
          }
        }
      }

      await dataService.softDeleteClinicalLog(logId);
      
      // Reload logs
      const updatedLogs = await dataService.getClinicalLogs(selectedPatient.id);
      setLogs(updatedLogs);
      
      await dataService.addAuditTrail('READ_PATIENT', `Archived progress log and deleted storage attachment for patient ID ${selectedPatient.id}`);
      triggerRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (invId: string, status: Invoice['payment_status']) => {
    try {
      await dataService.updateInvoiceStatus(invId, status);
      triggerRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const hasAccess = currentUser?.can_view_personal_data && currentUser?.can_view_medical_history;
  
  if (currentUser && !hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-red-200 rounded-xl dark:bg-[#111827] dark:border-red-950/20 max-w-xl mx-auto mt-12 shadow-lg col-span-full">
        <ShieldAlert className="h-12 w-12 text-red-500 mb-4 animate-bounce" />
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Access Denied</h3>
        <p className="text-xs text-slate-500 dark:text-slate-450 mt-2 max-w-md">
          Viewing patient clinical charts and personal ledger records requires both 'Read Personal Data' and 'Read Medical Logs' privileges. Please contact your system administrator.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      
      {/* 1. Patients Roster Table (Left 5 Columns) */}
      <div className="lg:col-span-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center text-slate-900 dark:text-white">
            <Users className="h-5 w-5 mr-2 text-brand-500" /> Patient Ledger
          </h2>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center bg-brand-500 text-white text-xs font-bold px-3 py-2 rounded-lg hover:bg-brand-600 shadow transition-colors"
          >
            <Plus className="h-4 w-4 mr-1" /> New Patient
          </button>
        </div>

        {/* Local Search Bar Input */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Search patients by name, email, or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:bg-white focus:border-brand-500 dark:bg-slate-800 dark:border-slate-700 transition-all text-slate-900 dark:text-white"
          />
        </div>

        {/* Patients Table Card */}
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm dark:bg-[#111827] dark:border-slate-800">
          <div className="max-h-[70vh] overflow-y-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:bg-slate-800/40 dark:border-slate-800">
                  <th className="px-4 py-3">Patient Name / Gender</th>
                  <th className="px-4 py-3">ABHA Code</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-sm text-slate-400">Loading patients ledger...</td>
                  </tr>
                ) : patients.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-6 text-sm text-slate-400">No patients matching filters.</td>
                  </tr>
                ) : (
                  patients.map((p) => {
                    const isSelected = selectedPatient?.id === p.id;
                    const givenName = p.resource_fhir?.name?.[0]?.given?.[0] || 'Unknown';
                    const familyName = p.resource_fhir?.name?.[0]?.family || '';
                    const gender = p.resource_fhir?.gender || 'Unspecified';
                    
                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedPatient(p)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-brand-50/50 dark:bg-brand-950/10'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="px-4 py-3.5">
                          <div className="font-bold text-sm text-slate-900 dark:text-white">
                            {givenName} {familyName}
                          </div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 mt-0.5 block">
                            {gender}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-semibold font-mono text-xs text-slate-700 dark:text-slate-300">
                            {p.abha_number ? (showDetails && isSelected ? p.abha_number : '••••-••••-••••-••••') : 'Not Linked'}
                          </span>
                          <span className="block text-[10px] text-slate-400 mt-0.5">
                            {p.abha_address ? (showDetails && isSelected ? p.abha_address : '••••••••@abdm') : 'No Address'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <ChevronRight className={`inline h-5 w-5 ${isSelected ? 'text-brand-500' : 'text-slate-300 dark:text-slate-600'}`} />
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

      {/* 2. Patient Profile & Clinical Timeline (Right 7 Columns) */}
      <div ref={detailsRef} className="lg:col-span-7 space-y-6">
        {selectedPatient ? (
          <div className="space-y-6">
            
            {/* Header Identity Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-4">
                  <div className="h-12 w-12 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-lg shadow shadow-brand-500/20">
                    {selectedPatient.resource_fhir?.name?.[0]?.given?.[0]?.[0] || 'P'}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {selectedPatient.resource_fhir?.name?.[0]?.given?.[0]} {selectedPatient.resource_fhir?.name?.[0]?.family}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center">
                      <User className="h-3 w-3 mr-1" />
                      DOB: {selectedPatient.resource_fhir?.birthDate || 'Unspecified'} | Gender: {selectedPatient.resource_fhir?.gender}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Reveal toggle for qualified non-admins */}
                  {!isAdmin && canToggleDetails && (
                    <button
                      onClick={() => setRevealPersonalData(!revealPersonalData)}
                      className="flex items-center bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-350 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all focus:outline-none"
                    >
                      {revealPersonalData ? 'Hide Details' : 'Reveal Details'}
                    </button>
                  )}


                  {/* GST toggle pill */}
                  <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">GST Invoicing</span>
                    <button
                      onClick={() => handleGstToggle(selectedPatient)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
                        selectedPatient.gst_enabled ? 'bg-emerald-500' : 'bg-slate-350 dark:bg-slate-700'
                      }`}
                    >
                      <span
                        className={`${
                          selectedPatient.gst_enabled ? 'translate-x-5' : 'translate-x-1'
                        } inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Demographics & ABHA Information */}
              <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">14-Digit ABHA Number</span>
                  <div className="text-sm font-bold font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedPatient.abha_number ? (
                      showDetails ? (
                        <span className="text-brand-600 dark:text-brand-400">{selectedPatient.abha_number}</span>
                      ) : (
                        <span className="text-slate-400 font-normal">••••-••••-••••-••••</span>
                      )
                    ) : (
                      <span className="text-slate-400 italic font-normal text-xs">No ABHA Registered</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">ABHA Address String</span>
                  <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedPatient.abha_address ? (
                      showDetails ? (
                        selectedPatient.abha_address
                      ) : (
                        <span className="text-slate-400 font-normal">••••••••@abdm</span>
                      )
                    ) : (
                      <span className="text-slate-400 italic font-normal text-xs">name@abdm</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Contact and address */}
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Phone Contact</span>
                  <div className="text-sm text-slate-800 dark:text-slate-200 mt-0.5">
                    {selectedPatient.resource_fhir?.telecom?.[0]?.value ? (
                      showDetails ? (
                        selectedPatient.resource_fhir.telecom[0].value
                      ) : (
                        <span className="text-slate-400 font-normal">+91 ••••• •••••</span>
                      )
                    ) : (
                      'Unspecified'
                    )}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400">Residential Address</span>
                  <div className="text-xs text-slate-800 dark:text-slate-200 mt-0.5 truncate" title={showDetails ? (selectedPatient.resource_fhir?.address?.[0]?.text || 'Unspecified') : 'Address Masked'}>
                    {selectedPatient.resource_fhir?.address?.[0]?.text ? (
                      showDetails ? (
                        selectedPatient.resource_fhir.address[0].text
                      ) : (
                        <span className="text-slate-400 font-normal">••••••••••••••••••••••••</span>
                      )
                    ) : (
                      'Unspecified'
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. DPDP Act 2023 Consent Vault */}
            <div className="rounded-xl border border-brand-100 bg-brand-50/20 p-5 shadow-sm dark:bg-brand-950/5 dark:border-brand-900/20">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <div className="mt-0.5">
                    {selectedPatient.consent_given && !selectedPatient.consent_withdrawal_requested ? (
                      <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center dark:bg-emerald-950/20 dark:text-emerald-400">
                        <CheckCircle2 className="h-5 w-5" />
                      </div>
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center dark:bg-amber-950/20 dark:text-amber-400">
                        <ShieldAlert className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">DPDP Indian Consent Vault</h4>
                      {selectedPatient.consent_given && !selectedPatient.consent_withdrawal_requested ? (
                        <span className="text-[9px] bg-emerald-500 text-white px-2 py-0.5 rounded font-extrabold tracking-wider uppercase">Consent Active</span>
                      ) : selectedPatient.consent_withdrawal_requested ? (
                        <span className="text-[9px] bg-red-500 text-white px-2 py-0.5 rounded font-extrabold tracking-wider uppercase">WITHDRAWAL REQUESTED</span>
                      ) : (
                        <span className="text-[9px] bg-amber-500 text-white px-2 py-0.5 rounded font-extrabold tracking-wider uppercase">No Consent Record</span>
                      )}
                    </div>
                    
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-lg">
                      Forensic digital audit trail. According to DPDP Act 2023, data can only be accessed with verified permissions.
                    </p>
                    
                    {selectedPatient.consent_timestamp && (
                      <div className="flex items-center text-[10px] text-slate-400 mt-2 font-mono">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        Forensic Opt-in Stamp: {new Date(selectedPatient.consent_timestamp).toLocaleString('en-IN')}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {selectedPatient.consent_given && !selectedPatient.consent_withdrawal_requested ? (
                    <button
                      onClick={() => handleWithdrawConsent(selectedPatient.id)}
                      className="text-xs font-bold text-red-600 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg dark:text-red-400 dark:border-red-900/50 dark:hover:bg-red-950/20 transition-all shadow-sm"
                    >
                      Withdraw Consent
                    </button>
                  ) : (
                    <button
                      onClick={() => handleActivateConsent(selectedPatient.id)}
                      className="text-xs font-bold text-emerald-600 border border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-lg dark:text-emerald-400 dark:border-emerald-900/50 dark:hover:bg-emerald-950/20 transition-all shadow-sm"
                    >
                      Activate Consent
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Clinical Logging Timeline */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Clinical Logs & Progress Timeline
                </h4>
                <div className="flex items-center space-x-1.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/30 px-2.5 py-1 rounded-lg font-bold text-[11px] shadow-xs">
                  <span>Total Sessions Completed:</span>
                  <span className="font-extrabold font-mono text-xs">{patientSessions.filter(s => s.status === 'completed').length}</span>
                </div>
              </div>

              {currentUser && !isAdmin && !currentUser.can_view_medical_history ? (
                <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-800/20 border border-dashed border-red-200 dark:border-red-900/30 rounded-lg mt-4">
                  <ShieldAlert className="h-8 w-8 text-red-500 mb-2 animate-pulse" />
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Medical Logs Access Denied</p>
                  <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
                    You do not have the required clearance to view or update the medical timeline logs for this patient.
                  </p>
                </div>
              ) : (
                <>
                  {/* Add Clinical Note Form */}
              <form onSubmit={handleAddLog} className="mt-4 space-y-3 pb-6 border-b border-slate-150 dark:border-slate-800">
                <div>
                  <textarea
                    required
                    rows={2}
                    value={newLogSummary}
                    onChange={(e) => setNewLogSummary(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 p-2.5 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700 focus:outline-none focus:bg-white focus:border-brand-500 text-slate-900 dark:text-white"
                    placeholder="Append new clinical note (impairments, sessions progress, orthotic adjustments)..."
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <label className="flex items-center space-x-1.5 cursor-pointer bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-350 transition-colors shadow-xs">
                      <Paperclip className="h-3.5 w-3.5 text-brand-500" />
                      <span className="text-[11px] font-bold">
                        {selectedFile ? selectedFile.name : 'Attach Report (PDF, Image, Doc)'}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            setSelectedFile(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                    {selectedFile && (
                      <button
                        type="button"
                        onClick={() => setSelectedFile(null)}
                        className="text-red-500 hover:text-red-650 text-[10px] font-bold uppercase transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  
                  <button
                    type="submit"
                    disabled={uploadingFile}
                    className="bg-brand-500 text-white font-bold text-[11px] px-3.5 py-1.5 rounded-lg hover:bg-brand-600 transition-colors shadow disabled:opacity-50"
                  >
                    {uploadingFile ? 'Uploading...' : 'Add Clinical Log'}
                  </button>
                </div>
              </form>

              {/* Timeline Feed */}
              <div className="mt-6 space-y-6 relative before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100 dark:before:bg-slate-800">
                {logs.length === 0 ? (
                  <p className="text-center py-4 text-xs text-slate-400 italic">No clinical progress logs recorded for this patient.</p>
                ) : (
                  logs.map((log) => {
                    const author = staffList.find((st) => st.id === log.author_id);
                    const authorName = author ? author.full_name : 'Clinic Specialist';
                    const role = author ? author.position_role : 'Specialist';
                    
                    return (
                      <div key={log.id} className="relative pl-8 flex items-start justify-between group">
                        {/* Dot indicator */}
                        <div className="absolute left-[9px] top-1.5 h-2 w-2 rounded-full bg-brand-500 border border-white dark:border-[#0B0F19]" />
                        
                        <div className="space-y-1.5 flex-1 pr-6">
                          <div className="flex items-center space-x-2 text-[10px]">
                            <span className="font-extrabold text-slate-800 dark:text-slate-300">{authorName} ({role})</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-slate-400">{new Date(log.resource_fhir?.date || '').toLocaleString('en-IN')}</span>
                          </div>
                          
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50/50 p-2.5 rounded-lg border border-slate-100 dark:bg-slate-800/20 dark:border-slate-800">
                            {log.resource_fhir?.summary}
                          </p>

                          {/* Attachments if any */}
                          {log.attachments && log.attachments.length > 0 && (
                            <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 rounded-lg w-fit text-[10px] text-slate-655 dark:text-slate-400 mt-2 border border-slate-200 dark:border-slate-700">
                              <Paperclip className="h-3.5 w-3.5 text-brand-500" />
                              {log.attachments[0].filePath ? (
                                <button 
                                  onClick={() => handleViewPrivateDocument(log.attachments[0].filePath, log.attachments[0].name)}
                                  className="font-bold text-brand-500 dark:text-brand-400 hover:underline flex items-center text-left focus:outline-none"
                                  title="Open secure temporary document link"
                                >
                                  {log.attachments[0].name}
                                </button>
                              ) : log.attachments[0].url ? (
                                <a 
                                  href={log.attachments[0].url} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="font-bold text-brand-500 dark:text-brand-400 hover:underline flex items-center"
                                  title="Open uploaded file"
                                >
                                  {log.attachments[0].name}
                                </a>
                              ) : (
                                <span className="font-semibold">{log.attachments[0].name}</span>
                              )}
                              <span className="text-[9px] text-slate-400 ml-1">({(log.attachment_size_bytes / 1024).toFixed(0)} KB)</span>
                            </div>
                          )}
                        </div>

                        {/* Soft Delete Trigger */}
                        <button
                          onClick={() => handleSoftDeleteLog(log.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1 rounded hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all flex items-center space-x-1"
                          title="Soft delete from active view (DGHS compliance audit preserved)"
                        >
                          <Archive className="h-4 w-4" />
                          <span className="text-[9px] font-bold">Archive</span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

            {/* Previous Invoices */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 animate-fade-in">
              <div className="flex justify-between items-center pb-3 border-b border-slate-100 dark:border-slate-800">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center">
                  <CreditCard className="h-4 w-4 mr-2 text-brand-500" />
                  Previous Invoices
                </h4>
                {!showInvoices && (
                  <button
                    onClick={() => setShowInvoices(true)}
                    className="bg-brand-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-brand-600 shadow transition-colors"
                  >
                    Load Invoices
                  </button>
                )}
              </div>
              
              {showInvoices && (
                <div className="mt-4 space-y-3">
                  {patientInvoices.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-slate-800/10 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                      <CreditCard className="h-8 w-8 text-slate-350 dark:text-slate-650 mb-2" />
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">No invoices found for this patient.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-855 text-xs">
                      {patientInvoices.map((invoice, index) => {
                        const practitioner = staffList.find(s => s.id === invoice.associated_practitioner_id)?.full_name || 'Clinic Specialist';
                        const identifier = invoice.resource_fhir?.identifier?.[0]?.value || invoice.id;
                        const formattedDate = new Date(invoice.created_at).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        });
                        
                        return (
                          <div key={invoice.id} className={`flex flex-col sm:flex-row sm:items-center sm:justify-between py-3.5 ${index === 0 ? 'pt-0' : ''} ${index === patientInvoices.length - 1 ? 'pb-0' : ''}`}>
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold font-mono text-sm text-slate-900 dark:text-white">
                                  {identifier}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-550 font-mono">
                                  {formattedDate}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">
                                Practitioner: <span className="font-semibold text-slate-700 dark:text-slate-300">{practitioner}</span>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between sm:justify-end space-x-4 mt-3 sm:mt-0">
                              <div className="text-right">
                                <div className="text-sm font-extrabold text-slate-900 dark:text-white font-mono">
                                  ₹{invoice.total_amount.toLocaleString('en-IN')}
                                </div>
                                <div className="mt-0.5">
                                  {String(invoice.payment_status).toUpperCase() === 'PAID' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-400">
                                      PAID
                                    </span>
                                  )}
                                  {String(invoice.payment_status).toUpperCase() === 'UNPAID' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-red-100 text-red-800 dark:bg-red-950/20 dark:text-red-400">
                                      UNPAID
                                    </span>
                                  )}
                                  {String(invoice.payment_status).toUpperCase() === 'PENDING' && (
                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-100 text-amber-850 dark:bg-amber-950/20 dark:text-amber-400">
                                      PENDING
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <button
                                onClick={() => handleViewInvoicePDF(invoice)}
                                className="bg-brand-50 hover:bg-brand-100 text-brand-600 text-xs font-bold px-3 py-1.5 rounded-lg border border-brand-100 dark:bg-brand-950/20 dark:text-brand-400 dark:border-brand-900/30 transition-all shadow-xs inline-flex items-center space-x-1"
                                title="View PDF / Print Invoice"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>View PDF</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center border border-slate-200 border-dashed rounded-xl bg-white p-12 dark:bg-[#111827] dark:border-slate-800 h-[60vh]">
            <Users className="h-12 w-12 text-slate-350 dark:text-slate-650" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-4">No Patient Selected</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Select a patient on the left to view profile details, consent vault, and clinical logs.</p>
          </div>
        )}
      </div>

      {/* Add Patient Modal overlay */}
      {showAddForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-xl dark:bg-slate-900 dark:border-slate-800 overflow-hidden">
            <div className="bg-brand-500 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-lg">Create New Patient Profile</h3>
              <button onClick={() => setShowAddForm(false)} className="text-white/80 hover:text-white text-sm font-bold">Close</button>
            </div>
            
            <form onSubmit={handleAddPatient} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={newGivenName}
                    onChange={(e) => setNewGivenName(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 focus:outline-none"
                    placeholder="Aarav"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={newFamilyName}
                    onChange={(e) => setNewFamilyName(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 focus:outline-none"
                    placeholder="Patel"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Gender</label>
                  <select
                    value={newGender}
                    onChange={(e) => setNewGender(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 focus:outline-none"
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Birth Date</label>
                  <input
                    type="date"
                    required
                    value={newBirthDate}
                    onChange={(e) => setNewBirthDate(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Contact Phone</label>
                  <input
                    type="tel"
                    required
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 focus:outline-none"
                    placeholder="+91 99887 76655"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Residential Address</label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={(e) => setNewAddress(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 focus:outline-none"
                    placeholder="Flat 402, Sunset Heights, Mumbai"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">14-digit ABHA Number</label>
                  <input
                    type="text"
                    value={newAbhaNumber}
                    onChange={(e) => setNewAbhaNumber(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 focus:outline-none"
                    placeholder="XX-XXXX-XXXX-XXXX"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">ABHA Address String</label>
                  <input
                    type="text"
                    value={newAbhaAddress}
                    onChange={(e) => setNewAbhaAddress(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 focus:outline-none"
                    placeholder="name@abdm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">GSTIN Number (Optional)</label>
                  <input
                    type="text"
                    value={newGstin}
                    onChange={(e) => setNewGstin(e.target.value)}
                    className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 focus:outline-none"
                    placeholder="27AAAAA1111A1Z1"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-5">
                  <input
                    id="newGstEnabledCheck"
                    type="checkbox"
                    checked={newGstEnabled}
                    onChange={(e) => setNewGstEnabled(e.target.checked)}
                    className="h-4 w-4 text-brand-500 rounded border-slate-350"
                  />
                  <label htmlFor="newGstEnabledCheck" className="text-xs font-semibold text-slate-600 dark:text-slate-300">Enable GST Split Billing</label>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-xl dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex items-start space-x-3.5">
                <input
                  id="newConsentGivenCheck"
                  type="checkbox"
                  checked={newConsentGiven}
                  onChange={(e) => setNewConsentGiven(e.target.checked)}
                  className="h-5 w-5 text-brand-500 rounded border-slate-350 mt-0.5"
                />
                <div>
                  <label htmlFor="newConsentGivenCheck" className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                    DPDP Act Data Processing Consent Granted
                  </label>
                  <span className="block text-[10px] text-slate-400 mt-1 leading-normal">
                    Check here to verify that the patient has given explicit physical/digital consent for data processing inside the Supabase network. Sets opt-in timestamp.
                  </span>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-slate-200 rounded text-xs font-semibold text-slate-500 hover:text-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-all shadow"
                >
                  Save Patient Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Printable Invoice Receipt Overlay */}
      {printableInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <style>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #printable-invoice-area, #printable-invoice-area * {
                visibility: visible !important;
              }
              #printable-invoice-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                color: black !important;
                box-shadow: none !important;
                border: none !important;
              }
              .no-print {
                display: none !important;
              }
            }
          `}</style>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden dark:bg-slate-900 dark:border-slate-850">
            
            {/* Top Bar for Actions (Screen Only) */}
            <div className="bg-slate-100 border-b border-slate-200 px-6 py-4 flex justify-between items-center dark:bg-slate-800 dark:border-slate-700 no-print">
              <span className="font-extrabold text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Receipt Document Viewer
              </span>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    window.print();
                    handleUpdateStatus(printableInvoice.id, 'PAID');
                  }}
                  className="bg-brand-500 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-brand-600 transition-all flex items-center space-x-1 shadow-sm"
                >
                  <span>🖨️ Print / Save PDF</span>
                </button>
                <button
                  onClick={() => {
                    const patient = patients.find(p => p.id === printableInvoice.patient_id);
                    const pName = patient ? `${patient.resource_fhir?.name?.[0]?.given?.[0]} ${patient.resource_fhir?.name?.[0]?.family}` : 'Patient';
                    const practitioner = staffList.find(s => s.id === printableInvoice.associated_practitioner_id)?.full_name || 'Practitioner';
                    
                    const receiptText = `
--------------------------------------------------
ZENITH CORE CLINICAL RECEIPT
--------------------------------------------------
Invoice ID: ${printableInvoice.resource_fhir?.identifier?.[0]?.value || printableInvoice.id}
Date Generated: ${new Date(printableInvoice.created_at).toLocaleDateString('en-IN')}
Patient Name: ${pName}
Practitioner Name: ${practitioner}
--------------------------------------------------
LINE ITEMS:
${(printableInvoice.resource_fhir?.lineItem || []).map((item: any) => {
  const quantity = item.quantity || 1;
  const rate = item.priceComponent?.[0]?.amount?.value || 0;
  const total = quantity * rate;
  return `- ${item.description}: ${quantity} x ₹${rate} = ₹${total}`;
}).join('\n')}
--------------------------------------------------
Subtotal: ₹${printableInvoice.total_amount - printableInvoice.computed_tax_amount}
CGST (9%): ₹${printableInvoice.cgst_rate > 0 ? printableInvoice.computed_tax_amount / 2 : 0}
SGST (9%): ₹${printableInvoice.sgst_rate > 0 ? printableInvoice.computed_tax_amount / 2 : 0}
Grand Total: ₹${printableInvoice.total_amount}
Payment Status: ${String(printableInvoice.payment_status).toUpperCase()}
--------------------------------------------------
Thank you for choosing Zenith Ortho-Rehab Care!
`;
                    const blob = new Blob([receiptText], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `Invoice_${printableInvoice.resource_fhir?.identifier?.[0]?.value || printableInvoice.id}.txt`;
                    link.click();
                    handleUpdateStatus(printableInvoice.id, 'PAID');
                  }}
                  className="bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-emerald-700 transition-all flex items-center space-x-1 shadow-sm"
                >
                  <span>📥 Download Text Receipt</span>
                </button>
                <button
                  onClick={() => {
                    handleUpdateStatus(printableInvoice.id, 'PAID');
                    setPrintableInvoice(null);
                  }}
                  className="bg-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 transition-all"
                >
                  Close
                </button>
              </div>
            </div>

            {/* Document Content View */}
            <div className="p-8 max-h-[75vh] overflow-y-auto bg-white dark:bg-slate-900" id="printable-invoice-area">
              <div className="space-y-6">
                
                {/* Header branding */}
                <div className="flex justify-between items-start border-b border-slate-200 pb-4 dark:border-slate-800">
                  <div>
                    <h2 className="text-xl font-extrabold text-slate-900 dark:text-white font-outfit">
                      {localStorage.getItem('zenith_tenant_logo_name') || 'Zenith Ortho-Rehab Care'}
                    </h2>
                    <p className="text-[10px] text-slate-450 uppercase tracking-widest font-bold">
                      Zenith Medical Alliance Workspace
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono font-bold bg-slate-100 text-slate-800 px-3 py-1.5 rounded dark:bg-slate-800 dark:text-slate-200">
                      {printableInvoice.resource_fhir?.identifier?.[0]?.value || printableInvoice.id}
                    </span>
                    <span className="block text-[10px] text-slate-400 mt-2 font-bold uppercase font-mono">
                      Date: {new Date(printableInvoice.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                </div>

                {/* Bill To & Bill From info */}
                <div className="grid grid-cols-2 gap-6 text-xs border-b border-slate-100 pb-4 dark:border-slate-800/60">
                  <div>
                    <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 font-mono">Billed To (Patient)</h4>
                    <p className="font-bold text-slate-800 dark:text-slate-100">
                      {(() => {
                        const patient = patients.find(p => p.id === printableInvoice.patient_id);
                        return patient ? `${patient.resource_fhir?.name?.[0]?.given?.[0]} ${patient.resource_fhir?.name?.[0]?.family}` : 'Unknown Patient';
                      })()}
                    </p>
                    {(() => {
                      const patient = patients.find(p => p.id === printableInvoice.patient_id);
                      if (!patient) return null;
                      return (
                        <div className="text-slate-500 dark:text-slate-400 space-y-0.5 mt-1 font-mono text-[10px]">
                          {patient.abha_number && <p>ABHA No: {patient.abha_number}</p>}
                          {patient.abha_address && <p>ABHA Addr: {patient.abha_address}</p>}
                          {patient.gstin && <p>GSTIN: {patient.gstin}</p>}
                        </div>
                      );
                    })()}
                  </div>
                  
                  <div>
                    <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 font-mono">Billed by</h4>
                    <p className="font-bold text-slate-800 dark:text-slate-100">
                      {staffList.find(s => s.id === printableInvoice.associated_practitioner_id)?.full_name || 'Clinic Specialist'}
                    </p>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="space-y-2">
                  <h4 className="text-[10px] uppercase font-bold text-slate-400 font-mono">Itemized Breakdown</h4>
                  <table className="w-full text-left border-collapse border border-slate-100 dark:border-slate-800 text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 dark:bg-slate-850 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800 font-mono">
                        <th className="px-4 py-2">Item Description</th>
                        <th className="px-4 py-2 text-right font-mono">Rate</th>
                        <th className="px-4 py-2 text-center font-mono font-bold">Qty</th>
                        <th className="px-4 py-2 text-right font-mono font-bold">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {((printableInvoice.resource_fhir?.lineItem) || (
                        printableInvoice.session_count_incremented > 0 ? [
                          {
                            description: 'Therapy Session Units',
                            quantity: printableInvoice.session_count_incremented,
                            priceComponent: [{ amount: { value: (printableInvoice.total_amount - printableInvoice.computed_tax_amount) / (printableInvoice.session_count_incremented || 1) } }]
                          }
                        ] : []
                      )).map((item: any, idx: number) => {
                        const quantity = item.quantity || 1;
                        const rate = item.priceComponent?.[0]?.amount?.value || 0;
                        const lineTotal = quantity * rate;
                        return (
                          <tr key={idx} className="hover:bg-slate-50/20 dark:hover:bg-slate-800/10">
                            <td className="px-4 py-2 text-slate-800 dark:text-slate-200 font-semibold">{item.description}</td>
                            <td className="px-4 py-2 text-right font-mono">₹{rate.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-2 text-center font-mono">{quantity}</td>
                            <td className="px-4 py-2 text-right font-mono font-bold text-slate-900 dark:text-white font-mono">₹{lineTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Calculation Summary Footer block */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-850">
                  <div className="text-[10px] text-slate-450 italic flex items-end font-mono">
                    * All rates are listed in Indian Rupees (INR). Status is: {String(printableInvoice.payment_status).toUpperCase()}.
                  </div>
                  
                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-slate-500">
                      <span>Subtotal:</span>
                      <span>₹{(printableInvoice.total_amount - printableInvoice.computed_tax_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>

                    {printableInvoice.apply_gst ? (
                      <div className="space-y-1 bg-emerald-50/30 p-2 rounded border border-emerald-100/40 dark:bg-emerald-950/5 dark:border-emerald-900/10">
                        <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                          <span>CGST (9.0%):</span>
                          <span>₹{(printableInvoice.computed_tax_amount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-400 font-mono">
                          <span>SGST (9.0%):</span>
                          <span>₹{(printableInvoice.computed_tax_amount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between text-slate-400 text-[10px] italic font-mono">
                        <span>GST Exempt</span>
                        <span>₹0.00</span>
                      </div>
                    )}

                    <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-white pt-2 border-t border-slate-100 dark:border-slate-800">
                      <span>GRAND TOTAL:</span>
                      <span>₹{printableInvoice.total_amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[10px] text-slate-450 dark:text-slate-500 border-t border-slate-100 pt-4 dark:border-slate-800/60 font-medium">
                  Thank you for choosing {localStorage.getItem('zenith_tenant_logo_name') || 'Zenith Ortho-Rehab Care'}!
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
