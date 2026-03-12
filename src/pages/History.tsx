import { useState } from 'react';
import { useAuth } from '../store/auth';
import { useData } from '../context/DataContext';
import { format } from 'date-fns';
import { exportToXlsx } from '../utils/exportXlsx';
import { Search, Download, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

// Helper: Google Sheets sometimes auto-converts class text (e.g. "10A1") to dates
const sanitizeClass = (val: string): string => {
  if (!val) return '';
  const s = String(val);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return '';
  return s;
};

const formatClassPeriod = (cls: string, period: string): string => {
  const c = sanitizeClass(cls);
  const p = String(period || '').trim();
  if (c && p) return `${c} - T${p}`;
  if (c) return c;
  if (p) return `T${p}`;
  return '-';
};

const ITEMS_PER_PAGE = 15;

type QRModalData = {
  teacher: string;
  device_id: string;
  borrow_id: string;
} | null;

export default function History() {
  const { borrowHistory, devices, rooms, isLoading } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [qrModal, setQrModal] = useState<QRModalData>(null);
  const { user } = useAuth();

  const getDeviceName = (deviceId: string) => {
    const d = devices.find(dev => dev.id === deviceId);
    return d ? d.name : deviceId;
  };

  const sortedHistory = [...borrowHistory].sort(
    (a, b) => new Date(b.borrow_date).getTime() - new Date(a.borrow_date).getTime()
  );

  // Build set of device IDs in managed rooms
  const managedDeviceIds = (() => {
    if (!user?.managed_rooms) return null;
    const managedIds = user.managed_rooms.split(',').map(s => s.trim()).filter(Boolean);
    if (managedIds.length === 0) return null;
    const managedRoomNames = rooms.filter(r => managedIds.includes(r.id)).map(r => r.name);
    return new Set(devices.filter(d => managedRoomNames.includes(d.room)).map(d => d.id));
  })();

  const filteredHistory = sortedHistory.filter(h => {
    // Teachers without managed_rooms: only own borrows
    if (user?.role === 'teacher' && !user.managed_rooms && h.teacher !== user.name) return false;
    // Users with managed_rooms: only devices in those rooms
    if (managedDeviceIds && !managedDeviceIds.has(h.device_id)) return false;
    return h.device_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.teacher.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.class.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
  const paginatedData = filteredHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  const handleSearch = (term: string) => { setSearchTerm(term); setCurrentPage(1); };

  const exportExcel = () => {
    if (filteredHistory.length === 0) return;
    const headers = ['STT', 'Mã GD', 'Mã TB', 'Tên thiết bị', 'Giáo viên', 'Lớp/Tiết', 'TG Mượn', 'TG Trả', 'Trạng thái', 'Ghi chú'];
    const rows = filteredHistory.map((r, i) => [
      i + 1, r.id, r.device_id, getDeviceName(r.device_id), r.teacher, formatClassPeriod(r.class, r.period),
      format(new Date(r.borrow_date), 'dd/MM/yyyy HH:mm'),
      r.return_date ? format(new Date(r.return_date), 'dd/MM/yyyy HH:mm') : '',
      r.status, r.note || ''
    ]);
    exportToXlsx('Lịch sử mượn trả', headers, rows, `LichSuMuonTra_${format(new Date(), 'yyyyMMdd')}.xls`);
  };

  const handleStatusClick = (record: typeof borrowHistory[0]) => {
    if (record.status === 'Đang mượn' || record.status === 'Trả thiếu') {
      setQrModal({
        teacher: record.teacher,
        device_id: record.device_id,
        borrow_id: record.id,
      });
    }
  };

  // Count active borrows for the teacher in QR modal
  const activeBorrowsForTeacher = qrModal
    ? borrowHistory.filter(b => b.teacher === qrModal.teacher && (b.status === 'Đang mượn' || b.status === 'Trả thiếu'))
    : [];

  const StatusBadge = ({ record }: { record: typeof borrowHistory[0] }) => {
    const isActive = record.status === 'Đang mượn' || record.status === 'Trả thiếu';
    const colorClass = record.status === 'Đang mượn'
      ? 'bg-blue-100 text-blue-800 hover:bg-blue-200'
      : record.status === 'Trả thiếu'
        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
        : 'bg-emerald-100 text-emerald-800';

    return (
      <span
        onClick={isActive ? (e) => { e.stopPropagation(); handleStatusClick(record); } : undefined}
        className={`px-2 inline-flex items-center gap-1 text-xs leading-5 font-semibold rounded-full transition-colors ${colorClass} ${isActive ? 'cursor-pointer' : ''}`}
      >
        {isActive && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
        {record.status}
      </span>
    );
  };

  const PaginationControls = () => {
    if (filteredHistory.length <= ITEMS_PER_PAGE) return null;
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
        <div className="text-xs text-slate-500">
          {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredHistory.length)} / {filteredHistory.length}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safeCurrentPage <= 1}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-medium text-slate-700 px-2">{safeCurrentPage}/{totalPages}</span>
          <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safeCurrentPage >= totalPages}
            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Lịch sử mượn trả</h1>
        {user?.role !== 'teacher' && (
          <button onClick={exportExcel}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50">
            <Download className="-ml-1 mr-2 h-5 w-5 text-slate-400" />
            Xuất báo cáo
          </button>
        )}
      </div>

      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-slate-400" />
            </div>
            <input type="text"
              className="block w-full rounded-md border-slate-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2 border"
              placeholder="Tìm kiếm theo mã TB, giáo viên, lớp..."
              value={searchTerm} onChange={(e) => handleSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase w-12">STT</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Mã GD</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Thiết bị</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Giáo viên</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Lớp/Tiết</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Thời gian mượn</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Thời gian trả</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {[...Array(8)].map((_, j) => (
                      <td key={j} className="px-4 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                    ))}
                  </tr>
                ))
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-4 text-center text-sm text-slate-500">Không có dữ liệu</td>
                </tr>
              ) : (
                paginatedData.map((record, idx) => (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-400 text-center">{startIndex + idx + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{record.id}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-slate-900">{getDeviceName(record.device_id)}</div>
                      <div className="text-xs text-slate-400 font-mono">{record.device_id}</div>
                      {(record.missing_qty || 0) > 0 && (
                        <div className="text-xs text-red-500 font-medium">Mất {record.missing_qty}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{record.teacher}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{formatClassPeriod(record.class, record.period)}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {format(new Date(record.borrow_date), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {record.return_date ? format(new Date(record.return_date), 'dd/MM/yyyy HH:mm') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge record={record} />
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
          ) : paginatedData.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">Không có dữ liệu</div>
          ) : (
            paginatedData.map((record, idx) => (
              <div key={record.id} className="p-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">{startIndex + idx + 1}.</span>
                      <span className="font-mono text-sm text-indigo-600 font-medium">{record.device_id}</span>
                      <StatusBadge record={record} />
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {record.teacher} • {formatClassPeriod(record.class, record.period)}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                  <span>Mượn: {format(new Date(record.borrow_date), 'dd/MM HH:mm')}</span>
                  {record.return_date && (
                    <span>Trả: {format(new Date(record.return_date), 'dd/MM HH:mm')}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <PaginationControls />
      </div>

      {/* QR Return Modal */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setQrModal(null)}>
          <div className="bg-white rounded-2xl p-5 max-w-sm mx-4 w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-slate-900">QR Trả thiết bị</h3>
              <button onClick={() => setQrModal(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Tab: Individual device vs All by teacher */}
            <div className="space-y-4">
              {/* Individual device QR */}
              <div className="border border-slate-200 rounded-xl p-4 text-center">
                <p className="text-xs font-medium text-slate-500 mb-2">Trả thiết bị này</p>
                <p className="text-sm font-semibold text-slate-900 mb-1">{getDeviceName(qrModal.device_id)}</p>
                <p className="text-xs font-mono text-indigo-500 mb-3">{qrModal.device_id}</p>
                <div className="inline-block bg-white p-3 rounded-lg border border-slate-100">
                  <QRCodeSVG
                    value={`${window.location.origin}/device/${qrModal.device_id}`}
                    size={150}
                    level="H"
                    includeMargin
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Quét để mở trang trả thiết bị này</p>
              </div>

              {/* Shared teacher return QR */}
              <div className="border border-indigo-200 bg-indigo-50/50 rounded-xl p-4 text-center">
                <p className="text-xs font-medium text-indigo-600 mb-2">Trả TẤT CẢ thiết bị của {qrModal.teacher}</p>
                <p className="text-xs text-slate-500 mb-3">
                  Đang mượn {activeBorrowsForTeacher.length} thiết bị
                </p>
                <div className="inline-block bg-white p-3 rounded-lg border border-indigo-100">
                  <QRCodeSVG
                    value={`${window.location.origin}/return/${encodeURIComponent(qrModal.teacher)}`}
                    size={150}
                    level="H"
                    includeMargin
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Quét để trả tất cả thiết bị đang mượn</p>
                {activeBorrowsForTeacher.length > 0 && (
                  <div className="mt-2 text-left">
                    {activeBorrowsForTeacher.map(b => (
                      <div key={b.id} className="text-[11px] text-slate-500 py-0.5">
                        • <span className="font-mono text-indigo-500">{b.device_id}</span> {getDeviceName(b.device_id)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
