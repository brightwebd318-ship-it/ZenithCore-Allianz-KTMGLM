import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  Calendar,
  CreditCard,
  Package,
  UserCheck,
  BarChart3,
  Sliders,
  Search,
  Bell,
  ChevronDown,
  Moon,
  Sun,
  Activity,
  PlusCircle,
  LogOut,
  Kanban,
  Heart,
  Stethoscope,
  Plus,
  CheckSquare,
  Banknote
} from 'lucide-react';
import { dataService, subscribeToTable } from '../services/dataService';
import type { Tenant, User, SystemNotification } from '../services/dataService';

export type TabType =
  | 'Dashboard'
  | 'Patients'
  | 'Appointments'
  | 'Tasks'
  | 'Billing'
  | 'Inventory'
  | 'Staff'
  | 'Salary'
  | 'Reports'
  | 'Administrative Controls';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  tenant: Tenant | null;
  onLogout: () => void;
  darkMode: boolean;
  setDarkMode: (dark: boolean) => void;
  currentUser: User | null;
  onNavigateToTask?: (id: string) => void;
  onNavigateToAppointment?: (id: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({
  children,
  activeTab,
  setActiveTab,
  tenant,
  onLogout,
  darkMode,
  setDarkMode,
  currentUser,
  onNavigateToTask,
  onNavigateToAppointment,
}) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [logoConfig, setLogoConfig] = useState<{type: string; preset?: string; url?: string}>({ type: 'preset', preset: 'blue' });

  const loadNotificationsAndBranding = async () => {
    if (currentUser?.id) {
      try {
        const notifs = await dataService.getNotifications(currentUser.id);
        setNotifications(notifs);
      } catch (err) {
        console.error('Failed to load notifications:', err);
      }
    }
  };

  useEffect(() => {
    loadNotificationsAndBranding();
  }, [currentUser]);

  useEffect(() => {
    if (tenant?.id) {
      localStorage.setItem('zenith_tenant_logo_name', tenant.business_name);
      const storedLogo = localStorage.getItem(`zenith_tenant_logo_${tenant.id}`);
      if (storedLogo) {
        try {
          setLogoConfig(JSON.parse(storedLogo));
        } catch (e) {
          console.error('Failed to parse clinic logo config:', e);
        }
      } else {
        setLogoConfig({ type: 'preset', preset: 'blue' });
      }
    }
  }, [tenant]);

  useEffect(() => {
    const unsubscribe = subscribeToTable('notifications', (payload) => {
      loadNotificationsAndBranding();
    });
    return () => {
      unsubscribe();
    };
  }, [currentUser]);

  useEffect(() => {
    if (notificationsOpen && currentUser?.id) {
      dataService.markNotificationsRead(currentUser.id).then(() => {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      });
    }
  }, [notificationsOpen, currentUser]);

  const handleClearNotifications = async () => {
    if (currentUser?.id) {
      await dataService.clearNotifications(currentUser.id);
      setNotifications([]);
    }
  };

  const handleNotificationClick = (n: SystemNotification) => {
    setNotificationsOpen(false);
    const titleLower = n.title.toLowerCase();
    if (titleLower.includes('task')) {
      setActiveTab('Tasks');
      if (n.target_id && onNavigateToTask) {
        onNavigateToTask(n.target_id);
      }
    } else if (titleLower.includes('appointment') || titleLower.includes('booking')) {
      setActiveTab('Appointments');
      if (n.target_id && onNavigateToAppointment) {
        onNavigateToAppointment(n.target_id);
      }
    }
  };

  const renderLogoIcon = () => {
    if ((logoConfig.type === 'url' || logoConfig.type === 'file') && logoConfig.url) {
      return (
        <div className="flex h-10 w-10 items-center justify-center rounded-lg overflow-hidden border border-slate-200 dark:border-slate-800 bg-white shadow-sm flex-shrink-0">
          <img src={logoConfig.url} alt="Clinic Logo" className="h-full w-full object-cover" />
        </div>
      );
    }

    let bgClass = 'bg-brand-500 shadow-brand-500/20';
    let IconComponent = Activity;

    if (logoConfig.type === 'preset') {
      switch (logoConfig.preset) {
        case 'teal':
          bgClass = 'bg-teal-500 shadow-teal-500/20';
          IconComponent = Heart;
          break;
        case 'indigo':
          bgClass = 'bg-indigo-600 shadow-indigo-600/20';
          IconComponent = Stethoscope;
          break;
        case 'emerald':
          bgClass = 'bg-emerald-600 shadow-emerald-600/20';
          IconComponent = CheckSquare;
          break;
        case 'amber':
          bgClass = 'bg-amber-500 shadow-amber-500/20';
          IconComponent = Plus;
          break;
        case 'blue':
        default:
          bgClass = 'bg-blue-600 shadow-blue-600/20';
          IconComponent = Activity;
          break;
      }
    }

    return (
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-white shadow-md flex-shrink-0 ${bgClass}`}>
        <IconComponent className="h-6 w-6 animate-pulse" />
      </div>
    );
  };

  const defaultTabsForRole = (role: string) => {
    if (role === 'Admin') {
      return ['Dashboard', 'Patients', 'Appointments', 'Tasks', 'Salary', 'Billing', 'Inventory', 'Staff', 'Reports'];
    } else if (role === 'Senior Therapist') {
      return ['Dashboard', 'Patients', 'Appointments', 'Tasks', 'Reports'];
    } else {
      return ['Dashboard', 'Patients', 'Appointments', 'Tasks', 'Billing', 'Inventory'];
    }
  };

  const enabledTabs = currentUser?.resource_fhir?.enabled_tabs || defaultTabsForRole(currentUser?.position_role || '');

  const navigationItems = [
    { name: 'Dashboard' as TabType, icon: LayoutDashboard },
    { name: 'Patients' as TabType, icon: Users },
    { name: 'Appointments' as TabType, icon: Calendar },
    { name: 'Tasks' as TabType, icon: Kanban },
    { name: 'Salary' as TabType, icon: Banknote },
    { name: 'Billing' as TabType, icon: CreditCard },
    { name: 'Inventory' as TabType, icon: Package },
    { name: 'Staff' as TabType, icon: UserCheck },
    { name: 'Reports' as TabType, icon: BarChart3 },
    ...(currentUser?.position_role === 'Admin' ? [{ name: 'Administrative Controls' as TabType, icon: Sliders }] : []),
  ].filter(item => {
    if (item.name === 'Administrative Controls') return true;
    return enabledTabs.includes(item.name);
  });

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-800 dark:bg-[#0B0F19] dark:text-slate-100 transition-colors duration-200">
      
      {/* 1. LEFT SIDEBAR */}
      <aside className="w-64 fixed inset-y-0 left-0 bg-white border-r border-slate-200 dark:bg-[#111827] dark:border-slate-800 flex flex-col justify-between z-30 transition-colors duration-200">
        <div>
          {/* Logo Brand Header */}
          <div className="h-16 flex items-center px-2 border-b border-slate-150 dark:border-slate-800 bg-slate-50/55 dark:bg-[#111827] justify-center overflow-hidden">
            <img 
              src="/logo.png" 
              alt="Zenith Core Alliance Logo" 
              className="h-full w-full object-contain p-1.5"
            />
          </div>

          {/* Navigation Tabs */}
          <nav className="mt-2 px-3 space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => setActiveTab(item.name)}
                  className={`w-full flex items-center px-4 py-2.5 text-sm font-semibold rounded-lg transition-all duration-150 group ${
                    isActive
                      ? 'bg-brand-500 text-white shadow-md shadow-brand-500/10'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white'
                  }`}
                >
                  <Icon className={`h-5 w-5 mr-3 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200'}`} />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Lower Left Actions */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-4 bg-slate-50/30 dark:bg-[#111827]/50">

          {/* Brand Logo Banner */}
          <div className="flex items-center justify-center py-2">
            <img 
              src="/praxdoc_logo.png" 
              alt="PraxDoc Logo" 
              className="h-12 w-auto object-contain"
            />
          </div>

          {/* Dark / Light Toggle Switch */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {darkMode ? 'Dark Theme Active' : 'Light Theme Active'}
            </span>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-slate-200 dark:bg-slate-700 transition-colors focus:outline-none"
              id="theme-toggle"
            >
              <span
                className={`${
                  darkMode ? 'translate-x-6 bg-brand-500' : 'translate-x-1 bg-white'
                } inline-block h-4 w-4 transform rounded-full transition-transform flex items-center justify-center`}
              >
                {darkMode ? (
                  <Moon className="h-2.5 w-2.5 text-white" />
                ) : (
                  <Sun className="h-2.5 w-2.5 text-amber-500" />
                )}
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 pl-64 flex flex-col min-h-screen">
        
        {/* 2. TOP BAR */}
        <header className="h-16 bg-white border-b border-slate-200 dark:bg-[#111827] dark:border-slate-800 flex items-center justify-between px-8 sticky top-0 z-25 transition-colors duration-200">
          
          {/* Left spacer / Empty div since search was moved */}
          <div></div>

          {/* Actions & Profile */}
          <div className="flex items-center space-x-4">
            
            {/* Notification Icon */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors relative"
              >
                <Bell className="h-5 w-5" />
                {notifications.some(n => !n.is_read) && (
                  <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500" />
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl py-2 z-50 dark:bg-slate-900 dark:border-slate-800 text-xs">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <span className="font-bold text-slate-900 dark:text-white">System Notifications</span>
                    <span 
                      onClick={handleClearNotifications}
                      className="text-[10px] text-brand-500 font-bold uppercase cursor-pointer hover:text-brand-600 transition-colors"
                    >
                      Clear all
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="px-4 py-6 text-center text-slate-400 dark:text-slate-500 italic">
                        No new notifications
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const stamp = new Date(n.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                        return (
                          <div 
                            key={n.id} 
                            onClick={() => handleNotificationClick(n)}
                            className={`px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 border-b border-slate-50 dark:border-slate-800/50 cursor-pointer ${!n.is_read ? 'bg-brand-50/20 dark:bg-brand-950/10' : ''}`}
                          >
                            <p className="font-bold text-slate-850 dark:text-slate-200 flex items-center justify-between">
                              {n.title}
                              {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-brand-500 inline-block ml-1.5" />}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400 mt-0.5 text-[11px] leading-relaxed">{n.description}</p>
                            <span className="text-[9px] text-slate-400 mt-1 block">{stamp}</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center space-x-3 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all focus:outline-none"
              >
                <div className="h-8 w-8 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-sm shadow">
                  {currentUser && currentUser.full_name ? currentUser.full_name[0].toUpperCase() : 'A'}
                </div>
                <div className="text-left hidden md:block">
                  <span className="block text-xs font-extrabold text-slate-800 dark:text-white">
                    {currentUser ? currentUser.full_name : 'Loading...'}
                  </span>
                  <span className="block text-[10px] font-bold text-slate-400">
                    {currentUser ? currentUser.position_role : 'Clinic Head'}
                  </span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white shadow-xl py-2 z-50 dark:bg-slate-900 dark:border-slate-800">
                  <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800">
                    <span className="block text-sm font-bold text-slate-900 dark:text-white">
                      {currentUser ? currentUser.full_name : 'Loading...'}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400 truncate">
                      {currentUser ? currentUser.email : 'Loading...'}
                    </span>
                  </div>
                  
                  <div className="p-1">

                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        setActiveTab('Administrative Controls');
                      }}
                      className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 rounded-lg dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <Sliders className="h-4 w-4 mr-2 text-slate-400" />
                      Settings & Backups
                    </button>
                    <button
                      onClick={() => {
                        setProfileOpen(false);
                        if (onLogout) onLogout();
                      }}
                      className="w-full text-left flex items-center px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 rounded-lg dark:text-red-400 dark:hover:bg-red-950/20"
                    >
                      <LogOut className="h-4 w-4 mr-2 text-red-500" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

        </header>

        {/* View Content Wrapper */}
        <main className="flex-1 p-8 overflow-y-auto">
          {children}
        </main>
      </div>

    </div>
  );
};
