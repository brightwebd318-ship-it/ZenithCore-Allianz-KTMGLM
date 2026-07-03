const fs = require('fs');
const file = 'src/services/dataService.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Add imports if missing
const importToAdd = `  getServicesAction,
  addServiceAction,
  deleteServiceAction,
  getAttendanceAction,
  addAttendanceAction,
  updateAttendanceAction,
  deleteStaffAction,`;
if (!code.includes('getServicesAction')) {
  code = code.replace(
    /getTenantAction,/,
    importToAdd + '\n  getTenantAction,'
  );
}

// 2. Replace Services Stubs
code = code.replace(
  /getServices: async \(\.\.\.args: any\[\]\): Promise<any\[\]> => \[\],/,
  `getServices: async (): Promise<any[]> => {
    const token = await getAuthToken();
    return getServicesAction(token);
  },`
);

code = code.replace(
  /addService: async \(\.\.\.args: any\[\]\): Promise<any> => args\[0\],/,
  `addService: async (serviceData: any): Promise<any> => {
    const token = await getAuthToken();
    const tenant = await dataService.getTenant();
    const newService = { ...serviceData, tenant_id: tenant.id };
    return addServiceAction(token, newService);
  },`
);

code = code.replace(
  /deleteService: async \(\.\.\.args: any\[\]\): Promise<void> => \{\},/,
  `deleteService: async (serviceId: string): Promise<void> => {
    const token = await getAuthToken();
    await deleteServiceAction(token, serviceId);
  },`
);

// 3. Replace Attendance Stubs
code = code.replace(
  /getAttendance: async \(\.\.\.args: any\[\]\): Promise<any\[\]> => \[\],/,
  `getAttendance: async (dateFilter?: string, staffId?: string): Promise<any[]> => {
    const token = await getAuthToken();
    return getAttendanceAction(token, dateFilter, staffId);
  },`
);

code = code.replace(
  /markAttendance: async \(\.\.\.args: any\[\]\): Promise<any> => args\[0\],/,
  `markAttendance: async (attendance: any): Promise<any> => {
    const token = await getAuthToken();
    const tenant = await dataService.getTenant();
    const payload = { ...attendance, tenant_id: tenant.id };
    if (attendance.id && attendance.id.length > 5) { // Assuming if it has a real UUID it's an update
      return updateAttendanceAction(token, attendance.id, payload);
    } else {
      payload.id = undefined; // let db generate uuid
      return addAttendanceAction(token, payload);
    }
  },`
);

code = code.replace(
  /markAttendanceQR: async \(\.\.\.args: any\[\]\): Promise<any> => args\[0\],/,
  `markAttendanceQR: async (userId: string, type: 'CHECK_IN' | 'CHECK_OUT'): Promise<any> => {
    const token = await getAuthToken();
    const tenant = await dataService.getTenant();
    const today = new Date().toISOString().split('T')[0];
    const nowStr = new Date().toISOString();
    
    // Check existing
    const existing = await getAttendanceAction(token, today, userId);
    if (existing && existing.length > 0) {
      if (type === 'CHECK_OUT') {
        const payload = { ...existing[0], check_out: nowStr };
        return updateAttendanceAction(token, existing[0].id, payload);
      }
      return existing[0]; // Already checked in
    }
    
    if (type === 'CHECK_IN') {
      const payload = {
        tenant_id: tenant.id,
        user_id: userId,
        date: today,
        check_in: nowStr,
        status: 'PRESENT',
        mode: 'QR'
      };
      return addAttendanceAction(token, payload);
    }
  },`
);

fs.writeFileSync(file, code);
console.log('Restored stubs in dataService.ts');
