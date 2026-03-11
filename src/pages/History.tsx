import { useState } from 'react';
import { useAuth } from '../store/auth';
import { useData } from '../context/DataContext';
import { format } from 'date-fns';
import { Search, Download } from 'lucide-react';

// Helper: Google Sheets sometimes auto-converts class text (e.g. "10A1") to dates
const sanitizeClass = (val: string): string => {
  if (!val) return '';
  const s = String(val);
  if (s.includes('T') && (s.includes('Z') || s.includes('+')) && s.length > 15) {
    // It's an ISO date — strip it, keep whatever text remains
    return s.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, '').replace(/^[\s\-–]*/, '').trim() || s.substring(0, 10);
  }
  return s;
};

export default function History() {
  const { borrowHistory, isLoading } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const { user } = useAuth();

  // Sort by borrow_date descending
  const sortedHistory = [...borrowHistory].sort(
    (a, b) => new Date(b.borrow_date).getTime() - new Date(a.borrow_date).getTime()
  );

  const filteredHistory = sortedHistory.filter(h => {
    // Nếu là giáo viên, chỉ thấy lịch sử của mình
    if (user?.role === 'teacher' && h.teacher !== user.name) {
      return false;
    }

    // Áp dụng bộ lọc tìm kiếm
    return h.device_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.teacher.toLowerCase().includes(searchTerm.toLowerCase()) ||
      h.class.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const exportCSV = () => {
    if (filteredHistory.length === 0) return;

    const headers = ['Mã GD', 'Mã TB', 'Giáo viên', 'Lớp/Tiết', 'TG Mượn', 'TG Trả', 'Trạng thái', 'Ghi chú'];
    const csvData = filteredHistory.map(r => [
      r.id, r.device_id, r.teacher, `${r.class} - T${r.period}`,
      format(new Date(r.borrow_date), 'dd/MM/yyyy HH:mm'),
      r.return_date ? format(new Date(r.return_date), 'dd/MM/yyyy HH:mm') : '',
      r.status, r.note || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `LichSuMuonTra_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Lịch sử mượn trả</h1>
        {user?.role === 'vice_principal' && (
          <button
            onClick={exportCSV}
            className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto"
          >
            <Download className="-ml-1 mr-2 h-5 w-5 text-slate-400" aria-hidden="true" />
            Xuất báo cáo
          </button>
        )}
      </div>

      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
        <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="h-5 w-5 text-slate-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              className="block w-full rounded-md border-slate-300 pl-10 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm py-2 border"
              placeholder="Tìm kiếm theo mã TB, giáo viên, lớp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Mã GD</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Mã TB</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Giáo viên</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Lớp/Tiết</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Thời gian mượn</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Thời gian trả</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {isLoading ? (
                [...Array(3)].map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-16"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-28"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-200 rounded w-20"></div></td>
                  </tr>
                ))
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-slate-500">Không có dữ liệu</td>
                </tr>
              ) : (
                filteredHistory.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{record.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-indigo-600">{record.device_id}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{record.teacher}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{sanitizeClass(record.class)} - T{record.period}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {format(new Date(record.borrow_date), 'dd/MM/yyyy HH:mm')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                      {record.return_date ? format(new Date(record.return_date), 'dd/MM/yyyy HH:mm') : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${record.status === 'Đang mượn' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                        {record.status}
                      </span>
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
            filteredHistory.map((record) => (
              <div key={record.id} className="p-3 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-indigo-600 font-medium">{record.device_id}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${record.status === 'Đang mượn' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                        }`}>
                        {record.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {record.teacher} • Lớp {sanitizeClass(record.class)} - T{record.period}
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
      </div>
    </div>
  );
}
