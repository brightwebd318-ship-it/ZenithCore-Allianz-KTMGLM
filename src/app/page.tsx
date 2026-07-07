"use client";

import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import type { TabType } from '../components/Layout';
import { OnboardingWizard } from '../components/OnboardingWizard';
import { LoginView } from '../views/LoginView';
import { DashboardView } from '../views/DashboardView';
import { PatientsView } from '../views/PatientsView';
import { AppointmentsView } from '../views/AppointmentsView';
import { BillingView } from '../views/BillingView';
import { InventoryView } from '../views/InventoryView';
import { StaffView } from '../views/StaffView';
import { SalaryView } from '../views/SalaryView';
import { ReportsView } from '../views/ReportsView';
import { TasksView } from '../views/TasksView';
import { AdminControlsView } from '../views/AdminControlsView';
import { AttendanceView } from '../views/AttendanceView';
import { dataService } from '../services/dataService';
import type { Tenant, User } from '../services/dataService';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

export default function Home() {
  const [activeTab, setActiveTab] = useState<TabType>('Dashboard');
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Authentication States
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isFirstTimeSetup, setIsFirstTimeSetup] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Deep-linking Target States
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  // Always enforce light mode and clean up any dark preferences
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('praxdoc_theme');
      document.documentElement.classList.remove('dark');
    }
  }, []);

  // Check session on mount
  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      // Fetch current session
      supabase.auth.getSession()
        .then(({ data: { session } }) => {
          setIsAuthenticated(!!session);
          setAuthLoading(false);
        })
        .catch((err) => {
          console.error("Auth session lookup failed:", err);
          setIsAuthenticated(false);
          setAuthLoading(false);
        });

      // Listen for auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        setIsAuthenticated(!!session);
        setAuthLoading(false);
        if (event !== 'USER_UPDATED' && event !== 'PASSWORD_RECOVERY') {
          dataService.clearCache();
          triggerRefresh();
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      // Mock mode session lookup
      const session = localStorage.getItem('praxdoc_session');
      if (session) {
        try {
          const parsed = JSON.parse(session);
          setIsAuthenticated(!!parsed.loggedIn);
        } catch {
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
      setAuthLoading(false);
    }
  }, []);

  const fetchTenant = async () => {
    try {
      const data = await dataService.getTenant();
      setTenant(data);

      const userProfile = await dataService.getCurrentUser();
      if (userProfile && userProfile.resource_fhir?.active === false) {
        alert("Your account has been deactivated by an administrator.");
        handleLogout();
        return;
      }
      setCurrentUser(userProfile);

      if (data && data.business_name === 'Pending Setup') {
        setIsFirstTimeSetup(true);
        setOnboardingOpen(true);
      } else {
        setIsFirstTimeSetup(false);
        setOnboardingOpen(false);
      }
    } catch (err) {
      console.error('Failed to retrieve tenant settings:', err);
      // If tenant retrieval fails, clear the active session so the user goes back to a clean login screen
      handleLogout();
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchTenant();
    }
  }, [isAuthenticated, refreshKey]);

  // Redirect to first enabled tab if current active tab is not visible/allowed
  useEffect(() => {
    if (currentUser) {
      const defaultTabsForRole = (role: string) => {
        if (role === 'Admin') {
          return ['Dashboard', 'Patients', 'Appointments', 'Tasks', 'Salary', 'Billing', 'Inventory', 'Staff', 'Reports'];
        } else if (role === 'Senior Therapist') {
          return ['Dashboard', 'Patients', 'Appointments', 'Tasks', 'Reports'];
        } else {
          return ['Dashboard', 'Patients', 'Appointments', 'Tasks', 'Billing', 'Inventory'];
        }
      };

      const enabledTabs = currentUser.resource_fhir?.enabled_tabs || defaultTabsForRole(currentUser.position_role);
      
      if (!enabledTabs.includes(activeTab) && activeTab !== 'Administrative Controls') {
        if (enabledTabs.length > 0) {
          setActiveTab(enabledTabs[0] as any);
        }
      }
    }
  }, [currentUser, activeTab]);

  const triggerRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const handleLogout = async () => {
    try {
      if (currentUser) {
        await dataService.addAuditTrail('CONSENT_CHANGED', `User logged out: ${currentUser.email} (${currentUser.full_name})`);
      } else {
        const sessionStr = localStorage.getItem('praxdoc_session');
        const session = sessionStr ? JSON.parse(sessionStr) : null;
        if (session?.email) {
          await dataService.addAuditTrail('CONSENT_CHANGED', `User logged out: ${session.email}`);
        }
      }
    } catch (err) {
      console.error("Failed to log audit trail for logout:", err);
    }

    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    } else {
      localStorage.removeItem('praxdoc_session');
      setIsAuthenticated(false);
    }
    dataService.clearCache();
    setTenant(null);
    setCurrentUser(null);
  };

  const renderActiveView = () => {
    switch (activeTab) {
      case 'Dashboard':
        return (
          <DashboardView
            tenant={tenant}
            setActiveTab={setActiveTab}
            triggerRefreshKey={refreshKey}
            currentUser={currentUser}
          />
        );
      case 'Patients':
        return (
          <PatientsView
            triggerRefresh={triggerRefresh}
            triggerRefreshKey={refreshKey}
            currentUser={currentUser}
          />
        );
      case 'Appointments':
        return (
          <AppointmentsView
            triggerRefresh={triggerRefresh}
            triggerRefreshKey={refreshKey}
            selectedAppointmentId={selectedAppointmentId}
            setSelectedAppointmentId={setSelectedAppointmentId}
            currentUser={currentUser}
          />
        );
      case 'Tasks':
        return (
          <TasksView
            triggerRefresh={triggerRefresh}
            triggerRefreshKey={refreshKey}
            currentUser={currentUser}
            selectedTaskId={selectedTaskId}
            setSelectedTaskId={setSelectedTaskId}
          />
        );
      case 'Billing':
        return (
          <BillingView
            triggerRefresh={triggerRefresh}
            triggerRefreshKey={refreshKey}
          />
        );
      case 'Inventory':
        return (
          <InventoryView
            triggerRefresh={triggerRefresh}
            triggerRefreshKey={refreshKey}
          />
        );
      case 'Staff':
        return (
          <StaffView
            triggerRefresh={triggerRefresh}
            triggerRefreshKey={refreshKey}
            currentUser={currentUser}
          />
        );
      case 'Salary':
        return (
          <SalaryView
            triggerRefresh={triggerRefresh}
            triggerRefreshKey={refreshKey}
          />
        );
      case 'Reports':
        return (
          <ReportsView
            triggerRefresh={triggerRefresh}
            triggerRefreshKey={refreshKey}
            currentUser={currentUser}
          />
        );
      case 'Administrative Controls':
        return (
          <AdminControlsView
            triggerRefresh={triggerRefresh}
          />
        );
      case 'Attendance':
        return (
          <AttendanceView
            triggerRefresh={triggerRefresh}
            triggerRefreshKey={refreshKey}
            currentUser={currentUser}
          />
        );
      default:
        return (
          <div className="text-center py-12 text-slate-400">
            Select a panel from the navigation drawer.
          </div>
        );
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F4F7F9] dark:bg-[#0B0F19] transition-colors duration-200">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-brand-500 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 font-outfit">Loading PraxDoc...</h2>
          <p className="text-xs text-slate-400 mt-1">Verifying secure database credentials</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LoginView
          onLoginSuccess={() => {
            setIsAuthenticated(true);
            triggerRefresh();
          }}
        />
        <OnboardingWizard
          isOpen={onboardingOpen}
          onClose={() => setOnboardingOpen(false)}
          onSuccess={() => {
            setIsAuthenticated(true);
            triggerRefresh();
          }}
          isFirstTimeSetup={isFirstTimeSetup}
          tenantId={tenant?.id}
        />
      </>
    );
  }

  return (
    <>
      <Layout
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        tenant={tenant}
        onLogout={handleLogout}
        currentUser={currentUser}
        onNavigateToTask={(id) => setSelectedTaskId(id)}
        onNavigateToAppointment={(id) => setSelectedAppointmentId(id)}
      >
        {renderActiveView()}
      </Layout>

      <OnboardingWizard
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onSuccess={triggerRefresh}
        isFirstTimeSetup={isFirstTimeSetup}
        tenantId={tenant?.id}
      />
    </>
  );
}
