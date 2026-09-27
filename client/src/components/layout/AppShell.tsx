import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  FileText,
  CheckSquare,
  Mail,
  LogOut,
  Zap,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface NavItem {
  to:    string;
  icon:  React.ReactNode;
  label: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { to: '/pipeline',  icon: <LayoutDashboard size={18} />, label: 'Pipeline'   },
  { to: '/dashboard', icon: <Zap size={18} />,             label: 'Dashboard'  },
  { to: '/clients',   icon: <Users size={18} />,           label: 'Clients'    },
  { to: '/tasks',     icon: <CheckSquare size={18} />,     label: 'Tasks'      },
  { to: '/templates', icon: <Mail size={18} />,            label: 'Templates', roles: ['brokerage_admin', 'advisor'] },
  { to: '/automation',icon: <Zap size={18} />,             label: 'Automation',roles: ['brokerage_admin'] },
  { to: '/users',     icon: <Briefcase size={18} />,       label: 'Team',      roles: ['brokerage_admin'] },
  { to: '/documents', icon: <FileText size={18} />,        label: 'Documents'  },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const { isConnected, isReconnecting } = useSocket();

  const visibleItems = navItems.filter(
    (item) => !item.roles || item.roles.includes(user?.role ?? ''),
  );

  return (
    <div className="flex h-screen overflow-hidden bg-surface-900">
      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className="w-60 shrink-0 flex flex-col border-r border-white/6 bg-surface-800/50">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl gradient-brand flex items-center justify-center shadow-glow-brand shrink-0">
              <svg viewBox="0 0 32 32" fill="none" className="w-5 h-5" aria-hidden="true">
                <path d="M6 26 L16 6 L26 26" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M10 20 L22 20"      stroke="white" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-white">LeadFlow</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider truncate">
                {user?.role === 'platform_admin' ? 'Platform' : 'Brokerage'}
              </p>
            </div>
            {/* Live Connection indicator */}
            <div
              title={isConnected ? 'Real-time sync active' : isReconnecting ? 'Reconnecting to real-time layer...' : 'Offline'}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-surface-700 border border-white/6"
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isConnected
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] animate-pulse'
                    : isReconnecting
                    ? 'bg-amber-400 animate-ping'
                    : 'bg-rose-400'
                )}
              />
              <span className="text-[10px] text-slate-400">
                {isConnected ? 'Live' : isReconnecting ? 'Syncing' : 'Off'}
              </span>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav aria-label="Main Navigation" className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-brand-500/15 text-brand-300 border border-brand-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-700',
                )
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-white/6">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg">
            <div className="w-7 h-7 rounded-full gradient-brand flex items-center justify-center text-white text-xs font-bold shrink-0">
              {user?.name?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-200 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.role?.replace('_', ' ')}</p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              aria-label="Sign out"
              className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden flex flex-col">
        <Outlet />
      </main>
    </div>
  );
}
