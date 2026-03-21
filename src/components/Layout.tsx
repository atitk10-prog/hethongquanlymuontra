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
  MoreHorizontal,
  ArrowLeftRight,
  BookOpen,
  Library,
  BarChart3
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
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['teacher', 'equipment', 'leader', 'vice_principal', 'admin', 'librarian', 'student'], group: 'main' },
    { name: 'Quét QR', path: '/scan', icon: ScanLine, roles: ['teacher', 'equipment', 'leader', 'vice_principal', 'admin', 'librarian', 'student'], group: 'scan' },
    // Thiết bị: Quản lý → Sử dụng → Phân tích
    { name: 'Phòng', path: '/rooms', icon: MapPin, roles: ['equipment', 'vice_principal', 'admin'], group: 'devices' },
    { name: 'Thiết bị', path: '/devices', icon: MonitorSmartphone, roles: ['equipment', 'vice_principal', 'admin'], group: 'devices' },
    { name: 'Mượn/Trả TB', path: '/device-borrow', icon: ArrowLeftRight, roles: ['teacher', 'equipment', 'leader', 'vice_principal', 'admin'], group: 'devices' },
    { name: 'Lịch sử mượn', path: '/history', icon: History, roles: ['teacher', 'equipment', 'leader', 'vice_principal', 'admin'], group: 'devices' },
    { name: 'Bảo trì', path: '/maintenance', icon: Wrench, roles: ['equipment', 'vice_principal', 'admin'], group: 'devices' },
    { name: 'Kiểm kê TB', path: '/inventory', icon: ClipboardCheck, roles: ['equipment', 'vice_principal', 'admin'], group: 'devices' },
    { name: 'Báo cáo TB', path: '/device-report', icon: BarChart3, roles: ['equipment', 'vice_principal', 'admin'], group: 'devices' },
    // Thư viện
    { name: 'Kho sách', path: '/books', icon: BookOpen, roles: ['equipment', 'vice_principal', 'admin', 'librarian'], group: 'library' },
    { name: 'Mượn/Trả sách', path: '/book-borrow', icon: ArrowLeftRight, roles: ['teacher', 'equipment', 'leader', 'vice_principal', 'admin', 'librarian', 'student'], group: 'library' },
    { name: 'Kiểm kê sách', path: '/book-inventory', icon: ClipboardCheck, roles: ['equipment', 'vice_principal', 'admin', 'librarian'], group: 'library' },
    { name: 'Lịch sử sách', path: '/book-history', icon: History, roles: ['teacher', 'equipment', 'leader', 'vice_principal', 'admin', 'librarian', 'student'], group: 'library' },
    // Hệ thống
    { name: 'Tài khoản', path: '/users', icon: UsersIcon, roles: ['admin', 'vice_principal'], group: 'admin' },
    { name: 'Hồ sơ', path: '/profile', icon: UserCircle, roles: ['teacher', 'equipment', 'leader', 'vice_principal', 'admin', 'librarian', 'student'], group: 'admin' },
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

  // Bottom tab bar items — role-aware (max 4 + "More")
  const getBottomTabPaths = () => {
    if (user?.role === 'librarian') return ['/', '/scan', '/book-borrow', '/profile'];
    return ['/', '/scan', '/history', '/profile'];
  };
  const bottomTabPrimary = filteredNavItems.filter(item =>
    getBottomTabPaths().includes(item.path)
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
      case 'librarian': return 'Thủ thư';
      default: return role;
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
  };

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : '?';

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar for desktop */}
      <aside className="hidden md:flex flex-col w-64 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-300 transition-all duration-300">
        <div className="flex items-center gap-3 h-16 px-5 border-b border-white/10">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ArrowLeftRight className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-sm tracking-wider block">HỆ THỐNG</span>
            <span className="text-[10px] text-slate-500 font-medium">Quản lý mượn-trả</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-0.5 px-3">
            {filteredNavItems.map((item, idx) => {
              const active = isActive(item.path);
              const prevGroup = idx > 0 ? filteredNavItems[idx - 1].group : item.group;
              const isNewSection = item.group !== prevGroup;
              return (
                <div key={item.name}>
                  {isNewSection && (
                    <div className="my-3 mx-2 border-t border-white/[0.06]" />
                  )}
                  <Link
                    to={item.path}
                    className={cn(
                      active
                        ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                        : 'hover:bg-white/5 hover:text-white',
                      'group flex items-center px-3 py-2.5 text-sm font-medium rounded-xl transition-all duration-200'
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
                </div>
              );
            })}
          </nav>
        </div>
        <div className="p-4 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold shadow-lg">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-[11px] font-medium text-slate-500">{user ? getRoleName(user.role) : ''}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="mt-3 flex w-full items-center px-3 py-2 text-sm font-medium text-slate-400 rounded-xl hover:bg-white/5 hover:text-white transition-all duration-200"
          >
            <LogOut className="mr-3 h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      </aside>

      {/* Mobile slide-out menu (for overflow items) */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative flex w-full max-w-xs flex-1 flex-col bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-5 pb-4">
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
            <div className="flex items-center gap-3 px-5">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg">
                <ArrowLeftRight className="h-5 w-5 text-white" />
              </div>
              <span className="text-white font-bold text-lg">QL MƯỢN TRẢ</span>
            </div>
            <div className="mt-5 h-0 flex-1 overflow-y-auto">
              <nav className="space-y-1 px-3">
                {filteredNavItems.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={cn(
                        active
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                          : 'text-slate-300 hover:bg-white/5 hover:text-white',
                        'group flex items-center px-3 py-3 text-base font-medium rounded-xl transition-all duration-200'
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
            <div className="border-t border-white/10 p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg">
                  {userInitial}
                </div>
                <div>
                  <p className="text-base font-medium text-white">{user?.name}</p>
                  <p className="text-sm font-medium text-slate-400">{user ? getRoleName(user.role) : ''}</p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="mt-4 flex w-full items-center px-3 py-3 text-base font-medium text-slate-300 rounded-xl hover:bg-white/5 hover:text-white transition-all"
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
        <div className="md:hidden flex items-center justify-between bg-gradient-to-r from-slate-950 to-slate-900 px-4 py-3 sticky top-0 z-30 shadow-lg"
          style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top))' }}
        >
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ArrowLeftRight className="h-4 w-4 text-white" />
            </div>
            <span className="text-white font-bold text-base tracking-wide">QL MƯỢN TRẢ</span>
          </div>
          <button
            type="button"
            className="-mr-2 inline-flex items-center justify-center rounded-xl p-2 text-slate-400 hover:bg-white/10 hover:text-white focus:outline-none transition-all"
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
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200/80 shadow-[0_-4px_20px_-1px_rgba(0,0,0,0.08)] mobile-bottom-nav"
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
                  'flex flex-col items-center justify-center py-2 px-1 flex-1 min-w-0 transition-all duration-200 relative',
                  active
                    ? 'text-indigo-600'
                    : 'text-slate-400 hover:text-slate-600'
                )}
              >
                <div className={cn(
                  'p-1 rounded-xl transition-all duration-200',
                  active && 'bg-indigo-50'
                )}>
                  <item.icon className={cn('h-5 w-5', active && 'text-indigo-600')} />
                </div>
                <span className={cn(
                  'text-[10px] mt-0.5 truncate w-full text-center',
                  active ? 'font-semibold' : 'font-medium'
                )}>
                  {item.name}
                </span>
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full" />
                )}
              </Link>
            );
          })}

          {/* "More" button */}
          {bottomTabOverflow.length > 0 && (
            <button
              onClick={() => setIsMobileMenuOpen(true)}
              className={cn(
                'flex flex-col items-center justify-center py-2 px-1 flex-1 min-w-0 transition-all duration-200',
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
