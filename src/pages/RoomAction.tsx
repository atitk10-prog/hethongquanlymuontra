import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type Device } from '../services/api';
import { useAuth } from '../store/auth';
import { useData } from '../context/DataContext';
import { ArrowLeft, CheckCircle, Monitor, MapPin, BookOpen } from 'lucide-react';

export default function RoomAction() {
  const { subject, room } = useParams<{ subject: string; room: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { devices, borrowHistory, rooms, refreshDevices } = useData();

  // Manager check: admin/equipment/vice_principal OR manages this room
  const isManager = (() => {
    if (!user) return false;
    if (['admin', 'vice_principal', 'equipment'].includes(user.role)) return true;
    if (user.managed_rooms) {
      const managedIds = user.managed_rooms.split(',').map(s => s.trim());
      const managedRoomNames = rooms.filter(r => managedIds.includes(r.id)).map(r => r.name);
      if (managedRoomNames.includes(decodeURIComponent(room || ''))) return true;
    }
    return false;
  })();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [borrowQtys, setBorrowQtys] = useState<Record<string, number>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [borrowData, setBorrowData] = useState({
    class: '',
    period: '',
    note: ''
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Filter devices by room
  const roomDevices = useMemo(() => {
    if (!subject || !room) return [];
    return devices.filter(d =>
      d.subject?.toLowerCase() === decodeURIComponent(subject).toLowerCase() &&
      d.room?.toLowerCase() === decodeURIComponent(room).toLowerCase()
    );
  }, [devices, subject, room]);

  // Calculate available qty for each device
  const getAvailableQty = (device: Device) => {
    const totalQty = device.quantity || 1;
    const damaged = device.damaged_qty || 0;
    const borrowed = borrowHistory
      .filter(b => String(b.device_id) === String(device.id) && (b.status === 'Đang mượn' || b.status === 'Trả thiếu'))
      .reduce((sum, b) => sum + ((b.quantity || 1) - (b.returned_qty || 0)), 0);
    return Math.max(0, totalQty - borrowed - damaged);
  };

  const totalDeviceQty = roomDevices.reduce((sum, d) => sum + (d.quantity || 1), 0);
  const totalAvailable = roomDevices.reduce((sum, d) => sum + getAvailableQty(d), 0);
  const totalBorrowed = totalDeviceQty - totalAvailable;
  const totalBrokenMaint = roomDevices.filter(d => !['Tốt', 'Đang mượn'].includes(d.status)).length;

  const setBorrowQty = (deviceId: string, qty: number) => {
    setBorrowQtys(prev => ({ ...prev, [deviceId]: qty }));
  };

  const totalSelected = Object.values(borrowQtys).reduce((sum, q) => sum + q, 0);

  const handleBatchBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || totalSelected === 0) return;

    setIsLoading(true);
    setError('');
    
    const borrowEntries = Object.entries(borrowQtys).filter(([, qty]) => qty > 0);
    const results: { id: string; qty: number; success: boolean; error?: string }[] = [];

    for (const [deviceId, qty] of borrowEntries) {
      try {
        await api.borrowDevice({
          device_id: deviceId,
          teacher: user.name,
          class: borrowData.class,
          period: borrowData.period,
          note: borrowData.note,
          quantity: qty,
          status: isManager ? 'Đang mượn' : 'Chờ duyệt'
        });
        results.push({ id: deviceId, qty, success: true });
      } catch (err: any) {
        results.push({ id: deviceId, qty, success: false, error: err.message });
      }
    }

    const successQty = results.filter(r => r.success).reduce((s, r) => s + r.qty, 0);
    const failCount = results.filter(r => !r.success).length;

    if (failCount === 0) {
      setSuccess(isManager
        ? `Đã mượn thành công ${successQty} thiết bị!`
        : `Đã gửi yêu cầu mượn ${successQty} thiết bị — chờ duyệt!`);
      showToast(isManager ? `Mượn thành công ${successQty} thiết bị` : `Gửi yêu cầu ${successQty} TB — chờ duyệt`);
    } else {
      setError(`Mượn thành công ${successQty}, thất bại ${failCount} loại thiết bị`);
      showToast(`Có ${failCount} loại mượn thất bại`, 'error');
    }

    setBorrowQtys({});
    refreshDevices();
    setIsLoading(false);

    if (failCount === 0) {
      setTimeout(() => navigate('/history'), 2000);
    }
  };

  const decodedSubject = subject ? decodeURIComponent(subject) : '';
  const decodedRoom = room ? decodeURIComponent(room) : '';

  if (roomDevices.length === 0 && !isLoading) {
    return (
      <div className="max-w-2xl mx-auto text-center py-10">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">
          Không tìm thấy thiết bị nào trong phòng {decodedRoom} - {decodedSubject}
        </div>
        <button onClick={() => navigate('/scan')} className="text-indigo-600 hover:underline">
          Quay lại trang quét
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center">
        <button onClick={() => navigate(-1)} className="mr-4 text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Mượn thiết bị theo phòng
          </h1>
          <p className="text-sm text-slate-500 mt-1">Nhập số lượng cần mượn cho mỗi thiết bị</p>
        </div>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center text-emerald-700">
          <CheckCircle className="h-5 w-5 mr-3 flex-shrink-0" />
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Room Info */}
      <div className="bg-white shadow-sm rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-indigo-100 flex items-center justify-center">
            <MapPin className="h-6 w-6 text-indigo-600" />
          </div>
          <div className="flex-1">
            <h2 className="font-semibold text-slate-900">Phòng {decodedRoom}</h2>
            <p className="text-sm text-slate-500">Bộ môn: {decodedSubject}</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-indigo-600">{totalDeviceQty}</div>
            <div className="text-xs text-slate-500">tổng SL</div>
          </div>
        </div>

        <div className="mt-3 flex gap-3 text-xs">
          <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700">
            Sẵn sàng: {totalAvailable}
          </span>
          <span className="px-2 py-1 rounded-full bg-blue-100 text-blue-700">
            Đang mượn: {totalBorrowed}
          </span>
          {totalBrokenMaint > 0 && (
            <span className="px-2 py-1 rounded-full bg-red-100 text-red-700">
              Hỏng/Bảo trì: {totalBrokenMaint}
            </span>
          )}
        </div>
      </div>

      {/* Device List */}
      {!success && (
        <>
          <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
              <h3 className="text-sm font-medium text-slate-700">Danh sách thiết bị — nhập số lượng mượn</h3>
            </div>

            <div className="divide-y divide-slate-100">
              {roomDevices.map(device => {
                const available = getAvailableQty(device);
                const totalQty = device.quantity || 1;
                const isUsable = available > 0 && !['Hỏng', 'Hỏng nhẹ', 'Cần bảo trì'].includes(device.status);
                const currentQty = borrowQtys[device.id] || 0;

                return (
                  <div
                    key={device.id}
                    className={`flex items-center px-4 py-3 ${isUsable ? '' : 'opacity-50 bg-slate-50'} ${currentQty > 0 ? 'bg-indigo-50' : ''}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Monitor className="h-4 w-4 text-slate-400 flex-shrink-0" />
                        <span className="font-medium text-sm text-slate-900 truncate">{device.name}</span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex gap-2">
                        <span className="font-mono">{device.id}</span>
                        <span className={`font-bold ${available > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          Còn {available}/{totalQty}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {isUsable ? (
                        <input
                          type="number"
                          min={0}
                          max={available}
                          value={currentQty}
                          onChange={e => setBorrowQty(device.id, Math.min(parseInt(e.target.value) || 0, available))}
                          className="w-16 text-center border border-slate-300 rounded-md py-1 px-2 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      ) : (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          device.status === 'Đang mượn' || available === 0 ? 'bg-blue-100 text-blue-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {available === 0 ? 'Hết' : device.status}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Borrow Form */}
          <form onSubmit={handleBatchBorrow} className="bg-white shadow-sm rounded-xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-medium text-slate-900 flex items-center">
              <BookOpen className="h-4 w-4 mr-2 text-indigo-600" />
              Thông tin mượn
              {totalSelected > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                  {totalSelected} thiết bị
                </span>
              )}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Lớp <span className="text-red-500">*</span></label>
                <input type="text" required value={borrowData.class} onChange={e => setBorrowData({ ...borrowData, class: e.target.value })}
                  className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="VD: 10A1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Tiết <span className="text-red-500">*</span></label>
                <input type="text" required value={borrowData.period} onChange={e => setBorrowData({ ...borrowData, period: e.target.value })}
                  className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="VD: 1, 2" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Mục đích</label>
              <input type="text" value={borrowData.note} onChange={e => setBorrowData({ ...borrowData, note: e.target.value })}
                className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="VD: Dạy bài thực hành" />
            </div>

            <button
              type="submit"
              disabled={isLoading || totalSelected === 0}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-all active:scale-[0.98]"
            >
              {isLoading ? 'Đang xử lý...' : totalSelected === 0 ? 'Nhập số lượng mượn' : `Mượn ${totalSelected} thiết bị`}
            </button>
          </form>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[100] px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
