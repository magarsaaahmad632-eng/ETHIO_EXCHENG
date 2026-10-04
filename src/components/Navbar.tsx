import React from 'react';
import { Home, Megaphone, Briefcase, Package, UserCheck, ShieldAlert } from 'lucide-react';

export type TabType = 'home' | 'market' | 'wallet' | 'orders' | 'profile' | 'admin';

interface NavbarProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  isAdmin: boolean;
  activeOrdersCount?: number;
  pendingAdminCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onChangeTab,
  isAdmin,
  activeOrdersCount = 0,
  pendingAdminCount = 0,
}) => {
  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'market', label: 'P2P', icon: Megaphone },
    { id: 'wallet', label: 'Wallet', icon: Briefcase },
    {
      id: 'orders',
      label: 'Orders',
      icon: Package,
      badge: activeOrdersCount > 0 ? activeOrdersCount : undefined,
    },
    { id: 'profile', label: 'Profile', icon: UserCheck },
  ];

  if (isAdmin) {
    navItems.push({
      id: 'admin',
      label: 'Admin',
      icon: ShieldAlert,
      badge: pendingAdminCount > 0 ? pendingAdminCount : undefined,
    });
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-2 py-2">
      <div className={`max-w-md mx-auto grid ${isAdmin ? 'grid-cols-6' : 'grid-cols-5'} gap-1`}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id as TabType)}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all duration-200 ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 font-medium'
              }`}
            >
              <Icon className={`w-5 h-5 mb-1 ${isActive ? 'text-emerald-400 scale-110' : 'text-slate-400'}`} />
              <span className="text-[10px] leading-tight">{item.label}</span>
              {item.badge !== undefined && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-slate-950 font-extrabold text-[10px] flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
