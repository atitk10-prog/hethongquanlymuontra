import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type Book, type BookBorrow } from '../services/api';
import { useAuth } from '../store/auth';
import { useData } from '../context/DataContext';
import { ArrowLeft, CheckCircle, BookOpen, AlertTriangle, Clock, Package } from 'lucide-react';
import { format } from 'date-fns';

export default function BookAction() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refreshBooks, refreshBookBorrows, bookBorrows } = useData();

  const [book, setBook] = useState<Book | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Borrow form
  const [borrower, setBorrower] = useState(user?.name || '');
  const [borrowerType, setBorrowerType] = useState<'GV' | 'HS'>('GV');
  const [borrowClass, setBorrowClass] = useState('');
  const [borrowQty, setBorrowQty] = useState('1');
  const [borrowNote, setBorrowNote] = useState('');

  // Return form
  const [returnBorrowId, setReturnBorrowId] = useState('');
  const [returnData, setReturnData] = useState({
    returned_qty: 0,
    damaged_qty: 0,
    lost_qty: 0,
    condition_note: '',
    note: ''
  });

  const now = new Date();

  useEffect(() => {
    if (id) fetchBook(id);
  }, [id]);

  const fetchBook = async (bookId: string) => {
    try {
      const books = await api.getBooks();
      const found = books.find(b => b.id === bookId);
      if (!found) throw new Error('Không tìm thấy sách');
      setBook(found);
    } catch (err: any) {
      setError(err.message || 'Không tìm thấy sách');
    } finally {
      setIsLoading(false);
    }
  };

  // Active borrows for this book
  const activeBorrows = bookBorrows.filter(b => b.book_id === id && (b.status === 'Đang mượn' || b.status === 'Trả thiếu'));
  const borrowedQty = activeBorrows.reduce((s, b) => {
    const qty = b.quantity || 1;
    const returned = b.returned_qty || 0;
    return s + (qty - returned);
  }, 0);
  const lostQty = bookBorrows.filter(b => b.book_id === id).reduce((s, b) => s + (b.lost_qty || 0), 0);
  const totalQty = book?.quantity || 1;
  const availableQty = totalQty - borrowedQty;

  const isOverdue = (dueDate: string) => {
    if (!dueDate) return false;
    try { return now > new Date(dueDate); } catch { return false; }
  };

  const selectBorrowForReturn = (borrow: BookBorrow) => {
    const remaining = (borrow.quantity || 1) - (borrow.returned_qty || 0);
    setReturnBorrowId(borrow.id);
    setReturnData({
      returned_qty: remaining,
      damaged_qty: 0,
      lost_qty: 0,
      condition_note: '',
      note: ''
    });
  };

  const handleBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!book || !borrower.trim()) return;

    setIsSubmitting(true);
    setError('');
    try {
      await api.borrowBook({
        book_id: book.id,
        borrower: borrower.trim(),
        borrower_type: borrowerType,
        class: borrowClass,
        quantity: parseInt(borrowQty) || 1,
        note: borrowNote
      });
      setSuccess('Mượn sách thành công!');
      await Promise.all([refreshBooks(), refreshBookBorrows()]);
      if (id) fetchBook(id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnBorrowId) return;

    setIsSubmitting(true);
    setError('');
    try {
      await api.returnBook({
        borrow_id: returnBorrowId,
        returned_qty: returnData.returned_qty + returnData.damaged_qty,
        damaged_qty: returnData.damaged_qty,
        lost_qty: returnData.lost_qty,
        condition_note: returnData.condition_note,
        note: returnData.note
      });
      const parts: string[] = [];
      if (returnData.returned_qty > 0) parts.push(`Trả tốt ${returnData.returned_qty}`);
      if (returnData.damaged_qty > 0) parts.push(`hỏng ${returnData.damaged_qty}`);
      if (returnData.lost_qty > 0) parts.push(`mất ${returnData.lost_qty}`);
      setSuccess(parts.join(', ') + ' cuốn');
      setReturnBorrowId('');
      await Promise.all([refreshBooks(), refreshBookBorrows()]);
      if (id) fetchBook(id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto text-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent mx-auto mb-3" />
        <p className="text-sm text-slate-500">Đang tải thông tin sách...</p>
      </div>
    );
  }

  if (error && !book) {
    return (
      <div className="max-w-md mx-auto text-center py-10">
        <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-4">{error}</div>
        <button onClick={() => navigate('/scan')} className="text-indigo-600 hover:underline">
          Quay lại quét QR
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto space-y-6 animate-slide-up">
      <div className="flex items-center">
        <button onClick={() => navigate(-1)} className="mr-4 text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-6 w-6" />
        </button>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
          {activeBorrows.length > 0 ? 'Mượn / Trả sách' : 'Mượn sách'}
        </h1>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center text-emerald-700">
          <CheckCircle className="h-5 w-5 mr-3 flex-shrink-0" />
          {success}
        </div>
      )}

      {error && book && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Book Info */}
      <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-4 py-4 bg-gradient-to-r from-indigo-50 to-blue-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white shadow-sm flex items-center justify-center">
              <BookOpen className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">{book?.title}</h3>
              <p className="text-xs text-slate-500">{book?.author || 'Chưa rõ tác giả'} • {book?.category}</p>
            </div>
          </div>
        </div>
        <div className="p-4">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-400 text-xs">Mã sách</dt>
              <dd className="font-mono text-indigo-600 font-medium">{book?.id}</dd>
            </div>
            <div>
              <dt className="text-slate-400 text-xs">Vị trí</dt>
              <dd className="text-slate-700">{book?.location || '—'}</dd>
            </div>
          </dl>
          {/* Stock bar */}
          <div className="mt-4">
            <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
              {availableQty > 0 && (
                <div className="bg-emerald-500 h-full transition-all" style={{ width: `${(availableQty / totalQty) * 100}%` }} />
              )}
              {borrowedQty > 0 && (
                <div className="bg-blue-500 h-full transition-all" style={{ width: `${(borrowedQty / totalQty) * 100}%` }} />
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 text-center mt-2">
              <div className="bg-slate-50 rounded-lg p-2">
                <div className="text-lg font-bold text-slate-800">{totalQty}</div>
                <div className="text-[10px] text-slate-500">Tổng</div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-2">
                <div className="text-lg font-bold text-emerald-700">{availableQty}</div>
                <div className="text-[10px] text-emerald-600">Trong kho</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-2">
                <div className="text-lg font-bold text-blue-700">{borrowedQty}</div>
                <div className="text-[10px] text-blue-600">Đang mượn</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!success && (
        <>
          {/* Active Borrows — Select to Return */}
          {activeBorrows.length > 0 && (
            <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
                <h3 className="text-sm font-semibold text-blue-800 flex items-center">
                  <Package className="h-4 w-4 mr-2" />
                  Lượt mượn — Chọn để trả
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {activeBorrows.map(b => {
                  const remaining = (b.quantity || 1) - (b.returned_qty || 0);
                  const overdue = isOverdue(b.due_date);
                  return (
                    <button
                      key={b.id}
                      onClick={() => selectBorrowForReturn(b)}
                      className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${returnBorrowId === b.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : ''}`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="text-sm font-medium text-slate-900">
                            {b.borrower} — {b.quantity} cuốn
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {b.borrow_date ? format(new Date(b.borrow_date), 'dd/MM') : ''}
                            <span className={overdue ? 'text-red-600 font-semibold' : ''}>
                              → {b.due_date ? format(new Date(b.due_date), 'dd/MM') : ''}
                            </span>
                            {b.class && <span> • {b.class}</span>}
                            <span> • Còn {remaining} chưa trả</span>
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          b.status === 'Trả thiếu' ? 'bg-amber-100 text-amber-800' :
                          overdue ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {overdue ? 'Quá hạn' : b.status}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Return Form */}
          {returnBorrowId && (() => {
            const borrow = activeBorrows.find(b => b.id === returnBorrowId);
            const remaining = borrow ? (borrow.quantity || 1) - (borrow.returned_qty || 0) : 0;
            return (
              <form onSubmit={handleReturn} className="bg-white shadow-sm rounded-xl border border-slate-200 p-5 space-y-4">
                <h3 className="font-semibold text-slate-900">Trả sách</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-emerald-700 mb-1">Trả tốt</label>
                    <input type="number" min={0} max={remaining}
                      value={returnData.returned_qty}
                      onChange={e => {
                        const val = Math.max(0, Math.min(remaining, parseInt(e.target.value) || 0));
                        const maxOther = remaining - val;
                        setReturnData(prev => ({
                          ...prev,
                          returned_qty: val,
                          damaged_qty: Math.min(prev.damaged_qty, maxOther),
                          lost_qty: Math.min(prev.lost_qty, maxOther - Math.min(prev.damaged_qty, maxOther))
                        }));
                      }}
                      className="w-full border border-emerald-300 rounded-lg px-3 py-2 text-sm bg-emerald-50 focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-amber-700 mb-1">Hỏng</label>
                    <input type="number" min={0} max={remaining - returnData.returned_qty - returnData.lost_qty}
                      value={returnData.damaged_qty}
                      onChange={e => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setReturnData(prev => ({
                          ...prev,
                          damaged_qty: val,
                          lost_qty: Math.min(prev.lost_qty, remaining - prev.returned_qty - val)
                        }));
                      }}
                      className="w-full border border-amber-300 rounded-lg px-3 py-2 text-sm bg-amber-50 focus:ring-2 focus:ring-amber-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-red-700 mb-1">Mất</label>
                    <input type="number" min={0} max={remaining - returnData.returned_qty - returnData.damaged_qty}
                      value={returnData.lost_qty}
                      onChange={e => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setReturnData(prev => ({ ...prev, lost_qty: val }));
                      }}
                      className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm bg-red-50 focus:ring-2 focus:ring-red-500" />
                  </div>
                </div>
                <p className="text-xs text-slate-400">Tổng: {returnData.returned_qty + returnData.damaged_qty + returnData.lost_qty}/{remaining}</p>

                {(returnData.lost_qty > 0 || returnData.damaged_qty > 0) && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 flex items-center mb-1">
                      <AlertTriangle className="h-3.5 w-3.5 mr-1 text-amber-500" />
                      Ghi chú hỏng/mất <span className="text-red-500 ml-1">*</span>
                    </label>
                    <input type="text" required
                      value={returnData.condition_note}
                      onChange={e => setReturnData({ ...returnData, condition_note: e.target.value })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                      placeholder="VD: 1 cuốn rách bìa, 1 cuốn mất" />
                  </div>
                )}

                <button type="submit"
                  disabled={isSubmitting || (returnData.returned_qty + returnData.damaged_qty + returnData.lost_qty === 0)}
                  className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all active:scale-[0.98]">
                  {(() => {
                    const parts: string[] = [];
                    if (returnData.returned_qty > 0) parts.push(`Trả tốt ${returnData.returned_qty}`);
                    if (returnData.damaged_qty > 0) parts.push(`hỏng ${returnData.damaged_qty}`);
                    if (returnData.lost_qty > 0) parts.push(`mất ${returnData.lost_qty}`);
                    return parts.length > 0 ? parts.join(', ') : 'Chọn số lượng';
                  })()}
                </button>
              </form>
            );
          })()}

          {/* Borrow Form */}
          {availableQty > 0 && !returnBorrowId && (
            <form onSubmit={handleBorrow} className="bg-white shadow-sm rounded-xl border border-slate-200 p-5 space-y-4">
              <h3 className="font-semibold text-slate-900">Mượn sách</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Người mượn <span className="text-red-500">*</span></label>
                  <input type="text" required value={borrower} onChange={e => setBorrower(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Họ tên" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Loại</label>
                  <select value={borrowerType} onChange={e => setBorrowerType(e.target.value as any)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                    <option value="GV">Giáo viên (30 ngày)</option>
                    <option value="HS">Học sinh (14 ngày)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Lớp</label>
                  <input type="text" value={borrowClass} onChange={e => setBorrowClass(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="10A1" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">SL mượn</label>
                  <input type="number" min={1} max={Math.min(availableQty, 5)} value={borrowQty}
                    onChange={e => setBorrowQty(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                  <p className="text-[10px] text-slate-400 mt-0.5">Tối đa: {Math.min(availableQty, 5)}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Ghi chú</label>
                  <input type="text" value={borrowNote} onChange={e => setBorrowNote(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <button type="submit" disabled={isSubmitting || !borrower.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-xl disabled:opacity-50 transition-all active:scale-[0.98]">
                {isSubmitting ? 'Đang xử lý...' : `Mượn ${borrowQty} cuốn`}
              </button>
            </form>
          )}

          {availableQty <= 0 && activeBorrows.length === 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-700 text-sm text-center">
              Hết sách để mượn
            </div>
          )}
        </>
      )}

      {/* Quick navigate */}
      <div className="flex gap-2 text-center">
        <button onClick={() => navigate('/scan')}
          className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 transition-all">
          ← Quét tiếp
        </button>
        <button onClick={() => navigate('/library')}
          className="flex-1 py-2.5 bg-indigo-50 text-indigo-700 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-all">
          Duyệt kho sách
        </button>
      </div>
    </div>
  );
}
