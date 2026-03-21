import { useState } from 'react';
import { useData } from '../context/DataContext';
import { api } from '../services/api';
import { BookOpen, Plus, Search, Edit2, Trash2, X, Library, QrCode, Printer, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import type { Book } from '../services/api';

const DEFAULT_CATEGORIES = ['Sách giáo khoa', 'Tham khảo', 'Khoa học', 'Văn học', 'Ngoại ngữ', 'Tin học', 'Lịch sử', 'Khác'];

export default function Books() {
  const { books, refreshBooks } = useData();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editBook, setEditBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showQR, setShowQR] = useState<Book | null>(null);
  const [showBatchQR, setShowBatchQR] = useState(false);
  const [showLibraryQR, setShowLibraryQR] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [form, setForm] = useState({
    title: '', author: '', isbn: '', category: 'Sách giáo khoa',
    publisher: '', year: '', quantity: '1', location: ''
  });
  const [formError, setFormError] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Dynamic categories: defaults + from existing books
  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...books.map(b => b.category).filter(Boolean)])];

  const filtered = books.filter(b => {
    const matchSearch = !search || b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase()) || b.isbn.includes(search);
    const matchCat = !filterCategory || b.category === filterCategory;
    return matchSearch && matchCat;
  });

  const openAdd = () => {
    setEditBook(null);
    setForm({ title: '', author: '', isbn: '', category: 'Sách giáo khoa', publisher: '', year: '', quantity: '1', location: '' });
    setShowForm(true);
  };

  const openEdit = (book: Book) => {
    setEditBook(book);
    setForm({
      title: book.title, author: book.author, isbn: book.isbn, category: book.category,
      publisher: book.publisher, year: book.year, quantity: String(book.quantity), location: book.location
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    setIsLoading(true);
    setFormError('');
    try {
      if (editBook) {
        await api.updateBook(editBook.id, { ...form, quantity: parseInt(form.quantity) || 1 } as any);
      } else {
        await api.addBook({ ...form, quantity: parseInt(form.quantity) || 1 } as any);
      }
      await refreshBooks();
      setShowForm(false);
    } catch (e: any) {
      setFormError(e.message || 'Lỗi khi lưu sách');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleteLoading(true);
    try {
      await api.deleteBook(id);
      await refreshBooks();
      setDeleteConfirmId(null);
      showToast('Đã xóa sách thành công');
    } catch (e: any) {
      showToast(e.message || 'Lỗi khi xóa sách', 'error');
      setDeleteConfirmId(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Library className="h-6 w-6 text-indigo-600" />
            Kho sách thư viện
          </h1>
          <p className="text-sm text-slate-500 mt-1">Quản lý danh sách sách thư viện</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowLibraryQR(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-medium hover:bg-emerald-100 transition-all">
            <QrCode className="h-4 w-4" /> QR Thư viện
          </button>
          <button onClick={() => setShowBatchQR(true)} disabled={filtered.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all disabled:opacity-50">
            <Printer className="h-4 w-4" /> In QR ({filtered.length})
          </button>
          <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-xl transition-all active:scale-[0.98]">
            <Plus className="h-4 w-4" /> Thêm sách
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Tìm theo tên sách, tác giả, ISBN..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500">
          <option value="">Tất cả thể loại</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Đầu sách', value: books.length, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Tổng SL', value: books.reduce((s, b) => s + (b.quantity || 1), 0), color: 'text-blue-600 bg-blue-50' },
          { label: 'Thể loại', value: [...new Set(books.map(b => b.category))].length, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Kết quả', value: filtered.length, color: 'text-amber-600 bg-amber-50' },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-xl px-4 py-3 text-center`}>
            <div className="text-2xl font-bold">{s.value}</div>
            <div className="text-xs font-medium opacity-80">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Sách</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase hidden sm:table-cell">Thể loại</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase hidden md:table-cell">Vị trí</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">SL</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                  Chưa có sách nào
                </td></tr>
              ) : filtered.map(book => (
                <tr key={book.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center flex-shrink-0">
                        <BookOpen className="h-5 w-5 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{book.title}</p>
                        <p className="text-xs text-slate-500">{book.author || 'Chưa rõ tác giả'} {book.isbn && `• ISBN: ${book.isbn}`}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-slate-100 text-slate-700">{book.category}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500 hidden md:table-cell">{book.location || '—'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-semibold text-sm text-slate-900">{book.quantity}</span>
                  </td>
                    <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setShowQR(book)} className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all" title="Xem QR">
                        <QrCode className="h-4 w-4" />
                      </button>
                      <button onClick={() => openEdit(book)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button onClick={() => setDeleteConfirmId(book.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Form */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">{editBook ? 'Sửa sách' : 'Thêm sách mới'}</h3>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tên sách <span className="text-red-500">*</span></label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="Nhập tên sách" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tác giả</label>
                  <input type="text" value={form.author} onChange={e => setForm({ ...form, author: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Tác giả" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">ISBN</label>
                  <input type="text" value={form.isbn} onChange={e => setForm({ ...form, isbn: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="ISBN" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Thể loại</label>
                  <select value={form.category === '__custom__' ? '__custom__' : form.category}
                    onChange={e => {
                      if (e.target.value === '__custom__') {
                        setForm({ ...form, category: '__custom__' });
                        setCustomCategory('');
                      } else {
                        setForm({ ...form, category: e.target.value });
                      }
                    }}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500">
                    {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="__custom__">➕ Nhập thể loại mới...</option>
                  </select>
                  {form.category === '__custom__' && (
                    <input type="text" value={customCategory}
                      onChange={e => setCustomCategory(e.target.value)}
                      onBlur={() => { if (customCategory.trim()) setForm({ ...form, category: customCategory.trim() }); }}
                      className="w-full mt-2 border border-indigo-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500 bg-indigo-50"
                      placeholder="Nhập tên thể loại mới" autoFocus />
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Số lượng</label>
                  <input type="number" min={1} value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nhà xuất bản</label>
                  <input type="text" value={form.publisher} onChange={e => setForm({ ...form, publisher: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="NXB" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Năm XB</label>
                  <input type="text" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="2025" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vị trí kệ</label>
                <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="VD: Kệ A3-2" />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-slate-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-all">Hủy</button>
              <button onClick={handleSave} disabled={isLoading || !form.title.trim()}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20 hover:shadow-xl disabled:opacity-50 transition-all active:scale-[0.98]">
                {isLoading ? 'Đang lưu...' : editBook ? 'Cập nhật' : 'Thêm sách'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Single QR Modal */}
      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowQR(null)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 text-center max-w-xs" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Mã QR Sách</h3>
              <button onClick={() => setShowQR(null)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="bg-white p-4 rounded-xl border-2 border-indigo-100 inline-block">
              <QRCodeSVG value={`${window.location.origin}/book/${showQR.id}`} size={180} level="H" includeMargin />
            </div>
            <p className="text-sm font-semibold text-slate-900 mt-3">{showQR.title}</p>
            <p className="text-xs text-slate-500 font-mono">{showQR.id}</p>
            <button onClick={() => {
              const printWindow = window.open('', '_blank');
              if (printWindow) {
                printWindow.document.write(`<html><head><title>QR - ${showQR.title}</title><style>body{display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:sans-serif;}.qr-card{text-align:center;padding:20px;border:2px solid #e2e8f0;border-radius:12px;}.qr-card h3{margin:10px 0 5px;font-size:14px;}.qr-card p{margin:0;font-size:11px;color:#64748b;font-family:monospace;}</style></head><body><div class="qr-card"><img src="data:image/svg+xml;base64,${btoa(document.querySelector('#single-qr-svg')?.outerHTML || '')}" width="200" height="200"/><h3>${showQR.title}</h3><p>${showQR.id}</p></div></body></html>`);
                printWindow.document.close();
                printWindow.print();
              }
            }} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all">
              <Printer className="h-4 w-4 inline-block mr-1" /> In
            </button>
            <div id="single-qr-svg" className="hidden">
              <QRCodeSVG value={`${window.location.origin}/book/${showQR.id}`} size={200} level="H" includeMargin />
            </div>
          </div>
        </div>
      )}

      {/* Batch QR Print */}
      {showBatchQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowBatchQR(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">In mã QR sách ({filtered.length})</h3>
              <div className="flex items-center gap-2">
                <button onClick={() => {
                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
                    const cards = filtered.map(b => `<div class="qr-card"><svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="white"/><text x="60" y="60" text-anchor="middle" font-size="10">${b.id}</text></svg><h3>${b.title}</h3><p>${b.id}${b.author ? ' • ' + b.author : ''}</p></div>`).join('');
                    printWindow.document.write(`<html><head><title>QR Sách</title><style>body{font-family:sans-serif;}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:20px;}.qr-card{text-align:center;padding:12px;border:1px solid #e2e8f0;border-radius:8px;page-break-inside:avoid;}.qr-card h3{margin:8px 0 2px;font-size:11px;}.qr-card p{margin:0;font-size:9px;color:#64748b;}</style></head><body><div class="grid">${cards}</div></body></html>`);
                    printWindow.document.close();
                    printWindow.print();
                  }
                }} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all">
                  <Printer className="h-4 w-4 inline-block mr-1" /> In tất cả
                </button>
                <button onClick={() => setShowBatchQR(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map(b => (
                <div key={b.id} className="text-center p-3 border border-slate-200 rounded-xl hover:border-indigo-200 transition-all">
                  <QRCodeSVG value={`${window.location.origin}/book/${b.id}`} size={100} level="M" includeMargin />
                  <p className="text-xs font-medium text-slate-900 truncate mt-2">{b.title}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{b.id}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Library QR Modal */}
      {showLibraryQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowLibraryQR(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 text-center max-w-xs" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">QR Thư viện chung</h3>
              <button onClick={() => setShowLibraryQR(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-xs text-slate-500 mb-4">Quét mã này để duyệt toàn bộ kho sách và mượn nhiều cuốn</p>
            <div className="bg-white p-4 rounded-xl border-2 border-emerald-100 inline-block">
              <QRCodeSVG value={`${window.location.origin}/library`} size={200} level="H" includeMargin />
            </div>
            <p className="text-sm font-semibold text-emerald-700 mt-3">Thư viện — Duyệt & Mượn</p>
            <p className="text-[10px] text-slate-400 font-mono mt-1">{window.location.origin}/library</p>
            <button onClick={() => {
              const printWindow = window.open('', '_blank');
              if (printWindow) {
                printWindow.document.write(`<html><head><title>QR Thư viện</title><style>body{display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:sans-serif;}.qr-card{text-align:center;padding:30px;border:3px solid #10b981;border-radius:16px;}.qr-card h3{margin:15px 0 5px;font-size:18px;color:#065f46;}.qr-card p{margin:5px 0;font-size:12px;color:#64748b;}</style></head><body><div class="qr-card"><img src="data:image/svg+xml;base64,${btoa(document.querySelector('#library-qr-svg svg')?.outerHTML || '')}" width="250" height="250"/><h3>THƯ VIỆN — DUYỆT & MƯỢN</h3><p>Quét mã QR để xem sách và mượn</p></div></body></html>`);
                printWindow.document.close();
                printWindow.print();
              }
            }} className="mt-4 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-all">
              <Printer className="h-4 w-4 inline-block mr-1" /> In QR Thư viện
            </button>
            <div id="library-qr-svg" className="hidden">
              <QRCodeSVG value={`${window.location.origin}/library`} size={250} level="H" includeMargin />
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
            <CheckCircle2 className={`h-5 w-5 ${toast.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`} />
            <span className="font-medium text-sm">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-slate-500/75 backdrop-blur-sm transition-opacity" onClick={() => !deleteLoading && setDeleteConfirmId(null)}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="relative inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-slate-200">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-bold text-slate-900">Xác nhận xóa sách?</h3>
                    <div className="mt-2">
                      <p className="text-sm text-slate-500">
                        Hành động này không thể hoàn tác. Sách <span className="font-bold text-slate-700">{books.find(b => b.id === deleteConfirmId)?.title || deleteConfirmId}</span> sẽ bị xóa vĩnh viễn khỏi kho.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                <button type="button" disabled={deleteLoading}
                  className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 sm:ml-3 sm:w-auto sm:text-sm transition-all active:scale-95 disabled:opacity-50"
                  onClick={() => handleDelete(deleteConfirmId)}>
                  {deleteLoading ? (
                    <div className="flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white mr-2"></div>
                      Đang xử lý...
                    </div>
                  ) : 'Xác nhận xóa'}
                </button>
                <button type="button" disabled={deleteLoading}
                  className="mt-3 w-full inline-flex justify-center rounded-xl border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-all active:scale-95 disabled:opacity-50"
                  onClick={() => setDeleteConfirmId(null)}>
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
