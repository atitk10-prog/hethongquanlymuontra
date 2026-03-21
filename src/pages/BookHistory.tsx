import { useState } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../store/auth';
import { History, Search, BookOpen, AlertTriangle, Download } from 'lucide-react';
import { format } from 'date-fns';

export default function BookHistory() {
  const { books, bookBorrows } = useData();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Role-based filtering: teacher/student only see own borrows
  const managerRoles = ['admin', 'vice_principal', 'equipment', 'librarian'];
  const isManager = user && managerRoles.includes(user.role);
  const userBorrows = isManager ? bookBorrows : bookBorrows.filter(b => b.borrower === user?.name);
  const now = new Date();

  const getBookTitle = (bookId: string) => {
    const b = books.find(bk => bk.id === bookId);
    return b ? b.title : bookId;
  };

  const isOverdue = (dueDate: string, status: string) => {
    if (status !== 'Đang mượn' || !dueDate) return false;
    try { return now > new Date(dueDate); } catch { return false; }
  };

  // Sort by most recent first
  const sorted = [...userBorrows].sort((a, b) => {
    const da = a.borrow_date ? new Date(a.borrow_date).getTime() : 0;
    const db = b.borrow_date ? new Date(b.borrow_date).getTime() : 0;
    return db - da;
  });

  const filtered = sorted.filter(b => {
    const matchSearch = !search ||
      getBookTitle(b.book_id).toLowerCase().includes(search.toLowerCase()) ||
      b.borrower.toLowerCase().includes(search.toLowerCase()) ||
      b.id.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || b.status === filterStatus ||
      (filterStatus === 'Quá hạn' && isOverdue(b.due_date, b.status));
    return matchSearch && matchStatus;
  });

  const stats = {
    total: userBorrows.length,
    active: userBorrows.filter(b => b.status === 'Đang mượn').length,
    returned: userBorrows.filter(b => b.status === 'Đã trả').length,
    overdue: userBorrows.filter(b => isOverdue(b.due_date, b.status)).length,
  };

  const handleExport = () => {
    const headers = ['STT', 'Mã', 'Sách', 'Người mượn', 'Loại', 'Lớp', 'Ngày mượn', 'Hạn trả', 'Ngày trả', 'Trạng thái', 'Ghi chú'];
    const rows = filtered.map((b, i) => [
      i + 1, b.id, getBookTitle(b.book_id), b.borrower, b.borrower_type,
      b.class, b.borrow_date ? format(new Date(b.borrow_date), 'dd/MM/yyyy') : '',
      b.due_date ? format(new Date(b.due_date), 'dd/MM/yyyy') : '',
      b.return_date ? format(new Date(b.return_date), 'dd/MM/yyyy') : '',
      b.status, b.note
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lich_su_muon_sach_${format(now, 'yyyyMMdd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <History className="h-6 w-6 text-indigo-600" />
            Lịch sử mượn sách
          </h1>
          <p className="text-sm text-slate-500 mt-1">Theo dõi lịch sử mượn trả sách thư viện</p>
        </div>
        <button onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all">
          <Download className="h-4 w-4" /> Xuất CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Tổng lượt', value: stats.total, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Đang mượn', value: stats.active, color: 'text-blue-600 bg-blue-50' },
          { label: 'Đã trả', value: stats.returned, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Quá hạn', value: stats.overdue, color: 'text-red-600 bg-red-50' },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-xl px-4 py-3 text-center`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs font-medium opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Tìm theo tên sách, người mượn, mã..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 transition-all" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500">
          <option value="">Tất cả trạng thái</option>
          <option value="Đang mượn">Đang mượn</option>
          <option value="Đã trả">Đã trả</option>
          <option value="Quá hạn">Quá hạn</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sách</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Người mượn</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Ngày mượn</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Hạn trả</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  Chưa có lịch sử mượn sách
                </td></tr>
              ) : filtered.map(b => {
                const overdue = isOverdue(b.due_date, b.status);
                return (
                  <tr key={b.id} className={`hover:bg-slate-50 transition-colors ${overdue ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                          <BookOpen className="h-4 w-4 text-indigo-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{getBookTitle(b.book_id)}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{b.id} • SL: {b.quantity}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-900">{b.borrower}</p>
                      <p className="text-xs text-slate-400">{b.borrower_type === 'HS' ? 'Học sinh' : 'Giáo viên'} {b.class && `• ${b.class}`}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 hidden sm:table-cell">
                      {b.borrow_date ? format(new Date(b.borrow_date), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm hidden md:table-cell">
                      <span className={overdue ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                        {b.due_date ? format(new Date(b.due_date), 'dd/MM/yyyy') : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {overdue ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-full bg-red-100 text-red-700">
                          <AlertTriangle className="h-3 w-3" /> Quá hạn
                        </span>
                      ) : (
                        <span className={`px-2 py-1 text-[10px] font-semibold rounded-full ${
                          b.status === 'Đang mượn' ? 'bg-blue-100 text-blue-700' :
                          b.status === 'Đã trả' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {b.status}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
