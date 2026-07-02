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
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Deep-linking Target States
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);

  // Load theme preference on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('zenith_theme');
      if (savedTheme === 'dark') {
        setDarkMode(true);
      } else if (!savedTheme) {
        // Default to dark theme if user prefers system dark mode
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setDarkMode(prefersDark);
      }
    }
  }, []);

  // Sync theme with HTML class
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (darkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('zenith_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('zenith_theme', 'light');
      }
    }
  }, [darkMode]);

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
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setIsAuthenticated(!!session);
        setAuthLoading(false);
        triggerRefresh();
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      // Mock mode session lookup
      const session = localStorage.getItem('zenith_session');
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

      const enabledTabsRaw = currentUser.resource_fhir?.enabled_tabs || defaultTabsForRole(currentUser.position_role);
      const hasPatientsAccess = currentUser.can_view_personal_data && currentUser.can_view_medical_history;
      const enabledTabs = hasPatientsAccess ? enabledTabsRaw : enabledTabsRaw.filter((t: string) => t !== 'Patients');
      
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
        const sessionStr = localStorage.getItem('zenith_session');
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
      localStorage.removeItem('zenith_session');
      setIsAuthenticated(false);
    }
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
          />
        );
      case 'Administrative Controls':
        return (
          <AdminControlsView
            triggerRefresh={triggerRefresh}
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
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200 font-outfit">Loading ZenithCore Alliance...</h2>
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
        darkMode={darkMode}
        setDarkMode={setDarkMode}
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
