import React, { useEffect, useState } from 'react';
import { api, type Device } from '../services/api';
import { Plus, Search, QrCode, Edit, Trash2, X, Download, Printer, CheckCircle2, AlertTriangle, MapPin, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '../store/auth';
import { format } from 'date-fns';
import { exportToXlsx } from '../utils/exportXlsx';
import { useData } from '../context/DataContext';
import { QRCodeSVG } from 'qrcode.react';
import { useNavigate } from 'react-router-dom';

export default function Devices() {
  const { devices, setDevices, rooms, borrowHistory, isLoading, refreshDevices } = useData();

  // Calculate borrowed quantity per device from active borrows
  const getBorrowedQty = (deviceId: string): number => {
    return borrowHistory
      .filter(b => b.device_id === deviceId && (b.status === 'Đang mượn' || b.status === 'Trả thiếu'))
      .reduce((sum, b) => sum + ((b.quantity || 1) - (b.returned_qty || 0)), 0);
  };
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 15;
  const [showAddModal, setShowAddModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState<string | null>(null);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [formDevice, setFormDevice] = useState({
    name: '',
    subject: '',
    room: '',
    status: 'Tốt',
    quantity: 1
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    // Initial data is handled by DataProvider
  }, []);

  const openAddModal = () => {
    setEditingDevice(null);
    setFormDevice({ name: '', subject: '', room: '', status: 'Tốt', quantity: 1 });
    setShowAddModal(true);
  };

  const openEditModal = (device: Device) => {
    setEditingDevice(device);
    setFormDevice({
      name: device.name,
      subject: device.subject,
      room: device.room,
      status: device.status,
      quantity: device.quantity || 1
    });
    setShowAddModal(true);
  };

  const handleSubmitDevice = async (e: React.FormEvent) => {
    e.preventDefault();

    const previousDevices = devices;

    try {
      if (editingDevice) {
        // Edit — optimistic update OK, ID không đổi
        const updatedDevice: Device = {
          ...editingDevice,
          ...formDevice,
        };
        setDevices(devices.map(d => d.id === editingDevice.id ? updatedDevice : d));
        setShowAddModal(false);
        setEditingDevice(null);

        await api.updateDevice(editingDevice.id, formDevice);
        showToast('Đã cập nhật thiết bị thành công');
      } else {
        // Add — gọi API trước, nhận ID thật rồi mới thêm vào list
        setShowAddModal(false);
        setEditingDevice(null);
        showToast('Đang tạo thiết bị...');

        const result = await api.addDevice({ ...formDevice, created_by: user?.name || '' });
        
        const newDevice: Device = {
          id: result.id,
          ...formDevice,
          purchase_date: new Date().toISOString().split('T')[0],
          value: 0,
          qr_code: '',
          quantity: formDevice.quantity || 1,
          created_by: user?.name || ''
        };
        setDevices(prev => [newDevice, ...prev]);
        showToast('Đã thêm thiết bị thành công');
      }
      refreshDevices();
    } catch (error) {
      console.error('Failed to save device', error);
      setDevices(previousDevices);
      showToast('Lỗi khi lưu thiết bị', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    const previousDevices = devices;
    // Optimistic Delete
    setDevices(prev => prev.filter(d => d.id !== id));
    setIsDeleting(true);

    try {
      await api.deleteDevice(id);
      showToast('Đã xóa thiết bị thành công');
      refreshDevices();
    } catch (error) {
      console.error('Failed to delete device', error);
      setDevices(previousDevices); // Rollback
      showToast('Lỗi khi xóa thiết bị', 'error');
    } finally {
      setIsDeleting(false);
      setConfirmDeleteId(null);
    }
  };

  const filteredDevices = devices.filter(d => {
    // Role matching
    if (user?.role === 'leader' && d.subject !== user.department) return false;

    // Filter by managed rooms (all roles)
    if (user?.managed_rooms) {
      const managedRoomIds = user.managed_rooms.split(',').map(s => s.trim()).filter(Boolean);
      if (managedRoomIds.length > 0) {
        const managedRooms = rooms.filter(r => managedRoomIds.includes(r.id));
        const isInManagedRoom = managedRooms.some(r => r.name === d.room && r.subject === d.subject);
        if (!isInManagedRoom) return false;
      }
    }

    // Search matching
    const search = searchTerm.toLowerCase();
    return (
      d.name.toLowerCase().includes(search) ||
      d.id.toLowerCase().includes(search) ||
      d.room.toLowerCase().includes(search) ||
      d.subject.toLowerCase().includes(search)
    );
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredDevices.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedDevices = filteredDevices.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleSearch = (term: string) => { setSearchTerm(term); setCurrentPage(1); };

  const exportExcel = () => {
    if (filteredDevices.length === 0) return;
    const headers = ['STT', 'ID', 'Tên thiết bị', 'Bộ môn', 'Phòng', 'Tình trạng', 'Số lượng'];
    const rows = filteredDevices.map((d, i) => [
      i + 1, d.id, d.name, d.subject, d.room, d.status, d.quantity || 1
    ]);
    exportToXlsx('Danh sách thiết bị', headers, rows, `DanhSachThietBi_${format(new Date(), 'yyyyMMdd')}.xls`);
  };

  const PaginationControls = () => {
    if (filteredDevices.length <= ITEMS_PER_PAGE) return null;
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
        <div className="text-xs text-slate-500">{startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredDevices.length)} / {filteredDevices.length}</div>
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Tốt': return 'bg-emerald-100 text-emerald-800';
      case 'Đang mượn': return 'bg-blue-100 text-blue-800';
      case 'Hỏng nhẹ': return 'bg-amber-100 text-amber-800';
      case 'Hỏng': return 'bg-red-100 text-red-800';
      case 'Cần bảo trì': return 'bg-orange-100 text-orange-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Danh sách thiết bị</h1>
        <div className="flex flex-wrap gap-2">
          {user?.role === 'vice_principal' && (
            <button
              onClick={exportExcel}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Download className="-ml-1 mr-1.5 h-4 w-4 text-slate-400" aria-hidden="true" />
              <span className="hidden sm:inline">Xuất báo cáo</span>
              <span className="sm:hidden">Xuất</span>
            </button>
          )}
          <button
            onClick={() => navigate('/print-qr')}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Printer className="-ml-1 mr-1.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <span className="hidden sm:inline">In QR thiết bị</span>
            <span className="sm:hidden">QR TB</span>
          </button>
          <button
            onClick={() => navigate('/print-qr-room')}
            className="hidden sm:inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <MapPin className="-ml-1 mr-1.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            In QR phòng
          </button>
          <button
            onClick={openAddModal}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus className="-ml-1 mr-1.5 h-4 w-4" aria-hidden="true" />
            Thêm
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
            }`}>
            <CheckCircle2 className={`h-5 w-5 ${toast.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`} />
            <span className="font-medium text-sm">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              className="block w-full rounded-md border-slate-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2 border"
              placeholder="Tìm kiếm thiết bị..."
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
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">ID</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tên thiết bị</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Phòng</th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Tổng</th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Mượn</th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-slate-500 uppercase tracking-wider">Còn</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Tình trạng</th>
                <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Thao tác</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-32"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24 ml-auto"></div></td>
                  </tr>
                ))
              ) : paginatedDevices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-4 text-center text-sm text-slate-500">Không tìm thấy thiết bị nào</td>
                </tr>
              ) : (
                paginatedDevices.map((device, idx) => {
                  const totalQty = device.quantity || 1;
                  const borrowed = getBorrowedQty(device.id);
                  const available = totalQty - borrowed;
                  return (
                  <tr key={device.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-3 py-3 text-center text-sm text-slate-400">{startIndex + idx + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">{device.id}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-700">{device.name}</div>
                      <div className="text-xs text-slate-400">{device.subject}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{device.room}</td>
                    <td className="px-3 py-3 whitespace-nowrap text-center">
                      <span className="text-sm font-bold text-slate-700">{totalQty}</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-center">
                      {borrowed > 0 ? (
                        <span className="text-sm font-bold text-blue-600">{borrowed}</span>
                      ) : (
                        <span className="text-sm text-slate-300">0</span>
                      )}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap text-center">
                      <span className={`text-sm font-bold ${available > 0 ? 'text-emerald-600' : 'text-red-600'}`}>{available}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(device.status)}`}>
                        {device.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => setShowQRModal(device.id)}
                        className="text-indigo-600 hover:text-indigo-900 mx-2"
                        title="Xem QR"
                      >
                        <QrCode className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => openEditModal(device)}
                        className="text-blue-600 hover:text-blue-900 mx-2"
                        title="Sửa"
                      >
                        <Edit className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(device.id)}
                        className="text-red-600 hover:text-red-900 mx-2 transition-transform active:scale-90"
                        title="Xóa"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                  );
                })
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
          ) : filteredDevices.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">Không tìm thấy thiết bị nào</div>
          ) : (
            paginatedDevices.map((device, idx) => (
              <div key={device.id} className="p-3 hover:bg-slate-50 transition-colors active:bg-slate-100">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-slate-400 font-medium">{startIndex + idx + 1}.</span>
                      <span className="font-semibold text-sm text-slate-900 truncate">{device.name}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full flex-shrink-0 ${getStatusColor(device.status)}`}>
                        {device.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono text-indigo-600">{device.id}</span>
                      <span>•</span>
                      <span>{device.room}</span>
                      <span>•</span>
                      <span>{device.subject}</span>
                      <span>•</span>
                      <span className="font-bold">SL: {device.quantity || 1}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    <button
                      onClick={() => setShowQRModal(device.id)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                      title="Xem QR"
                    >
                      <QrCode className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => openEditModal(device)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                      title="Sửa"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(device.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Xóa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <PaginationControls />
      </div>

      {/* Add/Edit Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-500/75 transition-opacity" aria-hidden="true" onClick={() => { setShowAddModal(false); setEditingDevice(null); }}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="relative z-10 inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={handleSubmitDevice}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg leading-6 font-medium text-slate-900" id="modal-title">
                      {editingDevice ? 'Sửa thiết bị' : 'Thêm thiết bị mới'}
                    </h3>
                    <button type="button" onClick={() => { setShowAddModal(false); setEditingDevice(null); }} className="text-slate-400 hover:text-slate-600">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Tên thiết bị</label>
                      <input type="text" required value={formDevice.name} onChange={e => setFormDevice({ ...formDevice, name: e.target.value })} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Phòng (chọn phòng đã tạo)</label>
                      {rooms.length > 0 ? (
                        <select
                          required
                          value={`${formDevice.subject}|||${formDevice.room}`}
                          onChange={e => {
                            const [subject, room] = e.target.value.split('|||');
                            setFormDevice({ ...formDevice, subject: subject || '', room: room || '' });
                          }}
                          className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        >
                          <option value="|||">-- Chọn phòng --</option>
                          {rooms.map(r => (
                            <option key={r.id} value={`${r.subject}|||${r.name}`}>
                              {r.name} — {r.subject}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="mt-1 space-y-2">
                          <input type="text" required value={formDevice.subject} onChange={e => setFormDevice({ ...formDevice, subject: e.target.value })} placeholder="Bộ môn" className="block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                          <input type="text" required value={formDevice.room} onChange={e => setFormDevice({ ...formDevice, room: e.target.value })} placeholder="Phòng" className="block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                          <p className="text-xs text-amber-600">💡 Tạo phòng trước ở mục "Phòng" để chọn nhanh hơn</p>
                        </div>
                      )}
                    </div>
                    {editingDevice && (
                      <div>
                        <label className="block text-sm font-medium text-slate-700">Tình trạng</label>
                        <select value={formDevice.status} onChange={e => setFormDevice({ ...formDevice, status: e.target.value })} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                          <option value="Tốt">Tốt</option>
                          <option value="Hỏng nhẹ">Hỏng nhẹ</option>
                          <option value="Hỏng">Hỏng</option>
                          <option value="Cần bảo trì">Cần bảo trì</option>
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Số lượng</label>
                      <input type="number" min={1} required value={formDevice.quantity} onChange={e => setFormDevice({ ...formDevice, quantity: parseInt(e.target.value) || 1 })} className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm">
                    {editingDevice ? 'Cập nhật' : 'Lưu'}
                  </button>
                  <button type="button" onClick={() => { setShowAddModal(false); setEditingDevice(null); }} className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                    Hủy
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-500/75 transition-opacity" aria-hidden="true" onClick={() => setShowQRModal(null)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div className="relative z-10 inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-sm sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 flex flex-col items-center">
                <h3 className="text-lg leading-6 font-medium text-slate-900 mb-4" id="modal-title">
                  Mã QR Thiết bị: {showQRModal}
                </h3>
                <div className="bg-white p-4 border-2 border-slate-100 rounded-xl shadow-sm">
                  <QRCodeSVG
                    value={`${window.location.origin}/device/${showQRModal}`}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <p className="mt-4 text-sm text-slate-500 text-center">
                  Quét mã này để mượn, trả hoặc kiểm kê thiết bị.
                </p>
              </div>
              <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button type="button" onClick={() => setShowQRModal(null)} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm">
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Custom Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[60] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-500/75 backdrop-blur-sm transition-opacity" aria-hidden="true" onClick={() => !isDeleting && setConfirmDeleteId(null)}></div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="relative inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-slate-200 animate-in zoom-in-95 duration-200">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-bold text-slate-900" id="modal-title">
                      Xác nhận xóa thiết bị?
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-slate-500">
                        Hành động này không thể hoàn tác. Thiết bị <span className="font-mono font-bold text-slate-700">{confirmDeleteId}</span> sẽ bị xóa vĩnh viễn khỏi danh sách quản lý.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                <button
                  type="button"
                  disabled={isDeleting}
                  className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm transition-all active:scale-95 disabled:opacity-50"
                  onClick={() => handleDelete(confirmDeleteId)}
                >
                  {isDeleting ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white mr-2"></div>
                      Đang xử lý...
                    </div>
                  ) : 'Xác nhận xóa'}
                </button>
                <button
                  type="button"
                  disabled={isDeleting}
                  className="mt-3 w-full inline-flex justify-center rounded-xl border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-all active:scale-95 disabled:opacity-50"
                  onClick={() => setConfirmDeleteId(null)}
                >
                  Hủy bỏ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
