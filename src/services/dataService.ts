import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  getTenantAction,
  updateTenantAction,
  getUsersAction,
  getCurrentUserAction,
  updateUserPermissionsAction,
  addUserAction,
  createStaffAuthAction,
  pauseStaffAuthAction,
  getAuthUsersStatusAction,
  getPatientsAction,
  addPatientAction,
  updatePatientConsentAction,
  updatePatientGstAction,
  getClinicalLogsAction,
  addClinicalLogAction,
  softDeleteClinicalLogAction,
  getInvoicesAction,
  addInvoiceAction,
  updateInvoicePaymentStatusAction,
  getInventoryAction,
  addInventoryItemAction,
  updateInventoryStockAction,
  getExpensesAction,
  addExpenseAction,
  getAuditTrailsAction,
  addAuditTrailAction,
  truncateAuditTrailsAction,
  getTodoTasksAction,
  addTodoTaskAction,
  updateTodoTaskStatusAction,
  getScheduledSessionsAction,
  addScheduledSessionAction,
  updateScheduledSessionStatusAction,
  getSystemNotificationsAction,
  markNotificationAsReadAction,
  deleteScheduledSessionAction,
  wipeCompletedTasksAction,
  getTenantResourceMetricsAction,
  initializeTenantAction,
  completeOnboardingAction,
  deleteStaffAction,
} from '../app/actions';

const getAuthToken = async (): Promise<string> => {
  if (isSupabaseConfigured && supabase) {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || '';
  }
  return '';
};

// Helper to generate UUIDs in mockup mode
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Types corresponding exactly to PostgreSQL schema
export interface Tenant {
  id: string;
  business_name: string;
  business_type: 'physiotherapy' | 'dentist' | 'general_clinic';
  subdomain: string;
  max_db_storage_mb: number;
  max_file_storage_mb: number;
  clinic_start_time: string;
  clinic_end_time: string;
  bonus_threshold_hours?: number;
  session_duration_minutes?: number;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  full_name: string;
  position_role: 'Admin' | 'Senior Therapist' | 'Receptionist';
  medical_council_registration_no: string;
  can_view_personal_data: boolean;
  can_view_medical_history: boolean;
  can_manage_finance: boolean;
  can_print_generate_invoice: boolean;
  can_manage_staff: boolean;
  base_salary_monthly: number;
  bonus_system_enabled: boolean;
  resource_fhir: any; // Practitioner v6.0
  created_at?: string;
}

export interface Patient {
  id: string;
  tenant_id: string;
  abha_number: string | null;
  abha_address: string | null;
  gstin: string | null;
  gst_enabled: boolean;
  consent_given: boolean;
  consent_timestamp: string;
  consent_withdrawal_requested: boolean;
  resource_fhir: any; // Patient v6.0
}

export interface ClinicalLog {
  id: string;
  tenant_id: string;
  patient_id: string;
  author_id: string;
  resource_fhir: any; // Clinical Note FHIR
  attachments: any; // Attachment metadata list
  attachment_size_bytes: number;
  is_deleted: boolean;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  patient_id: string;
  generated_by: string | null;
  session_count_incremented: number;
  associated_practitioner_id: string;
  apply_gst: boolean;
  cgst_rate: number;
  sgst_rate: number;
  igst_rate: number;
  computed_tax_amount: number;
  total_amount: number;
  payment_status: 'PAID' | 'UNPAID' | 'PENDING' | 'paid' | 'unpaid' | 'pending';
  created_at: string;
  resource_fhir?: any;
}

export interface InventoryItem {
  id: string;
  tenant_id: string;
  item_name: string;
  stock_count: number;
  unit_price: number;
  sellable_via_invoice: boolean;
}

export interface BusinessExpense {
  id: string;
  tenant_id: string;
  expense_name: string;
  amount: number;
  category: 'Salaries' | 'Rent' | 'Supplies' | 'Utilities' | 'Other';
  expense_date: string;
  attachment_size_bytes: number;
}

export interface SystemAuditTrail {
  id: string;
  tenant_id: string;
  action_type: 'SEARCH' | 'READ_PATIENT' | 'FINANCIAL_MUTATION' | 'CONSENT_CHANGED';
  description: string;
  performed_by: string;
  created_at: string;
}

export interface TodoTask {
  id: string;
  tenant_id: string;
  title: string;
  description: string;
  status: 'PENDING' | 'COMPLETED';
  assigned_to: string; // User ID
  created_by: string; // User ID
  created_at: string;
}

export interface ScheduledSession {
  id: string;
  tenant_id: string;
  patient_id: string;
  practitioner_id: string;
  start_time: string;
  end_time: string;
  session_notes: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
  created_at: string;
}

export interface SystemNotification {
  id: string;
  user_id: string;
  title: string;
  description: string;
  created_at: string;
  is_read: boolean;
  target_id?: string;
}



// REALTIME SUBSCRIPTIONS EVENT BUS (Simulates Supabase channels)
type SubscriptionCallback = (payload: any) => void;
const subscribers: { [key: string]: { [id: string]: SubscriptionCallback } } = {
  scheduled_sessions: {},
  todo_tasks: {},
  notifications: {},
};

export const subscribeToTable = (table: 'scheduled_sessions' | 'todo_tasks' | 'notifications', callback: SubscriptionCallback) => {
  const subId = generateUUID();
  
  if (table === 'notifications') {
    if (!subscribers[table]) subscribers[table] = {};
    subscribers[table][subId] = callback;
    return () => {
      delete subscribers[table][subId];
    };
  }
  
  if (isSupabaseConfigured && supabase) {
    const channel = supabase
      .channel(`realtime:${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
        callback(payload);
      })
      .subscribe();
      
    return () => {
      supabase!.removeChannel(channel);
    };
  } else {
    // Mock subscription
    if (!subscribers[table]) subscribers[table] = {};
    subscribers[table][subId] = callback;
    return () => {
      delete subscribers[table][subId];
    };
  }
};

const notifySubscribers = (table: 'scheduled_sessions' | 'todo_tasks' | 'notifications', eventType: 'INSERT' | 'UPDATE' | 'DELETE', record: any) => {
  const payload = {
    eventType,
    new: eventType !== 'DELETE' ? record : {},
    old: eventType !== 'INSERT' ? { id: record.id } : {},
  };
  if (subscribers[table]) {
    Object.values(subscribers[table]).forEach((cb) => cb(payload));
  }
};


// Initial mockup state seed
const initialTenant: Tenant = {
  id: 'd1983024-bc48-4cb1-97b7-5f72e9dcfaea',
  business_name: 'Zenith Ortho-Rehab Care',
  business_type: 'physiotherapy',
  subdomain: 'zenithortho',
  max_db_storage_mb: 50,
  max_file_storage_mb: 200,
  clinic_start_time: '08:00',
  clinic_end_time: '20:00',
  bonus_threshold_hours: 100,
  session_duration_minutes: 45,
};

const initialUsers: User[] = [
  {
    id: 'u1111111-1111-1111-1111-111111111111',
    tenant_id: initialTenant.id,
    email: 'dibin@zenithcore.com',
    full_name: 'Dibin',
    position_role: 'Admin',
    medical_council_registration_no: 'IMR/KAR-283921',
    can_view_personal_data: true,
    can_view_medical_history: true,
    can_manage_finance: true,
    can_print_generate_invoice: true,
    can_manage_staff: true,
    base_salary_monthly: 75000,
    bonus_system_enabled: true,
    resource_fhir: { resourceType: 'Practitioner', active: true, name: [{ text: 'Dibin' }] },
    created_at: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'u2222222-2222-2222-2222-222222222222',
    tenant_id: initialTenant.id,
    email: 'ananya@zenithcore.com',
    full_name: 'Dr. Ananya Sharma',
    position_role: 'Senior Therapist',
    medical_council_registration_no: 'IMR/KAR-981242',
    can_view_personal_data: true,
    can_view_medical_history: true,
    can_manage_finance: false,
    can_print_generate_invoice: true,
    can_manage_staff: false,
    base_salary_monthly: 60000,
    bonus_system_enabled: true,
    resource_fhir: { resourceType: 'Practitioner', active: true, name: [{ text: 'Dr. Ananya Sharma' }] },
    created_at: '2026-06-01T00:00:00.000Z',
  },
  {
    id: 'u3333333-3333-3333-3333-333333333333',
    tenant_id: initialTenant.id,
    email: 'rohan@zenithcore.com',
    full_name: 'Rohan Mehta',
    position_role: 'Receptionist',
    medical_council_registration_no: '',
    can_view_personal_data: true,
    can_view_medical_history: false,
    can_manage_finance: true,
    can_print_generate_invoice: true,
    can_manage_staff: false,
    base_salary_monthly: 30000,
    bonus_system_enabled: false,
    resource_fhir: { resourceType: 'Practitioner', active: true, name: [{ text: 'Rohan Mehta' }] },
    created_at: '2026-06-01T00:00:00.000Z',
  },
];

const initialPatients: Patient[] = [
  {
    id: 'p1111111-1111-1111-1111-111111111111',
    tenant_id: initialTenant.id,
    abha_number: '12-3456-7890-1234',
    abha_address: 'aarav@abdm',
    gstin: '27AAAAA1111A1Z1',
    gst_enabled: true,
    consent_given: true,
    consent_timestamp: '2026-05-10T10:30:00Z',
    consent_withdrawal_requested: false,
    resource_fhir: {
      resourceType: 'Patient',
      name: [{ given: ['Aarav'], family: 'Patel' }],
      telecom: [{ system: 'phone', value: '+91 98765 43210' }],
      gender: 'male',
      birthDate: '1988-11-20',
      address: [{ text: 'Flat 402, Sunset Heights, Mumbai' }],
    },
  },
  {
    id: 'p2222222-2222-2222-2222-222222222222',
    tenant_id: initialTenant.id,
    abha_number: '98-7654-3210-9876',
    abha_address: 'priya@abdm',
    gstin: '',
    gst_enabled: false,
    consent_given: true,
    consent_timestamp: '2026-05-18T14:15:00Z',
    consent_withdrawal_requested: false,
    resource_fhir: {
      resourceType: 'Patient',
      name: [{ given: ['Priya'], family: 'Iyer' }],
      telecom: [{ system: 'phone', value: '+91 99887 76655' }],
      gender: 'female',
      birthDate: '1995-04-12',
      address: [{ text: '32, Rosewood Enclave, Bengaluru' }],
    },
  },
  {
    id: 'p3333333-3333-3333-3333-333333333333',
    tenant_id: initialTenant.id,
    abha_number: '55-4433-2211-0099',
    abha_address: 'kabir@abdm',
    gstin: '29BBBBB2222B2Z2',
    gst_enabled: true,
    consent_given: false,
    consent_timestamp: '',
    consent_withdrawal_requested: false,
    resource_fhir: {
      resourceType: 'Patient',
      name: [{ given: ['Kabir'], family: 'Nair' }],
      telecom: [{ system: 'phone', value: '+91 90001 20002' }],
      gender: 'male',
      birthDate: '1979-08-30',
      address: [{ text: 'Villa 14, Lotus Palms, Chennai' }],
    },
  },
];

const initialClinicalLogs: ClinicalLog[] = [
  {
    id: 'l1111111-1111-1111-1111-111111111111',
    tenant_id: initialTenant.id,
    patient_id: 'p1111111-1111-1111-1111-111111111111', // Aarav
    author_id: 'u2222222-2222-2222-2222-222222222222', // Ananya
    resource_fhir: {
      resourceType: 'ClinicalImpression',
      status: 'completed',
      summary: 'Patient presents with acute left knee pain, matching ACL grade 2 sprain from sports injury. Recommending neuromuscular coordination training, hamstring strengthening, and thermal therapy sessions twice weekly.',
      date: '2026-06-10T11:00:00Z'
    },
    attachments: [{ name: 'knee_mri_report.pdf', type: 'application/pdf', size: 4500000 }],
    attachment_size_bytes: 4500000, // 4.29 MB
    is_deleted: false,
  },
  {
    id: 'l2222222-2222-2222-2222-222222222222',
    tenant_id: initialTenant.id,
    patient_id: 'p2222222-2222-2222-2222-222222222222', // Priya
    author_id: 'u2222222-2222-2222-2222-222222222222', // Ananya
    resource_fhir: {
      resourceType: 'ClinicalImpression',
      status: 'completed',
      summary: 'Administered 20 minutes of cervical static traction at 12 lbs, followed by neck isometric extension training. Patient reports mild relief in radicular symptoms in upper right arm.',
      date: '2026-06-11T16:00:00Z'
    },
    attachments: [{ name: 'prescription_scan.png', type: 'image/png', size: 150000 }],
    attachment_size_bytes: 150000, // 0.14 MB
    is_deleted: false,
  }
];

const initialInvoices: Invoice[] = [
  {
    id: 'INV-2026-001',
    tenant_id: initialTenant.id,
    patient_id: 'p1111111-1111-1111-1111-111111111111', // Aarav
    generated_by: 'u1111111-1111-1111-1111-111111111111',
    session_count_incremented: 4,
    associated_practitioner_id: 'u2222222-2222-2222-2222-222222222222',
    apply_gst: true,
    cgst_rate: 9,
    sgst_rate: 9,
    igst_rate: 0,
    computed_tax_amount: 900,
    total_amount: 5900, // 5000 + 900
    payment_status: 'PAID',
    created_at: '2026-06-08T10:00:00Z',
  },
  {
    id: 'INV-2026-002',
    tenant_id: initialTenant.id,
    patient_id: 'p2222222-2222-2222-2222-222222222222', // Priya
    generated_by: 'u3333333-3333-3333-3333-333333333333',
    session_count_incremented: 2,
    associated_practitioner_id: 'u2222222-2222-2222-2222-222222222222',
    apply_gst: false,
    cgst_rate: 0,
    sgst_rate: 0,
    igst_rate: 0,
    computed_tax_amount: 0,
    total_amount: 2500,
    payment_status: 'PENDING',
    created_at: '2026-06-11T12:00:00Z',
  },
  {
    id: 'INV-2026-003',
    tenant_id: initialTenant.id,
    patient_id: 'p3333333-3333-3333-3333-333333333333', // Kabir
    generated_by: 'u1111111-1111-1111-1111-111111111111',
    session_count_incremented: 1,
    associated_practitioner_id: 'u1111111-1111-1111-1111-111111111111',
    apply_gst: true,
    cgst_rate: 9,
    sgst_rate: 9,
    igst_rate: 0,
    computed_tax_amount: 180,
    total_amount: 1180,
    payment_status: 'UNPAID',
    created_at: '2026-06-12T15:30:00Z',
  }
];

const initialInventory: InventoryItem[] = [
  {
    id: 'i1',
    tenant_id: initialTenant.id,
    item_name: 'Resistance Loop Bands (Pack of 5)',
    stock_count: 45,
    unit_price: 450,
    sellable_via_invoice: true,
  },
  {
    id: 'i2',
    tenant_id: initialTenant.id,
    item_name: 'Kinesiology Therapeutic Tape (5m)',
    stock_count: 80,
    unit_price: 650,
    sellable_via_invoice: true,
  },
  {
    id: 'i3',
    tenant_id: initialTenant.id,
    item_name: 'Ultrasound Gel (5 Liters)',
    stock_count: 12,
    unit_price: 1200,
    sellable_via_invoice: false,
  }
];

const initialExpenses: BusinessExpense[] = [
  {
    id: 'e1',
    tenant_id: initialTenant.id,
    expense_name: 'May Rent - Clinic Premises',
    amount: 45000,
    category: 'Rent',
    expense_date: '2026-05-31',
    attachment_size_bytes: 520000, // 0.5 MB
  },
  {
    id: 'e2',
    tenant_id: initialTenant.id,
    expense_name: 'Therapist Latex Gloves & Sanitizers',
    amount: 8500,
    category: 'Supplies',
    expense_date: '2026-06-05',
    attachment_size_bytes: 88000, // 0.08 MB
  },
  {
    id: 'e3',
    tenant_id: initialTenant.id,
    expense_name: 'BESCOM Electricity Bill - May',
    amount: 4200,
    category: 'Utilities',
    expense_date: '2026-06-02',
    attachment_size_bytes: 45000,
  },
  {
    id: 'e4',
    tenant_id: initialTenant.id,
    expense_name: 'Water & Cleaning Services',
    amount: 1500,
    category: 'Utilities',
    expense_date: '2026-06-03',
    attachment_size_bytes: 0,
  },
  {
    id: 'e5',
    tenant_id: initialTenant.id,
    expense_name: 'Clinic Supplies - Resistance Loop Bands',
    amount: 2400,
    category: 'Supplies',
    expense_date: '2026-06-06',
    attachment_size_bytes: 12000,
  },
  {
    id: 'e6',
    tenant_id: initialTenant.id,
    expense_name: 'Salary Payout - Dr. Ananya Sharma',
    amount: 60000,
    category: 'Salaries',
    expense_date: '2026-06-01',
    attachment_size_bytes: 150000,
  },
  {
    id: 'e7',
    tenant_id: initialTenant.id,
    expense_name: 'Salary Payout - Rohan Mehta',
    amount: 30000,
    category: 'Salaries',
    expense_date: '2026-06-01',
    attachment_size_bytes: 150000,
  }
];

const initialAuditTrails: SystemAuditTrail[] = [
  {
    id: generateUUID(),
    tenant_id: initialTenant.id,
    action_type: 'READ_PATIENT',
    description: "Viewed patient profile and clinical logs for 'Aarav Patel'",
    performed_by: 'Dibin',
    created_at: '2026-06-12T18:45:00Z',
  },
  {
    id: generateUUID(),
    tenant_id: initialTenant.id,
    action_type: 'FINANCIAL_MUTATION',
    description: "Generated Invoice INV-2026-003 for Kabir Nair with total: ₹1,180",
    performed_by: 'Dibin',
    created_at: '2026-06-12T15:31:00Z',
  },
  {
    id: generateUUID(),
    tenant_id: initialTenant.id,
    action_type: 'CONSENT_CHANGED',
    description: "Updated DPDP Act status for Kabir Nair: Consent Set to False",
    performed_by: 'Dibin',
    created_at: '2026-06-12T14:10:00Z',
  }
];

const initialTodoTasks: TodoTask[] = [
  {
    id: 't1',
    tenant_id: initialTenant.id,
    title: 'Follow up on Aarav Patel MRI Report',
    description: 'Review the ACL grade 2 knee MRI scan reports from the diagnostics center and upload attachment.',
    status: 'PENDING',
    assigned_to: 'u2222222-2222-2222-2222-222222222222', // Ananya
    created_by: 'u1111111-1111-1111-1111-111111111111', // Dibin
    created_at: '2026-06-10T09:00:00Z',
  },
  {
    id: 't2',
    tenant_id: initialTenant.id,
    title: 'Reorder Kinesiology Tape',
    description: 'Current stock is running low. Coordinate with suppliers to order 50 new therapeutic rolls.',
    status: 'PENDING',
    assigned_to: 'u3333333-3333-3333-3333-333333333333', // Rohan
    created_by: 'u1111111-1111-1111-1111-111111111111', // Dibin
    created_at: '2026-06-11T14:30:00Z',
  },
  {
    id: 't3',
    tenant_id: initialTenant.id,
    title: 'Approve May Payroll Spreadsheet',
    description: 'Submit calculated session bonuses and base salary payouts to accounting bank portal.',
    status: 'COMPLETED',
    assigned_to: 'u1111111-1111-1111-1111-111111111111', // Dibin
    created_by: 'u1111111-1111-1111-1111-111111111111', // Dibin
    created_at: '2026-06-01T10:00:00Z',
  }
];

const initialScheduledSessions: ScheduledSession[] = [
  {
    id: 's1',
    tenant_id: initialTenant.id,
    patient_id: 'p1111111-1111-1111-1111-111111111111', // Aarav
    practitioner_id: 'u2222222-2222-2222-2222-222222222222', // Ananya
    start_time: '2026-06-13T09:00:00',
    end_time: '2026-06-13T10:00:00',
    session_notes: 'ACL strengthening exercise routine.',
    status: 'completed',
    created_at: '2026-06-12T10:00:00Z',
  },
  {
    id: 's2',
    tenant_id: initialTenant.id,
    patient_id: 'p2222222-2222-2222-2222-222222222222', // Priya
    practitioner_id: 'u2222222-2222-2222-2222-222222222222', // Ananya
    start_time: '2026-06-13T11:30:00',
    end_time: '2026-06-13T12:30:00',
    session_notes: 'Cervical mobilization and home exercise review.',
    status: 'completed',
    created_at: '2026-06-12T11:00:00Z',
  },
  {
    id: 's3',
    tenant_id: initialTenant.id,
    patient_id: 'p3333333-3333-3333-3333-333333333333', // Kabir
    practitioner_id: 'u1111111-1111-1111-1111-111111111111', // Dibin
    start_time: '2026-06-13T15:00:00',
    end_time: '2026-06-13T16:00:00',
    session_notes: 'Lower back spine evaluation.',
    status: 'scheduled',
    created_at: '2026-06-12T12:00:00Z',
  }
];

// Helper to retrieve or initialize state in LocalStorage
const getStorageItem = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') {
    return defaultValue;
  }
  const data = localStorage.getItem(`zenith_${key}`);
  if (!data) {
    localStorage.setItem(`zenith_${key}`, JSON.stringify(defaultValue));
    return defaultValue;
  }
  return JSON.parse(data);
};

const setStorageItem = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`zenith_${key}`, JSON.stringify(value));
};


const mapTodoTaskFromDb = (row: any): TodoTask => {
  if (!row) return {} as TodoTask;
  let title = row.title;
  let description = row.description;
  if ('task_body' in row) {
    const [t, ...descParts] = (row.task_body || '').split(' | ');
    title = t || '';
    description = descParts.join(' | ') || '';
  }
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    title: title || '',
    description: description || '',
    status: String(row.status).toUpperCase() as 'PENDING' | 'COMPLETED',
    assigned_to: row.assignee_id || row.assigned_to || '',
    created_by: row.creator_id || row.created_by || '',
    created_at: row.created_at,
  };
};

export const dataService = {
  // TENANTS
  getTenant: async (): Promise<Tenant> => {
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      if (!token) {
        throw new Error("No active auth token available on client.");
      }
      return getTenantAction(token);
    } else {
      return getStorageItem('tenant', initialTenant);
    }
  },

  updateTenant: async (tenant: Partial<Tenant>): Promise<Tenant> => {
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      return updateTenantAction(token, tenant);
    } else {
      const current = getStorageItem('tenant', initialTenant);
      const updated = { ...current, ...tenant };
      setStorageItem('tenant', updated);
      return updated;
    }
  },

  // USERS / STAFF
  getUsers: async (): Promise<User[]> => {
    if (isSupabaseConfigured && supabase) {
      try {
        const token = await getAuthToken();
        const data = await getUsersAction(token);
        return (data || []).map((row: any) => ({
          ...row,
          can_manage_staff: row.resource_fhir?.can_manage_staff !== undefined
            ? row.resource_fhir.can_manage_staff
            : (row.position_role === 'Admin')
        }));
      } catch (err) {
        console.warn("Error in getUsers:", err);
        return [];
      }
    } else {
      const localUsers = getStorageItem('users', initialUsers);
      return localUsers.map((row: any) => ({
        ...row,
        can_manage_staff: row.resource_fhir?.can_manage_staff !== undefined
          ? row.resource_fhir.can_manage_staff
          : (row.position_role === 'Admin')
      }));
    }
  },

  getCurrentUser: async (): Promise<User | null> => {
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      if (!token) return null;
      const data = await getCurrentUserAction(token);
      if (!data) return null;
      return {
        ...data,
        can_manage_staff: data.resource_fhir?.can_manage_staff !== undefined
          ? data.resource_fhir.can_manage_staff
          : (data.position_role === 'Admin')
      };
    } else {
      const session = localStorage.getItem('zenith_session');
      if (session) {
        try {
          const parsed = JSON.parse(session);
          const users = getStorageItem('users', initialUsers);
          const matched = users.find(u => u.email.toLowerCase() === parsed.email.toLowerCase()) || users[0] || null;
          if (matched) {
            return {
              ...matched,
              can_manage_staff: matched.resource_fhir?.can_manage_staff !== undefined
                ? matched.resource_fhir.can_manage_staff
                : (matched.position_role === 'Admin')
            };
          }
          return null;
        } catch {
          return null;
        }
      }
      return null;
    }
  },

  updateUserPermissions: async (userId: string, updates: Partial<User>): Promise<User> => {
    let current: any;
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      const users = await getUsersAction(token);
      current = users.find((u: any) => u.id === userId);
    } else {
      const users = getStorageItem('users', initialUsers);
      current = users.find((u) => u.id === userId);
    }
    if (!current) throw new Error('User not found');

    const resourceFhir = {
      ...(current.resource_fhir || {}),
      ...(updates.resource_fhir || {}),
    };
    if (updates.can_manage_staff !== undefined) {
      resourceFhir.can_manage_staff = updates.can_manage_staff;
    }

    const { can_manage_staff, ...rest } = updates;
    const dbPayload = {
      ...rest,
      resource_fhir: resourceFhir,
    };

    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      const data = await updateUserPermissionsAction(token, userId, dbPayload);
      return {
        ...data,
        can_manage_staff: data.resource_fhir?.can_manage_staff !== undefined
          ? data.resource_fhir.can_manage_staff
          : (data.position_role === 'Admin')
      };
    } else {
      const users = getStorageItem('users', initialUsers);
      const idx = users.findIndex((u) => u.id === userId);
      if (idx !== -1) {
        users[idx] = { ...users[idx], ...dbPayload };
        setStorageItem('users', users);
        return {
          ...users[idx],
          can_manage_staff: users[idx].resource_fhir?.can_manage_staff !== undefined
            ? users[idx].resource_fhir.can_manage_staff
            : (users[idx].position_role === 'Admin')
        };
      }
      throw new Error('User not found');
    }
  },

  addUser: async (user: Omit<User, 'id' | 'tenant_id'> & { id?: string }): Promise<User> => {
    const tenant = await dataService.getTenant();
    
    const resourceFhir = {
      ...(user.resource_fhir || {}),
      can_manage_staff: user.can_manage_staff !== undefined ? user.can_manage_staff : (user.position_role === 'Admin'),
    };

    const { can_manage_staff, ...rest } = user;
    const newUser = {
      ...rest,
      id: user.id || generateUUID(),
      tenant_id: tenant.id,
      resource_fhir: resourceFhir,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      const data = await addUserAction(token, newUser);
      return {
        ...data,
        can_manage_staff: data.resource_fhir?.can_manage_staff !== undefined
          ? data.resource_fhir.can_manage_staff
          : (data.position_role === 'Admin')
      };
    } else {
      const users = getStorageItem('users', initialUsers);
      users.push(newUser as any);
      setStorageItem('users', users);
      return {
        ...newUser,
        can_manage_staff: newUser.resource_fhir?.can_manage_staff !== undefined
          ? newUser.resource_fhir.can_manage_staff
          : (newUser.position_role === 'Admin')
      } as any;
    }
  },

  createStaffAuthUser: async (
    email: string,
    password?: string,
    fullName?: string,
    role?: 'Admin' | 'Senior Therapist' | 'Receptionist',
    targetUserId?: string
  ): Promise<string> => {
    if (isSupabaseConfigured && supabase) {
      const tenant = await dataService.getTenant();
      const token = await getAuthToken();
      return createStaffAuthAction(token, email, password, fullName, role, tenant.id, targetUserId);
    } else {
      // LocalStorage Mock Mode
      const tenant = getStorageItem('tenant', initialTenant);
      const newUserId = targetUserId || generateUUID();
      
      // Seed mockup auth session / logins in localstorage if needed
      const mockLogins = getStorageItem<{ [email: string]: string }>('mock_auth_passwords', {
        'dibin@zenithcore.com': 'password',
        'ananya@zenithcore.com': 'password',
        'rohan@zenithcore.com': 'password',
      });
      mockLogins[email.toLowerCase()] = password || 'password';
      setStorageItem('mock_auth_passwords', mockLogins);
      
      const mockStatuses = getStorageItem<Array<{ id: string; exists: boolean; paused: boolean }>>('mock_auth_statuses', [
        { id: 'u1111111-1111-1111-1111-111111111111', exists: true, paused: false },
        { id: 'u2222222-2222-2222-2222-222222222222', exists: true, paused: false },
        { id: 'u3333333-3333-3333-3333-333333333333', exists: true, paused: false },
      ]);
      
      const existingIdx = mockStatuses.findIndex(s => s.id === newUserId);
      if (existingIdx !== -1) {
        mockStatuses[existingIdx] = { id: newUserId, exists: true, paused: false };
      } else {
        mockStatuses.push({ id: newUserId, exists: true, paused: false });
      }
      setStorageItem('mock_auth_statuses', mockStatuses);

      // If this is a new user (no targetUserId), add to public.users mock list as well
      if (!targetUserId) {
        const users = getStorageItem('users', initialUsers);
        const resourceFhir = {
          resourceType: 'Practitioner',
          active: true,
          name: [{ text: fullName || email.split('@')[0] }],
          can_manage_staff: role === 'Admin'
        };
        const newUser: User = {
          id: newUserId,
          tenant_id: tenant.id,
          email,
          full_name: fullName || email.split('@')[0],
          position_role: role || 'Receptionist',
          medical_council_registration_no: '',
          can_view_personal_data: true,
          can_view_medical_history: role !== 'Receptionist',
          can_manage_finance: role === 'Admin',
          can_print_generate_invoice: true,
          can_manage_staff: role === 'Admin',
          base_salary_monthly: 0,
          bonus_system_enabled: false,
          resource_fhir: resourceFhir
        };
        users.push(newUser);
        setStorageItem('users', users);
      }
      
      return newUserId;
    }
  },

  pauseStaffAuthUser: async (targetUserId: string, shouldPause: boolean): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      await pauseStaffAuthAction(token, targetUserId, shouldPause);
    } else {
      // LocalStorage Mock Mode
      const mockStatuses = getStorageItem<Array<{ id: string; exists: boolean; paused: boolean }>>('mock_auth_statuses', [
        { id: 'u1111111-1111-1111-1111-111111111111', exists: true, paused: false },
        { id: 'u2222222-2222-2222-2222-222222222222', exists: true, paused: false },
        { id: 'u3333333-3333-3333-3333-333333333333', exists: true, paused: false },
      ]);
      const idx = mockStatuses.findIndex(s => s.id === targetUserId);
      if (idx !== -1) {
        mockStatuses[idx].paused = shouldPause;
      } else {
        mockStatuses.push({ id: targetUserId, exists: true, paused: shouldPause });
      }
      setStorageItem('mock_auth_statuses', mockStatuses);
    }
  },

  getAuthUsersStatus: async (): Promise<Array<{ id: string; exists: boolean; paused: boolean }>> => {
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      return getAuthUsersStatusAction(token);
    } else {
      // LocalStorage Mock Mode
      return getStorageItem<Array<{ id: string; exists: boolean; paused: boolean }>>('mock_auth_statuses', [
        { id: 'u1111111-1111-1111-1111-111111111111', exists: true, paused: false },
        { id: 'u2222222-2222-2222-2222-222222222222', exists: true, paused: false },
        { id: 'u3333333-3333-3333-3333-333333333333', exists: true, paused: false },
      ]);
    }
  },

  deleteStaffUser: async (targetUserId: string): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      await deleteStaffAction(token, targetUserId);
    } else {
      // LocalStorage Mock Mode
      const users = getStorageItem<User[]>('users', initialUsers);
      const remainingUsers = users.filter((u) => u.id !== targetUserId);
      setStorageItem('users', remainingUsers);

      const mockStatuses = getStorageItem<Array<{ id: string; exists: boolean; paused: boolean }>>('mock_auth_statuses', []);
      const remainingStatuses = mockStatuses.filter((s) => s.id !== targetUserId);
      setStorageItem('mock_auth_statuses', remainingStatuses);
    }
  },

  // PATIENTS
  getPatients: async (searchQuery?: string): Promise<Patient[]> => {
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      return getPatientsAction(token, searchQuery);
    } else {
      const patients = getStorageItem('patients', initialPatients);
      if (!searchQuery) return patients;
      const q = searchQuery.toLowerCase();
      return patients.filter((p) => {
        const given = p.resource_fhir?.name?.[0]?.given?.[0]?.toLowerCase() || '';
        const family = p.resource_fhir?.name?.[0]?.family?.toLowerCase() || '';
        const full = `${given} ${family}`;
        return (
          full.includes(q) ||
          (p.abha_number || '').toLowerCase().includes(q) ||
          (p.abha_address || '').toLowerCase().includes(q)
        );
      });
    }
  },

  addPatient: async (patient: Omit<Patient, 'id' | 'tenant_id'>): Promise<Patient> => {
    const tenant = await dataService.getTenant();
    const newPatient: Patient = {
      ...patient,
      id: generateUUID(),
      tenant_id: tenant.id,
      abha_number: patient.abha_number && patient.abha_number.trim() !== '' ? patient.abha_number.trim() : null,
      abha_address: patient.abha_address && patient.abha_address.trim() !== '' ? patient.abha_address.trim() : null,
      gstin: patient.gstin && patient.gstin.trim() !== '' ? patient.gstin.trim() : null,
    };

    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      return addPatientAction(token, newPatient);
    } else {
      const patients = getStorageItem('patients', initialPatients);
      patients.push(newPatient);
      setStorageItem('patients', patients);
      return newPatient;
    }
  },

  updatePatientConsent: async (
    patientId: string,
    consentGiven: boolean,
    withdrawalRequested: boolean = false
  ): Promise<Patient> => {
    const updates = {
      consent_given: consentGiven,
      consent_timestamp: consentGiven ? new Date().toISOString() : '',
      consent_withdrawal_requested: withdrawalRequested,
    };

    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      return updatePatientConsentAction(token, patientId, updates);
    } else {
      const patients = getStorageItem('patients', initialPatients);
      const idx = patients.findIndex((p) => p.id === patientId);
      if (idx !== -1) {
        patients[idx] = { ...patients[idx], ...updates };
        setStorageItem('patients', patients);
        return patients[idx];
      }
      throw new Error('Patient not found');
    }
  },

  updatePatientGst: async (patientId: string, gstEnabled: boolean, gstin: string | null): Promise<Patient> => {
    const updates = { gst_enabled: gstEnabled, gstin };
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      return updatePatientGstAction(token, patientId, updates);
    } else {
      const patients = getStorageItem('patients', initialPatients);
      const idx = patients.findIndex((p) => p.id === patientId);
      if (idx !== -1) {
        patients[idx] = { ...patients[idx], ...updates };
        setStorageItem('patients', patients);
        return patients[idx];
      }
      throw new Error('Patient not found');
    }
  },

  updatePatientResource: async (patientId: string, resourceFhir: any): Promise<Patient> => {
    const updates = { resource_fhir: resourceFhir };
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      return updatePatientConsentAction(token, patientId, updates);
    } else {
      const patients = getStorageItem('patients', initialPatients);
      const idx = patients.findIndex((p) => p.id === patientId);
      if (idx !== -1) {
        patients[idx] = { ...patients[idx], resource_fhir: resourceFhir };
        setStorageItem('patients', patients);
        return patients[idx];
      }
      throw new Error('Patient not found');
    }
  },

  // CLINICAL LOGS
  getClinicalLogs: async (patientId: string): Promise<ClinicalLog[]> => {
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      return getClinicalLogsAction(token, patientId);
    } else {
      const logs = getStorageItem('clinical_logs', initialClinicalLogs);
      return logs.filter((log) => log.patient_id === patientId && !log.is_deleted);
    }
  },

  addClinicalLog: async (
    patientId: string,
    summary: string,
    attachments: Array<{ name: string; type: string; size: number }> = []
  ): Promise<ClinicalLog> => {
    const tenant = await dataService.getTenant();
    const currentUser = await dataService.getCurrentUser();
    const totalSize = attachments.reduce((sum, item) => sum + item.size, 0);

    const newLog: ClinicalLog = {
      id: generateUUID(),
      tenant_id: tenant.id,
      patient_id: patientId,
      author_id: currentUser ? currentUser.id : 'u1111111-1111-1111-1111-111111111111',
      resource_fhir: {
        resourceType: 'ClinicalImpression',
        status: 'completed',
        summary: summary,
        date: new Date().toISOString(),
      },
      attachments: attachments,
      attachment_size_bytes: totalSize,
      is_deleted: false,
    };

    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      return addClinicalLogAction(token, newLog);
    } else {
      const logs = getStorageItem('clinical_logs', initialClinicalLogs);
      logs.push(newLog);
      setStorageItem('clinical_logs', logs);
      return newLog;
    }
  },

  softDeleteClinicalLog: async (logId: string): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      await softDeleteClinicalLogAction(token, logId);
    } else {
      const logs = getStorageItem('clinical_logs', initialClinicalLogs);
      const idx = logs.findIndex((l) => l.id === logId);
      if (idx !== -1) {
        logs[idx].is_deleted = true;
        setStorageItem('clinical_logs', logs);
      }
    }
  },

  // INVOICES
  getInvoices: async (): Promise<Invoice[]> => {
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      return getInvoicesAction(token);
    } else {
      return getStorageItem('invoices', initialInvoices);
    }
  },

  addInvoice: async (
    patientId: string,
    sessions: number,
    practitionerId: string,
    applyGst: boolean,
    baseAmount: number,
    customItems?: Array<{ name: string; quantity: number; rate: number }>
  ): Promise<Invoice> => {
    const tenant = await dataService.getTenant();
    
    // Get logged-in user or first user in the system
    const loggedInUser = await dataService.getCurrentUser();
    const fallbackUser = (await dataService.getUsers())[0];
    const generatedBy = loggedInUser?.id || fallbackUser?.id || null;

    // Compute Indian GST (9% CGST + 9% SGST = 18% total if enabled)
    const cgst_rate = applyGst ? 9 : 0;
    const sgst_rate = applyGst ? 9 : 0;
    const computed_tax_amount = applyGst ? baseAmount * 0.18 : 0;
    const total_amount = baseAmount + computed_tax_amount;

    // Get current total count of invoices dynamically to base invoice serial sequence
    let currentInvoicesCount = 0;
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      const dbInvoices = await getInvoicesAction(token);
      currentInvoicesCount = dbInvoices.length;
    } else {
      currentInvoicesCount = getStorageItem('invoices', initialInvoices).length;
    }
    const nextNum = currentInvoicesCount + 1;
    const invoiceNum = `INV-2026-${String(nextNum).padStart(3, '0')}`;
    const invoiceId = isSupabaseConfigured ? generateUUID() : invoiceNum; // UUID primary key for Supabase, sequential for mock

    // Calculate session rate
    const customTotal = customItems ? customItems.reduce((sum, item) => sum + item.quantity * item.rate, 0) : 0;
    const sessionsTotal = baseAmount - customTotal;
    const sessionRate = sessions > 0 ? sessionsTotal / sessions : 0;

    const newInvoice: Invoice = {
      id: invoiceId,
      tenant_id: tenant.id,
      patient_id: patientId,
      generated_by: generatedBy,
      session_count_incremented: sessions,
      associated_practitioner_id: practitionerId,
      apply_gst: applyGst,
      cgst_rate,
      sgst_rate,
      igst_rate: 0,
      computed_tax_amount,
      total_amount,
      payment_status: isSupabaseConfigured ? 'pending' : 'PENDING',
      created_at: new Date().toISOString(),
      resource_fhir: {
        resourceType: 'Invoice',
        status: 'issued',
        identifier: [{ system: 'local', value: invoiceNum }],
        totalNet: { value: baseAmount, currency: 'INR' },
        totalGross: { value: total_amount, currency: 'INR' },
        lineItem: [
          {
            description: 'Therapy Session Units',
            quantity: sessions,
            priceComponent: [{
              type: 'base',
              factor: sessions,
              amount: { value: sessionRate, currency: 'INR' }
            }]
          },
          ...(customItems || []).map(item => ({
            description: item.name,
            quantity: item.quantity,
            priceComponent: [{
              type: 'base',
              factor: item.quantity,
              amount: { value: item.rate, currency: 'INR' }
            }]
          }))
        ]
      }
    };

    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      return addInvoiceAction(token, newInvoice);
    } else {
      const invoices = getStorageItem('invoices', initialInvoices);
      invoices.push(newInvoice);
      setStorageItem('invoices', invoices);
      return newInvoice;
    }
  },

  updateInvoiceStatus: async (invoiceId: string, status: Invoice['payment_status']): Promise<Invoice> => {
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      return updateInvoicePaymentStatusAction(token, invoiceId, status.toLowerCase());
    } else {
      const invoices = getStorageItem('invoices', initialInvoices);
      const idx = invoices.findIndex((inv) => inv.id === invoiceId);
      if (idx !== -1) {
        invoices[idx].payment_status = status;
        setStorageItem('invoices', invoices);
        return invoices[idx];
      }
      throw new Error('Invoice not found');
    }
  },

  // INVENTORY
  getInventory: async (): Promise<InventoryItem[]> => {
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      return getInventoryAction(token);
    } else {
      return getStorageItem('inventory', initialInventory);
    }
  },

  updateInventoryStock: async (itemId: string, count: number): Promise<InventoryItem> => {
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      return updateInventoryStockAction(token, itemId, count);
    } else {
      const items = getStorageItem('inventory', initialInventory);
      const idx = items.findIndex((i) => i.id === itemId);
      if (idx !== -1) {
        items[idx].stock_count = count;
        setStorageItem('inventory', items);
        return items[idx];
      }
      throw new Error('Item not found');
    }
  },

  addInventoryItem: async (item: Omit<InventoryItem, 'id' | 'tenant_id'>): Promise<InventoryItem> => {
    const tenant = await dataService.getTenant();
    const newItem: InventoryItem = {
      ...item,
      id: generateUUID(),
      tenant_id: tenant.id,
    };

    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      return addInventoryItemAction(token, newItem);
    } else {
      const items = getStorageItem('inventory', initialInventory);
      items.push(newItem);
      setStorageItem('inventory', items);
      return newItem;
    }
  },

  // EXPENSES
  getExpenses: async (): Promise<BusinessExpense[]> => {
    if (isSupabaseConfigured && supabase) {
      try {
        const token = await getAuthToken();
        const data = await getExpensesAction(token);
        return (data || []).map((row: any) => ({
          id: row.id,
          tenant_id: row.tenant_id,
          expense_name: row.description || row.expense_name || '',
          amount: Number(row.amount),
          category: row.category,
          expense_date: row.expense_date,
          attachment_size_bytes: Number(row.attachment_size_bytes || 0),
        }));
      } catch (err) {
        console.warn("Error in getExpenses, falling back to LocalStorage:", err);
        return getStorageItem('expenses', initialExpenses);
      }
    } else {
      return getStorageItem('expenses', initialExpenses);
    }
  },

  addExpense: async (expense: Omit<BusinessExpense, 'id' | 'tenant_id'>): Promise<BusinessExpense> => {
    const tenant = await dataService.getTenant();
    const newExpense = {
      id: generateUUID(),
      tenant_id: tenant.id,
      amount: expense.amount,
      category: expense.category,
      expense_date: expense.expense_date,
      attachment_size_bytes: expense.attachment_size_bytes,
    };

    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      let userId: string | null = null;
      try {
        const currentUser = await dataService.getCurrentUser();
        userId = currentUser?.id || null;
      } catch (authErr) {
        console.warn("Failed to retrieve auth user inside addExpense:", authErr);
      }

      const dbPayload = {
        ...newExpense,
        description: expense.expense_name,
        logged_by: userId,
      };

      try {
        const data = await addExpenseAction(token, dbPayload);
        return {
          id: data.id,
          tenant_id: data.tenant_id,
          expense_name: data.description || data.expense_name || '',
          amount: Number(data.amount),
          category: data.category,
          expense_date: data.expense_date,
          attachment_size_bytes: Number(data.attachment_size_bytes || 0),
        };
      } catch (err) {
        console.warn("Error inserting expense to Supabase, falling back to LocalStorage:", err);
        const mockExpense: BusinessExpense = {
          ...newExpense,
          expense_name: expense.expense_name,
        };
        const expenses = getStorageItem('expenses', initialExpenses);
        expenses.push(mockExpense);
        setStorageItem('expenses', expenses);
        return mockExpense;
      }
    } else {
      const mockExpense: BusinessExpense = {
        ...newExpense,
        expense_name: expense.expense_name,
      };
      const expenses = getStorageItem('expenses', initialExpenses);
      expenses.push(mockExpense);
      setStorageItem('expenses', expenses);
      return mockExpense;
    }
  },

  // AUDIT TRAILS
  getAuditTrails: async (): Promise<SystemAuditTrail[]> => {
    if (isSupabaseConfigured && supabase) {
      try {
        const token = await getAuthToken();
        const data = await getAuditTrailsAction(token);
        return (data || []).map((row: any) => ({
          id: row.id,
          tenant_id: row.tenant_id,
          action_type: row.action_type,
          description: row.metadata?.description || row.resource_affected || 'No description provided',
          performed_by: row.performer?.full_name || row.performer?.email || 'System / Unknown',
          created_at: row.timestamp || new Date().toISOString()
        }));
      } catch (err) {
        console.warn("Error in getAuditTrails, falling back to LocalStorage:", err);
        return getStorageItem('audit_trails', initialAuditTrails);
      }
    } else {
      return getStorageItem('audit_trails', initialAuditTrails);
    }
  },

  addAuditTrail: async (actionType: SystemAuditTrail['action_type'], description: string): Promise<void> => {
    const tenant = await dataService.getTenant();
    
    // Attempt to get logged-in user profile
    let currentUserId: string | null = null;
    let currentUserEmail = 'System / Unknown';
    try {
      const currentUser = await dataService.getCurrentUser();
      if (currentUser) {
        currentUserId = currentUser.id;
        currentUserEmail = currentUser.full_name || currentUser.email || 'Unknown User';
      }
    } catch (e) {
      console.warn("Failed to load current user for audit trail:", e);
    }

    if (isSupabaseConfigured && supabase) {
      const dbRow = {
        id: generateUUID(),
        tenant_id: tenant.id,
        performer_id: currentUserId,
        action_type: actionType,
        resource_affected: description.substring(0, 100) || 'System',
        metadata: { description },
      };
      
      try {
        const token = await getAuthToken();
        await addAuditTrailAction(token, dbRow);
      } catch (err: any) {
        console.error("Failed to insert audit trail into Supabase system_audit_trails. Error message: " + err.message);
      }
    } else {
      const newTrail: SystemAuditTrail = {
        id: generateUUID(),
        tenant_id: tenant.id,
        action_type: actionType,
        description,
        performed_by: currentUserEmail,
        created_at: new Date().toISOString(),
      };
      const trails = getStorageItem('audit_trails', initialAuditTrails);
      trails.unshift(newTrail);
      setStorageItem('audit_trails', trails);
    }
  },

  truncateAuditTrails: async (): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      await truncateAuditTrailsAction(token);
    } else {
      setStorageItem('audit_trails', []);
    }
    await dataService.addAuditTrail('FINANCIAL_MUTATION', 'Cleared entire system audit log');
  },

  // TODO TASKS
  getTodoTasks: async (): Promise<TodoTask[]> => {
    if (isSupabaseConfigured && supabase) {
      try {
        const token = await getAuthToken();
        const data = await getTodoTasksAction(token);
        return (data || []).map(mapTodoTaskFromDb);
      } catch (err) {
        console.warn("Error in getTodoTasks, falling back to LocalStorage:", err);
        return getStorageItem('todo_tasks', initialTodoTasks);
      }
    } else {
      return getStorageItem('todo_tasks', initialTodoTasks);
    }
  },

  addTodoTask: async (task: Omit<TodoTask, 'id' | 'tenant_id' | 'status' | 'created_at'>): Promise<TodoTask> => {
    const tenant = await dataService.getTenant();
    const newTask: TodoTask = {
      ...task,
      id: generateUUID(),
      tenant_id: tenant.id,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };

    let createdTask: TodoTask;
    if (isSupabaseConfigured && supabase) {
      try {
        const dbPayload = {
          id: newTask.id,
          tenant_id: newTask.tenant_id,
          status: 'pending',
          assignee_id: newTask.assigned_to,
          creator_id: newTask.created_by,
          task_body: newTask.title + (newTask.description ? ' | ' + newTask.description : ''),
        };
        const token = await getAuthToken();
        const data = await addTodoTaskAction(token, dbPayload);
        createdTask = mapTodoTaskFromDb(data);
      } catch (err) {
        console.warn("Error inserting task to Supabase, falling back to LocalStorage:", err);
        const tasks = getStorageItem('todo_tasks', initialTodoTasks);
        tasks.push(newTask);
        setStorageItem('todo_tasks', tasks);
        notifySubscribers('todo_tasks', 'INSERT', newTask);
        createdTask = newTask;
      }
    } else {
      const tasks = getStorageItem('todo_tasks', initialTodoTasks);
      tasks.push(newTask);
      setStorageItem('todo_tasks', tasks);
      notifySubscribers('todo_tasks', 'INSERT', newTask);
      createdTask = newTask;
    }

    if (createdTask.assigned_to) {
      try {
        await dataService.addNotification({
          user_id: createdTask.assigned_to,
          title: 'New Task Assigned',
          description: `You have been assigned a new task: "${createdTask.title}"`,
          target_id: createdTask.id,
        });
      } catch (err) {
        console.warn("Failed to route task assignment notification:", err);
      }
    }

    // Notify all admins of new tasks
    try {
      const users = await dataService.getUsers();
      const admins = users.filter(u => u.position_role === 'Admin');
      const assigneeName = users.find(u => u.id === createdTask.assigned_to)?.full_name || 'Specialist';
      for (const admin of admins) {
        await dataService.addNotification({
          user_id: admin.id,
          title: 'New Workspace Task Created',
          description: `Task "${createdTask.title}" was created and assigned to ${assigneeName}`,
          target_id: createdTask.id,
        });
      }
    } catch (err) {
      console.warn("Failed to notify admins of new task:", err);
    }

    return createdTask;
  },

  toggleTodoTask: async (taskId: string): Promise<TodoTask> => {
    if (isSupabaseConfigured && supabase) {
      try {
        const token = await getAuthToken();
        const tasks = await getTodoTasksAction(token);
        const current = tasks.find((t: any) => t.id === taskId);
        const nextStatus = current?.status.toLowerCase() === 'completed' ? 'pending' : 'completed';
        const data = await updateTodoTaskStatusAction(token, taskId, nextStatus);
        return mapTodoTaskFromDb(data);
      } catch (err) {
        console.warn("Failed to toggle task status in Supabase, falling back to LocalStorage:", err);
        const tasks = getStorageItem('todo_tasks', initialTodoTasks);
        const idx = tasks.findIndex((t) => t.id === taskId);
        if (idx !== -1) {
          tasks[idx].status = tasks[idx].status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
          setStorageItem('todo_tasks', tasks);
          notifySubscribers('todo_tasks', 'UPDATE', tasks[idx]);
          return tasks[idx];
        }
        throw new Error('Task not found in LocalStorage');
      }
    } else {
      const tasks = getStorageItem('todo_tasks', initialTodoTasks);
      const idx = tasks.findIndex((t) => t.id === taskId);
      if (idx !== -1) {
        tasks[idx].status = tasks[idx].status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
        setStorageItem('todo_tasks', tasks);
        notifySubscribers('todo_tasks', 'UPDATE', tasks[idx]);
        return tasks[idx];
      }
      throw new Error('Task not found');
    }
  },

  wipeCompletedTasks: async (): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      try {
        const token = await getAuthToken();
        await wipeCompletedTasksAction(token);
      } catch (err) {
        console.warn("Failed to wipe completed tasks in Supabase, falling back to LocalStorage:", err);
        const tasks = getStorageItem('todo_tasks', initialTodoTasks);
        const remaining = tasks.filter((t) => t.status !== 'COMPLETED');
        setStorageItem('todo_tasks', remaining);
        notifySubscribers('todo_tasks', 'DELETE', { id: 'all' });
      }
    } else {
      const tasks = getStorageItem('todo_tasks', initialTodoTasks);
      const remaining = tasks.filter((t) => t.status !== 'COMPLETED');
      setStorageItem('todo_tasks', remaining);
      notifySubscribers('todo_tasks', 'DELETE', { id: 'all' });
    }
  },

  // SCHEDULED SESSIONS (APPOINTMENTS)
  getScheduledSessions: async (): Promise<ScheduledSession[]> => {
    if (isSupabaseConfigured && supabase) {
      try {
        const token = await getAuthToken();
        const data = await getScheduledSessionsAction(token);
        return (data || []).map((session: any) => ({
          ...session,
          status: session.status || 'scheduled',
          session_notes: session.next_session_notes || session.session_notes || ''
        }));
      } catch (err) {
        console.warn("Error fetching scheduled sessions from Supabase, falling back to LocalStorage:", err);
        return getStorageItem('scheduled_sessions', initialScheduledSessions);
      }
    } else {
      const mockSessions = getStorageItem('scheduled_sessions', initialScheduledSessions);
      return mockSessions.map((s) => ({
        ...s,
        status: s.status || 'scheduled',
      }));
    }
  },

  addScheduledSession: async (session: Omit<ScheduledSession, 'id' | 'tenant_id' | 'created_at'>): Promise<ScheduledSession> => {
    const tenant = await dataService.getTenant();
    
    // Validate end time > start time
    if (!session.start_time || !session.end_time) {
      throw new Error("Start and end times are required.");
    }
    const startB = new Date(session.start_time).getTime();
    const endB = new Date(session.end_time).getTime();
    if (endB <= startB) {
      throw new Error("Session end time must be after the start time.");
    }

    // Check for practitioner slot conflict
    try {
      const existingSessions = await dataService.getScheduledSessions();
      const conflict = existingSessions.find((s) => {
        if (s.practitioner_id !== session.practitioner_id) return false;
        if (!s.start_time || !s.end_time) return false;
        if (s.status === 'cancelled') return false; // Cancelled appointments don't block slots!
        const startA = new Date(s.start_time).getTime();
        const endA = new Date(s.end_time).getTime();
        return startA < endB && startB < endA;
      });

      if (conflict) {
        throw new Error("This time slot overlaps with an existing appointment for the selected practitioner.");
      }
    } catch (e: any) {
      if (e.message && (e.message.includes("overlaps") || e.message.includes("after") || e.message.includes("required"))) {
        throw e;
      }
      console.warn("Failed to perform conflict validation, proceeding:", e);
    }

    // Map session_notes to next_session_notes database column for Supabase payload
    const dbPayload: any = {
      id: generateUUID(),
      tenant_id: tenant.id,
      patient_id: session.patient_id,
      practitioner_id: session.practitioner_id,
      start_time: session.start_time,
      end_time: session.end_time,
      status: session.status || 'scheduled',
      created_at: new Date().toISOString(),
    };

    let createdSession: ScheduledSession;
    if (isSupabaseConfigured && supabase) {
      dbPayload.next_session_notes = session.session_notes;
      try {
        const token = await getAuthToken();
        const data = await addScheduledSessionAction(token, dbPayload);
        createdSession = {
          ...data,
          session_notes: data.next_session_notes || data.session_notes || ''
        };
      } catch (err) {
        console.error("Error inserting scheduled session to Supabase:", err);
        throw err;
      }
    } else {
      const newSession: ScheduledSession = {
        ...session,
        id: dbPayload.id,
        tenant_id: dbPayload.tenant_id,
        status: dbPayload.status,
        created_at: dbPayload.created_at,
      };
      const sessions = getStorageItem('scheduled_sessions', initialScheduledSessions);
      sessions.push(newSession);
      setStorageItem('scheduled_sessions', sessions);
      notifySubscribers('scheduled_sessions', 'INSERT', newSession);
      createdSession = newSession;
    }

    if (createdSession.practitioner_id) {
      try {
        let patientName = 'Patient';
        const patients = await dataService.getPatients();
        const pat = patients.find(p => p.id === createdSession.patient_id);
        if (pat) {
          const givenName = pat.resource_fhir?.name?.[0]?.given?.[0] || '';
          const familyName = pat.resource_fhir?.name?.[0]?.family || '';
          patientName = `${givenName} ${familyName}`.trim() || 'Patient';
        }
        await dataService.addNotification({
          user_id: createdSession.practitioner_id,
          title: 'New Appointment Assigned',
          description: `Therapy session scheduled with ${patientName} on ${new Date(createdSession.start_time).toLocaleString('en-IN')}`,
          target_id: createdSession.id,
        });
      } catch (err) {
        console.warn("Failed to route appointment assignment notification:", err);
      }
    }

    return createdSession;
  },

  updateScheduledSessionStatus: async (sessionId: string, status: 'scheduled' | 'completed' | 'cancelled'): Promise<ScheduledSession> => {
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      const data = await updateScheduledSessionStatusAction(token, sessionId, status);
      return {
        ...data,
        session_notes: data.next_session_notes || data.session_notes || ''
      };
    } else {
      const sessions = getStorageItem('scheduled_sessions', initialScheduledSessions);
      const idx = sessions.findIndex((s) => s.id === sessionId);
      if (idx !== -1) {
        sessions[idx].status = status;
        setStorageItem('scheduled_sessions', sessions);
        notifySubscribers('scheduled_sessions', 'UPDATE', sessions[idx]);
        return sessions[idx];
      }
      throw new Error('Session not found');
    }
  },

  deleteScheduledSession: async (sessionId: string): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      try {
        const token = await getAuthToken();
        await deleteScheduledSessionAction(token, sessionId);
      } catch (err) {
        console.error("Failed to delete scheduled session in Supabase:", err);
        throw err;
      }
    } else {
      const sessions = getStorageItem('scheduled_sessions', initialScheduledSessions);
      const remaining = sessions.filter((s) => s.id !== sessionId);
      setStorageItem('scheduled_sessions', remaining);
      notifySubscribers('scheduled_sessions', 'DELETE', { id: sessionId });
    }
  },

  // DATABASE VIEW RECONCILIATION - TENANT RESOURCE METRICS
  getTenantResourceMetrics: async () => {
    const tenant = await dataService.getTenant();
    if (isSupabaseConfigured && supabase) {
      try {
        const token = await getAuthToken();
        const data = await getTenantResourceMetricsAction(token, tenant.id);
        if (data) {
          // Convert estimated_database_storage_bytes and total_file_storage_bytes to MB
          const dbUsed = Number(data.estimated_database_storage_bytes || 0) / (1024 * 1024);
          const fileUsed = Number(data.total_file_storage_bytes || 0) / (1024 * 1024);
          
          return {
            max_db_storage_mb: Number(tenant.max_db_storage_mb || 50),
            max_file_storage_mb: Number(tenant.max_file_storage_mb || 200),
            used_db_storage_mb: parseFloat(dbUsed.toFixed(3)),
            used_file_storage_mb: parseFloat(fileUsed.toFixed(3)),
          };
        }
      } catch (err) {
        console.warn("Failed to read resource metrics from Supabase view, falling back to mock calculations:", err);
      }
    }

    // Dynamic Mock Calculations
    let patientsCount = 0;
    let usersCount = 0;
    let invoicesCount = 0;
    try {
      patientsCount = (await dataService.getPatients()).length;
      usersCount = (await dataService.getUsers()).length;
      invoicesCount = (await dataService.getInvoices()).length;
    } catch (e) {
      console.warn("Failed to count database items for mock calculations:", e);
    }
    
    // Base DB storage computation: ~0.08MB per user, ~0.04MB per patient/invoice
    const computedDbUsed = parseFloat(
      (usersCount * 0.08 + patientsCount * 0.04 + invoicesCount * 0.02).toFixed(3)
    );

    // File storage computation: Sum of file sizes in clinical logs + expenses
    const logs = getStorageItem('clinical_logs', initialClinicalLogs).filter(l => !l.is_deleted);
    const expenses = getStorageItem('expenses', initialExpenses);
    
    const logsBytes = logs.reduce((sum, log) => sum + (log.attachment_size_bytes || 0), 0);
    const expensesBytes = expenses.reduce((sum, exp) => sum + (exp.attachment_size_bytes || 0), 0);
    
    const totalBytes = logsBytes + expensesBytes;
    const computedFileUsed = parseFloat((totalBytes / (1024 * 1024)).toFixed(3)); // Convert to MB

    const maxDb = Number(tenant?.max_db_storage_mb || 50);
    const maxFile = Number(tenant?.max_file_storage_mb || 200);

    return {
      max_db_storage_mb: maxDb,
      max_file_storage_mb: maxFile,
      used_db_storage_mb: Math.min(computedDbUsed, maxDb),
      used_file_storage_mb: Math.min(computedFileUsed, maxFile),
    };
  },

  // DATABASE FUNCTION RECONCILIATION - PAYROLL CALCULATOR
  calculateMonthlyPayout: async (staffId: string, targetMonth: string): Promise<{
    base_salary: number;
    sessions_conducted: number;
    clinical_hours: number;
    bonus_multiplier: number;
    computed_bonus: number;
    total_payout: number;
  }> => {
    // We will calculate locally by querying the tables, ensuring 100% correctness regardless of RPC constraints:
    let staff: User | undefined;
    let sessions: ScheduledSession[] = [];

    if (isSupabaseConfigured && supabase) {
      try {
        const users = await dataService.getUsers();
        const userData = users.find(u => u.id === staffId);
        if (userData) {
          staff = userData;
        }
        sessions = await dataService.getScheduledSessions();
      } catch (err) {
        console.warn("Failed to fetch payout data from Supabase, falling back to LocalStorage:", err);
      }
    }

    if (!staff) {
      const users = getStorageItem('users', initialUsers);
      const rawStaff = users.find((u) => u.id === staffId);
      if (rawStaff) {
        staff = {
          ...rawStaff,
          can_manage_staff: rawStaff.resource_fhir?.can_manage_staff !== undefined
            ? rawStaff.resource_fhir.can_manage_staff
            : (rawStaff.position_role === 'Admin')
        };
      }
      const rawSessions = getStorageItem('scheduled_sessions', initialScheduledSessions);
      sessions = rawSessions.map(s => ({
        ...s,
        status: s.status || 'scheduled'
      }));
    }

    if (!staff) throw new Error('Staff not found');

    const baseAmount = staff.base_salary_monthly || 0;
    const completedSessions = sessions.filter((s) => {
      if (s.practitioner_id !== staffId) return false;
      if (s.status !== 'completed') return false; // Only completed / done appointments count for salary bonus!
      return s.start_time.startsWith(targetMonth);
    });

    const countInMonth = completedSessions.length;
    let totalClinicalHours = 0;
    completedSessions.forEach((s) => {
      if (s.start_time && s.end_time) {
        const start = new Date(s.start_time).getTime();
        const end = new Date(s.end_time).getTime();
        const hrs = (end - start) / (1000 * 60 * 60);
        if (hrs > 0) totalClinicalHours += hrs;
      }
    });

    // Fetch threshold hours from tenant configuration (default: 100)
    let thresholdLimit = 100;
    try {
      const tenant = await dataService.getTenant();
      if (tenant && tenant.bonus_threshold_hours !== undefined) {
        thresholdLimit = tenant.bonus_threshold_hours;
      }
    } catch (e) {
      console.warn("Failed to get tenant config for threshold hours:", e);
    }

    // Formula: (baseAmount / 100) * Math.max(0, totalClinicalHours - thresholdLimit)
    const extraHours = Math.max(0, totalClinicalHours - thresholdLimit);
    const computedBonus = staff.bonus_system_enabled ? Math.round((baseAmount / 100) * extraHours) : 0;
    const bonusMultiplier = staff.bonus_system_enabled ? Math.round(baseAmount / 100) : 0; // Hourly bonus rate
    const totalPayout = baseAmount + computedBonus;

    return {
      base_salary: baseAmount,
      sessions_conducted: countInMonth,
      clinical_hours: totalClinicalHours,
      bonus_multiplier: bonusMultiplier,
      computed_bonus: computedBonus,
      total_payout: totalPayout,
    };
  },

  // ONBOARDING WIZARD INITIALIZER
  initializeTenant: async (onboardingData: {
    business_name: string;
    business_type: 'physiotherapy' | 'dentist' | 'general_clinic';
    subdomain: string;
    clinic_start_time: string;
    clinic_end_time: string;
    max_db_storage_mb: number;
    max_file_storage_mb: number;
    gst_enabled: boolean;
    consent_given: boolean;
    admin_name: string;
    admin_email: string;
    admin_password?: string;
  }): Promise<Tenant> => {
    // 1. Create Tenant
    const tenantId = generateUUID();
    const newTenant: Tenant = {
      id: tenantId,
      business_name: onboardingData.business_name,
      business_type: onboardingData.business_type,
      subdomain: onboardingData.subdomain,
      max_db_storage_mb: onboardingData.max_db_storage_mb,
      max_file_storage_mb: onboardingData.max_file_storage_mb,
      clinic_start_time: onboardingData.clinic_start_time,
      clinic_end_time: onboardingData.clinic_end_time,
      bonus_threshold_hours: 100,
    };

    // 2. Create First Admin User
    let adminId = generateUUID();

    if (isSupabaseConfigured && supabase) {
      // Try to sign up user in Supabase Auth first
      if (!onboardingData.admin_password) {
        throw new Error('Admin password is required to initialize a clinic under Supabase.');
      }
      
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: onboardingData.admin_email,
        password: onboardingData.admin_password,
      });

      if (authErr) throw authErr;
      if (!authData.user) {
        throw new Error('Supabase Auth failed to return user data.');
      }
      
      // Use the official Supabase Auth user ID as the public.users record ID
      adminId = authData.user.id;
    }

    const firstAdmin: User & { password?: string } = {
      id: adminId,
      tenant_id: tenantId,
      email: onboardingData.admin_email,
      full_name: onboardingData.admin_name,
      position_role: 'Admin',
      medical_council_registration_no: 'IMR/ADMIN-TEMP',
      can_view_personal_data: true,
      can_view_medical_history: true,
      can_manage_finance: true,
      can_print_generate_invoice: true,
      can_manage_staff: true,
      base_salary_monthly: 80000,
      bonus_system_enabled: true,
      resource_fhir: { resourceType: 'Practitioner', active: true, name: [{ text: onboardingData.admin_name }] },
    };

    if (isSupabaseConfigured && supabase) {
      // Insert tenant and then insert public.users row via server action
      await initializeTenantAction(newTenant, firstAdmin);
    } else {
      // Mock reset with new tenant
      setStorageItem('tenant', newTenant);
      
      // Seed password in user record for offline login mock verification
      if (onboardingData.admin_password) {
        firstAdmin.password = onboardingData.admin_password;
      }
      setStorageItem('users', [firstAdmin]);

      // Auto-authenticate mock admin session
      localStorage.setItem('zenith_session', JSON.stringify({
        email: onboardingData.admin_email.toLowerCase(),
        loggedIn: true,
      }));
      
      // Seed an empty/cleared baseline for this tenant
      setStorageItem('patients', []);
      setStorageItem('clinical_logs', []);
      setStorageItem('invoices', []);
      setStorageItem('inventory', initialInventory); // Keep standard products list
      setStorageItem('expenses', []);
      setStorageItem('todo_tasks', []);
      setStorageItem('scheduled_sessions', []);
      
      const setupTrails: SystemAuditTrail[] = [
        {
          id: generateUUID(),
          tenant_id: tenantId,
          action_type: 'CONSENT_CHANGED',
          description: `Initialized Clinic Tenant and set DPDP Processing Consent: ${onboardingData.consent_given ? 'Granted' : 'Pending'}`,
          performed_by: onboardingData.admin_name,
          created_at: new Date().toISOString(),
        }
      ];
      setStorageItem('audit_trails', setupTrails);
    }

    return newTenant;
  },

  completeOnboarding: async (
    tenantId: string,
    onboardingData: {
      business_name: string;
      business_type: 'physiotherapy' | 'dentist' | 'general_clinic';
      clinic_start_time: string;
      clinic_end_time: string;
      max_db_storage_mb: number;
      max_file_storage_mb: number;
      admin_name: string;
    }
  ): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      const token = await getAuthToken();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) throw new Error("No active user session found.");
      await completeOnboardingAction(token, tenantId, onboardingData, userData.user.id);
    } else {
      // Mock mode completion
      const tenant = getStorageItem('tenant', initialTenant);
      const updatedTenant = {
        ...tenant,
        business_name: onboardingData.business_name,
        business_type: onboardingData.business_type,
        clinic_start_time: onboardingData.clinic_start_time,
        clinic_end_time: onboardingData.clinic_end_time,
        max_db_storage_mb: onboardingData.max_db_storage_mb,
        max_file_storage_mb: onboardingData.max_file_storage_mb,
      };
      setStorageItem('tenant', updatedTenant);

      const users = getStorageItem('users', initialUsers);
      if (users.length > 0) {
        users[0].full_name = onboardingData.admin_name;
        users[0].resource_fhir = {
          resourceType: 'Practitioner',
          active: true,
          name: [{ text: onboardingData.admin_name }]
        };
        setStorageItem('users', users);
      }
    }
  },

  // NOTIFICATIONS
  getNotifications: async (userId: string): Promise<SystemNotification[]> => {
    const all = getStorageItem('notifications', [] as SystemNotification[]);
    return all.filter((n: any) => n.user_id === userId);
  },

  addNotification: async (notification: { user_id: string; title: string; description: string; target_id?: string }): Promise<SystemNotification> => {
    if (!notification.user_id) return {} as SystemNotification;
    const all = getStorageItem('notifications', [] as SystemNotification[]);
    const newNotification: SystemNotification = {
      id: generateUUID(),
      user_id: notification.user_id,
      title: notification.title,
      description: notification.description,
      created_at: new Date().toISOString(),
      is_read: false,
      target_id: notification.target_id,
    };
    all.unshift(newNotification);
    setStorageItem('notifications', all);
    notifySubscribers('notifications', 'INSERT', newNotification);
    return newNotification;
  },

  clearNotifications: async (userId: string): Promise<void> => {
    const all = getStorageItem('notifications', [] as SystemNotification[]);
    const remaining = all.filter((n: any) => n.user_id !== userId);
    setStorageItem('notifications', remaining);
    notifySubscribers('notifications', 'DELETE', { id: 'all_user_' + userId });
  },

  markNotificationsRead: async (userId: string): Promise<void> => {
    const all = getStorageItem('notifications', [] as SystemNotification[]);
    const updated = all.map((n: any) => n.user_id === userId ? { ...n, is_read: true } : n);
    setStorageItem('notifications', updated);
    notifySubscribers('notifications', 'UPDATE', { id: 'all_user_' + userId });
  },
};
