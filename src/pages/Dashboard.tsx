import { useState } from 'react';
import { useAuth } from '../store/auth';
import { useData } from '../context/DataContext';
import { useNavigate } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { MonitorSmartphone, ArrowRightLeft, AlertTriangle, Wrench, QrCode, Package, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { format } from 'date-fns';

export default function Dashboard() {
  const { user } = useAuth();
  const { devices, rooms, borrowHistory, isLoading } = useData();
  const navigate = useNavigate();
  const [showReturnQR, setShowReturnQR] = useState(false);

  // Teacher's active borrows
  const myActiveBorrows = user?.role === 'teacher'
    ? borrowHistory.filter(b => b.teacher === user.name && b.status === 'Đang mượn')
    : [];

  const myReturnedBorrows = user?.role === 'teacher'
    ? borrowHistory.filter(b => b.teacher === user.name && b.status !== 'Đang mượn').slice(0, 5)
    : [];

  // All staff/admin: active borrows (filtered by managed rooms if set)
  const equipmentActiveBorrows = (() => {
    if (!user) return [];
    // Teachers without managed_rooms don't see this panel
    if (user.role === 'teacher' && !user.managed_rooms) return [];
    const activeBorrows = borrowHistory.filter(b => b.status === 'Đang mượn' || b.status === 'Trả thiếu');
    if (user.managed_rooms) {
      const managedIds = user.managed_rooms.split(',').map(s => s.trim()).filter(Boolean);
      if (managedIds.length > 0) {
        const managedRoomNames = rooms.filter(r => managedIds.includes(r.id)).map(r => r.name);
        const managedDeviceIds = devices.filter(d => managedRoomNames.includes(d.room)).map(d => d.id);
        return activeBorrows.filter(b => managedDeviceIds.includes(b.device_id));
      }
    }
    return activeBorrows;
  })();

  // Get device name by ID
  const getDeviceName = (deviceId: string) => {
    const d = devices.find(dev => dev.id === deviceId);
    return d ? d.name : deviceId;
  };

  // Return QR URL — encodes teacher name to allow staff to scan and see all borrows
  const returnQRUrl = `${window.location.origin}/return/${encodeURIComponent(user?.name || '')}`;

  // Filter devices by managed_rooms (applies to ALL roles)
  const visibleDevices = (() => {
    if (user?.managed_rooms) {
      const managedIds = user.managed_rooms.split(',').map(s => s.trim()).filter(Boolean);
      if (managedIds.length > 0) {
        const managedRooms = rooms.filter(r => managedIds.includes(r.id));
        return devices.filter(d => managedRooms.some(r => r.name === d.room && r.subject === d.subject));
      }
    }
    return devices;
  })();

  // Calculate stats from visible devices
  const stats = {
    total: visibleDevices.length,
    borrowing: visibleDevices.filter(d => d.status === 'Đang mượn').length,
    broken: visibleDevices.filter(d => d.status === 'Hỏng' || d.status === 'Hỏng nhẹ').length,
    maintenance: visibleDevices.filter(d => d.status === 'Cần bảo trì').length
  };

  // Calculate real weekly usage from borrowHistory
  const dayNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const weeklyStats = dayNames.map(name => ({ name, borrow: 0, return: 0 }));

  borrowHistory.forEach(record => {
    if (record.borrow_date) {
      try {
        const borrowDay = new Date(record.borrow_date).getDay();
        weeklyStats[borrowDay].borrow++;
      } catch (_) {}
    }
    if (record.return_date) {
      try {
        const returnDay = new Date(record.return_date).getDay();
        weeklyStats[returnDay].return++;
      } catch (_) {}
    }
  });

  // T2-CN order
  const chartData = [...weeklyStats.slice(1), weeklyStats[0]].map(d => ({
    name: d.name,
    'Mượn': d.borrow,
    'Trả': d.return
  }));

  const statCards = [
    { name: 'Tổng thiết bị', value: stats.total, icon: MonitorSmartphone, color: 'bg-blue-500/10', textColor: 'text-blue-600' },
    { name: 'Đang mượn', value: stats.borrowing, icon: ArrowRightLeft, color: 'bg-emerald-500/10', textColor: 'text-emerald-600' },
    { name: 'Hỏng', value: stats.broken, icon: AlertTriangle, color: 'bg-red-500/10', textColor: 'text-red-600' },
    { name: 'Cần bảo trì', value: stats.maintenance, icon: Wrench, color: 'bg-amber-500/10', textColor: 'text-amber-600' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-slate-200 rounded w-40 animate-pulse"></div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse">
              <div className="flex items-center">
                <div className="h-12 w-12 bg-slate-200 rounded-lg"></div>
                <div className="ml-5 space-y-2 flex-1">
                  <div className="h-4 bg-slate-200 rounded w-20"></div>
                  <div className="h-8 bg-slate-200 rounded w-12"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">
          Dashboard {user?.role === 'leader' && <span className="text-lg font-normal text-slate-500 ml-2">(Bộ môn: {user.department})</span>}
        </h1>
      </div>

      {/* Teacher: Active Borrows Panel */}
      {user?.role === 'teacher' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-indigo-800 flex items-center">
              <Package className="h-4 w-4 mr-2" />
              Thiết bị bạn đang mượn ({myActiveBorrows.length})
            </h3>
          </div>

          {myActiveBorrows.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-slate-500">
              Bạn chưa mượn thiết bị nào
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {myActiveBorrows.map(b => (
                <div key={b.id} className="px-4 py-3 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/device/${b.device_id}`)}>
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900">{getDeviceName(b.device_id)}</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-semibold">
                          SL: {b.quantity || 1}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        <span className="font-mono text-indigo-500">{b.device_id}</span>
                        {b.class && <span> • Lớp {b.class}</span>}
                        {b.period && <span> - T{b.period}</span>}
                        <span> • {b.borrow_date ? format(new Date(b.borrow_date), 'dd/MM HH:mm') : ''}</span>
                      </div>
                    </div>
                    <span className="text-indigo-500 text-xs font-medium">Bấm để trả →</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Recently returned */}
          {myReturnedBorrows.length > 0 && (
            <>
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200">
                <span className="text-xs font-medium text-slate-500">Đã trả gần đây</span>
              </div>
              <div className="divide-y divide-slate-100">
                {myReturnedBorrows.map(b => (
                  <div key={b.id} className="px-4 py-2 text-xs text-slate-400">
                    <span className="font-mono text-slate-500">{b.device_id}</span>
                    <span className="ml-2">{getDeviceName(b.device_id)}</span>
                    <span className="ml-2">•</span>
                    <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${b.status === 'Trả thiếu' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                      {b.status}
                    </span>
                    {b.return_date && (
                      <span className="ml-2">{format(new Date(b.return_date), 'dd/MM HH:mm')}</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Return QR Modal */}
      {showReturnQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowReturnQR(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 text-center" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">QR Trả thiết bị</h3>
              <button onClick={() => setShowReturnQR(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Đưa mã này cho cán bộ thiết bị quét để trả tất cả thiết bị đang mượn
            </p>
            <div className="bg-white p-4 rounded-xl border-2 border-indigo-100 inline-block">
              <QRCodeSVG
                value={returnQRUrl}
                size={200}
                level="H"
                includeMargin
              />
            </div>
            <p className="text-xs text-slate-400 mt-3 font-mono break-all">{user?.name}</p>
            <p className="text-xs text-slate-500 mt-1">Đang mượn {myActiveBorrows.length} thiết bị</p>
          </div>
        </div>
      )}

      {/* Equipment/Admin: Active Borrows Overview */}
      {(user?.role !== 'teacher' || user?.managed_rooms) && equipmentActiveBorrows.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-amber-800 flex items-center">
              <Package className="h-4 w-4 mr-2" />
              Thiết bị đang được mượn ({equipmentActiveBorrows.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto">
            {/* Group by teacher */}
            {Object.entries(
              equipmentActiveBorrows.reduce((acc, b) => {
                if (!acc[b.teacher]) acc[b.teacher] = [];
                acc[b.teacher].push(b);
                return acc;
              }, {} as Record<string, typeof equipmentActiveBorrows>)
            ).map(([teacher, borrows]) => (
              <div key={teacher}>
                <div className="px-4 py-2 bg-slate-50 flex items-center justify-between sticky top-0">
                  <span className="text-xs font-semibold text-slate-700">{teacher} ({borrows.length})</span>
                  <button
                    onClick={() => navigate(`/return/${encodeURIComponent(teacher)}`)}
                    className="text-[10px] px-2 py-1 bg-emerald-600 text-white rounded-md font-medium hover:bg-emerald-700 active:scale-95 transition-all"
                  >
                    Trả tất cả
                  </button>
                </div>
                {borrows.map(b => (
                  <div key={b.id} className="px-4 py-2 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between"
                    onClick={() => navigate(`/device/${b.device_id}`)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-900">{getDeviceName(b.device_id)}</span>
                        <span className="px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-semibold">
                          SL: {b.quantity || 1}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${b.status === 'Trả thiếu' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {b.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        <span className="font-mono text-indigo-500">{b.device_id}</span>
                        {b.class && <span> • Lớp {b.class}</span>}
                        {b.period && <span> - T{b.period}</span>}
                        {b.borrow_date && <span> • {format(new Date(b.borrow_date), 'dd/MM HH:mm')}</span>}
                      </div>
                    </div>
                    <span className="text-emerald-500 text-xs font-medium flex-shrink-0">Trả →</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((item) => (
          <div key={item.name} className="bg-white overflow-hidden shadow-sm rounded-xl border border-slate-100 p-5 hover:shadow-md transition-shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`p-3 rounded-lg ${item.color}`}>
                  <item.icon className={`h-6 w-6 ${item.textColor}`} aria-hidden="true" />
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-slate-500 truncate">{item.name}</dt>
                  <dd>
                    <div className="text-3xl font-bold text-slate-900">{item.value}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Managed Devices List — shows actual device names for room managers */}
      {user?.managed_rooms && visibleDevices.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-blue-800 flex items-center">
              <MonitorSmartphone className="h-4 w-4 mr-2" />
              Thiết bị bạn quản lý ({visibleDevices.length})
            </h3>
            <button onClick={() => navigate('/devices')} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
              Xem tất cả →
            </button>
          </div>
          <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
            {visibleDevices.map(d => (
              <div key={d.id} className="px-4 py-2.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between"
                onClick={() => navigate(`/device/${d.id}`)}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{d.name}</p>
                  <p className="text-xs text-slate-500">{d.room} • {d.subject} • SL: {d.quantity || 1}</p>
                </div>
                <span className={`ml-2 flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${
                  d.status === 'Tốt' ? 'bg-emerald-100 text-emerald-700' :
                  d.status === 'Hỏng' || d.status === 'Hỏng nhẹ' ? 'bg-red-100 text-red-700' :
                  d.status === 'Đang mượn' ? 'bg-blue-100 text-blue-700' :
                  'bg-amber-100 text-amber-700'
                }`}>{d.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <h3 className="text-lg font-medium leading-6 text-slate-900 mb-4">Biểu đồ sử dụng thiết bị (Tuần này)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748B' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B' }} />
              <Tooltip
                cursor={{ fill: '#F1F5F9' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend iconType="circle" />
              <Bar dataKey="Mượn" fill="#4F46E5" radius={[4, 4, 0, 0]} barSize={32} />
              <Bar dataKey="Trả" fill="#10B981" radius={[4, 4, 0, 0]} barSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}