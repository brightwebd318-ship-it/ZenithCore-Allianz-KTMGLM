const fs = require('fs');
const file = 'src/services/dataService.ts';
let code = fs.readFileSync(file, 'utf8');

code = code.replace(
  /markAttendance: async \(attendance: any\): Promise<any> => \{/,
  `markAttendance: async (userId: string, checkInISO: string, checkOutISO: string | null, status: 'PRESENT' | 'ABSENT' | 'LATE', mode: 'QR' | 'MANUAL', notes?: string): Promise<any> => {
    const attendance = { user_id: userId, check_in: checkInISO, check_out: checkOutISO, status, mode, notes, date: checkInISO.split('T')[0] };`
);

code = code.replace(
  /markAttendanceQR: async \(userId: string, type: 'CHECK_IN' \| 'CHECK_OUT'\): Promise<any> => \{/,
  `markAttendanceQR: async (userId: string, type: 'CHECK_IN' | 'CHECK_OUT' | string): Promise<any> => {`
);

// Fix duplicate deleteStaffAction import
code = code.replace(/import \{\n(.*?)deleteStaffAction,\n(.*?)\n  deleteStaffAction,/s, 'import {\n$1$2\n  deleteStaffAction,');

fs.writeFileSync(file, code);
console.log('Fixed markAttendance signatures');
