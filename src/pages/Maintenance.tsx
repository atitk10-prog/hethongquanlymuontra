import React, { useState, useMemo } from 'react';
import { api, type MaintenanceRecord } from '../services/api';
import { useData } from '../context/DataContext';
import { useAuth } from '../store/auth';
import { format } from 'date-fns';
import { exportToXlsx } from '../utils/exportXlsx';
import { Plus, Search, Wrench, ChevronLeft, ChevronRight, AlertTriangle, Check, Download } from 'lucide-react';

export default function Maintenance() {
  const { maintenanceHistory, devices, rooms, isLoading, refreshMaintenance, refreshDevices } = useData();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;
  const [resultFilter, setResultFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [replaceModal, setReplaceModal] = useState<{ recordId: string; deviceId: string; maxQty: number } | null>(null);
  const [replaceDamagedQty, setReplaceDamagedQty] = useState(0);
  const [repairModal, setRepairModal] = useState<{ recordId: string; deviceId: string; damagedQty: number } | null>(null);
  const [repairQty, setRepairQty] = useState(0);

  // Device search state
  const [deviceSearch, setDeviceSearch] = useState('');
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);

  const [newRecord, setNewRecord] = useState({
    device_id: '',
    device_name: '', // for display
    room: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    content: '',
    technician: user?.name || '',
    result: 'Đã sửa'
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Filter devices for dropdown (respects managed_rooms for equipment staff)
  const visibleDevices = useMemo(() => {
    if (user?.role === 'equipment' && user.managed_rooms) {
      const managedIds = user.managed_rooms.split(',').map(s => s.trim()).filter(Boolean);
      if (managedIds.length > 0) {
        const managedRooms = rooms.filter(r => managedIds.includes(r.id));
        return devices.filter(d => managedRooms.some(r => r.name === d.room && r.subject === d.subject));
      }
    }
    return devices;
  }, [devices, rooms, user]);

  const filteredDevices = useMemo(() => {
    if (!deviceSearch.trim()) return visibleDevices;
    const q = deviceSearch.toLowerCase();
    return visibleDevices.filter(d =>
      d.name.toLowerCase().includes(q) ||
      d.id.toLowerCase().includes(q) ||
      d.room.toLowerCase().includes(q) ||
      d.subject.toLowerCase().includes(q)
    );
  }, [visibleDevices, deviceSearch]);

  const selectDevice = (d: { id: string; name: string; room: string; subject: string }) => {
    setNewRecord(prev => ({
      ...prev,
      device_id: d.id,
      device_name: `${d.name} (${d.id})`,
      room: `${d.room} - ${d.subject}`,
    }));
    setDeviceSearch(`${d.name} - ${d.room}`);
    setShowDeviceDropdown(false);
  };

  const openAddModal = () => {
    setNewRecord({
      device_id: '',
      device_name: '',
      room: '',
      date: format(new Date(), 'yyyy-MM-dd'),
      content: '',
      technician: user?.name || '',
      result: 'Đã sửa'
    });
    setDeviceSearch('');
    setShowAddModal(true);
  };

  // Sort by date descending, then by ID descending for same-date records
  const sortedHistory = [...maintenanceHistory].sort((a, b) => {
    const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
    if (dateDiff !== 0) return dateDiff;
    return (b.id || '').localeCompare(a.id || '');
  });

  const handleAddRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecord.device_id) {
      showToast('Vui lòng chọn thiết bị', 'error');
      return;
    }
    try {
      showToast('Đang lưu...');
      await api.addMaintenance({
        device_id: newRecord.device_id,
        date: newRecord.date,
        content: newRecord.content,
        technician: newRecord.technician,
        result: newRecord.result,
        room: newRecord.room,
      });
      setShowAddModal(false);
      showToast('Đã thêm ghi chú bảo trì');
      refreshMaintenance();
    } catch (error: any) {
      console.error('Failed to add maintenance record', error);
      showToast(error.message || 'Lỗi khi lưu', 'error');
    }
  };

  const handleUpdateResult = async (recordId: string, newResult: string, opts?: { damaged_qty?: number; repaired_qty?: number }) => {
    setUpdatingId(recordId);
    try {
      const payload: { id: string; result: string; damaged_qty?: number; repaired_qty?: number } = { id: recordId, result: newResult };
      if (opts?.damaged_qty !== undefined) payload.damaged_qty = opts.damaged_qty;
      if (opts?.repaired_qty !== undefined) payload.repaired_qty = opts.repaired_qty;
      const res = await api.updateMaintenanceResult(payload);
      if (newResult === 'Đã sửa') {
        showToast(res.auto_reset ? `Đã sửa ${opts?.repaired_qty || ''} TB — Thiết bị chuyển về Tốt` : `Đã sửa ${opts?.repaired_qty || ''} TB`);
      } else if (newResult === 'Cần thay thế') {
        showToast(`Cần thay thế (${opts?.damaged_qty || 0} hỏng)`);
      } else {
        showToast(`Đã cập nhật: ${newResult}`);
      }
      refreshMaintenance();
      refreshDevices();
    } catch (error: any) {
      showToast(error.message || 'Lỗi cập nhật', 'error');
    } finally {
      setUpdatingId(null);
      setReplaceModal(null);
      setRepairModal(null);
    }
  };

  const openReplaceModal = (recordId: string, deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    const maxQty = device?.quantity || 1;
    setReplaceModal({ recordId, deviceId, maxQty });
    setReplaceDamagedQty(device?.damaged_qty || 1);
  };

  const openRepairModal = (recordId: string, deviceId: string) => {
    const device = devices.find(d => d.id === deviceId);
    const damagedQty = device?.damaged_qty || 0;
    setRepairModal({ recordId, deviceId, damagedQty });
    setRepairQty(damagedQty);
  };

  const filteredHistory = sortedHistory.filter(h => {
    // Result filter
    if (resultFilter === 'pending' && (h.result === 'Đã sửa' || h.result === 'Cần thay thế')) return false;
    if (resultFilter === 'fixed' && h.result !== 'Đã sửa') return false;
    if (resultFilter === 'replace' && h.result !== 'Cần thay thế') return false;
    // Search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return h.device_id.toLowerCase().includes(q) ||
        h.technician.toLowerCase().includes(q) ||
        (h.content && h.content.toLowerCase().includes(q));
    }
    return true;
  });

  // Get device name from device list
  const getDeviceName = (deviceId: string) => {
    const d = devices.find(dev => dev.id === deviceId);
    return d ? d.name : deviceId;
  };

  const getDeviceRoom = (deviceId: string) => {
    const d = devices.find(dev => dev.id === deviceId);
    return d ? `${d.room} - ${d.subject}` : '';
  };

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedData = filteredHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const handleSearch = (term: string) => { setSearchTerm(term); setCurrentPage(1); };

  const PaginationControls = () => {
    if (filteredHistory.length <= ITEMS_PER_PAGE) return null;
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
        <div className="text-xs text-slate-500">{startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredHistory.length)} / {filteredHistory.length}</div>
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safeCurrentPage <= 1}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
          <span className="text-xs font-medium text-slate-700 px-2">{safeCurrentPage}/{totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safeCurrentPage >= totalPages}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Lịch sử bảo trì</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              if (filteredHistory.length === 0) return;
              const headers = ['STT', 'Mã GD', 'Mã TB', 'Tên thiết bị', 'Phòng', 'Ngày', 'Nội dung', 'Người sửa', 'Kết quả'];
              const rows = filteredHistory.map((r, i) => [
                i + 1, r.id, r.device_id, getDeviceName(r.device_id), getDeviceRoom(r.device_id),
                format(new Date(r.date), 'dd/MM/yyyy'), r.content, r.technician, r.result
              ]);
              exportToXlsx('Lịch sử bảo trì', headers, rows, `BaoTri_${format(new Date(), 'yyyyMMdd')}.xls`);
            }}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Download className="-ml-0.5 mr-1.5 h-4 w-4 text-slate-400" />
            Xuất Excel
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <Plus className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
            Thêm ghi chú bảo trì
          </button>
        </div>
      </div>

      {/* Panel: Thiết bị cần sửa chữa */}
      {(() => {
        // Only show devices needing repair (exclude ones already marked 'Cần thay thế')
        const damagedDevices = devices.filter(d => {
          if (!d.status || d.status === 'Tốt' || d.status === 'Đang mượn') return false;
          // Hide if all maintenance records for this device are 'Cần thay thế'
          const pendingRecords = maintenanceHistory.filter(m => m.device_id === d.id && m.result !== 'Đã sửa');
          const allReplaced = pendingRecords.length > 0 && pendingRecords.every(m => m.result === 'Cần thay thế');
          return !allReplaced;
        });
        if (damagedDevices.length === 0) return null;
        return (
          <div className="bg-white shadow-sm rounded-xl border border-amber-200 overflow-hidden">
            <div className="px-4 py-3 bg-amber-50 border-b border-amber-200">
              <h3 className="text-sm font-semibold text-amber-800 flex items-center">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Thiết bị cần sửa chữa ({damagedDevices.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {damagedDevices.map(d => {
                // Find matching maintenance record for this device
                const matchingRecord = maintenanceHistory.find(m => m.device_id === d.id && m.result !== 'Đã sửa');
                return (
                <div key={d.id} className="px-4 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900">{d.name}</div>
                      <div className="text-xs text-slate-500">{d.id} • {d.room} • {d.subject}</div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                      <div className="text-center">
                        <div className="text-lg font-bold text-red-600">{d.damaged_qty || 0}</div>
                        <div className="text-[10px] text-slate-400 uppercase">Hỏng</div>
                      </div>
                      <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${
                        d.status === 'Hỏng' ? 'bg-red-100 text-red-800' :
                        d.status === 'Hỏng nhẹ' ? 'bg-amber-100 text-amber-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {d.status}
                      </span>
                    </div>
                  </div>
                  {/* Action buttons */}
                  {matchingRecord && (
                    <div className="flex gap-2 mt-2">
                      {matchingRecord.result !== 'Cần thay thế' && (
                        <button onClick={() => openRepairModal(matchingRecord.id, d.id)}
                          disabled={updatingId === matchingRecord.id}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                          {updatingId === matchingRecord.id ? '...' : '✅ Đã sửa'}
                        </button>
                      )}
                      {matchingRecord.result !== 'Cần thay thế' && (
                        <button onClick={() => openReplaceModal(matchingRecord.id, d.id)}
                          disabled={updatingId === matchingRecord.id}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors">
                          Cần thay thế
                        </button>
                      )}
                      {matchingRecord.result === 'Cần thay thế' && (
                        <span className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-100 text-red-700">
                          Đã đánh dấu thay thế
                        </span>
                      )}
                    </div>
                  )}
                  {!matchingRecord && (
                    <div className="text-xs text-slate-400 mt-1 italic">Chưa có phiếu bảo trì — vui lòng thêm mới</div>
                  )}
                </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
        {/* Filter Tabs */}
        <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-2 border-b border-slate-200 bg-slate-50">
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-3">
            {[
              { key: 'all', label: 'Tất cả', count: sortedHistory.length },
              { key: 'pending', label: 'Chưa sửa', count: sortedHistory.filter(h => h.result !== 'Đã sửa' && h.result !== 'Cần thay thế').length },
              { key: 'fixed', label: 'Đã sửa', count: sortedHistory.filter(h => h.result === 'Đã sửa').length },
              { key: 'replace', label: 'Thay thế', count: sortedHistory.filter(h => h.result === 'Cần thay thế').length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => { setResultFilter(tab.key); setCurrentPage(1); }}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                  resultFilter === tab.key
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              className="block w-full rounded-md border-slate-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2 border"
              placeholder="Tìm kiếm theo mã TB, nội dung, người sửa..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase w-12">STT</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Mã GD</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Thiết bị</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Phòng</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Ngày</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nội dung</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Người sửa</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Kết quả</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-4 text-center text-sm text-slate-500">Không có dữ liệu</td>
                </tr>
              ) : (
                paginatedData.map((record, idx) => (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3 text-center text-sm text-slate-400">{startIndex + idx + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">{record.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="font-medium text-slate-900">{getDeviceName(record.device_id)}</div>
                      <div className="text-xs text-indigo-500 font-mono">{record.device_id}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{getDeviceRoom(record.device_id)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {format(new Date(record.date), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{record.content}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{record.technician}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {record.result === 'Đã sửa' ? (
                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-emerald-100 text-emerald-800">
                          <Check className="h-3 w-3 inline mr-1" /> Đã sửa
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            record.result === 'Cần thay thế' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {record.result}
                          </span>
                          {record.result !== 'Cần thay thế' && (
                            <button
                              onClick={() => openRepairModal(record.id, record.device_id)}
                              disabled={updatingId === record.id}
                              className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
                              title="Đánh dấu đã sửa xong"
                            >
                              {updatingId === record.id ? '...' : 'Đã sửa'}
                            </button>
                          )}
                          {record.result !== 'Cần thay thế' && (
                            <button
                              onClick={() => openReplaceModal(record.id, record.device_id)}
                              disabled={updatingId === record.id}
                              className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                              title="Đánh dấu cần thay thế"
                            >
                              Thay thế
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y divide-slate-100">
          {isLoading ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="p-4 animate-pulse space-y-2">
                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                <div className="h-3 bg-slate-100 rounded w-1/2"></div>
              </div>
            ))
          ) : filteredHistory.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">Không có dữ liệu</div>
          ) : (
            paginatedData.map((record, idx) => (
              <div key={record.id} className="p-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-400 font-medium">{startIndex + idx + 1}.</span>
                      <span className="font-semibold text-sm text-slate-900 truncate">{getDeviceName(record.device_id)}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full flex-shrink-0 ${record.result === 'Đã sửa' ? 'bg-emerald-100 text-emerald-800' : record.result === 'Cần thay thế' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                        {record.result}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">{record.content}</div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-1">
                      <span className="font-mono">{record.device_id}</span>
                      <span>•</span>
                      <span>{format(new Date(record.date), 'dd/MM/yyyy')}</span>
                      <span>•</span>
                      <span>{record.technician}</span>
                    </div>
                    {record.result !== 'Đã sửa' && (
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => openRepairModal(record.id, record.device_id)} disabled={updatingId === record.id}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
                          {updatingId === record.id ? '...' : 'Đã sửa'}
                        </button>
                        {record.result !== 'Cần thay thế' && (
                          <button onClick={() => openReplaceModal(record.id, record.device_id)} disabled={updatingId === record.id}
                            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50">
                            Thay thế
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <PaginationControls />
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[100] px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.message}
        </div>
      )}

      {/* Add Maintenance Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-500/75 transition-opacity" aria-hidden="true" onClick={() => setShowAddModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full relative z-10">
              <form onSubmit={handleAddRecord}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex items-center mb-4">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
                      <Wrench className="h-5 w-5 text-indigo-600" />
                    </div>
                    <h3 className="text-lg leading-6 font-medium text-slate-900" id="modal-title">
                      Thêm ghi chú bảo trì
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {/* Device search dropdown */}
                    <div className="relative">
                      <label className="block text-sm font-medium text-slate-700">Thiết bị <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={deviceSearch}
                        onChange={e => {
                          setDeviceSearch(e.target.value);
                          setShowDeviceDropdown(true);
                          if (!e.target.value) {
                            setNewRecord(prev => ({ ...prev, device_id: '', device_name: '', room: '' }));
                          }
                        }}
                        onFocus={() => setShowDeviceDropdown(true)}
                        className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="Tìm theo tên thiết bị, phòng, bộ môn..."
                      />
                      {showDeviceDropdown && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                          {filteredDevices.length === 0 ? (
                            <div className="px-3 py-2 text-sm text-slate-500">Không tìm thấy thiết bị</div>
                          ) : (
                            filteredDevices.map(d => (
                              <button
                                key={d.id}
                                type="button"
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-indigo-50 transition-colors border-b border-slate-100 last:border-0 ${newRecord.device_id === d.id ? 'bg-indigo-50 text-indigo-700' : ''}`}
                                onClick={() => selectDevice(d)}
                              >
                                <div className="font-medium">{d.name}</div>
                                <div className="text-xs text-slate-500">{d.id} • {d.room} • {d.subject} • <span className={d.status === 'Tốt' ? 'text-emerald-600' : 'text-red-600'}>{d.status}</span></div>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    {/* Selected device info */}
                    {newRecord.device_id && (
                      <div className="bg-indigo-50 rounded-lg px-3 py-2 text-sm">
                        <span className="font-medium text-indigo-700">Đã chọn:</span> {newRecord.device_name} — <span className="text-slate-600">{newRecord.room}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Ngày</label>
                        <input type="date" required value={newRecord.date} onChange={e => setNewRecord({ ...newRecord, date: e.target.value })} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Kết quả</label>
                        <select value={newRecord.result} onChange={e => setNewRecord({ ...newRecord, result: e.target.value })} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                          <option value="Đã sửa">Đã sửa</option>
                          <option value="Chưa sửa được">Chưa sửa được</option>
                          <option value="Cần thay thế">Cần thay thế</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Nội dung <span className="text-red-500">*</span></label>
                      <input type="text" required value={newRecord.content} onChange={e => setNewRecord({ ...newRecord, content: e.target.value })} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Mô tả nội dung bảo trì..." />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Người sửa</label>
                      <input type="text" value={newRecord.technician} onChange={e => setNewRecord({ ...newRecord, technician: e.target.value })} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" placeholder="Tên người sửa chữa" />
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button type="submit" disabled={!newRecord.device_id} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">
                    Lưu
                  </button>
                  <button type="button" onClick={() => setShowAddModal(false)} className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                    Hủy
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Replace Modal — input damaged_qty */}
      {replaceModal && (() => {
        const device = devices.find(d => d.id === replaceModal.deviceId);
        return (
          <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen px-4">
              <div className="fixed inset-0 bg-slate-500/75" onClick={() => setReplaceModal(null)}></div>
              <div className="relative z-10 bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  Cần thay thế
                </h3>
                {device && (
                  <div className="bg-slate-50 rounded-lg p-3 text-sm">
                    <div className="font-medium text-slate-900">{device.name}</div>
                    <div className="text-xs text-slate-500">{device.id} • {device.room} • Tổng: {device.quantity || 1}</div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Số lượng hỏng</label>
                  <input
                    type="number"
                    min={0}
                    max={replaceModal.maxQty}
                    value={replaceDamagedQty}
                    onChange={e => setReplaceDamagedQty(Math.min(replaceModal.maxQty, parseInt(e.target.value) || 0))}
                    className="w-full border border-red-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-red-500 bg-red-50"
                  />
                  <p className="text-xs text-slate-500 mt-1">Tối đa: {replaceModal.maxQty}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateResult(replaceModal.recordId, 'Cần thay thế', { damaged_qty: replaceDamagedQty })}
                    disabled={updatingId === replaceModal.recordId}
                    className="flex-1 py-2 rounded-lg bg-red-600 text-white font-medium text-sm hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {updatingId === replaceModal.recordId ? 'Đang xử lý...' : 'Xác nhận thay thế'}
                  </button>
                  <button
                    onClick={() => setReplaceModal(null)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Repair Modal — input repaired qty */}
      {repairModal && (() => {
        const device = devices.find(d => d.id === repairModal.deviceId);
        return (
          <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
            <div className="flex items-center justify-center min-h-screen px-4">
              <div className="fixed inset-0 bg-slate-500/75" onClick={() => setRepairModal(null)}></div>
              <div className="relative z-10 bg-white rounded-xl shadow-xl max-w-sm w-full p-6 space-y-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Check className="h-5 w-5 text-emerald-500" />
                  Đã sửa chữa
                </h3>
                {device && (
                  <div className="bg-slate-50 rounded-lg p-3 text-sm">
                    <div className="font-medium text-slate-900">{device.name}</div>
                    <div className="text-xs text-slate-500">{device.id} • Tổng: {device.quantity || 1} • Hỏng: {device.damaged_qty || 0}</div>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Số lượng đã sửa được</label>
                  <input
                    type="number"
                    min={0}
                    max={repairModal.damagedQty}
                    value={repairQty}
                    onChange={e => setRepairQty(Math.min(repairModal.damagedQty, parseInt(e.target.value) || 0))}
                    className="w-full border border-emerald-300 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-emerald-500 bg-emerald-50"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Đang hỏng: {repairModal.damagedQty} • Sau sửa còn hỏng: {Math.max(0, repairModal.damagedQty - repairQty)}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateResult(repairModal.recordId, 'Đã sửa', { repaired_qty: repairQty })}
                    disabled={updatingId === repairModal.recordId || repairQty <= 0}
                    className="flex-1 py-2 rounded-lg bg-emerald-600 text-white font-medium text-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                  >
                    {updatingId === repairModal.recordId ? 'Đang xử lý...' : `Xác nhận sửa ${repairQty} TB`}
                  </button>
                  <button
                    onClick={() => setRepairModal(null)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm hover:bg-slate-50"
                  >
                    Hủy
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
