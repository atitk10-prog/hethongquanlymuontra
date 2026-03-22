import { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../store/auth';
import { api } from '../services/api';
import { Monitor, Search, ArrowLeftRight, AlertTriangle, Check, Clock, X, ClipboardCheck, Plus, Minus, ShoppingCart, User, Calendar } from 'lucide-react';
import { format, addDays } from 'date-fns';

const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd');

type CartItem = { device_id: string; name: string; room: string; subject: string; qty: number; maxQty: number };

export default function DeviceBorrow() {
  const { devices, borrowHistory, rooms, users, refreshDevices, refreshHistory } = useData();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'borrow' | 'pending' | 'active'>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (t === 'active' || t === 'pending') return t;
    return 'borrow';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Equipment/admin/BGH can directly approve borrows (isManager)
  const isManager = user && (['equipment', 'admin', 'vice_principal'].includes(user.role) || !!user.managed_rooms);
  // Everyone logged in can borrow (non-managers need approval)
  const canBorrow = !!user;

  // Borrow form state — multi-device cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState(user?.id || '');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [showTeacherDropdown, setShowTeacherDropdown] = useState(false);
  const [borrowClass, setBorrowClass] = useState('');
  const [period, setPeriod] = useState('');
  const [borrowNote, setBorrowNote] = useState('');
  const [borrowDate, setBorrowDate] = useState(fmtDate(new Date()));
  const [dueDate, setDueDate] = useState(fmtDate(addDays(new Date(), 7)));

  // Return form state
  const [returnBorrowId, setReturnBorrowId] = useState('');
  const [returnData, setReturnData] = useState({
    returned_qty: 0, damaged_qty: 0, missing_qty: 0, missing_note: '', status: 'Tốt'
  });

  const activeBorrows = (borrowHistory || []).filter(b => {
    if (b.status !== 'Đang mượn' && b.status !== 'Trả thiếu') return false;
    const remaining = (b.quantity || 1) - (b.returned_qty || 0) - (b.missing_qty || 0);
    return remaining > 0;
  });

  // Teacher list — all users who are teachers
  const teacherList = useMemo(() => {
    return (users || []).filter(u => ['teacher', 'equipment', 'leader', 'vice_principal', 'admin'].includes(u.role));
  }, [users]);

  const selectedTeacher = teacherList.find(t => t.id === selectedTeacherId);
  const teacherName = selectedTeacher?.name || user?.name || '';

  const filteredTeachers = useMemo(() => {
    if (!teacherSearch) return teacherList;
    const q = teacherSearch.toLowerCase();
    return teacherList.filter(t =>
      t.name.toLowerCase().includes(q) || t.email.toLowerCase().includes(q) || t.id.toLowerCase().includes(q)
    );
  }, [teacherList, teacherSearch]);

  const getDeviceName = (deviceId: string) => {
    const d = devices.find(dv => dv.id === deviceId);
    return d ? d.name : deviceId;
  };

  const getDeviceBorrowedQty = (deviceId: string) => {
    return activeBorrows.filter(b => b.device_id === deviceId).reduce((s, b) => {
      const qty = b.quantity || 1;
      const returned = b.returned_qty || 0;
      return s + (qty - returned);
    }, 0);
  };

  // #5: Filter devices by managed_rooms
  const visibleDevices = useMemo(() => {
    if (user?.role === 'equipment' && user.managed_rooms) {
      const managedIds = user.managed_rooms.split(',').map((s: string) => s.trim()).filter(Boolean);
      if (managedIds.length > 0) {
        const managedRooms = rooms.filter(r => managedIds.includes(r.id));
        return devices.filter(d => managedRooms.some(r => r.name === d.room && r.subject === d.subject));
      }
    }
    return devices;
  }, [devices, rooms, user]);

  const filteredDevices = visibleDevices.filter(d => {
    if (!search) return true;
    const inCart = cart.some(c => c.device_id === d.id);
    if (inCart) return false;
    return d.name.toLowerCase().includes(search.toLowerCase()) || d.id.toLowerCase().includes(search.toLowerCase()) || d.room.toLowerCase().includes(search.toLowerCase());
  });

  const addToCart = (d: typeof devices[0]) => {
    const borrowed = getDeviceBorrowedQty(d.id);
    const damaged = d.damaged_qty || 0;
    const available = (d.quantity || 1) - borrowed - damaged;
    if (available <= 0) return;
    setCart(prev => [...prev, { device_id: d.id, name: d.name, room: d.room, subject: d.subject, qty: 1, maxQty: available }]);
    setSearch('');
  };

  const updateCartQty = (deviceId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.device_id !== deviceId) return c;
      const newQty = Math.max(1, Math.min(c.maxQty, c.qty + delta));
      return { ...c, qty: newQty };
    }));
  };

  const removeFromCart = (deviceId: string) => {
    setCart(prev => prev.filter(c => c.device_id !== deviceId));
  };

  const handleBorrow = async () => {
    if (cart.length === 0 || !teacherName.trim()) {
      setError('Vui lòng thêm thiết bị và chọn người mượn');
      return;
    }
    setIsLoading(true);
    setError('');
    setSuccess('');

    let successCount = 0;
    const errors: string[] = [];

    for (const item of cart) {
      try {
        await api.borrowDevice({
          device_id: item.device_id,
          teacher: teacherName.trim(),
          class: borrowClass,
          period: period,
          note: borrowNote,
          quantity: item.qty,
          borrow_date: borrowDate,
          status: isManager ? 'Đang mượn' : 'Chờ duyệt'
        });
        successCount++;
      } catch (e: any) {
        errors.push(`${item.name}: ${e.message || 'Lỗi không xác định'}`);
      }
    }

    if (errors.length === 0) {
      setSuccess(`Mượn thành công ${successCount} loại thiết bị!`);
      setCart([]);
      setBorrowNote('');
      setBorrowClass('');
      setPeriod('');
    } else if (successCount > 0) {
      setSuccess(`Thành công ${successCount} loại`);
      setError(`Thất bại: ${errors.join('; ')}`);
      setCart(prev => prev.filter(c => errors.some(err => err.startsWith(c.name))));
    } else {
      setError(`Thất bại: ${errors.join('; ')}`);
    }

    await Promise.all([refreshDevices(), refreshHistory()]);
    setIsLoading(false);
  };

  const selectBorrowForReturn = (borrowId: string) => {
    const borrow = activeBorrows.find(b => b.id === borrowId);
    if (!borrow) return;
    const remaining = (borrow.quantity || 1) - (borrow.returned_qty || 0);
    setReturnBorrowId(borrowId);
    setReturnData({ returned_qty: remaining, damaged_qty: 0, missing_qty: 0, missing_note: '', status: 'Tốt' });
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnBorrowId) return;
    const borrow = activeBorrows.find(b => b.id === returnBorrowId);
    if (!borrow) return;
    setIsLoading(true);
    setError('');
    try {
      // Auto-determine status based on damage
      let autoStatus = 'Tốt';
      if (returnData.damaged_qty > 0) {
        autoStatus = returnData.damaged_qty >= (borrow.quantity || 1) ? 'Hỏng' : 'Hỏng nhẹ';
      }

      await api.returnDevice({
        device_id: borrow.device_id,
        borrow_id: returnBorrowId,
        teacher: borrow.teacher,
        returned_qty: returnData.returned_qty,
        damaged_qty: returnData.damaged_qty,
        missing_qty: returnData.missing_qty,
        missing_note: returnData.missing_note,
        status: autoStatus,
        note: ''
      });
      const parts: string[] = [];
      if (returnData.returned_qty > 0) parts.push(`Trả tốt ${returnData.returned_qty}`);
      if (returnData.damaged_qty > 0) parts.push(`hỏng ${returnData.damaged_qty}`);
      if (returnData.missing_qty > 0) parts.push(`mất ${returnData.missing_qty}`);
      setSuccess(parts.join(', ') + ' thiết bị');
      setReturnBorrowId('');
      await Promise.all([refreshDevices(), refreshHistory()]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'teacher': return 'GV';
      case 'equipment': return 'TB';
      case 'leader': return 'TT';
      case 'vice_principal': return 'BGH';
      case 'admin': return 'QTV';
      case 'librarian': return 'TV';
      default: return role;
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ArrowLeftRight className="h-6 w-6 text-indigo-600" />
          Mượn / Trả thiết bị
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {canBorrow ? 'Cho mượn nhiều thiết bị cùng lúc và quản lý trả thiết bị' : 'Tra cứu thiết bị có sẵn trong hệ thống — liên hệ cán bộ thiết bị để mượn'}
        </p>
      </div>

      {!canBorrow && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          Bạn chỉ có quyền xem thiết bị. Vui lòng liên hệ cán bộ quản lý thiết bị để mượn/trả.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <button onClick={() => { setTab('borrow'); setReturnBorrowId(''); }}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${tab === 'borrow' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <Monitor className="h-4 w-4" /> Mượn
          {cart.length > 0 && <span className="ml-1 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{cart.length}</span>}
        </button>
        <button onClick={() => setTab('active')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${tab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <ClipboardCheck className="h-4 w-4" /> Đang mượn ({activeBorrows.length})
        </button>
        <button onClick={() => setTab('pending')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${tab === 'pending' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          Chờ duyệt ({borrowHistory.filter(b => b.status === 'Chờ duyệt').length})
        </button>
      </div>

      {/* Messages */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <Check className="h-4 w-4 flex-shrink-0" /> {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError('')} className="flex-shrink-0"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* ========= TAB MƯỢN ========= */}
      {tab === 'borrow' && (
        <div className="space-y-4">
          {/* Teacher selector */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <User className="h-4 w-4 text-indigo-500" />
              Người mượn <span className="text-red-500">*</span>
            </h2>

            {selectedTeacher ? (
              <div className="flex items-center gap-3 px-3 py-2.5 bg-indigo-50 rounded-lg border border-indigo-200">
                <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {selectedTeacher.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-900">{selectedTeacher.name}</div>
                  <div className="text-[11px] text-slate-500">{selectedTeacher.email} • {getRoleName(selectedTeacher.role)}</div>
                </div>
                <button onClick={() => { setSelectedTeacherId(''); setShowTeacherDropdown(true); }} className="text-indigo-400 hover:text-indigo-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input type="text" value={teacherSearch}
                  onChange={e => { setTeacherSearch(e.target.value); setShowTeacherDropdown(true); }}
                  onFocus={() => setShowTeacherDropdown(true)}
                  placeholder="Tìm theo tên, email hoặc mã người dùng..."
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                {showTeacherDropdown && (
                  <div className="absolute z-20 w-full mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg divide-y divide-slate-100">
                    {filteredTeachers.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-slate-400 text-center">Không tìm thấy</div>
                    ) : filteredTeachers.map(t => (
                      <button key={t.id} onClick={() => { setSelectedTeacherId(t.id); setTeacherSearch(''); setShowTeacherDropdown(false); }}
                        className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 flex items-center gap-3 transition-colors">
                        <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {t.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 truncate">{t.name}</div>
                          <div className="text-[11px] text-slate-400">{t.email}</div>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">{getRoleName(t.role)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Search & Add devices */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-indigo-500" />
              Chọn thiết bị cần mượn
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Tìm thiết bị để thêm vào danh sách mượn..." className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>

            {/* Search results dropdown */}
            {search && filteredDevices.length > 0 && (
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {filteredDevices.map(d => {
                  const borrowed = getDeviceBorrowedQty(d.id);
                  const damaged = d.damaged_qty || 0;
                  const available = (d.quantity || 1) - borrowed - damaged;
                  return (
                    <button key={d.id} onClick={() => addToCart(d)}
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-indigo-50 flex justify-between items-center transition-colors ${available <= 0 || !canBorrow ? 'opacity-40 cursor-not-allowed' : ''}`}
                      disabled={available <= 0 || !canBorrow}>
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-indigo-500" />
                        <div>
                          <span className="font-medium text-slate-900">{d.name}</span>
                          <span className="text-slate-400 ml-2 text-xs">{d.room} • {d.subject}</span>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold ${available > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        Còn {available}/{d.quantity || 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {search && filteredDevices.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2">Không tìm thấy thiết bị</p>
            )}

            {/* Cart items */}
            {cart.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Danh sách mượn ({cart.length} loại)</h3>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {cart.map((item, i) => (
                    <div key={item.device_id} className="flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-slate-50">
                      <span className="text-xs text-slate-400 font-mono w-5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{item.name}</div>
                        <div className="text-[11px] text-slate-400">{item.room} • {item.subject}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => updateCartQty(item.device_id, -1)} disabled={item.qty <= 1}
                          className="h-7 w-7 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center disabled:opacity-30 transition-colors">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold text-indigo-700">{item.qty}</span>
                        <button onClick={() => updateCartQty(item.device_id, 1)} disabled={item.qty >= item.maxQty}
                          className="h-7 w-7 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center disabled:opacity-30 transition-colors">
                          <Plus className="h-3 w-3" />
                        </button>
                        <span className="text-[10px] text-slate-400 w-8">/{item.maxQty}</span>
                      </div>
                      <button onClick={() => removeFromCart(item.device_id)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {cart.length === 0 && !search && (
              <div className="text-center py-6 text-slate-400 text-sm">
                <Monitor className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                Tìm và thêm thiết bị vào danh sách mượn
              </div>
            )}
          </div>

          {/* Borrow info form */}
          {cart.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-indigo-500" /> Thông tin mượn
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ngày mượn</label>
                  <input type="date" value={borrowDate}
                    onChange={e => {
                      setBorrowDate(e.target.value);
                      setDueDate(fmtDate(addDays(new Date(e.target.value), 7)));
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hạn trả</label>
                  <input type="date" value={dueDate} min={borrowDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Lớp</label>
                  <input type="text" value={borrowClass} onChange={e => setBorrowClass(e.target.value)} placeholder="VD: 10A1"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tiết</label>
                  <input type="text" value={period} onChange={e => setPeriod(e.target.value)} placeholder="VD: Tiết 3"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú</label>
                  <input type="text" value={borrowNote} onChange={e => setBorrowNote(e.target.value)} placeholder="Ghi chú"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              <button onClick={handleBorrow} disabled={isLoading || cart.length === 0 || !teacherName.trim() || !canBorrow}
                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {isLoading ? 'Đang xử lý...' : (
                  <>
                    <Check className="h-4 w-4" />
                    {isManager ? `Xác nhận mượn ${cart.length} loại thiết bị (${cart.reduce((s, c) => s + c.qty, 0)} đơn vị)` : `Gửi yêu cầu mượn ${cart.length} loại (chờ duyệt)`}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========= TAB CHỞ DUYỆT ========= */}
      {tab === 'pending' && (() => {
        const pendingBorrows = borrowHistory.filter(b => b.status === 'Chờ duyệt');
        const myPending = isManager ? pendingBorrows : pendingBorrows.filter(b => b.teacher === user?.name);
        return (
          <div className="space-y-3">
            {myPending.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm">
                <Monitor className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                Không có yêu cầu chờ duyệt
              </div>
            ) : myPending.map(borrow => (
              <div key={borrow.id} className="bg-white rounded-xl border border-amber-200 shadow-sm p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{getDeviceName(borrow.device_id)}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">SL: {borrow.quantity || 1}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-100 text-yellow-800">Chờ duyệt</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      Người mượn: <span className="font-medium text-slate-700">{borrow.teacher}</span>
                      {borrow.class && <> • Lớp: {borrow.class}</>}
                      {borrow.period && <> • Tiết: {borrow.period}</>}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {borrow.borrow_date && new Date(borrow.borrow_date).toLocaleDateString('vi-VN')}
                      {borrow.note && <> • {borrow.note}</>}
                    </div>
                  </div>
                  {isManager && (
                    <div className="flex gap-2 ml-3 flex-shrink-0">
                      <button onClick={async () => { setIsLoading(true); try { await api.approveDeviceBorrow({ id: borrow.id }); setSuccess('\u0110\u00e3 duy\u1ec7t m\u01b0\u1ee3n'); await refreshHistory(); } catch(e: any) { setError(e.message); } finally { setIsLoading(false); } }}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                        Duyệt
                      </button>
                      <button onClick={async () => { setIsLoading(true); try { await api.rejectDeviceBorrow({ id: borrow.id }); setSuccess('\u0110\u00e3 t\u1eeb ch\u1ed1i'); await refreshHistory(); } catch(e: any) { setError(e.message); } finally { setIsLoading(false); } }}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50">
                        Từ chối
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {/* ========= TAB ĐANG MƯỢN ========= */}
      {tab === 'active' && (
        <div className="space-y-3">
          {activeBorrows.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              <Monitor className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              Không có thiết bị đang mượn
            </div>
          ) : activeBorrows.map(borrow => {
            const remaining = (borrow.quantity || 1) - (borrow.returned_qty || 0);
            const isReturning = returnBorrowId === borrow.id;
            const total = returnData.returned_qty + returnData.damaged_qty + returnData.missing_qty;

            return (
              <div key={borrow.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900 text-sm">{getDeviceName(borrow.device_id)}</span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">SL: {remaining}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <span>{borrow.teacher}</span>
                      {borrow.class && <><span>•</span><span>{borrow.class}</span></>}
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Mượn: {borrow.borrow_date?.split('T')[0]}
                    </div>
                  </div>
                  {!isReturning && (
                    <button onClick={() => selectBorrowForReturn(borrow.id)}
                      disabled={!canBorrow}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-all flex-shrink-0 disabled:opacity-40">
                      Trả TB
                    </button>
                  )}
                  {isReturning && (
                    <button onClick={() => setReturnBorrowId('')} className="text-slate-400 hover:text-slate-600">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {isReturning && (
                  <form onSubmit={handleReturn} className="border-t border-slate-100 p-4 space-y-3 bg-slate-50">
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs font-medium text-emerald-700">Trả tốt</label>
                        <input type="number" min={0} max={remaining} value={returnData.returned_qty}
                          onChange={e => {
                            const v = Math.max(0, parseInt(e.target.value) || 0);
                            setReturnData(p => ({ ...p, returned_qty: v }));
                          }}
                          className="w-full mt-1 border border-emerald-300 rounded-lg px-2 py-2 text-sm bg-emerald-50 focus:ring-2 focus:ring-emerald-400" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-amber-700">Hỏng</label>
                        <input type="number" min={0} max={remaining} value={returnData.damaged_qty}
                          onChange={e => {
                            const v = Math.max(0, parseInt(e.target.value) || 0);
                            setReturnData(p => ({ ...p, damaged_qty: v }));
                          }}
                          className="w-full mt-1 border border-amber-300 rounded-lg px-2 py-2 text-sm bg-amber-50 focus:ring-2 focus:ring-amber-400" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-red-700">Mất</label>
                        <input type="number" min={0} max={remaining} value={returnData.missing_qty}
                          onChange={e => {
                            const v = Math.max(0, parseInt(e.target.value) || 0);
                            setReturnData(p => ({ ...p, missing_qty: v }));
                          }}
                          className="w-full mt-1 border border-red-300 rounded-lg px-2 py-2 text-sm bg-red-50 focus:ring-2 focus:ring-red-400" />
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">Tổng: {total}/{remaining}</div>
                    {returnData.missing_qty > 0 && (
                      <input type="text" value={returnData.missing_note} onChange={e => setReturnData(p => ({ ...p, missing_note: e.target.value }))} placeholder="Ghi chú mất..."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
                    )}
                    <button type="submit" disabled={isLoading || total === 0 || total > remaining}
                      className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all">
                      {isLoading ? 'Đang xử lý...' : `Trả ${returnData.returned_qty > 0 ? `tốt ${returnData.returned_qty}` : ''}${returnData.damaged_qty > 0 ? ` hỏng ${returnData.damaged_qty}` : ''}${returnData.missing_qty > 0 ? ` mất ${returnData.missing_qty}` : ''}`}
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
