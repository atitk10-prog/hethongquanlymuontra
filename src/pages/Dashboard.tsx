import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../store/auth';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import { api, type BookStats } from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { MonitorSmartphone, ArrowRightLeft, AlertTriangle, Wrench, Package, X, BookOpen, Clock, TrendingUp, Users } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';

const PIE_COLORS = ['#4F46E5', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6'];

export default function Dashboard() {
  const { user } = useAuth();
  const { devices, rooms, borrowHistory, books, bookBorrows, maintenanceHistory, isLoading } = useData();
  const navigate = useNavigate();
  const [showReturnQR, setShowReturnQR] = useState(false);
  const [bookStats, setBookStats] = useState<BookStats | null>(null);
  const [dashTab, setDashTab] = useState<'devices' | 'books'>('devices');

  useEffect(() => {
    api.getBookStats().then(setBookStats).catch(() => {});
  }, [books, bookBorrows]);

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

  // Role helpers
  const isAdmin = user?.role === 'admin' || user?.role === 'vice_principal';
  const isEquipment = user?.role === 'equipment';
  const isLibrarian = user?.role === 'librarian';
  const isTeacher = user?.role === 'teacher';
  const isStudent = user?.role === 'student';
  const isLeader = user?.role === 'leader';
  const isStaff = isAdmin || isEquipment || isLibrarian || isLeader;
  const showDevices = isAdmin || isEquipment || isLeader || (isTeacher && !!user?.managed_rooms);
  const showBooks = isAdmin || isLibrarian || isTeacher || isStudent || isLeader;

  // Set default tab based on role
  useEffect(() => {
    if (isLibrarian && !isAdmin) setDashTab('books');
    else if (showDevices) setDashTab('devices');
    else setDashTab('books');
  }, [user?.role]);

  // --- DEVICE DATA ---
  const visibleDevices = useMemo(() => {
    if (user?.managed_rooms) {
      const managedIds = user.managed_rooms.split(',').map(s => s.trim()).filter(Boolean);
      if (managedIds.length > 0) {
        const managedRooms = rooms.filter(r => managedIds.includes(r.id));
        return devices.filter(d => managedRooms.some(r => r.name === d.room && r.subject === d.subject));
      }
    }
    return devices;
  }, [devices, rooms, user]);

  const deviceStats = {
    total: visibleDevices.length,
    borrowing: visibleDevices.filter(d => d.status === 'Đang mượn').length,
    broken: visibleDevices.filter(d => d.status === 'Hỏng' || d.status === 'Hỏng nhẹ' || d.status === 'Cần bảo trì').length,
  };

  // Active device borrows
  const equipmentActiveBorrows = useMemo(() => {
    if (!user) return [];
    if (isTeacher && !user.managed_rooms && !isAdmin) return [];
    const active = borrowHistory.filter(b => {
      if (b.status !== 'Đang mượn' && b.status !== 'Trả thiếu') return false;
      return ((b.quantity || 1) - (b.returned_qty || 0) - (b.missing_qty || 0)) > 0;
    });
    if (user.managed_rooms) {
      const managedIds = user.managed_rooms.split(',').map(s => s.trim()).filter(Boolean);
      if (managedIds.length > 0) {
        const managedRoomNames = rooms.filter(r => managedIds.includes(r.id)).map(r => r.name);
        const managedDeviceIds = devices.filter(d => managedRoomNames.includes(d.room)).map(d => d.id);
        return active.filter(b => managedDeviceIds.includes(b.device_id));
      }
    }
    return active;
  }, [borrowHistory, user, devices, rooms]);

  // Teacher's own device borrows
  const myDeviceBorrows = useMemo(() => {
    if (!user) return [];
    return borrowHistory.filter(b => {
      if (b.teacher !== user.name) return false;
      if (b.status !== 'Đang mượn' && b.status !== 'Trả thiếu') return false;
      return ((b.quantity || 1) - (b.returned_qty || 0) - (b.missing_qty || 0)) > 0;
    });
  }, [borrowHistory, user]);

  // --- BOOK DATA ---
  const allActiveBookBorrows = bookBorrows.filter(b => b.status === 'Đang mượn' || b.status === 'Trả thiếu');
  const myBookBorrows = allActiveBookBorrows.filter(b => b.borrower === user?.name);
  const visibleBookBorrows = (isAdmin || isLibrarian) ? allActiveBookBorrows : myBookBorrows;
  const pendingBookBorrows = bookBorrows.filter(b => b.status === 'Chờ duyệt');

  const bookOverdue = bookBorrows.filter(b => {
    if (b.status !== 'Đang mượn' || !b.due_date) return false;
    try { return now > new Date(b.due_date); } catch { return false; }
  });

  // Book categories
  const bookCategories = useMemo(() => {
    const cats: Record<string, number> = {};
    books.forEach(b => { cats[b.category || 'Khác'] = (cats[b.category || 'Khác'] || 0) + 1; });
    return Object.entries(cats).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [books]);

  // --- CHARTS ---
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const weeklyStats = dayNames.map(name => ({ name, borrow: 0, return: 0 }));
  borrowHistory.forEach(r => {
    if (r.borrow_date) { try { weeklyStats[new Date(r.borrow_date).getDay()].borrow++; } catch {} }
    if (r.return_date) { try { weeklyStats[new Date(r.return_date).getDay()].return++; } catch {} }
  });
  const chartData = [...weeklyStats.slice(1), weeklyStats[0]].map(d => ({ name: d.name, 'Mượn': d.borrow, 'Trả': d.return }));

  const roomDistribution = useMemo(() => {
    const roomCounts: Record<string, number> = {};
    visibleDevices.forEach(d => { roomCounts[d.room || 'Chưa phân'] = (roomCounts[d.room || 'Chưa phân'] || 0) + 1; });
    return Object.entries(roomCounts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 8);
  }, [visibleDevices]);

  const monthlyTrend = useMemo(() => {
    const months: Record<string, { borrow: number; return: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months[format(d, 'MM/yy')] = { borrow: 0, return: 0 };
    }
    borrowHistory.forEach(r => {
      if (r.borrow_date) { try { const k = format(new Date(r.borrow_date), 'MM/yy'); if (months[k]) months[k].borrow++; } catch {} }
      if (r.return_date) { try { const k = format(new Date(r.return_date), 'MM/yy'); if (months[k]) months[k].return++; } catch {} }
    });
    return Object.entries(months).map(([name, v]) => ({ name, ...v }));
  }, [borrowHistory]);

  const pendingMaintenance = maintenanceHistory.filter(m => m.result !== 'Đã sửa' && m.result !== 'Cần thay thế');

  const getDeviceName = (deviceId: string) => {
    const d = devices.find(dev => dev.id === deviceId);
    return d ? d.name : deviceId;
  };

  const getBookTitle = (bookId: string) => {
    const b = books.find(bk => bk.id === bookId);
    return b ? b.title : bookId;
  };

  const returnQRUrl = `${window.location.origin}/return/${encodeURIComponent(user?.name || '')}`;

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 bg-slate-200 rounded-2xl" />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-slate-200 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-500 rounded-2xl p-5 sm:p-6 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-10 translate-x-10" />
        <div className="absolute bottom-0 left-1/2 w-32 h-32 bg-white/5 rounded-full translate-y-16" />
        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">
                {greeting}, {user?.name?.split(' ').pop()}
              </h1>
              <p className="text-indigo-100 text-sm mt-1">
                {format(now, 'EEEE, dd/MM/yyyy')} • 
                {user?.role === 'teacher' ? ' Giáo viên' :
                 user?.role === 'equipment' ? ' Phụ trách thiết bị' :
                 user?.role === 'vice_principal' ? ' Ban Giám Hiệu' :
                 user?.role === 'admin' ? ' Quản trị viên' :
                 user?.role === 'librarian' ? ' Thủ thư' :
                 user?.role === 'leader' ? ` Tổ trưởng ${user.department}` :
                 user?.role === 'student' ? ' Học sinh' : ''}
              </p>
            </div>
            <div className="flex gap-2">
              {isTeacher && myDeviceBorrows.length > 0 && (
                <button onClick={() => setShowReturnQR(true)}
                  className="px-4 py-2 bg-white/20 backdrop-blur-sm text-white rounded-xl text-sm font-medium hover:bg-white/30 transition-all">
                  QR Trả ({myDeviceBorrows.length})
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ========= GV/HS VIEW ========= */}
      {(isTeacher || isStudent) && !user?.managed_rooms && (
        <>
          {/* Book Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: 'Tổng đầu sách', value: books.length, icon: BookOpen, bg: 'bg-indigo-50', text: 'text-indigo-600' },
              { name: 'Thể loại', value: bookCategories.length, icon: Package, bg: 'bg-purple-50', text: 'text-purple-600' },
              { name: 'Sách bạn mượn', value: myBookBorrows.length, icon: ArrowRightLeft, bg: 'bg-emerald-50', text: 'text-emerald-600' },
              { name: 'Chờ duyệt', value: pendingBookBorrows.filter(b => b.borrower === user?.name).length, icon: Clock, bg: 'bg-amber-50', text: 'text-amber-600' },
            ].map(item => (
              <div key={item.name} className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-md transition-all">
                <div className={`p-2 rounded-lg ${item.bg} inline-block mb-2`}>
                  <item.icon className={`h-4 w-4 ${item.text}`} />
                </div>
                <div className="text-2xl font-bold text-slate-900">{item.value}</div>
                <div className="text-xs text-slate-500 font-medium">{item.name}</div>
              </div>
            ))}
          </div>

          {/* My active book borrows */}
          {myBookBorrows.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-200">
                <h3 className="text-sm font-semibold text-indigo-800 flex items-center">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Sách bạn đang mượn ({myBookBorrows.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-[250px] overflow-y-auto">
                {myBookBorrows.map(b => {
                  const overdue = b.due_date && now > new Date(b.due_date);
                  return (
                    <div key={b.id} className={`px-4 py-3 ${overdue ? 'bg-red-50/50' : 'hover:bg-slate-50'} transition-colors`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{getBookTitle(b.book_id)}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Hạn trả: {b.due_date ? format(new Date(b.due_date), 'dd/MM/yyyy') : '—'}
                            {overdue && <span className="text-red-600 font-semibold ml-2">⚠ Quá hạn</span>}
                          </p>
                        </div>
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-800">SL: {b.quantity}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* My device borrows (for teachers only) */}
          {isTeacher && myDeviceBorrows.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
                <h3 className="text-sm font-semibold text-amber-800 flex items-center">
                  <MonitorSmartphone className="h-4 w-4 mr-2" />
                  Thiết bị bạn đang mượn ({myDeviceBorrows.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {myDeviceBorrows.map(b => (
                  <div key={b.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{getDeviceName(b.device_id)}</p>
                        <p className="text-xs text-slate-500">
                          {b.borrow_date && format(new Date(b.borrow_date), 'dd/MM HH:mm')}
                          {b.class && <span> • Lớp {b.class}</span>}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-800">SL: {b.quantity || 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top books + Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="h-5 w-5 text-purple-500" />
                <h3 className="text-base font-semibold text-slate-900">Sách mượn nhiều nhất</h3>
              </div>
              {bookStats?.topBooks && bookStats.topBooks.length > 0 ? (
                <div className="space-y-3">
                  {bookStats.topBooks.slice(0, 6).map((book, idx) => {
                    const maxCount = bookStats.topBooks[0].count;
                    return (
                      <div key={book.id} className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-400 w-5">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{book.title}</p>
                          <div className="mt-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full" style={{ width: `${(book.count / maxCount) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-slate-700">{book.count}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-slate-400">Chưa có dữ liệu</div>
              )}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-indigo-500" />
                <h3 className="text-base font-semibold text-slate-900">Thể loại sách ({bookCategories.length})</h3>
              </div>
              {bookCategories.length > 0 ? (
                <ResponsiveContainer width="100%" height={200} minWidth={1} minHeight={1}>
                  <PieChart>
                    <Pie data={bookCategories.slice(0, 8)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                      {bookCategories.slice(0, 8).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-48 flex items-center justify-center text-sm text-slate-400">Chưa có dữ liệu</div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ========= STAFF/MANAGER VIEW ========= */}
      {(isStaff || !!user?.managed_rooms) && (
        <>
          {/* Stat Cards */}
          <div className={`grid grid-cols-2 sm:grid-cols-3 ${(showDevices && showBooks) ? 'lg:grid-cols-6' : 'lg:grid-cols-3'} gap-3`}>
            {[
              ...(showDevices ? [
                { name: 'Tổng TB', value: deviceStats.total, icon: MonitorSmartphone, bg: 'bg-blue-50', text: 'text-blue-600' },
                { name: 'TB Đang mượn', value: deviceStats.borrowing, icon: ArrowRightLeft, bg: 'bg-emerald-50', text: 'text-emerald-600' },
                { name: 'TB Hỏng', value: deviceStats.broken, icon: Wrench, bg: 'bg-amber-50', text: 'text-amber-600' },
              ] : []),
              ...(showBooks ? [
                { name: 'Đầu sách', value: books.length, icon: BookOpen, bg: 'bg-indigo-50', text: 'text-indigo-600' },
                { name: 'Sách mượn', value: allActiveBookBorrows.length, icon: Package, bg: 'bg-purple-50', text: 'text-purple-600' },
                { name: 'Sách quá hạn', value: bookOverdue.length, icon: AlertTriangle, bg: 'bg-red-50', text: 'text-red-600' },
              ] : []),
            ].map(item => (
              <div key={item.name} className="bg-white rounded-xl border border-slate-100 p-4 hover:shadow-md transition-all">
                <div className={`p-2 rounded-lg ${item.bg} inline-block mb-2`}>
                  <item.icon className={`h-4 w-4 ${item.text}`} />
                </div>
                <div className="text-2xl font-bold text-slate-900">{item.value}</div>
                <div className="text-xs text-slate-500 font-medium">{item.name}</div>
              </div>
            ))}
          </div>

          {/* Alerts */}
          {(() => {
            const alerts: { type: 'warning' | 'error' | 'info'; message: string; count: number; link: string }[] = [];
            if (showDevices && deviceStats.broken > 0) alerts.push({ type: 'warning', message: `${deviceStats.broken} thiết bị cần sửa chữa/bảo trì`, count: deviceStats.broken, link: '/maintenance' });
            if (showDevices) {
              const longBorrows = equipmentActiveBorrows.filter(b => { try { return (now.getTime() - new Date(b.borrow_date).getTime()) / (1000*60*60*24) > 3; } catch { return false; } });
              if (longBorrows.length > 0) alerts.push({ type: 'info', message: `${longBorrows.length} thiết bị mượn hơn 3 ngày`, count: longBorrows.length, link: '/device-borrow?tab=active' });
            }
            if (showBooks && pendingBookBorrows.length > 0 && (isAdmin || isLibrarian))
              alerts.push({ type: 'info', message: `${pendingBookBorrows.length} yêu cầu mượn sách chờ duyệt`, count: pendingBookBorrows.length, link: '/book-borrow?tab=pending' });
            if (pendingMaintenance.length > 0 && showDevices)
              alerts.push({ type: 'error', message: `${pendingMaintenance.length} phiếu bảo trì chưa hoàn thành`, count: pendingMaintenance.length, link: '/maintenance' });
            if (alerts.length === 0) return null;
            return (
              <div className="space-y-2">
                {alerts.map((a, i) => (
                  <div key={i} onClick={() => navigate(a.link)} className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm cursor-pointer hover:shadow-md transition-all ${
                    a.type === 'error' ? 'bg-red-50 border-red-200 text-red-800 hover:bg-red-100' :
                    a.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100' :
                    'bg-blue-50 border-blue-200 text-blue-800 hover:bg-blue-100'
                  }`}>
                    <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                    <span className="font-medium">{a.message}</span>
                    <span className={`ml-auto px-2 py-0.5 rounded-full text-xs font-bold ${
                      a.type === 'error' ? 'bg-red-200 text-red-900' :
                      a.type === 'warning' ? 'bg-amber-200 text-amber-900' :
                      'bg-blue-200 text-blue-900'
                    }`}>{a.count}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Tabs: Thiết bị / Sách */}
          {showDevices && showBooks && (
            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
              <button onClick={() => setDashTab('devices')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${dashTab === 'devices' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <MonitorSmartphone className="h-4 w-4" /> Thiết bị đang mượn ({equipmentActiveBorrows.length})
              </button>
              <button onClick={() => setDashTab('books')}
                className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${dashTab === 'books' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <BookOpen className="h-4 w-4" /> Sách đang mượn ({visibleBookBorrows.length})
              </button>
            </div>
          )}

          {/* Device Active Borrows */}
          {(dashTab === 'devices' || !showBooks) && showDevices && equipmentActiveBorrows.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-amber-800 flex items-center">
                  <Package className="h-4 w-4 mr-2" />
                  Thiết bị đang được mượn ({equipmentActiveBorrows.length})
                </h3>
              </div>
              <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
                {Object.entries(
                  equipmentActiveBorrows.reduce((acc, b) => {
                    if (!acc[b.teacher]) acc[b.teacher] = [];
                    acc[b.teacher].push(b);
                    return acc;
                  }, {} as Record<string, typeof equipmentActiveBorrows>)
                ).map(([teacher, borrows]) => (
                  <div key={teacher}>
                    <div className="px-4 py-2 bg-slate-50 flex items-center justify-between sticky top-0">
                      <span className="text-xs font-semibold text-slate-700">{teacher} ({borrows.length} TB)</span>
                      <button onClick={() => navigate('/device-borrow?tab=active')}
                        className="text-[10px] px-2 py-1 bg-emerald-600 text-white rounded-md font-medium hover:bg-emerald-700 active:scale-95 transition-all">
                        Trả thiết bị
                      </button>
                    </div>
                    {borrows.map(b => (
                      <div key={b.id} className="px-4 py-2 hover:bg-slate-50 transition-colors flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-slate-900">{getDeviceName(b.device_id)}</span>
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-semibold">SL: {b.quantity || 1}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-0.5">
                            {b.class && <span>Lớp {b.class} • </span>}
                            {b.borrow_date && format(new Date(b.borrow_date), 'dd/MM HH:mm')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Book Active Borrows */}
          {(dashTab === 'books' || !showDevices) && showBooks && (
            <>
              {visibleBookBorrows.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-200 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-indigo-800 flex items-center">
                      <BookOpen className="h-4 w-4 mr-2" />
                      Sách đang mượn ({visibleBookBorrows.length})
                    </h3>
                    <button onClick={() => navigate('/book-borrow?tab=active')} className="text-xs text-indigo-700 font-medium hover:underline">
                      Quản lý →
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                    {visibleBookBorrows.slice(0, 20).map(b => {
                      const overdue = b.due_date && now > new Date(b.due_date);
                      return (
                        <div key={b.id} className={`px-4 py-2.5 ${overdue ? 'bg-red-50/50' : 'hover:bg-slate-50'} transition-colors`}>
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900">{getBookTitle(b.book_id)}</p>
                              <p className="text-xs text-slate-500">
                                {b.borrower} • {b.borrower_type === 'HS' ? 'HS' : 'GV'}
                                {b.class && ` • ${b.class}`}
                                {overdue && <span className="text-red-600 font-semibold"> ⚠ Quá hạn</span>}
                              </p>
                            </div>
                            <span className="text-xs text-slate-400">{b.due_date ? format(new Date(b.due_date), 'dd/MM') : ''}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pending book approvals */}
              {(isAdmin || isLibrarian) && pendingBookBorrows.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
                  <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-amber-800 flex items-center">
                      <Clock className="h-4 w-4 mr-2" />
                      Yêu cầu mượn chờ duyệt ({pendingBookBorrows.length})
                    </h3>
                    <button onClick={() => navigate('/book-borrow?tab=pending')} className="text-xs text-amber-700 font-medium hover:underline">
                      Duyệt →
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
                    {pendingBookBorrows.slice(0, 10).map(b => (
                      <div key={b.id} className="px-4 py-2.5 hover:bg-slate-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-slate-900">{getBookTitle(b.book_id)}</p>
                            <p className="text-xs text-slate-500">{b.borrower} • SL: {b.quantity}</p>
                          </div>
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-700">Chờ duyệt</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Charts - only for staff */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {showDevices && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="h-5 w-5 text-indigo-500" />
                  <h3 className="text-base font-semibold text-slate-900">Mượn/Trả TB theo ngày</h3>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                      <Tooltip cursor={{ fill: '#F1F5F9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Legend iconType="circle" />
                      <Bar dataKey="Mượn" fill="#4F46E5" radius={[4, 4, 0, 0]} barSize={24} />
                      <Bar dataKey="Trả" fill="#10B981" radius={[4, 4, 0, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {showDevices && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="h-5 w-5 text-cyan-500" />
                  <h3 className="text-base font-semibold text-slate-900">TB theo phòng</h3>
                </div>
                <div className="h-64">
                  {roomDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                      <PieChart>
                        <Pie data={roomDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                          label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                          {roomDistribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-sm text-slate-400">Chưa có dữ liệu</div>
                  )}
                </div>
              </div>
            )}

            {showBooks && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="h-5 w-5 text-purple-500" />
                  <h3 className="text-base font-semibold text-slate-900">Sách mượn nhiều nhất</h3>
                </div>
                {bookStats?.topBooks && bookStats.topBooks.length > 0 ? (
                  <div className="space-y-3">
                    {bookStats.topBooks.slice(0, 6).map((book, idx) => (
                      <div key={book.id} className="flex items-center gap-3">
                        <span className="text-sm font-bold text-slate-400 w-5">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{book.title}</p>
                          <div className="mt-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full" style={{ width: `${(book.count / (bookStats.topBooks[0].count || 1)) * 100}%` }} />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-slate-700">{book.count}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-48 flex items-center justify-center text-sm text-slate-400">Chưa có dữ liệu</div>
                )}
              </div>
            )}

            {showDevices && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-5 w-5 text-emerald-500" />
                  <h3 className="text-base font-semibold text-slate-900">Xu hướng mượn trả (6 tháng)</h3>
                </div>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                    <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gradBorrow" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="gradReturn" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} />
                      <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                      <Legend iconType="circle" />
                      <Area type="monotone" dataKey="borrow" name="Mượn" stroke="#4F46E5" fill="url(#gradBorrow)" strokeWidth={2} />
                      <Area type="monotone" dataKey="return" name="Trả" stroke="#10B981" fill="url(#gradReturn)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Pending Maintenance */}
          {showDevices && pendingMaintenance.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-amber-800 flex items-center">
                  <Wrench className="h-4 w-4 mr-2" />
                  Bảo trì chưa xử lý ({pendingMaintenance.length})
                </h3>
                <button onClick={() => navigate('/maintenance')} className="text-xs text-amber-700 font-medium hover:underline">Xem tất cả →</button>
              </div>
              <div className="divide-y divide-slate-100 max-h-[200px] overflow-y-auto">
                {pendingMaintenance.slice(0, 5).map(m => (
                  <div key={m.id} className="px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{getDeviceName(m.device_id)}</p>
                      <p className="text-xs text-slate-500">{m.content} • {m.date}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${m.result === 'Cần thay thế' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                      {m.result}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Return QR Modal */}
      {showReturnQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowReturnQR(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 text-center" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">QR Trả thiết bị</h3>
              <button onClick={() => setShowReturnQR(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-slate-600 mb-4">Đưa mã này cho cán bộ thiết bị quét để trả</p>
            <div className="bg-white p-4 rounded-xl border-2 border-indigo-100 inline-block">
              <QRCodeSVG value={returnQRUrl} size={200} level="H" includeMargin />
            </div>
            <p className="text-xs text-slate-400 mt-3 font-mono break-all">{user?.name}</p>
            <p className="text-xs text-slate-500 mt-1">Đang mượn {myDeviceBorrows.length} thiết bị</p>
          </div>
        </div>
      )}
    </div>
  );
}