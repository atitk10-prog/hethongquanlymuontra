import React, { useState } from 'react';
import { api, type Room } from '../services/api';
import { useData } from '../context/DataContext';
import { useAuth } from '../store/auth';
import { Plus, Search, Edit, Trash2, MapPin, X, AlertTriangle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

export default function Rooms() {
  const { rooms, setRooms, devices, isLoading, refreshRooms } = useData();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<Room | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showQR, setShowQR] = useState<Room | null>(null);

  const [formRoom, setFormRoom] = useState({
    name: '',
    subject: '',
    description: ''
  });

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const openAddModal = () => {
    setEditingRoom(null);
    setFormRoom({ name: '', subject: '', description: '' });
    setShowAddModal(true);
  };

  const openEditModal = (room: Room) => {
    setEditingRoom(room);
    setFormRoom({ name: room.name, subject: room.subject, description: room.description || '' });
    setShowAddModal(true);
  };

  const getDeviceCount = (room: Room) => {
    return devices.filter(d => d.room === room.name && d.subject === room.subject).length;
  };

  const getAvailableCount = (room: Room) => {
    return devices.filter(d => d.room === room.name && d.subject === room.subject && d.status === 'Tốt').length;
  };

  const getQRValue = (room: Room) => {
    return `${window.location.origin}/room/${encodeURIComponent(room.subject)}/${encodeURIComponent(room.name)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingRoom) {
        await api.updateRoom(editingRoom.id, formRoom);
        showToast('Đã cập nhật phòng');
      } else {
        const result = await api.addRoom(formRoom);
        setRooms(prev => [...prev, { id: result.id, ...formRoom }]);
        showToast('Đã thêm phòng mới');
      }
      setShowAddModal(false);
      refreshRooms();
    } catch (error: any) {
      showToast(error.message || 'Lỗi khi lưu', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteId) return;
    setIsSubmitting(true);
    try {
      await api.deleteRoom(confirmDeleteId.id);
      setRooms(prev => prev.filter(r => r.id !== confirmDeleteId.id));
      showToast('Đã xóa phòng');
      refreshRooms();
    } catch (error: any) {
      showToast(error.message || 'Lỗi khi xóa', 'error');
    } finally {
      setIsSubmitting(false);
      setConfirmDeleteId(null);
    }
  };

  // Equipment staff: filter by managed rooms
  const visibleRooms = (() => {
    if (user?.role === 'equipment' && user.managed_rooms) {
      const managedIds = user.managed_rooms.split(',').map(s => s.trim()).filter(Boolean);
      if (managedIds.length > 0) return rooms.filter(r => managedIds.includes(r.id));
    }
    return rooms;
  })();

  const filteredRooms = visibleRooms.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý phòng</h1>
          <p className="text-sm text-slate-500 mt-1">Tạo phòng trước, sau đó gán thiết bị vào phòng</p>
        </div>
        <button
          onClick={openAddModal}
          className="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <Plus className="-ml-1 mr-2 h-5 w-5" />
          Thêm phòng
        </button>
      </div>

      {/* Search */}
      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="relative max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input
              type="text"
              className="block w-full rounded-md border-slate-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2 border"
              placeholder="Tìm theo tên phòng, bộ môn..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Room Cards Grid */}
        <div className="p-4">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse bg-slate-100 rounded-xl h-40"></div>
              ))}
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-10 text-slate-500">
              {rooms.length === 0 ? 'Chưa có phòng nào. Bấm "Thêm phòng" để bắt đầu.' : 'Không tìm thấy phòng'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRooms.map(room => (
                <div key={room.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900">{room.name}</h3>
                        <p className="text-sm text-slate-500">{room.subject}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => setShowQR(room)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Xem QR">
                        <MapPin className="h-4 w-4" />
                      </button>
                      <button onClick={() => openEditModal(room)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Sửa">
                        <Edit className="h-4 w-4" />
                      </button>
                      <button onClick={() => setConfirmDeleteId(room)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Xóa">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {room.description && (
                    <p className="text-xs text-slate-400 mt-2">{room.description}</p>
                  )}

                  <div className="mt-3 flex gap-2">
                    <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs">
                      {getDeviceCount(room)} thiết bị
                    </span>
                    <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs">
                      {getAvailableCount(room)} sẵn sàng
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[100] px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'}`}>
          {toast.message}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-500/75 backdrop-blur-sm transition-opacity" onClick={() => !isSubmitting && setShowAddModal(false)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="relative inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-slate-200">
              <form onSubmit={handleSubmit}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="flex items-center mb-4">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center mr-3">
                      <MapPin className="h-5 w-5 text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {editingRoom ? 'Sửa phòng' : 'Thêm phòng mới'}
                    </h3>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Tên phòng <span className="text-red-500">*</span></label>
                      <input
                        type="text" required
                        value={formRoom.name}
                        onChange={e => setFormRoom({ ...formRoom, name: e.target.value })}
                        className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="VD: Phòng Tin 3, Phòng Lab 1..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Bộ môn / Tổ <span className="text-red-500">*</span></label>
                      <input
                        type="text" required
                        value={formRoom.subject}
                        onChange={e => setFormRoom({ ...formRoom, subject: e.target.value })}
                        className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="VD: Tin học, Toán, Vật lý..."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700">Mô tả</label>
                      <input
                        type="text"
                        value={formRoom.description}
                        onChange={e => setFormRoom({ ...formRoom, description: e.target.value })}
                        className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                        placeholder="VD: Phòng thực hành máy tính tầng 3"
                      />
                    </div>
                  </div>
                </div>
                <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                  <button type="submit" disabled={isSubmitting}
                    className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50">
                    {isSubmitting ? 'Đang lưu...' : 'Lưu'}
                  </button>
                  <button type="button" disabled={isSubmitting} onClick={() => setShowAddModal(false)}
                    className="mt-3 w-full inline-flex justify-center rounded-xl border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                    Hủy
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* QR Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-slate-500/75 backdrop-blur-sm" onClick={() => setShowQR(null)}></div>
            <div className="relative bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full text-center">
              <button onClick={() => setShowQR(null)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
              <h3 className="font-bold text-lg text-slate-900 mb-1">{showQR.name}</h3>
              <p className="text-sm text-slate-500 mb-4">{showQR.subject}</p>
              <div className="flex justify-center mb-4">
                <QRCodeSVG value={getQRValue(showQR)} size={200} level="M" includeMargin={true} />
              </div>
              <p className="text-xs text-slate-400 break-all">{getQRValue(showQR)}</p>
              <div className="mt-3 flex gap-2 justify-center text-xs">
                <span className="px-2 py-1 bg-slate-100 rounded-full">{getDeviceCount(showQR)} thiết bị</span>
                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full">{getAvailableCount(showQR)} sẵn sàng</span>
              </div>
              <button
                onClick={() => window.print()}
                className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700"
              >
                In QR này
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[60] overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4">
            <div className="fixed inset-0 bg-slate-500/75 backdrop-blur-sm" onClick={() => !isSubmitting && setConfirmDeleteId(null)}></div>
            <div className="relative bg-white rounded-2xl p-6 shadow-xl max-w-sm w-full">
              <div className="flex items-center gap-3 mb-3">
                <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <h3 className="font-bold text-slate-900">Xóa phòng?</h3>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Xóa phòng <span className="font-bold text-slate-700">{confirmDeleteId.name}</span> ({confirmDeleteId.subject})?
                {getDeviceCount(confirmDeleteId) > 0 && (
                  <span className="block mt-1 text-amber-600 font-medium">Phòng đang có {getDeviceCount(confirmDeleteId)} thiết bị</span>
                )}
              </p>
              <div className="flex gap-2 justify-end">
                <button disabled={isSubmitting} onClick={() => setConfirmDeleteId(null)}
                  className="px-4 py-2 border border-slate-300 rounded-xl text-sm text-slate-700 hover:bg-slate-50">
                  Hủy
                </button>
                <button disabled={isSubmitting} onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm hover:bg-red-700 disabled:opacity-50">
                  {isSubmitting ? 'Đang xóa...' : 'Xác nhận xóa'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
