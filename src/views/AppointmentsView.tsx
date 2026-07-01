import React, { useEffect, useState } from 'react';
import { Calendar as CalendarIcon, Clock, Trash2, UserCheck, RefreshCw } from 'lucide-react';
import { dataService, subscribeToTable } from '../services/dataService';
import type { ScheduledSession, Patient, User as StaffUser, Tenant } from '../services/dataService';

interface AppointmentsViewProps {
  triggerRefresh: () => void;
  triggerRefreshKey: number;
  selectedAppointmentId: string | null;
  setSelectedAppointmentId: (id: string | null) => void;
  currentUser: StaffUser | null;
}

export const AppointmentsView: React.FC<AppointmentsViewProps> = ({
  triggerRefresh,
  triggerRefreshKey,
  selectedAppointmentId,
  setSelectedAppointmentId,
  currentUser,
}) => {
  const [sessions, setSessions] = useState<ScheduledSession[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);

  // Helper to get current YYYY-MM-DD
  const getTodayDateString = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Helper to get HH:MM with optional offset minutes
  const getCurrentTimeString = (offsetMinutes = 0) => {
    const now = new Date(Date.now() + offsetMinutes * 60000);
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  // Scheduling Form
  const [patientId, setPatientId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [sessionDate, setSessionDate] = useState(getTodayDateString());
  const [startTime, setStartTime] = useState(getCurrentTimeString(0));
  const [numSessions, setNumSessions] = useState<number>(1);
  const [notes, setNotes] = useState('');

  // Toast / Status message
  const [realtimeNotify, setRealtimeNotify] = useState<string | null>(null);

  const loadSessionsData = async () => {
    try {
      const s = await dataService.getScheduledSessions();
      setSessions(s);
      const p = await dataService.getPatients();
      setPatients(p);
      if (p.length > 0) setPatientId(p[0].id);
      const st = await dataService.getUsers();
      setStaff(st);
      if (st.length > 0) setStaffId(st[0].id);

      const t = await dataService.getTenant();
      setTenant(t);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessionsData();
  }, [triggerRefreshKey]);

  // Real-time listener registration
  useEffect(() => {
    const unsubscribe = subscribeToTable('scheduled_sessions', (payload) => {
      console.log('Real-time notification on scheduled_sessions channel:', payload);
      setRealtimeNotify(`Real-time Sync: Scheduled session list was ${payload.eventType.toLowerCase()}d!`);
      setTimeout(() => setRealtimeNotify(null), 4000);
      loadSessionsData(); // reload session logs dynamically without page refresh
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Handle auto-scrolling and highlighting for selectedAppointmentId
  useEffect(() => {
    if (selectedAppointmentId && sessions.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`appointment-card-${selectedAppointmentId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);

      const timer = setTimeout(() => {
        setSelectedAppointmentId(null);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [selectedAppointmentId, sessions]);

  const handleBookSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !staffId) {
      setBookingError("Please select both a patient and an assigned practitioner.");
      return;
    }
    if (!sessionDate || !startTime) {
      setBookingError("Please enter a valid session date and start time.");
      return;
    }
    setBookingError(null);

    try {
      // Calculate local Date objects to prevent timezone shifting
      const localStart = new Date(`${sessionDate}T${startTime}:00`);
      if (isNaN(localStart.getTime())) {
        throw new Error("Invalid start date or time format. Please check your inputs.");
      }
      
      const sessionDuration = tenant?.session_duration_minutes || 45;
      const localEnd = new Date(localStart.getTime() + numSessions * sessionDuration * 60 * 1000);
      const startIso = localStart.toISOString();
      const endIso = localEnd.toISOString();

      await dataService.addScheduledSession({
        patient_id: patientId,
        practitioner_id: staffId,
        start_time: startIso,
        end_time: endIso,
        session_notes: notes,
      });

      // Clear note
      setNotes('');
      setNumSessions(1);
      await dataService.addAuditTrail('READ_PATIENT', `Booked new therapy session for patient ID ${patientId}`);
      triggerRefresh();
    } catch (err: any) {
      console.warn("Validation warning:", err.message || err);
      setBookingError(err.message || 'Failed to book session. Please try again.');
    }
  };

  const canAcceptSession = (session: ScheduledSession) => {
    if (!currentUser) return false;
    if (currentUser.position_role === 'Admin') return true;
    return session.practitioner_id === currentUser.id;
  };

  const notifyAdmins = async (
    actionType: 'COMPLETED' | 'CANCELLED' | 'DELETED',
    session: ScheduledSession
  ) => {
    try {
      const patient = patients.find(p => p.id === session.patient_id);
      const practitioner = staff.find(s => s.id === session.practitioner_id);
      const patientName = patient
        ? `${patient.resource_fhir?.name?.[0]?.given?.[0] || ''} ${patient.resource_fhir?.name?.[0]?.family || ''}`.trim()
        : 'Unknown Patient';
      const practitionerName = practitioner ? practitioner.full_name : 'Specialist';
      
      const appTime = new Date(session.start_time).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
      
      const performerName = currentUser ? currentUser.full_name : 'Unknown User';
      const nowStr = new Date().toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      let title = '';
      let description = '';

      if (actionType === 'COMPLETED') {
        title = 'Appointment Completed';
        description = `Appointment for ${patientName} (assigned to Dr. ${practitionerName}) on ${appTime} was marked as COMPLETED by ${performerName} on ${nowStr}.`;
      } else if (actionType === 'CANCELLED') {
        title = 'Appointment Cancelled';
        description = `Appointment for ${patientName} (assigned to Dr. ${practitionerName}) on ${appTime} was CANCELLED by ${performerName} on ${nowStr}.`;
      } else if (actionType === 'DELETED') {
        title = 'Appointment Deleted';
        description = `Appointment slot for ${patientName} (assigned to Dr. ${practitionerName}) on ${appTime} was DELETED by ${performerName} on ${nowStr}.`;
      }

      // Find all admin users
      const admins = staff.filter(u => u.position_role === 'Admin');
      for (const admin of admins) {
        await dataService.addNotification({
          user_id: admin.id,
          title,
          description,
          target_id: session.id
        });
      }
    } catch (err) {
      console.warn("Failed to notify admins of appointment mutation:", err);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    try {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;

      await dataService.deleteScheduledSession(sessionId);
      await dataService.addAuditTrail('READ_PATIENT', `Cancelled scheduled session ID ${sessionId}`);
      
      // Send notification to admins
      await notifyAdmins('DELETED', session);
      
      triggerRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateStatus = async (sessionId: string, status: 'completed' | 'cancelled') => {
    try {
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return;
      
      const patient = patients.find((p) => p.id === session.patient_id);
      const patientName = patient
        ? `${patient.resource_fhir?.name?.[0]?.given?.[0] || ''} ${patient.resource_fhir?.name?.[0]?.family || ''}`.trim() || 'Unknown Patient'
        : session.patient_id;

      await dataService.updateScheduledSessionStatus(sessionId, status);
      await dataService.addAuditTrail(
        'READ_PATIENT',
        `Marked appointment session for patient ${patientName} as ${status === 'completed' ? 'Completed/Done' : 'Cancelled'}`
      );
      
      // Send notification to admins
      await notifyAdmins(status === 'completed' ? 'COMPLETED' : 'CANCELLED', session);
      
      triggerRefresh();
    } catch (err) {
      console.error("Failed to update session status:", err);
    }
  };
  return (
    <div className="space-y-6">
      
      {/* Real-time Banner indicator */}
      {realtimeNotify && (
        <div className="bg-emerald-600 text-white text-xs font-bold px-4 py-2.5 rounded-lg flex items-center justify-between shadow-lg animate-bounce transition-all duration-300">
          <div className="flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>{realtimeNotify}</span>
          </div>
          <span className="text-[9px] uppercase bg-emerald-700 px-2 py-0.5 rounded">Real-time Subscription Active</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column: Booking form */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm dark:bg-[#111827] dark:border-slate-800 space-y-4">
          <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
            <CalendarIcon className="h-4 w-4 mr-2 text-brand-500" /> Allocate Session
          </h3>

          <form onSubmit={handleBookSession} className="space-y-4">
            {bookingError && (
              <div className="bg-red-50 border border-red-200 text-red-750 text-xs font-semibold p-3 rounded-lg flex items-start space-x-2 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400">
                <span className="mt-0.5">⚠️</span>
                <span>{bookingError}</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Select Patient</label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.resource_fhir?.name?.[0]?.given?.[0]} {p.resource_fhir?.name?.[0]?.family}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Assigned Practitioner</label>
              <select
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              >
                {staff.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({s.position_role})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Date</label>
              <input
                type="date"
                required
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                className="w-full rounded border border-slate-200 px-3 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Start Time</label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded border border-slate-200 px-2 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Sessions (45m each)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={numSessions}
                  onChange={(e) => setNumSessions(parseInt(e.target.value) || 1)}
                  className="w-full rounded border border-slate-200 px-2 py-2 text-sm bg-white dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Session Target Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Core routine focus (e.g. cervical mobilization, spine evaluation, dry needling)..."
                className="w-full rounded border border-slate-200 p-2 text-xs bg-slate-50 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white focus:border-brand-500"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-brand-500 text-white font-bold text-xs py-2.5 rounded-lg hover:bg-brand-600 transition-colors shadow"
            >
              Add Session Slot
            </button>
          </form>
        </div>

        {/* Right columns: Shifts Timeline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center">
              <Clock className="h-4 w-4 mr-2 text-teal-500" /> Planned sessions
            </h3>
            <span className="text-[10px] bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded font-bold text-slate-500 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">
              Live Feed
            </span>
          </div>

          <div className="space-y-3">
            {loading ? (
              <p className="text-slate-400 text-center py-6 text-sm">Loading clinic schedules...</p>
            ) : sessions.length === 0 ? (
              <div className="text-center py-12 border border-slate-200 border-dashed rounded-xl bg-white dark:bg-[#111827] dark:border-slate-800">
                <CalendarIcon className="h-8 w-8 text-slate-350 dark:text-slate-650 mx-auto" />
                <p className="text-slate-400 text-xs mt-3">No shifts scheduled for this session date range.</p>
              </div>
            ) : (
              // Order by start_time ascending
              [...sessions]
                .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
                .map((session) => {
                  const patient = patients.find((p) => p.id === session.patient_id);
                  const doc = staff.find((s) => s.id === session.practitioner_id);
                  
                  const pName = patient ? `${patient.resource_fhir?.name?.[0]?.given?.[0]} ${patient.resource_fhir?.name?.[0]?.family}` : 'Unknown Patient';
                  const dName = doc ? doc.full_name : 'Specialist';

                  const dateObj = new Date(session.start_time);
                  const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
                  const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

                  const isSelected = session.id === selectedAppointmentId;

                  return (
                    <div
                      key={session.id}
                      id={`appointment-card-${session.id}`}
                      className={`rounded-xl border p-4 shadow-sm hover:shadow transition-all flex justify-between items-start group ${
                        isSelected
                          ? 'bg-brand-50/20 border-brand-500 ring-2 ring-brand-500/30 dark:bg-brand-950/10 dark:border-brand-400'
                          : 'bg-white border-slate-200 dark:bg-[#111827] dark:border-slate-800 hover:border-brand-500/40'
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                          <span className="text-brand-500 dark:text-brand-400">{timeStr}</span>
                          <span>•</span>
                          <span>{dateStr}</span>
                        </div>

                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{pName}</h4>
                        
                        <div className="flex items-center text-xs text-slate-500 dark:text-slate-400 space-x-1.5">
                          <UserCheck className="h-3.5 w-3.5 text-slate-400" />
                          <span>Assigned: <strong className="text-slate-700 dark:text-slate-300">{dName}</strong></span>
                        </div>

                        {session.session_notes && (
                          <p className="text-[11px] italic text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/30 p-2 rounded-lg mt-1 border border-slate-100 dark:border-slate-800/50">
                            ✏️ {session.session_notes}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center space-x-2 self-center">
                        {session.status === 'scheduled' && (
                          <>
                            {canAcceptSession(session) ? (
                              <>
                                <button
                                  onClick={() => handleUpdateStatus(session.id, 'completed')}
                                  className="text-[10px] bg-emerald-50 border border-emerald-200 text-emerald-700 hover:bg-emerald-100 px-2 py-1 rounded font-bold transition-all dark:bg-emerald-950/20 dark:border-emerald-900/30 dark:text-emerald-450"
                                  title="Mark Done"
                                >
                                  ✓ Done
                                </button>
                                <button
                                  onClick={() => handleUpdateStatus(session.id, 'cancelled')}
                                  className="text-[10px] bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100 px-2 py-1 rounded font-bold transition-all dark:bg-rose-950/20 dark:border-rose-900/30 dark:text-rose-450"
                                  title="Cancel appointment"
                                >
                                  ✕ Cancel
                                </button>
                              </>
                            ) : (
                              <span className="text-[9px] uppercase font-bold text-slate-400 border border-slate-200 px-2 py-1 rounded select-none dark:border-slate-800 dark:text-slate-500" title="Only Admin or assigned therapist can complete/cancel this session">
                                Locked
                              </span>
                            )}
                          </>
                        )}
                        {session.status !== 'scheduled' && (
                          <span className={`text-[9px] uppercase font-extrabold px-2 py-0.5 rounded border ${
                            session.status === 'completed'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/10 dark:border-emerald-900/30 dark:text-emerald-450'
                              : 'bg-slate-100 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400'
                          }`}>
                            {session.status === 'completed' ? 'Completed' : 'Cancelled'}
                          </span>
                        )}
                        
                        {canAcceptSession(session) && (
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-all self-center"
                            title="Remove session slot"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
