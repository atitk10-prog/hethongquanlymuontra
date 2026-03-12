import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type Device, type BorrowRecord } from '../services/api';
import { useAuth } from '../store/auth';
import { useData } from '../context/DataContext';
import { ArrowLeft, CheckCircle, Package, AlertTriangle } from 'lucide-react';

export default function DeviceAction() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshDevices, refreshHistory } = useData();

  const [device, setDevice] = useState<Device | null>(null);
  const [activeBorrows, setActiveBorrows] = useState<BorrowRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Borrow state
  const [borrowData, setBorrowData] = useState({
    class: '',
    period: '',
    note: '',
    quantity: 1
  });

  // Return state
  const [returnBorrowId, setReturnBorrowId] = useState('');
  const [returnData, setReturnData] = useState({
    returned_qty: 0,
    missing_qty: 0,
    missing_note: '',
    status: 'Tốt',
    note: ''
  });

  useEffect(() => {
    if (id) {
      fetchDevice(id);
      fetchActiveBorrows(id);
    }
  }, [id]);

  const fetchDevice = async (deviceId: string) => {
    try {
      const data = await api.getDevice(deviceId);
      setDevice(data);
    } catch (err: any) {
      setError(err.message || 'Không tìm thấy thiết bị');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchActiveBorrows = async (deviceId: string) => {
    try {
      const data = await api.getActiveBorrows(deviceId);
      setActiveBorrows(data);
    } catch {
      // Ignore - borrows may be empty
    }
  };

  // Calculate available quantity
  const totalQty = device?.quantity || 1;
  const borrowedQty = activeBorrows.reduce((sum, b) => {
    const qty = b.quantity || 1;
    const returned = b.returned_qty || 0;
    return sum + (qty - returned);
  }, 0);
  const availableQty = totalQty - borrowedQty;

  // Current user's active borrows
  const myBorrows = activeBorrows.filter(b => b.teacher === user?.name);

  const handleBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!device || !user) return;

    setIsLoading(true);
    setError('');
    try {
      await api.borrowDevice({
        device_id: device.id,
        teacher: user.name,
        class: borrowData.class,
        period: borrowData.period,
        note: borrowData.note,
        quantity: borrowData.quantity
      });
      setSuccess(`Mượn thành công ${borrowData.quantity} thiết bị!`);
      // Refresh ALL data for realtime updates
      refreshDevices();
      refreshHistory();
      // Re-fetch local data
      await Promise.all([fetchDevice(device.id), fetchActiveBorrows(device.id)]);
      setTimeout(() => navigate('/history'), 1500);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi mượn thiết bị');
      setIsLoading(false);
    }
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!device || !user || !returnBorrowId) return;

    setIsLoading(true);
    setError('');
    try {
      await api.returnDevice({
        device_id: device.id,
        borrow_id: returnBorrowId,
        teacher: user.name,
        returned_qty: returnData.returned_qty,
        missing_qty: returnData.missing_qty,
        missing_note: returnData.missing_note,
        status: returnData.status,
        note: returnData.note
      });
      const msg = returnData.missing_qty > 0
        ? `Trả ${returnData.returned_qty}, thiếu ${returnData.missing_qty} thiết bị`
        : `Trả thành công ${returnData.returned_qty} thiết bị!`;
      setSuccess(msg);
      // Refresh ALL data for realtime updates
      refreshDevices();
      refreshHistory();
      // Re-fetch local data
      await Promise.all([fetchDevice(device.id), fetchActiveBorrows(device.id)]);
      setTimeout(() => navigate('/history'), 1500);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi trả thiết bị');
      setIsLoading(false);
    }
  };

  const selectBorrowForReturn = (borrow: BorrowRecord) => {
    const remaining = (borrow.quantity || 1) - (borrow.returned_qty || 0);
    setReturnBorrowId(borrow.id);
    setReturnData({
      returned_qty: remaining,
      missing_qty: 0,
      missing_note: '',
      status: 'Tốt',
      note: ''
    });
  };

  if (isLoading && !device) {
    return <div className="text-center py-10">Đang tải thông tin...</div>;
  }

  if (error && !device) {
    return (
      <div className="max-w-md mx-auto text-center py-10">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>
        <button onClick={() => navigate('/scan')} className="text-indigo-600 hover:underline">
          Quay lại trang quét
        </button>
      </div>
    );
  }

  const canBorrow = availableQty > 0 && !['Hỏng', 'Hỏng nhẹ', 'Cần bảo trì'].includes(device?.status || '');

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div className="flex items-center">
        <button onClick={() => navigate(-1)} className="mr-4 text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-2xl font-bold text-slate-900">
          {myBorrows.length > 0 ? 'Mượn / Trả thiết bị' : 'Mượn thiết bị'}
        </h1>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center text-emerald-700">
          <CheckCircle className="h-5 w-5 mr-3" />
          {success}
        </div>
      )}

      {error && device && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Device Info */}
      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-5 sm:px-6 bg-slate-50 border-b border-slate-200">
          <h3 className="text-lg leading-6 font-medium text-slate-900">Thông tin thiết bị</h3>
        </div>
        <div className="border-t border-slate-200 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-slate-200">
            <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-slate-500">Mã thiết bị</dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0 sm:col-span-2 font-mono">{device?.id}</dd>
            </div>
            <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-slate-500">Tên thiết bị</dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0 sm:col-span-2 font-semibold">{device?.name}</dd>
            </div>
            <div className="py-3 sm:py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-slate-500">Phòng</dt>
              <dd className="mt-1 text-sm text-slate-900 sm:mt-0 sm:col-span-2">{device?.room} — {device?.subject}</dd>
            </div>
            <div className="py-3 sm:py-4 sm:px-6">
              <dt className="text-sm font-medium text-slate-500 mb-3">Tình trạng kho</dt>
              <dd>
                {/* Stock progress bar */}
                <div className="w-full bg-slate-100 rounded-full h-4 mb-2 overflow-hidden flex">
                  {availableQty > 0 && (
                    <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(availableQty / totalQty) * 100}%` }} />
                  )}
                  {borrowedQty > 0 && (
                    <div className="bg-blue-500 h-full transition-all" style={{ width: `${(borrowedQty / totalQty) * 100}%` }} />
                  )}
                </div>
                {/* Stock numbers */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-slate-800">{totalQty}</div>
                    <div className="text-xs text-slate-500">Tổng</div>
                  </div>
                  <div className="bg-emerald-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-emerald-700">{availableQty}</div>
                    <div className="text-xs text-emerald-600">Trong kho</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2">
                    <div className="text-lg font-bold text-blue-700">{borrowedQty}</div>
                    <div className="text-xs text-blue-600">Đang mượn</div>
                  </div>
                </div>
                {/* Device status warning */}
                {device?.status && device.status !== 'Tốt' && (
                  <div className={`mt-2 px-3 py-1.5 rounded-lg text-xs font-medium flex items-center ${
                    device.status === 'Hỏng' ? 'bg-red-50 text-red-700' :
                    device.status === 'Hỏng nhẹ' ? 'bg-amber-50 text-amber-700' :
                    'bg-yellow-50 text-yellow-700'
                  }`}>
                    <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                    Tình trạng: {device.status}
                  </div>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {!success && (
        <>
          {/* My active borrows — Return section */}
          {myBorrows.length > 0 && (
            <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
                <h3 className="text-sm font-semibold text-blue-800 flex items-center">
                  <Package className="h-4 w-4 mr-2" />
                  Lượt mượn của bạn — Chọn để trả
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {myBorrows.map(b => {
                  const remaining = (b.quantity || 1) - (b.returned_qty || 0);
                  return (
                    <button
                      key={b.id}
                      onClick={() => selectBorrowForReturn(b)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${returnBorrowId === b.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            Mượn {b.quantity || 1} — Lớp {b.class}
                          </div>
                          <div className="text-xs text-slate-500">
                            {b.borrow_date ? new Date(b.borrow_date).toLocaleDateString('vi') : ''} · Còn {remaining} chưa trả
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${b.status === 'Trả thiếu' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                          {b.status}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Return Form */}
          {returnBorrowId && (
            <form onSubmit={handleReturn} className="bg-white shadow-sm rounded-xl border border-slate-200 p-6 space-y-4">
              <h3 className="font-medium text-slate-900">Trả thiết bị</h3>
              {(() => {
                const borrow = myBorrows.find(b => b.id === returnBorrowId);
                const remaining = borrow ? (borrow.quantity || 1) - (borrow.returned_qty || 0) : 0;
                return (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Số lượng trả <span className="text-red-500">*</span></label>
                        <input
                          type="number" min={0} max={remaining} required
                          value={returnData.returned_qty}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            setReturnData({ ...returnData, returned_qty: val, missing_qty: remaining - val });
                          }}
                          className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Thiếu/Mất</label>
                        <input
                          type="number" min={0} max={remaining}
                          value={returnData.missing_qty}
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            setReturnData({ ...returnData, missing_qty: val, returned_qty: remaining - val });
                          }}
                          className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        />
                      </div>
                    </div>

                    {returnData.missing_qty > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700 flex items-center">
                          <AlertTriangle className="h-4 w-4 mr-1 text-amber-500" />
                          Lý do thiếu <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                          type="text" required
                          value={returnData.missing_note}
                          onChange={e => setReturnData({ ...returnData, missing_note: e.target.value })}
                          className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                          placeholder="VD: Mất 2 chuột, hỏng 1 bàn phím..."
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Tình trạng thiết bị khi trả</label>
                      <div className="flex flex-wrap gap-2">
                        {['Tốt', 'Hỏng nhẹ', 'Cần bảo trì', 'Hỏng'].map(s => (
                          <label key={s} className={`px-3 py-1.5 rounded-full text-sm cursor-pointer border transition-colors ${returnData.status === s ? 'bg-indigo-100 border-indigo-400 text-indigo-800 font-medium' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                            <input type="radio" name="returnStatus" value={s} checked={returnData.status === s} onChange={() => setReturnData({ ...returnData, status: s })} className="sr-only" />
                            {s}
                          </label>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading || (returnData.returned_qty === 0 && returnData.missing_qty === 0)}
                      className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {returnData.missing_qty > 0
                        ? `Trả ${returnData.returned_qty}, ghi nhận thiếu ${returnData.missing_qty}`
                        : `Xác nhận trả ${returnData.returned_qty}`}
                    </button>
                  </>
                );
              })()}
            </form>
          )}

          {/* Borrow Form */}
          {canBorrow && !returnBorrowId && (
            <form onSubmit={handleBorrow} className="bg-white shadow-sm rounded-xl border border-slate-200 p-6 space-y-4">
              <h3 className="font-medium text-slate-900">Mượn thiết bị</h3>
              <div>
                <label className="block text-sm font-medium text-slate-700">Số lượng mượn <span className="text-red-500">*</span></label>
                <input
                  type="number" min={1} max={availableQty} required
                  value={borrowData.quantity}
                  onChange={e => setBorrowData({ ...borrowData, quantity: parseInt(e.target.value) || 1 })}
                  className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
                <p className="text-xs text-slate-400 mt-1">Tối đa: {availableQty}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700">Lớp <span className="text-red-500">*</span></label>
                  <input type="text" required value={borrowData.class} onChange={e => setBorrowData({ ...borrowData, class: e.target.value })}
                    className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="VD: 10A1" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700">Tiết</label>
                  <input type="text" value={borrowData.period} onChange={e => setBorrowData({ ...borrowData, period: e.target.value })}
                    className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="VD: 1, 2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700">Mục đích</label>
                <input type="text" value={borrowData.note} onChange={e => setBorrowData({ ...borrowData, note: e.target.value })}
                  className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="VD: Dạy bài 3" />
              </div>
              <button
                type="submit" disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
              >
                Mượn {borrowData.quantity} thiết bị
              </button>
            </form>
          )}

          {!canBorrow && myBorrows.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm text-center">
              {availableQty <= 0 ? 'Hết thiết bị để mượn' : `Thiết bị đang ${device?.status}, không thể mượn`}
            </div>
          )}
        </>
      )}
    </div>
  );
}
