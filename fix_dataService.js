const fs = require('fs');
const file = 'src/services/dataService.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. softDeleteClinicalLogAction -> deleteClinicalLogAction
code = code.replace(/softDeleteClinicalLogAction/g, 'deleteClinicalLogAction');

// 2. Add can_manage_attendance to User interface
code = code.replace(
  /can_manage_finance: boolean;/g,
  'can_manage_finance: boolean;\n  can_manage_attendance?: boolean;'
);

// 3. Fix isSupabaseConfigured in addInvoice
code = code.replace(
  /const invoiceId = isSupabaseConfigured \? generateUUID\(\) : invoiceNum;/g,
  'const invoiceId = generateUUID();'
);
code = code.replace(
  /payment_status: isSupabaseConfigured \? 'pending' : 'PENDING',/g,
  "payment_status: 'pending',"
);

// 4. Remove mock notifications and insert missing stubs before the last closing brace
const stubCode = `
  // NOTIFICATIONS STUBS
  getNotifications: async (userId: string): Promise<any[]> => [],
  addNotification: async (n: any): Promise<any> => n,
  clearNotifications: async (userId: string): Promise<void> => {},
  markNotificationsRead: async (userId: string): Promise<void> => {},

  // SERVICES STUBS
  getServices: async (...args: any[]): Promise<any[]> => [],
  addService: async (...args: any[]): Promise<any> => args[0],
  deleteService: async (...args: any[]): Promise<void> => {},

  // ATTENDANCE STUBS
  getAttendance: async (...args: any[]): Promise<any[]> => [],
  markAttendance: async (...args: any[]): Promise<any> => args[0],
  markAttendanceQR: async (...args: any[]): Promise<any> => args[0],

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
`;

// Remove the existing Notifications block which spans from `// NOTIFICATIONS` to the end of the file `};`
const notifIndex = code.indexOf('  // NOTIFICATIONS');
if (notifIndex !== -1) {
    code = code.substring(0, notifIndex) + stubCode;
} else {
    // If not found, just replace the last closing brace
    const lastBrace = code.lastIndexOf('};');
    code = code.substring(0, lastBrace) + stubCode;
}

fs.writeFileSync(file, code);
console.log('Successfully patched dataService.ts');
