import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { Calendar, User, UserCheck, ShieldAlert, CheckCircle, Clock, QrCode, Search, FileText, Camera } from 'lucide-react';
import { dataService } from '../services/dataService';
import type { Attendance, User as StaffUser } from '../services/dataService';

interface AttendanceViewProps {
  triggerRefresh: () => void;
  triggerRefreshKey: number;
  currentUser: StaffUser | null;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({ triggerRefresh, triggerRefreshKey, currentUser }) => {
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filterDate, setFilterDate] = useState(() => {
    // Default to today's date in local YYYY-MM-DD
    return new Date().toLocaleDateString('sv-SE');
  });
  const [filterStaffName, setFilterStaffName] = useState('');

  // Modals
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [modalMode, setModalMode] = useState<'selection' | 'qr' | 'manual'>('selection');

  // Manual marking form
  const [selectedStaffId, setSelectedStaffId] = useState(currentUser?.id || '');
  const [manualDate, setManualDate] = useState(() => new Date().toLocaleDateString('sv-SE'));
  const [manualCheckIn, setManualCheckIn] = useState('09:00');
  const [manualCheckOut, setManualCheckOut] = useState('');
  const [manualStatus, setManualStatus] = useState<'PRESENT' | 'ABSENT' | 'LATE'>('PRESENT');
  const [manualNotes, setManualNotes] = useState('');

  // QR Simulator state
  const [qrScanning, setQrScanning] = useState(false);
  const [qrScanResult, setQrScanResult] = useState<string | null>(null);
  const [qrSuccessMessage, setQrSuccessMessage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  const isAdmin = currentUser?.position_role === 'Admin';
  const isReceptionist = currentUser?.position_role === 'Receptionist';
  const canSeeAllReports = isAdmin || isReceptionist;
  const canManageAttendance = isAdmin || currentUser?.can_manage_attendance;

  const loadAttendanceData = async () => {
    setLoading(true);
    try {
      // Load all attendance records
      const logs = await dataService.getAttendance();
      setAttendanceLogs(logs);

      // Load staff list
      const staff = await dataService.getUsers();
      setStaffList(staff);
    } catch (err) {
      console.error('Failed to load attendance logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAttendanceData();
  }, [triggerRefreshKey]);

  // Real QR Scanner logic
  useEffect(() => {
    let scanner: Html5QrcodeScanner | null = null;
    if (modalMode === 'qr') {
      scanner = new Html5QrcodeScanner(
        "qr-reader",
        { fps: 10, qrbox: {width: 250, height: 250}, aspectRatio: 1.0 },
        /* verbose= */ false
      );
      
      const onScanSuccess = (decodedText: string, decodedResult: any) => {
        // Stop scanning
        scanner?.clear();
        setQrScanResult(decodedText);
        setQrSuccessMessage("Scanned successfully! Processing...");
        setQrScanning(true);
        
        // Use the handleMarkQr from the button
        setTimeout(() => {
          simulateQRScan(decodedText);
        }, 1000);
      };

      const onScanFailure = (error: any) => {
        // handle scan failure, usually better to ignore and keep scanning
      };

      scanner.render(onScanSuccess, onScanFailure);
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(error => {
          console.error("Failed to clear html5QrcodeScanner. ", error);
        });
      }
    };
  }, [modalMode]);

  const handleMarkManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId && !canManageAttendance) {
      // If user isn't admin and staff id is blank, use current user id
      setSelectedStaffId(currentUser?.id || '');
    }
    
    const targetStaffId = selectedStaffId || currentUser?.id;
    if (!targetStaffId) return;

    try {
      // If blank, use 00:00:00 local time
      const finalCheckIn = manualCheckIn || '00:00';
      const checkInISO = new Date(`${manualDate}T${finalCheckIn}:00`).toISOString();
      const checkOutISO = manualCheckOut ? new Date(`${manualDate}T${manualCheckOut}:00`).toISOString() : null;

      await dataService.markAttendance(
        targetStaffId,
        checkInISO,
        checkOutISO,
        manualStatus,
        'MANUAL',
        manualNotes
      );

      const staffMember = staffList.find(s => s.id === targetStaffId);
      const staffName = staffMember ? staffMember.full_name : 'Staff';
      await dataService.addAuditTrail('FINANCIAL_MUTATION', `Manually logged attendance for: ${staffName} on date: ${manualDate}`);

      // Reset
      setShowMarkModal(false);
      setModalMode('selection');
      setManualNotes('');
      setManualCheckOut('');
      
      triggerRefresh();
      loadAttendanceData();
    } catch (err) {
      console.error(err);
    }
  };

  const simulateQRScan = async (decodedText?: string) => {
    if (!currentUser) return;
    setQrScanning(true);
    setQrScanResult(null);
    setQrSuccessMessage(null);

    // Simulate camera capture processing
    setTimeout(async () => {
      try {
        const todayStr = new Date().toLocaleDateString('sv-SE');
        const dailyToken = `PRAXDOC-AUTH-${todayStr}`;
        const finalToken = decodedText || dailyToken; // accept actual qr or fallback
        
        // If scanned text isn't correct token, reject
        if (finalToken !== dailyToken) {
          throw new Error("Invalid QR Code. Does not match today's attendance token.");
        }

        const response = await dataService.markAttendanceQR(currentUser.id, finalToken);
        setQrScanning(false);
        setQrScanResult(response.success ? 'success' : 'already_marked');
        setQrSuccessMessage(response.message);
        
        await dataService.addAuditTrail('CONSENT_CHANGED', `QR scanned for attendance checkout/checkin for user: ${currentUser.full_name}`);
        
        triggerRefresh();
        loadAttendanceData();
      } catch (err: any) {
        setQrScanning(false);
        setQrScanResult('error');
        setQrSuccessMessage(err.message || 'Verification token failed.');
      }
    }, 1500);
  };

  // Filter logs locally
  const filteredLogs = attendanceLogs.filter((log) => {
    // 1. Date Filter
    if (filterDate && log.date !== filterDate) return false;

    // 2. Staff Name Filter
    if (filterStaffName) {
      const staff = staffList.find((s) => s.id === log.user_id);
      if (!staff) return false;
      const q = filterStaffName.toLowerCase();
      const nameMatch = staff.full_name.toLowerCase().includes(q) || staff.email.toLowerCase().includes(q);
      if (!nameMatch) return false;
    }

    // 3. User Permission boundaries: non-admins can ONLY see their own logs
    if (!canSeeAllReports && log.user_id !== currentUser?.id) {
      return false;
    }

    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* Title Header Card */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center">
            <UserCheck className="h-6 w-6 mr-2 text-brand-500" /> Attendance Ledger & Check-in
          </h1>
          <p className="text-xs text-slate-400 mt-1">Manage staff check-ins, verify shift presence, and generate active QR codes.</p>
        </div>

        <button
          onClick={() => {
            setModalMode('selection');
            setShowMarkModal(true);
          }}
          className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs px-4 py-2.5 rounded-lg shadow-md transition-colors flex items-center justify-center space-x-1"
        >
          <Clock className="h-4 w-4" />
          <span>Mark Attendance</span>
        </button>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* 1. History & Reports Panel (Left 8 Columns) */}
        <div className="lg:col-span-8 bg-white rounded-xl border border-slate-200 p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 dark:border-slate-800 space-y-3 sm:space-y-0">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center text-sm">
              <FileText className="h-4 w-4 mr-2 text-brand-500" /> Presence Logs Registry
            </h3>

            {/* Filters Section */}
            <div className="flex items-center space-x-2">
              
              {/* Date Filter Input */}
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500"
              />
              {filterDate && (
                <button
                  onClick={() => setFilterDate('')}
                  className="text-[10px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  Clear Date
                </button>
              )}

              {/* Staff Name Filter (Admins/Reception only) */}
              {canSeeAllReports && (
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-455">
                    <Search className="h-3 w-3" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search staff name..."
                    value={filterStaffName}
                    onChange={(e) => setFilterStaffName(e.target.value)}
                    className="pl-8 pr-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500 w-40"
                  />
                </div>
              )}

            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:bg-slate-800/40 dark:border-slate-800">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Staff Member</th>
                  <th className="px-4 py-3">In / Out Timestamps</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Verification Mode</th>
                  <th className="px-4 py-3">Details / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700 dark:divide-slate-800 dark:text-slate-350">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="text-center py-6 text-slate-400">Loading attendance data...</td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400 italic">No attendance records matching active filters.</td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => {
                    const staff = staffList.find((s) => s.id === log.user_id);
                    const staffName = staff ? staff.full_name : 'Unknown User';
                    const staffRole = staff ? staff.position_role : 'Specialist';
                    
                    const inTime = log.check_in ? new Date(log.check_in).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '--:--';
                    const outTime = log.check_out ? new Date(log.check_out).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Still In';

                    let statusClass = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-455';
                    if (log.status === 'PRESENT') statusClass = 'bg-emerald-100 text-emerald-850 dark:bg-emerald-950/20 dark:text-emerald-400';
                    if (log.status === 'LATE') statusClass = 'bg-amber-100 text-amber-850 dark:bg-amber-950/20 dark:text-amber-400';
                    if (log.status === 'ABSENT') statusClass = 'bg-red-100 text-red-850 dark:bg-red-950/20 dark:text-red-400';

                      const editRow = () => {
                        setSelectedStaffId(log.user_id);
                        setManualDate(log.date);
                        setManualCheckIn(log.check_in ? new Date(log.check_in).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '09:00');
                        setManualCheckOut(log.check_out ? new Date(log.check_out).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '');
                        setManualStatus(log.status);
                        setManualNotes(log.notes || '');
                        setModalMode('manual');
                        setShowMarkModal(true);
                      };

                      return (
                        <tr 
                          key={log.id} 
                          onClick={editRow}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors cursor-pointer"
                          title="Click to edit check-in or mark exit time manually"
                        >
                          <td className="px-4 py-3 font-semibold font-mono text-[11px]">
                          {log.date}
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold block text-slate-900 dark:text-white">{staffName}</span>
                          <span className="text-[10px] text-slate-400 uppercase tracking-wide block mt-0.5">{staffRole}</span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px]">
                          <span className="text-emerald-600 dark:text-emerald-455">Check-in: {inTime}</span>
                          <span className="block text-slate-400 mt-0.5">Check-out: {outTime}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${statusClass}`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center space-x-1 font-semibold">
                            {log.mode === 'QR' ? (
                              <>
                                <QrCode className="h-3 w-3 text-brand-500" />
                                <span>QR Scanner</span>
                              </>
                            ) : (
                              <span>Manual Entry</span>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-455 max-w-xs truncate" title={log.notes || ''}>
                          {log.notes || <span className="italic text-slate-400">None</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

        </div>

        {/* 2. Overview / Info Panel (Right 4 Columns) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Quick Stats Card */}
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-4">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center text-sm border-b border-slate-100 pb-3 dark:border-slate-800">
              <Calendar className="h-4.5 w-4.5 mr-2 text-indigo-500" /> Shift Overview
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400">Present Staff Today</span>
                <span className="block text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                  {attendanceLogs.filter(a => a.date === new Date().toLocaleDateString('sv-SE') && a.status === 'PRESENT').length}
                </span>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-lg text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400">Late / Delayed Today</span>
                <span className="block text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                  {attendanceLogs.filter(a => a.date === new Date().toLocaleDateString('sv-SE') && a.status === 'LATE').length}
                </span>
              </div>
            </div>

            <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 p-3 flex space-x-2 text-xs text-indigo-700 dark:text-indigo-400">
              <Clock className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-bold">Check-in Window Guidelines</span>
                <p className="mt-0.5 leading-normal font-medium text-slate-500 dark:text-indigo-400/80 text-[10px]">
                  Daily check-in starts at 08:00 AM. Any check-ins logged after 09:30 AM will be automatically marked as LATE. Check-outs are logged on exit scan.
                </p>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Attendance Modal (Dual Mode: QR & Manual) */}
      {showMarkModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden dark:bg-slate-900 dark:border-slate-800">
            
            {/* Modal Header */}
            <div className="bg-brand-500 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center">
                <Clock className="h-4 w-4 mr-2" /> Mark Workspace Attendance
              </h3>
              <button
                onClick={() => {
                  setShowMarkModal(false);
                  setQrScanResult(null);
                  setQrSuccessMessage(null);
                }}
                className="text-white hover:text-slate-100 text-xs font-bold font-mono"
              >
                CLOSE
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6">
              
              {/* Option Selector Step */}
              {modalMode === 'selection' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal text-center">
                    Select a verification mode below to log your clinic attendance for today.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-4">
                    
                    {/* QR Code trigger */}
                    <button
                      onClick={() => {
                        setModalMode('qr');
                        simulateQRScan();
                      }}
                      className="flex flex-col items-center justify-center p-5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-500 dark:hover:border-brand-500 hover:bg-brand-50/10 transition-all text-center space-y-3 focus:outline-none cursor-pointer"
                    >
                      <div className="h-10 w-10 bg-brand-50 rounded-lg flex items-center justify-center text-brand-500 dark:bg-brand-950/20">
                        <QrCode className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-850 dark:text-white">Scan Clinic QR</span>
                      <span className="text-[10px] text-slate-400 font-medium">Capture countertop scanner code</span>
                    </button>

                    {/* Manual entry trigger */}
                    <button
                      onClick={() => setModalMode('manual')}
                      className="flex flex-col items-center justify-center p-5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-500 dark:hover:border-brand-500 hover:bg-brand-50/10 transition-all text-center space-y-3 focus:outline-none cursor-pointer"
                    >
                      <div className="h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500 dark:bg-indigo-950/20">
                        <Clock className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-850 dark:text-white">Log Manually</span>
                      <span className="text-[10px] text-slate-400 font-medium">Request direct manual database entry</span>
                    </button>

                  </div>
                </div>
              )}

              {/* QR Simulator Mode */}
              {modalMode === 'qr' && (
                <div className="flex flex-col items-center text-center space-y-4">
                  
                  {/* Real QR Viewfinder */}
                  <div className="relative border border-slate-350 dark:border-slate-700 rounded-lg overflow-hidden bg-white w-full max-w-sm">
                    <div id="qr-reader" className="w-full text-black"></div>
                  </div>

                  {/* QR Scan Results */}
                  {qrScanResult && (
                    <div className={`w-full p-3 rounded-lg border text-xs text-left flex items-start space-x-2 ${
                      qrScanResult === 'success'
                        ? 'bg-emerald-50 border-emerald-205 text-emerald-800 dark:bg-emerald-950/10 dark:border-emerald-900/30 dark:text-emerald-400'
                        : 'bg-amber-50 border-amber-205 text-amber-800 dark:bg-amber-950/10 dark:border-amber-900/30 dark:text-amber-400'
                    }`}>
                      <div className="mt-0.5">
                        {qrScanResult === 'success' ? (
                          <CheckCircle className="h-4.5 w-4.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <ShieldAlert className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                        )}
                      </div>
                      <div>
                        <span className="font-bold uppercase block">
                          {qrScanResult === 'success' ? 'Verification Success' : 'Scan Notice'}
                        </span>
                        <p className="mt-0.5 leading-normal text-[11px] font-semibold">{qrSuccessMessage}</p>
                      </div>
                    </div>
                  )}

                  {/* Manual trigger for demo scan */}
                  {!qrScanning && !qrScanResult && (
                    <button
                      onClick={() => simulateQRScan()}
                      className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs py-2 rounded-lg transition-colors flex items-center justify-center space-x-1"
                    >
                      <Camera className="h-4.5 w-4.5" />
                      <span>Scan Simulated Code</span>
                    </button>
                  )}

                  <button
                    onClick={() => {
                      setModalMode('selection');
                      setQrScanResult(null);
                      setQrSuccessMessage(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 text-xs font-semibold uppercase"
                  >
                    Go Back
                  </button>

                </div>
              )}

              {/* Manual Entry Form */}
              {modalMode === 'manual' && (
                <form onSubmit={handleMarkManual} className="space-y-4 text-xs">
                  
                  {/* Select User (Only Admins/Receptionists can change staff user) */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Staff Member</label>
                    {canManageAttendance ? (
                      <select
                        value={selectedStaffId}
                        onChange={(e) => setSelectedStaffId(e.target.value)}
                        className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
                      >
                        {staffList.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name} ({s.position_role})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="w-full bg-slate-50 border border-slate-200 dark:bg-slate-800 dark:border-slate-700 rounded px-3 py-2 text-slate-700 dark:text-slate-350 font-bold">
                        {currentUser?.full_name} ({currentUser?.position_role})
                      </div>
                    )}
                  </div>

                  {/* Date Selection */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                  </div>

                  {/* Checkin / Checkout times */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Check-in time</label>
                      <input
                        type="time"
                        value={manualCheckIn}
                        onChange={(e) => setManualCheckIn(e.target.value)}
                        className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Check-out time</label>
                      <input
                        type="time"
                        value={manualCheckOut}
                        onChange={(e) => setManualCheckOut(e.target.value)}
                        className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Status Selection (Admin Only) */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Presence Status</label>
                    <select
                      value={manualStatus}
                      onChange={(e) => setManualStatus(e.target.value as any)}
                      disabled={!canManageAttendance}
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none disabled:bg-slate-50"
                    >
                      <option value="PRESENT">Present (On Time)</option>
                      <option value="LATE">Late Check-in</option>
                      <option value="ABSENT">Absent</option>
                    </select>
                  </div>

                  {/* Notes / Reason */}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Log Notes / Reasons</label>
                    <textarea
                      rows={2}
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      placeholder="Enter check-in comments or absent excuse reason..."
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-850 dark:text-slate-200 focus:outline-none"
                    />
                  </div>

                  {/* Action buttons */}
                  <div className="flex space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalMode('selection')}
                      className="w-1/2 border border-slate-200 text-slate-650 rounded-lg py-2 hover:bg-slate-50 font-bold transition-all"
                    >
                      Go Back
                    </button>
                    <button
                      type="submit"
                      className="w-1/2 bg-brand-500 text-white rounded-lg py-2 hover:bg-brand-600 font-bold transition-all"
                    >
                      Save Log Entry
                    </button>
                  </div>

                </form>
              )}

            </div>

          </div>
        </div>
      )}

    </div>
  );
};
