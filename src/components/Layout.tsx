import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { cn } from '../lib/utils';
import {
  LayoutDashboard,
  MonitorSmartphone,
  ScanLine,
  History,
  ClipboardCheck,
  Wrench,
  LogOut,
  Menu,
  X,
  Users as UsersIcon,
  UserCircle,
  MapPin,
  MoreHorizontal
} from 'lucide-react';
import { useState } from 'react';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['teacher', 'equipment', 'leader', 'vice_principal'] },
    { name: 'Thiết bị', path: '/devices', icon: MonitorSmartphone, roles: ['equipment', 'vice_principal', 'admin'] },
    { name: 'Quét QR', path: '/scan', icon: ScanLine, roles: ['teacher', 'equipment', 'leader', 'vice_principal', 'admin'] },
    { name: 'Lịch sử mượn', path: '/history', icon: History, roles: ['teacher', 'equipment', 'leader', 'vice_principal', 'admin'] },
    { name: 'Kiểm kê', path: '/inventory', icon: ClipboardCheck, roles: ['equipment', 'vice_principal', 'admin'] },
    { name: 'Bảo trì', path: '/maintenance', icon: Wrench, roles: ['equipment', 'vice_principal', 'admin'] },
    { name: 'Phòng', path: '/rooms', icon: MapPin, roles: ['equipment', 'vice_principal', 'admin'] },
    { name: 'Tài khoản', path: '/users', icon: UsersIcon, roles: ['admin', 'vice_principal'] },
    { name: 'Hồ sơ', path: '/profile', icon: UserCircle, roles: ['teacher', 'equipment', 'leader', 'vice_principal', 'admin'] },
  ];

  // Teachers with managed_rooms can also access device management pages
  const managedRoomPaths = ['/devices', '/inventory', '/maintenance'];
  const filteredNavItems = navItems.filter(item => {
    if (!user) return false;
    if (item.roles.includes(user.role)) return true;
    // Users with managed_rooms get access to device management pages
    if (user.managed_rooms && managedRoomPaths.includes(item.path)) return true;
    return false;
  });

  // Bottom tab bar items (max 4 + "More")
  const bottomTabPrimary = filteredNavItems.filter(item =>
    ['/', '/scan', '/history', '/profile'].includes(item.path)
  ).slice(0, 4);

  const bottomTabOverflow = filteredNavItems.filter(item =>
    !bottomTabPrimary.some(p => p.path === item.path)
  );

  const getRoleName = (role: string) => {
    switch (role) {
      case 'teacher': return 'Giáo viên';
      case 'equipment': return 'Phụ trách TB';
      case 'leader': return 'Tổ trưởng';
      case 'vice_principal': return 'Ban Giám Hiệu';
      case 'admin': return 'Quản trị viên';
      default: return role;
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar for desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-slate-900 text-slate-300 transition-all duration-300">
        <div className="flex items-center justify-center h-16 bg-slate-950 border-b border-slate-800">
          <span className="text-white font-bold text-lg tracking-wider">QL THIẾT BỊ</span>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-2">
            {filteredNavItems.map((item) => {
              const active = isActive(item.path);
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={cn(
                    active ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800 hover:text-white',
                    'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors'
                  )}
                >
                  <item.icon
                    className={cn(
                      active ? 'text-white' : 'text-slate-400 group-hover:text-white',
                      'mr-3 flex-shrink-0 h-5 w-5 transition-colors'
                    )}
                    aria-hidden="true"
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <div className="flex items-center">
            <div className="ml-3">
              <p className="text-sm font-medium text-white">{user?.name}</p>
              <p className="text-xs font-medium text-slate-400">{user ? getRoleName(user.role) : ''}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-4 flex w-full items-center px-2 py-2 text-sm font-medium text-slate-300 rounded-md hover:bg-slate-800 hover:text-white transition-colors"
          >
            <LogOut className="mr-3 h-5 w-5 text-slate-400" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Mobile slide-out menu (for overflow items) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-slate-600/75" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-slate-900 pt-5 pb-4">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <span className="sr-only">Close sidebar</span>
                <X className="h-6 w-6 text-white" aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-shrink-0 items-center px-4">
              <span className="text-white font-bold text-xl">QL THIẾT BỊ</span>
            </div>
            <div className="mt-5 h-0 flex-1 overflow-y-auto">
              <nav className="space-y-1 px-2">
                {filteredNavItems.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        active ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                        'group flex items-center px-2 py-3 text-base font-medium rounded-md'
                      )}
                    >
                      <item.icon
                        className={cn(
                          active ? 'text-white' : 'text-slate-400 group-hover:text-white',
                          'mr-4 flex-shrink-0 h-6 w-6'
                        )}
                        aria-hidden="true"
                      />
                      {item.name}
                    </Link>
                  );
                })}
              </nav>
            </div>
            <div className="border-t border-slate-800 p-4">
              <div className="flex items-center">
                <div className="ml-3">
                  <p className="text-base font-medium text-white">{user?.name}</p>
                  <p className="text-sm font-medium text-slate-400">{user ? getRoleName(user.role) : ''}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="mt-4 flex w-full items-center px-2 py-3 text-base font-medium text-slate-300 rounded-md hover:bg-slate-800 hover:text-white"
              >
                <LogOut className="mr-4 h-6 w-6 text-slate-400" />
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto focus:outline-none">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center justify-between bg-slate-900 px-4 py-3 sticky top-0 z-30"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <span className="text-white font-bold text-lg">QL THIẾT BỊ</span>
          <button
            type="button"
            className="-mr-2 inline-flex items-center justify-center rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus:outline-none"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <span className="sr-only">Open main menu</span>
            {isMobileMenuOpen ? (
              <X className="block h-6 w-6" aria-hidden="true" />
            ) : (
              <Menu className="block h-6 w-6" aria-hidden="true" />
            )}
          </button>
        </div>

        <div className="py-4 md:py-6">
          <div className="mx-auto max-w-7xl px-3 sm:px-6 md:px-8">
            <Outlet />
          </div>
        </div>

        {/* Bottom spacer for mobile tab bar */}
        <div className="h-20 md:hidden" />
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] mobile-bottom-nav"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-stretch justify-around">
          {bottomTabPrimary.map((item) => {
            const active = isActive(item.path);
            return (
              <Link
                key={item.name}
                to={item.path}
                className={cn(
                  'flex flex-col items-center justify-center py-2 px-1 flex-1 min-w-0 transition-colors',
                  active
                    ? 'text-indigo-600'
                    : 'text-slate-400 hover:text-slate-600'
                )}
              >
                <item.icon className={cn('h-5 w-5', active && 'text-indigo-600')} />
                <span className={cn(
                  'text-[10px] mt-0.5 truncate w-full text-center',
                  active ? 'font-semibold' : 'font-medium'
                )}>
                  {item.name}
                </span>
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-indigo-600 rounded-full" />
                )}
              </Link>
            );
          })}

          {/* "More" button */}
          {bottomTabOverflow.length > 0 && (
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className={cn(
                'flex flex-col items-center justify-center py-2 px-1 flex-1 min-w-0 transition-colors',
                bottomTabOverflow.some(item => isActive(item.path))
                  ? 'text-indigo-600'
                  : 'text-slate-400 hover:text-slate-600'
              )}
            >
              <MoreHorizontal className="h-5 w-5" />
              <span className="text-[10px] mt-0.5 font-medium">Thêm</span>
            </button>
          )}
        </div>
      </nav>
    </div>
  );
}
