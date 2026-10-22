import React from 'react';
import { useApp } from '../context/AppContext';
import { 
  LayoutGrid, 
  Search, 
  Bell, 
  LogOut, 
  Briefcase, 
  UserPlus, 
  Handshake, 
  Printer, 
  Users2,
  FolderKanban,
  ShieldCheck
} from 'lucide-react';

interface Props {
  onOpenLogoutModal: () => void;
}

export const MobileAppBottomNav: React.FC<Props> = ({ onOpenLogoutModal }) => {
  const { 
    activeSection, 
    setActiveSection, 
    currentUser, 
    notifications 
  } = useApp();

  const unreadCount = notifications.filter(n => !n.read).length;

  // Determine user's primary department action
  const getUserPrimarySection = () => {
    const role = currentUser?.Role;
    if (role === 'reception' || role === 'reception_officer') {
      return { id: 'reception', label: 'الاستعلامات', icon: UserPlus };
    }
    if (role === 'admin' || role === 'admin_officer') {
      return { id: 'admin', label: 'الإدارة', icon: FolderKanban };
    }
    if (role === 'director' || role === 'deputy') {
      return { id: 'director', label: 'المدير', icon: Briefcase };
    }
    if (role === 'interviews_officer') {
      return { id: 'interviews', label: 'المقابلات', icon: Handshake };
    }
    if (role === 'organization' || role === 'organization_officer') {
      return { id: 'organization', label: 'التنظيم', icon: Users2 };
    }
    if (role === 'machine' || role === 'machine_officer') {
      return { id: 'machine', label: 'المكنة', icon: Printer };
    }
    if (role === 'audit') {
      return { id: 'audit', label: 'المتابعة', icon: ShieldCheck };
    }
    return { id: 'dashboard', label: 'المهام', icon: LayoutGrid };
  };

  const primaryDept = getUserPrimarySection();
  const PrimaryIcon = primaryDept.icon;

  const handleNav = (sectionId: string) => {
    if (navigator.vibrate) navigator.vibrate(12);
    setActiveSection(sectionId);
  };

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#090f1d]/95 backdrop-blur-xl border-t border-slate-800/90 shadow-[0_-10px_25px_rgba(0,0,0,0.5)] font-['Tajawal',sans-serif] pb-safe" dir="rtl">
      <div className="flex items-center justify-around h-15 px-2">
        
        {/* 1. Dashboard / Hub */}
        <button
          onClick={() => handleNav('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-90 cursor-pointer ${
            activeSection === 'dashboard'
              ? 'text-amber-400 font-black'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <LayoutGrid className="w-5 h-5" />
            {activeSection === 'dashboard' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400" />
            )}
          </div>
          <span className="text-[10px] mt-1 font-bold">الرئيسية</span>
        </button>

        {/* 2. Primary Department for current user */}
        <button
          onClick={() => handleNav(primaryDept.id)}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-90 cursor-pointer ${
            activeSection === primaryDept.id
              ? 'text-blue-400 font-black'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <PrimaryIcon className="w-5 h-5" />
            {activeSection === primaryDept.id && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-blue-400 shadow-sm shadow-blue-400" />
            )}
          </div>
          <span className="text-[10px] mt-1 font-bold">{primaryDept.label}</span>
        </button>

        {/* 3. Global Instant Search */}
        <button
          onClick={() => handleNav('search_archive')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-90 cursor-pointer ${
            activeSection === 'search_archive'
              ? 'text-cyan-400 font-black'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Search className="w-5 h-5" />
            {activeSection === 'search_archive' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
            )}
          </div>
          <span className="text-[10px] mt-1 font-bold">البحث</span>
        </button>

        {/* 4. Notifications / Urgent Alerts */}
        <button
          onClick={() => handleNav('audit')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all active:scale-90 cursor-pointer relative ${
            activeSection === 'audit'
              ? 'text-emerald-400 font-black'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-rose-600 text-white text-[8px] font-black flex items-center justify-center animate-pulse">
                {unreadCount}
              </span>
            )}
            {activeSection === 'audit' && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
            )}
          </div>
          <span className="text-[10px] mt-1 font-bold">المتابعة</span>
        </button>

        {/* 5. Logout / Exit */}
        <button
          onClick={onOpenLogoutModal}
          className="flex flex-col items-center justify-center flex-1 py-1 text-rose-400 hover:text-rose-300 transition-all active:scale-90 cursor-pointer"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-[10px] mt-1 font-bold">خروج</span>
        </button>

      </div>
    </nav>
  );
};
