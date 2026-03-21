import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { api } from '../services/api';
import { format } from 'date-fns';
import { ArrowLeft, Package, CheckCircle2, AlertCircle, X, Clock, Check } from 'lucide-react';

export default function ReturnByTeacher() {
  const { teacher } = useParams<{ teacher: string }>();
  const teacherName = decodeURIComponent(teacher || '');
  const navigate = useNavigate();
  const { borrowHistory, devices, refreshHistory, refreshDevices } = useData();
  const [returningId, setReturningId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Return form state
  const [returnBorrowId, setReturnBorrowId] = useState('');
  const [returnData, setReturnData] = useState({
    returned_qty: 0, damaged_qty: 0, missing_qty: 0, missing_note: '', status: 'Tốt'
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    refreshHistory?.();
  }, []);

  const activeBorrows = borrowHistory.filter(
    b => b.teacher === teacherName && (b.status === 'Đang mượn' || b.status === 'Trả thiếu')
  );

  const getDeviceName = (deviceId: string) => {
    const d = devices.find(dev => dev.id === deviceId);
    return d ? d.name : deviceId;
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
    try {
      // Auto-determine status based on damage
      let autoStatus = 'Tốt';
      if (returnData.damaged_qty > 0) {
        autoStatus = returnData.damaged_qty >= (borrow.quantity || 1) ? 'Hỏng' : 'Hỏng nhẹ';
      }

      await api.returnDevice({
        borrow_id: returnBorrowId,
        device_id: borrow.device_id,
        teacher: teacherName,
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
      showToast(parts.join(', ') + ' thiết bị');
      setReturnBorrowId('');
      refreshHistory?.();
      refreshDevices?.();
    } catch (error: any) {
      showToast(error.message || 'Lỗi khi trả thiết bị', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReturnAll = async () => {
    if (activeBorrows.length === 0) return;
    setReturningId('all');
    try {
      for (const b of activeBorrows) {
        await api.returnDevice({
          borrow_id: b.id,
          device_id: b.device_id,
          teacher: teacherName,
          returned_qty: (b.quantity || 1) - (b.returned_qty || 0),
          missing_qty: 0,
          missing_note: '',
          status: 'Đã trả',
          note: ''
        });
      }
      showToast(`Đã trả tất cả ${activeBorrows.length} thiết bị!`);
      refreshHistory?.();
      refreshDevices?.();
    } catch (error: any) {
      showToast(error.message || 'Lỗi khi trả thiết bị', 'error');
    } finally {
      setReturningId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Trả thiết bị</h1>
          <p className="text-sm text-slate-500">Giáo viên: <span className="font-semibold text-indigo-600">{teacherName}</span></p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-blue-800 flex items-center">
            <Package className="h-4 w-4 mr-2" />
            Đang mượn ({activeBorrows.length} thiết bị)
          </h3>
          {activeBorrows.length > 1 && (
            <button
              onClick={handleReturnAll}
              disabled={returningId !== null || isLoading}
              className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition-all"
            >
              {returningId === 'all' ? 'Đang trả...' : 'Trả tất cả (tốt)'}
            </button>
          )}
        </div>

        {activeBorrows.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <CheckCircle2 className="h-12 w-12 text-emerald-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-700">Không có thiết bị đang mượn</p>
            <p className="text-xs text-slate-500 mt-1">Giáo viên {teacherName} đã trả hết thiết bị</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activeBorrows.map(b => {
              const remaining = (b.quantity || 1) - (b.returned_qty || 0);
              const isReturning = returnBorrowId === b.id;
              const total = returnData.returned_qty + returnData.damaged_qty + returnData.missing_qty;

              return (
                <div key={b.id} className="overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900">{getDeviceName(b.device_id)}</span>
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-[10px] font-semibold">
                          SL: {remaining}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        <span className="font-mono text-indigo-500">{b.device_id}</span>
                        {b.class && <span> - Lớp {b.class}</span>}
                        {b.period && <span> - T{b.period}</span>}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {b.borrow_date && format(new Date(b.borrow_date), 'dd/MM HH:mm')}
                      </div>
                    </div>
                    {!isReturning && (
                      <button
                        onClick={() => selectBorrowForReturn(b.id)}
                        disabled={returningId !== null || isLoading}
                        className="ml-3 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition-all flex-shrink-0"
                      >
                        Trả chi tiết
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
                        className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium text-sm hover:bg-indigo-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                        {isLoading ? 'Đang xử lý...' : (
                          <>
                            <Check className="h-4 w-4" />
                            Xác nhận trả {returnData.returned_qty > 0 ? `tốt ${returnData.returned_qty}` : ''}{returnData.damaged_qty > 0 ? ` hỏng ${returnData.damaged_qty}` : ''}{returnData.missing_qty > 0 ? ` mất ${returnData.missing_qty}` : ''}
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-20 md:bottom-6 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium flex items-center gap-2 ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.type === 'error' ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
