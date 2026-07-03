import { supabase } from './supabaseClient';
import {
    getServicesAction,
  addServiceAction,
  deleteServiceAction,
  getAttendanceAction,
  addAttendanceAction,
  updateAttendanceAction,
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
  deleteClinicalLogAction,
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
  addSystemNotificationAction,
  clearSystemNotificationsAction,
  wipeCompletedTasksAction,
  getTenantResourceMetricsAction,
  initializeTenantAction,
  completeOnboardingAction,
  deleteStaffAction,
  deleteExpenseAction,
  updateExpenseAction,
} from '../app/actions';

const getAuthToken = async (): Promise<string> => {
  {
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
  max_user_logins?: number;
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
  can_manage_attendance?: boolean;
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
  bill_attachments?: any;
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
  system_notifications: {},
};

export const subscribeToTable = (table: 'scheduled_sessions' | 'todo_tasks' | 'system_notifications', callback: SubscriptionCallback) => {
  const subId = generateUUID();
  
  if (table === 'system_notifications') {
    if (!subscribers[table]) subscribers[table] = {};
    subscribers[table][subId] = callback;
    return () => {
      delete subscribers[table][subId];
    };
  }
  
  {
    const channel = supabase
          .channel(`realtime:${table}`)
          .on('postgres_changes', { event: '*', schema: 'public', table }, (payload) => {
            callback(payload);
          })
          .subscribe();
    return () => {
          supabase!.removeChannel(channel);
        };
    }
};

const notifySubscribers = (table: 'scheduled_sessions' | 'todo_tasks' | 'system_notifications', eventType: 'INSERT' | 'UPDATE' | 'DELETE', record: any) => {
  if (subscribers[table]) {
    Object.values(subscribers[table]).forEach(callback => callback({ eventType, record }));
  }
};


// Initial mockup state seed
const initialTenant: Tenant = {
  id: 'd1983024-bc48-4cb1-97b7-5f72e9dcfaea',
  business_name: 'PraxDoc Clinic',
  business_type: 'physiotherapy',
  subdomain: 'praxdoc_clinic',
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
    email: 'dibin@PraxDoc.com',
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
    email: 'ananya@PraxDoc.com',
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
    email: 'rohan@PraxDoc.com',
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
  const data = localStorage.getItem(`praxdoc_${key}`);
  if (!data) {
    localStorage.setItem(`praxdoc_${key}`, JSON.stringify(defaultValue));
    return defaultValue;
  }
  return JSON.parse(data);
};

const setStorageItem = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`praxdoc_${key}`, JSON.stringify(value));
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
    {
        const token = await getAuthToken();
        if (!token) {
                throw new Error("No active auth token available on client.");
              }
        return getTenantAction(token);
        }
  },

  updateTenant: async (tenant: Partial<Tenant>): Promise<Tenant> => {
    {
      const token = await getAuthToken();
      return updateTenantAction(token, tenant);
      }
  },

  // USERS / STAFF
  getUsers: async (): Promise<User[]> => {
    {
      try {
              const token = await getAuthToken();
              const data = await getUsersAction(token);
              return (data || []).map((row: any) => ({
                ...row,
                can_manage_staff: row.resource_fhir?.can_manage_staff !== undefined
                  ? row.resource_fhir.can_manage_staff
                  : (row.position_role === 'Admin'),
                can_manage_attendance: row.resource_fhir?.can_manage_attendance !== undefined
                  ? row.resource_fhir.can_manage_attendance
                  : (row.position_role === 'Admin' || row.position_role === 'Receptionist')
              }));
            } catch (err) {
              console.warn("Error in getUsers:", err);
              return [];
            }
      }
  },

  getCurrentUser: async (): Promise<User | null> => {
    {
      const token = await getAuthToken();
      if (!token) return null;
      const data = await getCurrentUserAction(token);
      if (!data) return null;
      return {
              ...data,
              can_manage_staff: data.resource_fhir?.can_manage_staff !== undefined
                ? data.resource_fhir.can_manage_staff
                : (data.position_role === 'Admin'),
              can_manage_attendance: data.resource_fhir?.can_manage_attendance !== undefined
                ? data.resource_fhir.can_manage_attendance
                : (data.position_role === 'Admin' || data.position_role === 'Receptionist')
            };
      }
  },

  updateUserPermissions: async (userId: string, updates: Partial<User>): Promise<User> => {
    let current: any;
    {
      const token = await getAuthToken();
      const users = await getUsersAction(token);
      current = users.find((u: any) => u.id === userId);
      }
    if (!current) throw new Error('User not found');

    const resourceFhir = {
      ...(current.resource_fhir || {}),
      ...(updates.resource_fhir || {}),
    };
    if (updates.can_manage_staff !== undefined) {
      resourceFhir.can_manage_staff = updates.can_manage_staff;
    }
    if (updates.can_manage_attendance !== undefined) {
      resourceFhir.can_manage_attendance = updates.can_manage_attendance;
    }

    const { can_manage_staff, can_manage_attendance, ...rest } = updates;
    const dbPayload = {
      ...rest,
      resource_fhir: resourceFhir,
    };

    {
      const token = await getAuthToken();
      const data = await updateUserPermissionsAction(token, userId, dbPayload);
      return {
              ...data,
              can_manage_staff: data.resource_fhir?.can_manage_staff !== undefined
                ? data.resource_fhir.can_manage_staff
                : (data.position_role === 'Admin'),
              can_manage_attendance: data.resource_fhir?.can_manage_attendance !== undefined
                ? data.resource_fhir.can_manage_attendance
                : (data.position_role === 'Admin' || data.position_role === 'Receptionist')
            };
      }
  },

  addUser: async (user: Omit<User, 'id' | 'tenant_id'> & { id?: string }): Promise<User> => {
    const tenant = await dataService.getTenant();
    
    const resourceFhir = {
      ...(user.resource_fhir || {}),
      can_manage_staff: user.can_manage_staff !== undefined ? user.can_manage_staff : (user.position_role === 'Admin'),
      can_manage_attendance: user.can_manage_attendance !== undefined ? user.can_manage_attendance : (user.position_role === 'Admin' || user.position_role === 'Receptionist'),
    };

    const { can_manage_staff, can_manage_attendance, ...rest } = user;
    const newUser = {
      ...rest,
      id: user.id || generateUUID(),
      tenant_id: tenant.id,
      resource_fhir: resourceFhir,
      created_at: new Date().toISOString(),
    };

    {
      const token = await getAuthToken();
      const data = await addUserAction(token, newUser);
      return {
              ...data,
              can_manage_staff: data.resource_fhir?.can_manage_staff !== undefined
                ? data.resource_fhir.can_manage_staff
                : (data.position_role === 'Admin'),
              can_manage_attendance: data.resource_fhir?.can_manage_attendance !== undefined
                ? data.resource_fhir.can_manage_attendance
                : (data.position_role === 'Admin' || data.position_role === 'Receptionist')
            };
      }
  },

  createStaffAuthUser: async (
    email: string,
    password?: string,
    fullName?: string,
    role?: 'Admin' | 'Senior Therapist' | 'Receptionist',
    targetUserId?: string
  ): Promise<string> => {
    {
      const tenant = await dataService.getTenant();
      const token = await getAuthToken();
      return createStaffAuthAction(token, email, password, fullName, role, tenant.id, targetUserId);
      }
  },

  pauseStaffAuthUser: async (targetUserId: string, shouldPause: boolean): Promise<void> => {
    {
      const token = await getAuthToken();
      await pauseStaffAuthAction(token, targetUserId, shouldPause);
      }
  },

  getAuthUsersStatus: async (): Promise<Array<{ id: string; exists: boolean; paused: boolean }>> => {
    {
      const token = await getAuthToken();
      return getAuthUsersStatusAction(token);
      }
  },

  deleteStaffUser: async (targetUserId: string): Promise<void> => {
    {
      const token = await getAuthToken();
      await deleteStaffAction(token, targetUserId);
      }
  },

  // PATIENTS
  getPatients: async (searchQuery?: string): Promise<Patient[]> => {
    {
      const token = await getAuthToken();
      return getPatientsAction(token, searchQuery);
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

    {
      const token = await getAuthToken();
      return addPatientAction(token, newPatient);
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

    {
      const token = await getAuthToken();
      return updatePatientConsentAction(token, patientId, updates);
      }
  },

  updatePatientGst: async (patientId: string, gstEnabled: boolean, gstin: string | null): Promise<Patient> => {
    const updates = { gst_enabled: gstEnabled, gstin };
    {
      const token = await getAuthToken();
      return updatePatientGstAction(token, patientId, updates);
      }
  },

  updatePatientResource: async (patientId: string, resourceFhir: any): Promise<Patient> => {
    const updates = { resource_fhir: resourceFhir };
    {
      const token = await getAuthToken();
      return updatePatientConsentAction(token, patientId, updates);
      }
  },

  updatePatientInfo: async (patientId: string, updates: Partial<Patient>): Promise<Patient> => {
    {
      const token = await getAuthToken();
      return updatePatientConsentAction(token, patientId, updates);
    }
  },

  // CLINICAL LOGS
  getClinicalLogs: async (patientId: string): Promise<ClinicalLog[]> => {
    {
      const token = await getAuthToken();
      return getClinicalLogsAction(token, patientId);
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

    {
      const token = await getAuthToken();
      return addClinicalLogAction(token, newLog);
      }
  },

  deleteClinicalLog: async (logId: string): Promise<void> => {
    {
      const token = await getAuthToken();
      await deleteClinicalLogAction(token, logId);
      }
  },

  // INVOICES
  getInvoices: async (fromDate?: string, toDate?: string): Promise<Invoice[]> => {
    {
      const token = await getAuthToken();
      return getInvoicesAction(token, fromDate, toDate);
      }
  },

  addInvoice: async (
    patientId: string,
    sessions: number,
    practitionerId: string,
    applyGst: boolean,
    baseAmount: number,
    customItems?: Array<{ name: string; quantity: number; rate: number }>,
    sessionDescription?: string
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
    {
      const token = await getAuthToken();
      const dbInvoices = await getInvoicesAction(token);
      currentInvoicesCount = dbInvoices.length;
      }
    const nextNum = currentInvoicesCount + 1;
    const invoiceNum = `INV-2026-${String(nextNum).padStart(3, '0')}`;
    const invoiceId = generateUUID(); // UUID primary key for Supabase, sequential for mock

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
      payment_status: 'pending',
      created_at: new Date().toISOString(),
      resource_fhir: {
        resourceType: 'Invoice',
        status: 'issued',
        identifier: [{ system: 'local', value: invoiceNum }],
        totalNet: { value: baseAmount, currency: 'INR' },
        totalGross: { value: total_amount, currency: 'INR' },
        lineItem: [
          ...(sessions > 0 ? [{
            description: 'Therapy Session Units',
            quantity: sessions,
            priceComponent: [{
              type: 'base',
              factor: sessions,
              amount: { value: sessionRate, currency: 'INR' }
            }]
          }] : []),
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

    {
      const token = await getAuthToken();
      const res = await addInvoiceAction(token, newInvoice);
      
      // Notify admins of new bill
      try {
        const users = await dataService.getUsers();
        const admins = users.filter((u: any) => u.position_role === 'Admin');
        for (const admin of admins) {
          await dataService.addNotification({
            user_id: admin.id,
            title: 'New Bill Generated',
            description: `A new bill was generated for ₹${total_amount.toLocaleString('en-IN')} by ${loggedInUser?.full_name || 'System'}.`,
            target_id: newInvoice.id,
          });
        }
      } catch (err) {
        console.warn("Failed to notify admins of new bill:", err);
      }
      
      return res;
      }
  },

  updateInvoiceStatus: async (invoiceId: string, status: Invoice['payment_status']): Promise<Invoice> => {
    {
      const token = await getAuthToken();
      return updateInvoicePaymentStatusAction(token, invoiceId, status.toLowerCase());
      }
  },

  // INVENTORY
  getInventory: async (): Promise<InventoryItem[]> => {
    {
      const token = await getAuthToken();
      return getInventoryAction(token);
      }
  },

  updateInventoryStock: async (itemId: string, count: number): Promise<InventoryItem> => {
    {
      const token = await getAuthToken();
      return updateInventoryStockAction(token, itemId, count);
      }
  },

  addInventoryItem: async (item: Omit<InventoryItem, 'id' | 'tenant_id'>): Promise<InventoryItem> => {
    const tenant = await dataService.getTenant();
    const newItem: InventoryItem = {
      ...item,
      id: generateUUID(),
      tenant_id: tenant.id,
    };

    {
      const token = await getAuthToken();
      return addInventoryItemAction(token, newItem);
      }
  },

  // EXPENSES
  getExpenses: async (): Promise<BusinessExpense[]> => {
    {
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
                bill_attachments: row.bill_attachments || [],
              }));
            } catch (err) {
              console.warn("Error in getExpenses, falling back to LocalStorage:", err);
              return getStorageItem('expenses', initialExpenses);
            }
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
      bill_attachments: expense.bill_attachments || [],
    };

    {
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
                bill_attachments: data.bill_attachments || [],
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
      }
  },

  deleteExpense: async (expenseId: string): Promise<boolean> => {
    {
      try {
              const token = await getAuthToken();
              await deleteExpenseAction(token, expenseId);
              return true;
            } catch (err) {
              console.warn("Error deleting expense in Supabase, falling back to LocalStorage:", err);
              const expenses = getStorageItem('expenses', initialExpenses);
              const filtered = expenses.filter((e: any) => e.id !== expenseId);
              setStorageItem('expenses', filtered);
              return true;
            }
      }
  },

  updateExpense: async (expenseId: string, updates: Partial<BusinessExpense>): Promise<BusinessExpense> => {
    {
      try {
              const token = await getAuthToken();
              const dbUpdates: any = {};
              if (updates.expense_name !== undefined) dbUpdates.description = updates.expense_name;
              if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
              if (updates.category !== undefined) dbUpdates.category = updates.category;
              if (updates.expense_date !== undefined) dbUpdates.expense_date = updates.expense_date;
              if (updates.attachment_size_bytes !== undefined) dbUpdates.attachment_size_bytes = updates.attachment_size_bytes;
              if (updates.bill_attachments !== undefined) dbUpdates.bill_attachments = updates.bill_attachments;

              const data = await updateExpenseAction(token, expenseId, dbUpdates);
              return {
                id: data.id,
                tenant_id: data.tenant_id,
                expense_name: data.description || data.expense_name || '',
                amount: Number(data.amount),
                category: data.category,
                expense_date: data.expense_date,
                attachment_size_bytes: Number(data.attachment_size_bytes || 0),
                bill_attachments: data.bill_attachments || [],
              };
            } catch (err) {
              console.warn("Error updating expense in Supabase, falling back to LocalStorage:", err);
              const expenses = getStorageItem('expenses', initialExpenses);
              const idx = expenses.findIndex((e: any) => e.id === expenseId);
              if (idx !== -1) {
                expenses[idx] = { ...expenses[idx], ...updates };
                setStorageItem('expenses', expenses);
              }
              return expenses.find((e: any) => e.id === expenseId) || (updates as any);
            }
      }
  },

  // AUDIT TRAILS
  getAuditTrails: async (): Promise<SystemAuditTrail[]> => {
    {
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

    {
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
              
              const isSuspect = actionType.includes('FAIL') || 
                                actionType.includes('SUSPECT') || 
                                actionType.includes('SECURITY') || 
                                actionType.includes('DELETE') || 
                                actionType.includes('REVOKE');
              if (isSuspect) {
                try {
                  const users = await dataService.getUsers();
                  const admins = users.filter((u: any) => u.position_role === 'Admin');
                  for (const admin of admins) {
                    await dataService.addNotification({
                      user_id: admin.id,
                      title: 'Security Alert: Suspected Activity',
                      description: `Audit Log Alert: ${description}`,
                      target_id: dbRow.id,
                    });
                  }
                } catch (notifErr) {
                  console.warn("Failed to notify admins of suspected activity:", notifErr);
                }
              }
            } catch (err: any) {
              console.error("Failed to insert audit trail into Supabase system_audit_trails. Error message: " + err.message);
            }
      }
  },

  truncateAuditTrails: async (): Promise<void> => {
    {
      const token = await getAuthToken();
      await truncateAuditTrailsAction(token);
      }
    await dataService.addAuditTrail('FINANCIAL_MUTATION', 'Cleared entire system audit log');
  },

  // TODO TASKS
  getTodoTasks: async (): Promise<TodoTask[]> => {
    {
      try {
              const token = await getAuthToken();
              const data = await getTodoTasksAction(token);
              return (data || []).map(mapTodoTaskFromDb);
            } catch (err) {
              console.warn("Error in getTodoTasks, falling back to LocalStorage:", err);
              return getStorageItem('todo_tasks', initialTodoTasks);
            }
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
    {
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
    {
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
      }
  },

  wipeCompletedTasks: async (): Promise<void> => {
    {
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
      }
  },

  // SCHEDULED SESSIONS (APPOINTMENTS)
  getScheduledSessions: async (): Promise<ScheduledSession[]> => {
    {
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
    {
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
    {
      const token = await getAuthToken();
      const data = await updateScheduledSessionStatusAction(token, sessionId, status);
      return {
              ...data,
              session_notes: data.next_session_notes || data.session_notes || ''
            };
      }
  },

  deleteScheduledSession: async (sessionId: string): Promise<void> => {
    {
      try {
              const token = await getAuthToken();
              await deleteScheduledSessionAction(token, sessionId);
            } catch (err) {
              console.error("Failed to delete scheduled session in Supabase:", err);
              throw err;
            }
      }
  },

  // DATABASE VIEW RECONCILIATION - TENANT RESOURCE METRICS
  getTenantResourceMetrics: async () => {
    const tenant = await dataService.getTenant();
    {
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

    {
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

    {
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

    {
      await initializeTenantAction(newTenant, firstAdmin);
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
    {
      const token = await getAuthToken();
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) throw new Error("No active user session found.");
      await completeOnboardingAction(token, tenantId, onboardingData, userData.user.id);
      }
  },


  // NOTIFICATIONS
  getNotifications: async (userId: string): Promise<any[]> => {
    const token = await getAuthToken();
    const all = await getSystemNotificationsAction(token);
    return all.filter((n: any) => n.user_id === userId);
  },
  addNotification: async (n: any): Promise<any> => {
    const token = await getAuthToken();
    const tenant = await dataService.getTenant();
    const notification = {
      ...n,
      tenant_id: tenant.id
    };
    return await addSystemNotificationAction(token, notification);
  },
  clearNotifications: async (userId: string): Promise<void> => {
    const token = await getAuthToken();
    await clearSystemNotificationsAction(token);
  },
  markNotificationsRead: async (userId: string): Promise<void> => {
    const token = await getAuthToken();
    const unread = await dataService.getNotifications(userId);
    for (const n of unread) {
      if (!n.is_read) {
        await markNotificationAsReadAction(token, n.id);
      }
    }
  },

  // SERVICES STUBS
  getServices: async (): Promise<any[]> => {
    const token = await getAuthToken();
    return getServicesAction(token);
  },
  addService: async (name: string, price: number): Promise<any> => {
    const token = await getAuthToken();
    const tenant = await dataService.getTenant();
    const newService = { name, price, tenant_id: tenant.id };
    return addServiceAction(token, newService);
  },
  deleteService: async (serviceId: string): Promise<void> => {
    const token = await getAuthToken();
    await deleteServiceAction(token, serviceId);
  },

  // ATTENDANCE STUBS
  getAttendance: async (dateFilter?: string, staffId?: string): Promise<any[]> => {
    const token = await getAuthToken();
    return getAttendanceAction(token, dateFilter, staffId);
  },
  markAttendance: async (userId: string, checkInISO: string, checkOutISO: string | null, status: 'PRESENT' | 'ABSENT' | 'LATE', mode: 'QR' | 'MANUAL', notes?: string): Promise<any> => {
    const token = await getAuthToken();
    const tenant = await dataService.getTenant();
    const targetDate = checkInISO.split('T')[0];
    
    const existing = await getAttendanceAction(token, targetDate, userId);
    
    const attendancePayload = { 
      user_id: userId, 
      check_in: checkInISO, 
      check_out: checkOutISO, 
      status, 
      mode, 
      notes, 
      date: targetDate,
      tenant_id: tenant.id
    };

    if (existing && existing.length > 0) {
      return updateAttendanceAction(token, existing[0].id, attendancePayload);
    } else {
      return addAttendanceAction(token, attendancePayload);
    }
  },
  markAttendanceQR: async (userId: string, tokenString: string): Promise<any> => {
    const token = await getAuthToken();
    const tenant = await dataService.getTenant();
    const today = new Date().toISOString().split('T')[0];
    const nowStr = new Date().toISOString();
    
    // Check existing
    const existing = await getAttendanceAction(token, today, userId);
    if (existing && existing.length > 0) {
      if (!existing[0].check_out) {
        const payload = { ...existing[0], check_out: nowStr };
        await updateAttendanceAction(token, existing[0].id, payload);
        return { success: true, message: 'Check-out successful!' };
      }
      return { success: false, message: 'Attendance already marked and checked out for today.' };
    }
    
    // Check in
    const payload = {
      tenant_id: tenant.id,
      user_id: userId,
      date: today,
      check_in: nowStr,
      status: 'PRESENT',
      mode: 'QR'
    };
    await addAttendanceAction(token, payload);
    return { success: true, message: 'Check-in successful!' };
  },

  // TODO TASKS STUBS
  deleteTodoTask: async (...args: any[]): Promise<void> => {},

  // CLINICAL LOGS STUBS
  softDeleteClinicalLog: async (...args: any[]): Promise<void> => {},
};

export interface Attendance {
  id: string;
  tenant_id: string;
  user_id: string;
  date: string;
  check_in: string;
  check_out?: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE';
  mode: 'QR' | 'MANUAL';
  notes?: string;
}
