import React, { useEffect, useState, useRef } from 'react';
import {
  Users,
  Calendar,
  IndianRupee,
  ArrowRight,
  Award,
  Clock,
  QrCode,
  CheckCircle,
  ShieldAlert,
  Camera,
  X
} from 'lucide-react';
import { dataService, formatHours } from '../services/dataService';
import type { Tenant, User as StaffUser, Attendance } from '../services/dataService';

interface DashboardViewProps {
  tenant: Tenant | null;
  setActiveTab: (tab: any) => void;
  triggerRefreshKey: number;
  currentUser: StaffUser | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ tenant, setActiveTab, triggerRefreshKey, currentUser }) => {
  const [stats, setStats] = useState({
    patientsCount: 0,
    appointmentsCount: 0,
    myTodaySessionsCount: 0,
    revenue: 0,
    myCompletedCount: 0,
    myCompletedHours: 0,
  });
  const [loading, setLoading] = useState(true);

  // Attendance states
  const [todayAttendance, setTodayAttendance] = useState<Attendance | null>(null);
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [modalMode, setModalMode] = useState<'selection' | 'qr' | 'manual'>('selection');
  const [showQrPortal, setShowQrPortal] = useState(false);

  // Manual marking form
  const [manualCheckIn, setManualCheckIn] = useState('09:00');
  const [manualCheckOut, setManualCheckOut] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState(currentUser?.id || '');
  const [manualStatus, setManualStatus] = useState<'PRESENT' | 'ABSENT' | 'LATE'>('PRESENT');

  // QR simulation states
  const [qrScanning, setQrScanning] = useState(false);
  const [qrScanResult, setQrScanResult] = useState<string | null>(null);
  const [qrSuccessMessage, setQrSuccessMessage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);

  // Helper to generate daily QR code pixels deterministically
  const getDailyQRPixels = (dateStr: string) => {
    let hash = 0;
    for (let i = 0; i < dateStr.length; i++) {
      hash = dateStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    const pixels = [];
    for (let x = 35; x <= 65; x += 5) {
      for (let y = 5; y <= 95; y += 5) {
        const pseudoRandom = Math.abs(Math.sin(hash + x * 12.9898 + y * 78.233)) * 43758.5453;
        if ((pseudoRandom % 1) > 0.45) {
          pixels.push({ x, y });
        }
      }
    }
    for (let x = 5; x <= 95; x += 5) {
      for (let y = 35; y <= 65; y += 5) {
        if (x < 30 && y < 30) continue;
        if (x >= 70 && y < 30) continue;
        if (x < 30 && y >= 70) continue;
        const pseudoRandom = Math.abs(Math.sin(hash + x * 12.9898 + y * 78.233)) * 43758.5453;
        if ((pseudoRandom % 1) > 0.45) {
          pixels.push({ x, y });
        }
      }
    }
    return pixels;
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const patients = await dataService.getPatients();
      const appointments = await dataService.getScheduledSessions();
      const invoices = await dataService.getInvoices();

      // Current calendar year & month helper
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-indexed

      // Calculate stats (Current month only)
      const totalRevenue = invoices
        .filter((inv) => {
          if (String(inv.payment_status).toUpperCase() !== 'PAID') return false;
          if (!inv.created_at) return false;
          const invDate = new Date(inv.created_at);
          return invDate.getFullYear() === currentYear && invDate.getMonth() === currentMonth;
        })
        .reduce((sum, inv) => sum + inv.total_amount, 0);

      const staff = await dataService.getUsers();
      setStaffList(staff);

      // Count appointments today in local timezone for active accounts
      const todayLocalStr = new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
      const todaySessionsList = appointments.filter((app) => {
        const appLocalDate = new Date(app.start_time).toLocaleDateString('sv-SE');
        if (appLocalDate !== todayLocalStr) return false;
        
        // Do not take count of appointments already marked as done
        if (app.status === 'completed') return false;

        // Verify practitioner account is active
        const practitioner = staff.find((u) => u.id === app.practitioner_id);
        if (practitioner && practitioner.resource_fhir?.active === false) return false;

        // Verify patient account is active
        const patient = patients.find((p) => p.id === app.patient_id);
        if (patient && patient.resource_fhir?.active === false) return false;

        return true;
      });

      const todaySessions = todaySessionsList.length;
      const myTodaySessionsCount = todaySessionsList.filter(app => app.practitioner_id === currentUser?.id).length;

      // Count new patients registered this month (from 1st of the month)
      const patientsThisMonth = patients.filter((patient) => {
        if (!patient.created_at) return false;
        const pDate = new Date(patient.created_at);
        return pDate.getFullYear() === currentYear && pDate.getMonth() === currentMonth;
      }).length;

        // Count my completed sessions and hours (Current month only)
        const myCompletedSessions = appointments.filter((app) => {
          if (app.practitioner_id !== currentUser?.id) return false;
          if (app.status !== 'completed') return false;
          if (!app.start_time) return false;
          const appDate = new Date(app.start_time);
          return appDate.getFullYear() === currentYear && appDate.getMonth() === currentMonth;
        });

        const sessionDuration = tenant?.session_duration_minutes || 45;

        const myCompletedCount = myCompletedSessions.reduce((sum, app) => {
          if (!app.start_time || !app.end_time) return sum;
          const durationMs = new Date(app.end_time).getTime() - new Date(app.start_time).getTime();
          if (isNaN(durationMs) || durationMs <= 0) return sum + 1;
          const count = Math.max(1, Math.round(durationMs / (sessionDuration * 60 * 1000)));
          return sum + count;
        }, 0);

        const myCompletedHours = myCompletedSessions.reduce((sum, app) => {
          if (!app.start_time || !app.end_time) return sum;
          const durationMs = new Date(app.end_time).getTime() - new Date(app.start_time).getTime();
          if (isNaN(durationMs) || durationMs <= 0) return sum;
          const count = Math.max(1, Math.round(durationMs / (sessionDuration * 60 * 1000)));
          return sum + (count * sessionDuration / 60);
        }, 0);

      setStats({
        patientsCount: patientsThisMonth,
        appointmentsCount: todaySessions,
        myTodaySessionsCount,
        revenue: totalRevenue,
        myCompletedCount,
        myCompletedHours,
      });

      // Load today's check-in status for currentUser
      if (currentUser?.id) {
        const attendance = await dataService.getAttendance(todayLocalStr, currentUser.id);
        if (attendance && attendance.length > 0) {
          setTodayAttendance(attendance[0]);
        } else {
          setTodayAttendance(null);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [triggerRefreshKey, currentUser]);

  // QR scanner animation
  useEffect(() => {
    if (modalMode === 'qr' && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let lineY = 0;
      let direction = 1;

      const drawScanner = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#64748B';
        ctx.lineWidth = 2;
        ctx.strokeRect(40, 40, canvas.width - 80, canvas.height - 80);

        ctx.strokeStyle = '#3B82F6';
        ctx.lineWidth = 4;
        
        ctx.beginPath();
        ctx.moveTo(35, 60); ctx.lineTo(35, 35); ctx.lineTo(60, 35); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(canvas.width - 60, 35); ctx.lineTo(canvas.width - 35, 35); ctx.lineTo(canvas.width - 35, 60); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(35, canvas.height - 60); ctx.lineTo(35, canvas.height - 35); ctx.lineTo(60, canvas.height - 35); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(canvas.width - 60, canvas.height - 35); ctx.lineTo(canvas.width - 35, canvas.height - 35); ctx.lineTo(canvas.width - 35, canvas.height - 60); ctx.stroke();

        ctx.strokeStyle = '#EF4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(45, 50 + lineY);
        ctx.lineTo(canvas.width - 45, 50 + lineY);
        ctx.stroke();

        lineY += 2.5 * direction;
        if (lineY > canvas.height - 100 || lineY < 0) direction *= -1;

        ctx.fillStyle = '#64748B';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('PLACE COUNTERTOP QR CODE WITHIN FOCUS AREA', canvas.width / 2, canvas.height - 15);

        animationRef.current = requestAnimationFrame(drawScanner);
      };

      drawScanner();
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [modalMode]);

  const handleMarkManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      const todayStr = new Date().toLocaleDateString('sv-SE');
      const checkInISO = new Date(`${todayStr}T${manualCheckIn}:00`).toISOString();
      const checkOutISO = manualCheckOut ? new Date(`${todayStr}T${manualCheckOut}:00`).toISOString() : null;

      const targetUserId = canManageAttendance ? selectedStaffId : currentUser.id;

      const result = await dataService.markAttendance(
        targetUserId,
        checkInISO,
        checkOutISO,
        canManageAttendance ? manualStatus : 'PRESENT',
        'MANUAL',
        manualNotes
      );

      if (result && result.success === false) {
        alert(result.message);
        return;
      }

      setShowMarkModal(false);
      setModalMode('selection');
      setManualNotes('');
      setManualCheckOut('');
      
      fetchDashboardData();
    } catch (err: any) {
      console.error(err);
      alert(`Error: ${err.message || err.details || JSON.stringify(err)}`);
    }
  };

  const simulateQRScan = async () => {
    if (!currentUser) return;
    setQrScanning(true);
    setQrScanResult(null);
    setQrSuccessMessage(null);

    setTimeout(async () => {
      try {
        const todayStr = new Date().toLocaleDateString('sv-SE');
        const dailyToken = `PRAXDOC-AUTH-${todayStr}`;
        const response = await dataService.markAttendanceQR(currentUser.id, dailyToken);
        setQrScanning(false);
        setQrScanResult(response.success ? 'success' : 'already_marked');
        setQrSuccessMessage(response.message);
        
        await dataService.addAuditTrail('CONSENT_CHANGED', `Logged dashboard QR attendance scan for: ${currentUser.full_name}`);
        fetchDashboardData();
      } catch (err: any) {
        setQrScanning(false);
        setQrScanResult('error');
        setQrSuccessMessage(err.message || 'Verification token failed.');
      }
    }, 1500);
  };

  const isReceptionist = currentUser?.position_role === 'Receptionist';
  const isAdmin = currentUser?.position_role === 'Admin';
  const canGenerateQr = isAdmin || isReceptionist;
  const canManageAttendance = isAdmin || currentUser?.can_manage_attendance;

  return (
    <div className="space-y-6">
      
      {/* Welcome Message Card */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 dark:bg-[#111827] dark:border-slate-800 flex flex-col md:flex-row md:items-center md:justify-between shadow-sm relative overflow-hidden transition-all duration-200 space-y-4 md:space-y-0">
        <div className="z-10">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Welcome back, {currentUser ? currentUser.full_name : <span className="animate-pulse bg-slate-200 dark:bg-slate-700 h-6 w-32 rounded inline-block ml-2 align-middle"></span>}!
          </h1>
          <p className="text-xs text-slate-400 mt-1">PraxDoc Workspace Panel</p>
        </div>
        
        {/* Attendance status indicators on dashboard */}
        <div className="flex flex-wrap items-center gap-3 z-10">
          <div className="bg-slate-50 dark:bg-slate-800 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <span className="text-slate-400 block text-[9px] uppercase font-bold">Attendance Today</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">
              {todayAttendance ? (
                todayAttendance.check_out ? (
                  `Checked Out: ${new Date(todayAttendance.check_out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                ) : (
                  `Checked In: ${new Date(todayAttendance.check_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`
                )
              ) : (
                'Not Checked In'
              )}
            </span>
          </div>

          <button
            onClick={() => {
              if (todayAttendance) {
                setManualCheckIn(todayAttendance.check_in ? new Date(todayAttendance.check_in).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '09:00');
                setManualCheckOut(todayAttendance.check_out ? new Date(todayAttendance.check_out).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) : '');
                setManualNotes(todayAttendance.notes || '');
                setModalMode('manual');
              } else {
                setManualCheckIn('09:00');
                setManualCheckOut('');
                setManualNotes('');
                setModalMode('selection');
              }
              setShowMarkModal(true);
            }}
            className="bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-sm transition-colors flex items-center space-x-1 cursor-pointer"
          >
            <Clock className="h-4 w-4" />
            <span>Mark Presence</span>
          </button>

          {canGenerateQr && (
            <button
              onClick={() => setShowQrPortal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs px-3.5 py-2 rounded-lg shadow-sm transition-colors flex items-center space-x-1"
            >
              <QrCode className="h-4 w-4" />
              <span>QR Portal</span>
            </button>
          )}
        </div>

        <div className="absolute right-0 top-0 h-32 w-32 bg-brand-500/10 rounded-full blur-xl -mr-10 -mt-10" />
      </div>

      {/* Stats Cards Section */}
      <div className={`grid grid-cols-1 gap-6 ${currentUser?.position_role === 'Admin' ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2'}`}>
        
        {/* Total Patients Card (Admin Only) */}
        {currentUser?.position_role === 'Admin' && (
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 dark:bg-[#111827] dark:border-slate-800 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">New Patients This Month</span>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
                {loading ? '...' : stats.patientsCount}
              </h3>
              <button
                onClick={() => setActiveTab('Patients')}
                className="text-brand-500 dark:text-brand-400 hover:text-brand-600 font-bold text-xs mt-2 flex items-center"
              >
                View patient roster <ArrowRight className="h-3 w-3 ml-1" />
              </button>
            </div>
            <div className="h-12 w-12 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 dark:bg-brand-950/20 dark:text-brand-400">
              <Users className="h-6 w-6" />
            </div>
          </div>
        )}

        {/* Sessions Today Card (Everyone Sees) */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 dark:bg-[#111827] dark:border-slate-800 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Appointments Today</span>
            <div className="flex items-baseline space-x-3 mt-1">
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {loading ? '...' : stats.appointmentsCount}
              </h3>
              <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded flex items-center">
                <span>For You:</span>
                <span className="font-extrabold font-mono text-brand-500 dark:text-brand-400 ml-1">{loading ? '...' : stats.myTodaySessionsCount}</span>
              </div>
            </div>
            <button
              onClick={() => setActiveTab('Appointments')}
              className="text-brand-500 dark:text-brand-400 hover:text-brand-600 font-bold text-xs mt-2 flex items-center"
            >
              View shift sessions <ArrowRight className="h-3 w-3 ml-1" />
            </button>
          </div>
          <div className="h-12 w-12 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 dark:bg-teal-950/20 dark:text-teal-400">
            <Calendar className="h-6 w-6" />
          </div>
        </div>

        {/* Earnings Card (Admin Only) */}
        {currentUser?.position_role === 'Admin' && (
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 dark:bg-[#111827] dark:border-slate-800 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
            <div>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Revenue Collected</span>
              <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1 flex items-center">
                <span className="text-slate-500 mr-1 text-2xl">₹</span>
                {loading ? '...' : stats.revenue.toLocaleString('en-IN')}
              </h3>
              <button
                onClick={() => setActiveTab('Billing')}
                className="text-brand-500 dark:text-brand-400 hover:text-brand-600 font-bold text-xs mt-2 flex items-center"
              >
                Go to billing console <ArrowRight className="h-3 w-3 ml-1" />
              </button>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-450">
              <IndianRupee className="h-6 w-6" />
            </div>
          </div>
        )}

        {/* Staff Performance Card (Everyone Sees Their Own) */}
        <div className="rounded-xl border border-slate-200/80 bg-white p-6 dark:bg-[#111827] dark:border-slate-800 flex items-center justify-between shadow-sm hover:shadow-md transition-all">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Monthly Completion</span>
            <div className="mt-2 space-y-1">
              <div className="text-sm font-bold text-slate-700 dark:text-slate-350">
                Sessions: <span className="text-2xl font-extrabold text-slate-900 dark:text-white ml-1">{loading ? '...' : stats.myCompletedCount}</span>
              </div>
              <div className="text-sm font-bold text-slate-700 dark:text-slate-350">
                Hours: <span className="text-xl font-extrabold text-slate-900 dark:text-white ml-1">{loading ? '...' : formatHours(stats.myCompletedHours)}</span>
              </div>
            </div>
          </div>
          <div className="h-12 w-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400">
            <Award className="h-6 w-6" />
          </div>
        </div>

      </div>

      {/* 1. Mark Attendance Modal */}
      {showMarkModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden dark:bg-slate-900 dark:border-slate-800">
            <div className="bg-brand-500 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center">
                <Clock className="h-4 w-4 mr-2" /> Mark Attendance
              </h3>
              <button
                onClick={() => {
                  setShowMarkModal(false);
                  setQrScanResult(null);
                  setQrSuccessMessage(null);
                }}
                className="text-white hover:text-slate-100 text-xs font-bold font-mono cursor-pointer"
              >
                CLOSE
              </button>
            </div>
            <div className="p-6">
              {modalMode === 'selection' && (
                <div className="space-y-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-normal text-center">
                    Select check-in method to register presence logs for today.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      onClick={() => {
                        setModalMode('qr');
                        simulateQRScan();
                      }}
                      className="flex flex-col items-center justify-center p-5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-500 hover:bg-brand-50/10 transition-all text-center space-y-3 cursor-pointer"
                    >
                      <div className="h-10 w-10 bg-brand-50 rounded-lg flex items-center justify-center text-brand-500 dark:bg-brand-950/20">
                        <QrCode className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-850 dark:text-white font-outfit">Scan Clinic QR</span>
                    </button>
                    <button
                      onClick={() => setModalMode('manual')}
                      className="flex flex-col items-center justify-center p-5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-brand-500 hover:bg-brand-50/10 transition-all text-center space-y-3 cursor-pointer"
                    >
                      <div className="h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-500 dark:bg-indigo-950/20">
                        <Clock className="h-5 w-5" />
                      </div>
                      <span className="text-xs font-bold text-slate-850 dark:text-white font-outfit">Manual Entry</span>
                    </button>
                  </div>
                </div>
              )}

              {modalMode === 'qr' && (
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="relative border border-slate-300 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-950">
                    <canvas ref={canvasRef} width={300} height={240} className="block" />
                    {qrScanning && (
                      <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500 mx-auto" />
                          <span className="block text-[10px] text-white mt-2 font-mono">VERIFYING QR ENCRYPTION TOKEN...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {qrScanResult && (
                    <div className={`w-full p-3 rounded-lg border text-xs text-left flex items-start space-x-2 ${
                      qrScanResult === 'success' ? 'bg-emerald-50 border-emerald-250 text-emerald-800' : 'bg-amber-50 border-amber-250 text-amber-800'
                    }`}>
                      <div className="mt-0.5">
                        {qrScanResult === 'success' ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <ShieldAlert className="h-4 w-4 text-amber-600" />}
                      </div>
                      <div>
                        <span className="font-bold uppercase block">{qrScanResult === 'success' ? 'Success' : 'Notice'}</span>
                        <p className="mt-0.5 leading-normal text-[11px] font-semibold">{qrSuccessMessage}</p>
                      </div>
                    </div>
                  )}

                  {!qrScanning && !qrScanResult && (
                    <button
                      onClick={simulateQRScan}
                      className="w-full bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs py-2 rounded-lg transition-colors flex items-center justify-center space-x-1 cursor-pointer"
                    >
                      <Camera className="h-4.5 w-4.5" />
                      <span>Simulate Camera Scan</span>
                    </button>
                  )}

                  <button onClick={() => { setModalMode('selection'); setQrScanResult(null); }} className="text-slate-400 text-xs font-semibold cursor-pointer">
                    Go Back
                  </button>
                </div>
              )}

              {modalMode === 'manual' && (
                <form onSubmit={handleMarkManual} className="space-y-4 text-xs">
                  
                  {canManageAttendance && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Select Staff Member</label>
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
                    </div>
                  )}

                  {canManageAttendance && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Presence Status</label>
                      <select
                        value={manualStatus}
                        onChange={(e) => setManualStatus(e.target.value as any)}
                        className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none"
                      >
                        <option value="PRESENT">Present (On Time)</option>
                        <option value="LATE">Late Check-in</option>
                        <option value="ABSENT">Absent</option>
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Check-in time</label>
                    <input
                      type="time"
                      required
                      value={manualCheckIn}
                      onChange={(e) => setManualCheckIn(e.target.value)}
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Check-out time (optional)</label>
                    <input
                      type="time"
                      value={manualCheckOut}
                      onChange={(e) => setManualCheckOut(e.target.value)}
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Comments / Reason</label>
                    <textarea
                      rows={2}
                      value={manualNotes}
                      onChange={(e) => setManualNotes(e.target.value)}
                      placeholder="Comment e.g. checked in from parking lot"
                      className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-850 dark:text-slate-200"
                    />
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <button type="button" onClick={() => setModalMode('selection')} className="w-1/2 border border-slate-200 rounded-lg py-2 cursor-pointer hover:bg-slate-50 transition-colors">
                      Go Back
                    </button>
                    <button type="submit" className="w-1/2 bg-brand-500 text-white rounded-lg py-2 cursor-pointer hover:bg-brand-600 transition-colors">
                      Save Log Entry
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. QR Code Generation Display Modal (Admin/Receptionist Only) */}
      {showQrPortal && canGenerateQr && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl w-full max-w-sm overflow-hidden dark:bg-slate-900 dark:border-slate-800">
            <div className="bg-indigo-650 text-white px-6 py-4 flex justify-between items-center">
              <h3 className="font-bold text-sm flex items-center">
                <QrCode className="h-4 w-4 mr-2" /> Attendance Scan Board
              </h3>
              <button 
                onClick={() => setShowQrPortal(false)} 
                className="text-white hover:text-slate-200 transition-colors"
                aria-label="Close QR Portal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col items-center justify-center space-y-4">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 text-center">
                Display this code at the front desk desk. Staff members can scan this QR code using their dashboard to mark entry/exit times.
              </span>
              
              {/* SVG vector rendered real-looking QR code */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col items-center space-y-3">
                <svg className="h-48 w-48 text-slate-900" viewBox="0 0 100 100" fill="currentColor">
                  {/* Top-Left finder */}
                  <rect x="0" y="0" width="30" height="30" />
                  <rect x="5" y="5" width="20" height="20" fill="white" />
                  <rect x="10" y="10" width="10" height="10" />

                  {/* Top-Right finder */}
                  <rect x="70" y="0" width="30" height="30" />
                  <rect x="75" y="5" width="20" height="20" fill="white" />
                  <rect x="80" y="10" width="10" height="10" />

                  {/* Bottom-Left finder */}
                  <rect x="0" y="70" width="30" height="30" />
                  <rect x="5" y="75" width="20" height="20" fill="white" />
                  <rect x="10" y="80" width="10" height="10" />

                  {/* Dynamic daily rotating pixels */}
                  {getDailyQRPixels(new Date().toLocaleDateString('sv-SE')).map((p, idx) => (
                    <rect key={idx} x={p.x} y={p.y} width="5" height="5" />
                  ))}
                </svg>
                <span className="text-[9px] font-mono font-bold tracking-widest text-slate-400">
                  PRAXDOC-AUTH-{new Date().toLocaleDateString('sv-SE')}
                </span>
              </div>

              <div className="flex items-center space-x-1.5 text-[10px] text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded dark:bg-emerald-950/20 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping inline-block" />
                <span className="font-bold font-mono">TOKEN REFRESHING IN REALTIME</span>
              </div>

              <button
                onClick={() => setShowQrPortal(false)}
                className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold py-2.5 rounded-lg transition-colors mt-2"
              >
                Close Portal
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
