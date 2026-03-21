import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { useAuth } from '../store/auth';
import { api } from '../services/api';
import { BookOpen, Search, ArrowLeftRight, AlertTriangle, Check, Clock, X, ClipboardCheck, Plus, Minus, ShoppingCart, User } from 'lucide-react';
import { format, addDays } from 'date-fns';

const fmtDate = (d: Date) => format(d, 'yyyy-MM-dd');

type CartItem = { book_id: string; title: string; author: string; category: string; qty: number; maxQty: number };

export default function BookBorrow() {
  const { books, bookBorrows, users, refreshBooks, refreshBookBorrows } = useData();
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'borrow' | 'active' | 'pending'>(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('tab');
    if (t === 'active' || t === 'pending') return t;
    return 'borrow';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Role check: librarian/admin/BGH are managers
  const isManager = user && ['librarian', 'admin', 'vice_principal'].includes(user.role);

  // Borrow form — cart based
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedBorrowerId, setSelectedBorrowerId] = useState(user?.id || '');
  const [borrowerSearch, setBorrowerSearch] = useState('');
  const [showBorrowerDropdown, setShowBorrowerDropdown] = useState(false);
  const [borrowerType, setBorrowerType] = useState<'GV' | 'HS'>(user?.role === 'student' ? 'HS' : 'GV');
  const [borrowClass, setBorrowClass] = useState(user?.department || '');
  const [borrowNote, setBorrowNote] = useState('');
  const [borrowDate, setBorrowDate] = useState(fmtDate(new Date()));
  const [dueDate, setDueDate] = useState(fmtDate(addDays(new Date(), user?.role === 'student' ? 14 : 30)));

  // Return form state
  const [returnBorrowId, setReturnBorrowId] = useState('');
  const [returnData, setReturnData] = useState({
    returned_qty: 0, damaged_qty: 0, lost_qty: 0, condition_note: ''
  });

  // Data filtering by role
  const allActiveBorrows = bookBorrows.filter(b => b.status === 'Đang mượn' || b.status === 'Trả thiếu');
  const activeBorrows = isManager ? allActiveBorrows : allActiveBorrows.filter(b => b.borrower === user?.name);
  const pendingBorrows = bookBorrows.filter(b => b.status === 'Chờ duyệt');
  const myPending = isManager ? pendingBorrows : pendingBorrows.filter(b => b.borrower === user?.name);

  const now = new Date();

  // User list for borrower selector (managers only)
  const userList = useMemo(() => {
    return (users || []).filter(u => u.role && u.name);
  }, [users]);

  const selectedBorrower = userList.find(u => u.id === selectedBorrowerId);
  const borrowerName = isManager ? (selectedBorrower?.name || user?.name || '') : (user?.name || '');

  const filteredUsers = useMemo(() => {
    if (!borrowerSearch) return userList;
    const q = borrowerSearch.toLowerCase();
    return userList.filter(u =>
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
    );
  }, [userList, borrowerSearch]);

  const getRoleName = (role: string) => {
    switch (role) {
      case 'teacher': return 'GV';
      case 'student': return 'HS';
      case 'equipment': return 'TB';
      case 'leader': return 'TT';
      case 'vice_principal': return 'BGH';
      case 'admin': return 'QTV';
      case 'librarian': return 'TV';
      default: return role;
    }
  };

  const getBookTitle = (bookId: string) => {
    const b = books.find(bk => bk.id === bookId);
    return b ? b.title : bookId;
  };

  const getBookBorrowedQty = (bookId: string) => {
    return allActiveBorrows.filter(b => b.book_id === bookId).reduce((s, b) => {
      const qty = b.quantity || 1;
      const returned = b.returned_qty || 0;
      return s + (qty - returned);
    }, 0);
  };

  const isOverdue = (d: string) => {
    if (!d) return false;
    try { return now > new Date(d); } catch { return false; }
  };

  // Show all books by default, filter by search if provided
  const filteredBooks = books.filter(b => {
    const inCart = cart.some(c => c.book_id === b.id);
    if (inCart) return false;
    if (!search) return true;
    return b.title.toLowerCase().includes(search.toLowerCase()) || b.author.toLowerCase().includes(search.toLowerCase());
  });

  const addToCart = (b: typeof books[0]) => {
    const borrowed = getBookBorrowedQty(b.id);
    const available = (b.quantity || 1) - borrowed;
    if (available <= 0) return;
    setCart(prev => [...prev, { book_id: b.id, title: b.title, author: b.author, category: b.category, qty: 1, maxQty: available }]);
    setSearch('');
  };

  const updateCartQty = (bookId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.book_id !== bookId) return c;
      const newQty = Math.max(1, Math.min(c.maxQty, c.qty + delta));
      return { ...c, qty: newQty };
    }));
  };

  const removeFromCart = (bookId: string) => {
    setCart(prev => prev.filter(c => c.book_id !== bookId));
  };

  const handleTypeChange = (type: 'GV' | 'HS') => {
    setBorrowerType(type);
    const base = borrowDate ? new Date(borrowDate) : new Date();
    setDueDate(fmtDate(addDays(base, type === 'GV' ? 30 : 14)));
  };

  const handleBorrow = async () => {
    if (cart.length === 0 || !borrowerName.trim()) {
      setError('Vui lòng thêm sách và chọn người mượn');
      return;
    }
    setIsLoading(true);
    setError('');
    setSuccess('');
    const borrowStatus = isManager ? 'Đang mượn' : 'Chờ duyệt';
    try {
      if (cart.length === 1) {
        await api.borrowBook({
          book_id: cart[0].book_id,
          borrower: borrowerName.trim(),
          borrower_type: borrowerType,
          class: borrowClass,
          quantity: cart[0].qty,
          note: borrowNote,
          borrow_date: borrowDate,
          due_date: dueDate,
          status: borrowStatus
        });
      } else {
        await api.borrowMultipleBooks({
          borrower: borrowerName.trim(),
          borrower_type: borrowerType,
          class: borrowClass,
          note: borrowNote,
          status: borrowStatus,
          items: cart.map(c => ({ book_id: c.book_id, quantity: c.qty }))
        });
      }
      setSuccess(isManager
        ? `Cho mượn thành công ${cart.length} đầu sách (${cart.reduce((s, c) => s + c.qty, 0)} cuốn)!`
        : `Đã gửi yêu cầu mượn ${cart.length} đầu sách — chờ thủ thư duyệt!`
      );
      setCart([]);
      setBorrowNote('');
      setBorrowClass('');
      await Promise.all([refreshBooks(), refreshBookBorrows()]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (borrowId: string) => {
    setIsLoading(true);
    try {
      await api.approveBookBorrow(borrowId);
      setSuccess('Đã duyệt phiếu mượn: ' + getBookTitle(bookBorrows.find(b => b.id === borrowId)?.book_id || ''));
      await Promise.all([refreshBooks(), refreshBookBorrows()]);
    } catch (e: any) { setError(e.message); }
    finally { setIsLoading(false); }
  };

  const handleReject = async (borrowId: string) => {
    setIsLoading(true);
    try {
      await api.rejectBookBorrow(borrowId);
      setSuccess('Đã từ chối phiếu mượn');
      await refreshBookBorrows();
    } catch (e: any) { setError(e.message); }
    finally { setIsLoading(false); }
  };

  const selectBorrowForReturn = (borrowId: string) => {
    const borrow = activeBorrows.find(b => b.id === borrowId);
    if (!borrow) return;
    const remaining = (borrow.quantity || 1) - (borrow.returned_qty || 0);
    setReturnBorrowId(borrowId);
    setReturnData({ returned_qty: remaining, damaged_qty: 0, lost_qty: 0, condition_note: '' });
  };

  const handleReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnBorrowId) return;
    setIsLoading(true);
    setError('');
    try {
      await api.returnBook({
        borrow_id: returnBorrowId,
        returned_qty: returnData.returned_qty,
        damaged_qty: returnData.damaged_qty,
        lost_qty: returnData.lost_qty,
        condition_note: returnData.condition_note
      });
      const parts: string[] = [];
      if (returnData.returned_qty > 0) parts.push(`Trả tốt ${returnData.returned_qty}`);
      if (returnData.damaged_qty > 0) parts.push(`hỏng ${returnData.damaged_qty}`);
      if (returnData.lost_qty > 0) parts.push(`mất ${returnData.lost_qty}`);
      setSuccess(parts.join(', ') + ' cuốn');
      setReturnBorrowId('');
      await Promise.all([refreshBooks(), refreshBookBorrows()]);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ArrowLeftRight className="h-6 w-6 text-indigo-600" />
          Mượn / Trả sách
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isManager ? 'Quản lý cho mượn và trả sách thư viện' : 'Tìm sách và gửi yêu cầu mượn — thủ thư sẽ duyệt'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <button onClick={() => { setTab('borrow'); setReturnBorrowId(''); }}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${tab === 'borrow' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <BookOpen className="h-4 w-4" /> {isManager ? 'Cho mượn' : 'Mượn sách'}
          {cart.length > 0 && <span className="ml-1 bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{cart.length}</span>}
        </button>
        <button onClick={() => setTab('active')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${tab === 'active' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <ClipboardCheck className="h-4 w-4" /> Đang mượn ({activeBorrows.length})
        </button>
        {(isManager || myPending.length > 0) && (
          <button onClick={() => setTab('pending')}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${tab === 'pending' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Clock className="h-4 w-4" /> Chờ duyệt ({isManager ? pendingBorrows.length : myPending.length})
          </button>
        )}
      </div>

      {/* Messages */}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl text-sm flex items-center gap-2">
          <Check className="h-4 w-4 flex-shrink-0" /> {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button onClick={() => setError('')} className="flex-shrink-0"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* ========= TAB MƯỢN ========= */}
      {tab === 'borrow' && (
        <div className="space-y-4">
          {/* Borrower selector - only for managers */}
          {isManager && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
              <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-500" />
                Người mượn <span className="text-red-500">*</span>
              </h2>

              {selectedBorrower ? (
                <div className="flex items-center gap-3 px-3 py-2.5 bg-indigo-50 rounded-lg border border-indigo-200">
                  <div className="h-8 w-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {selectedBorrower.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900">{selectedBorrower.name}</div>
                    <div className="text-[11px] text-slate-500">{selectedBorrower.email} • {getRoleName(selectedBorrower.role)}</div>
                  </div>
                  <button onClick={() => { setSelectedBorrowerId(''); setShowBorrowerDropdown(true); }} className="text-indigo-400 hover:text-indigo-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="text" value={borrowerSearch}
                    onChange={e => { setBorrowerSearch(e.target.value); setShowBorrowerDropdown(true); }}
                    onFocus={() => setShowBorrowerDropdown(true)}
                    placeholder="Tìm theo tên, email hoặc mã người dùng..."
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
                  {showBorrowerDropdown && (
                    <div className="absolute z-20 w-full mt-1 max-h-48 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg divide-y divide-slate-100">
                      {filteredUsers.length === 0 ? (
                        <div className="px-3 py-3 text-sm text-slate-400 text-center">Không tìm thấy</div>
                      ) : filteredUsers.map(u => (
                        <button key={u.id} onClick={() => {
                          setSelectedBorrowerId(u.id);
                          setBorrowerSearch('');
                          setShowBorrowerDropdown(false);
                          if (u.role === 'student') { setBorrowerType('HS'); setDueDate(fmtDate(addDays(new Date(borrowDate), 14))); }
                          else { setBorrowerType('GV'); setDueDate(fmtDate(addDays(new Date(borrowDate), 30))); }
                        }}
                          className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 flex items-center gap-3 transition-colors">
                          <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {u.name.charAt(0)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">{u.name}</div>
                            <div className="text-[11px] text-slate-400">{u.email}</div>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">{getRoleName(u.role)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Lớp</label>
                  <input type="text" value={borrowClass} onChange={e => setBorrowClass(e.target.value)} placeholder="VD: 10A1"
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
            </div>
          )}

          {/* Search & Add books */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-indigo-500" />
              Chọn sách cần mượn
            </h2>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Tìm sách theo tên hoặc tác giả..." className="w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500" />
            </div>

            {/* Book list — show all by default */}
            {filteredBooks.length > 0 && (
              <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {filteredBooks.slice(0, 50).map(b => {
                  const borrowed = getBookBorrowedQty(b.id);
                  const available = (b.quantity || 1) - borrowed;
                  return (
                    <button key={b.id} onClick={() => addToCart(b)}
                      className={`w-full text-left px-3 py-2.5 text-sm hover:bg-indigo-50 flex justify-between items-center transition-colors ${available <= 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                      disabled={available <= 0}>
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-indigo-500" />
                        <div>
                          <span className="font-medium text-slate-900">{b.title}</span>
                          <span className="text-slate-400 ml-2 text-xs">{b.author} • {b.category}</span>
                        </div>
                      </div>
                      <span className={`text-xs font-semibold ${available > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        Còn {available}/{b.quantity || 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {filteredBooks.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-2">Không tìm thấy sách</p>
            )}

            {/* Cart */}
            {cart.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Danh sách mượn ({cart.length} đầu sách)</h3>
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                  {cart.map((item, i) => (
                    <div key={item.book_id} className="flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-slate-50">
                      <span className="text-xs text-slate-400 font-mono w-5">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 truncate">{item.title}</div>
                        <div className="text-[11px] text-slate-400">{item.author} • {item.category}</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => updateCartQty(item.book_id, -1)} disabled={item.qty <= 1}
                          className="h-7 w-7 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center disabled:opacity-30 transition-colors">
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold text-indigo-700">{item.qty}</span>
                        <button onClick={() => updateCartQty(item.book_id, 1)} disabled={item.qty >= item.maxQty}
                          className="h-7 w-7 rounded-md bg-slate-100 hover:bg-slate-200 flex items-center justify-center disabled:opacity-30 transition-colors">
                          <Plus className="h-3 w-3" />
                        </button>
                        <span className="text-[10px] text-slate-400 w-8">/{item.maxQty}</span>
                      </div>
                      <button onClick={() => removeFromCart(item.book_id)} className="text-slate-300 hover:text-red-500 transition-colors">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Date & Submit */}
          {cart.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Ngày mượn</label>
                  <input type="date" value={borrowDate}
                    onChange={e => {
                      setBorrowDate(e.target.value);
                      setDueDate(fmtDate(addDays(new Date(e.target.value), borrowerType === 'GV' ? 30 : 14)));
                    }}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Hạn trả</label>
                  <input type="date" value={dueDate} min={borrowDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú</label>
                <input type="text" value={borrowNote} onChange={e => setBorrowNote(e.target.value)} placeholder="Ghi chú"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
              </div>

              <button onClick={handleBorrow} disabled={isLoading || cart.length === 0 || !borrowerName.trim()}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl font-medium text-sm shadow-lg shadow-indigo-500/20 hover:shadow-xl disabled:opacity-50 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                {isLoading ? 'Đang xử lý...' : (
                  <>
                    <Check className="h-4 w-4" />
                    {isManager ? 'Xác nhận cho mượn' : 'Gửi yêu cầu mượn'} {cart.length} đầu sách ({cart.reduce((s, c) => s + c.qty, 0)} cuốn)
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ========= TAB CHỜ DUYỆT ========= */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {(isManager ? pendingBorrows : myPending).length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
              <Clock className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">Không có yêu cầu chờ duyệt</p>
            </div>
          ) : (isManager ? pendingBorrows : myPending).map(b => (
            <div key={b.id} className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
              <div className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">{getBookTitle(b.book_id)}</span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-800">Chờ duyệt</span>
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-800">SL: {b.quantity}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    <span>👤 {b.borrower}</span>
                    <span> • {b.borrower_type === 'HS' ? 'Học sinh' : 'Giáo viên'}</span>
                    {b.class && <span> • Lớp {b.class}</span>}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Yêu cầu: {b.borrow_date ? format(new Date(b.borrow_date), 'dd/MM/yyyy') : '—'}
                  </div>
                </div>
                {isManager && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => handleApprove(b.id)} disabled={isLoading}
                      className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-all disabled:opacity-50">
                      ✅ Duyệt
                    </button>
                    <button onClick={() => handleReject(b.id)} disabled={isLoading}
                      className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-all disabled:opacity-50">
                      ❌ Từ chối
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========= TAB ĐANG MƯỢN ========= */}
      {tab === 'active' && (
        <div className="space-y-3">
          {activeBorrows.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
              <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500">{isManager ? 'Không có sách nào đang mượn' : 'Bạn chưa mượn sách nào'}</p>
            </div>
          ) : activeBorrows.map(b => {
            const overdue = isOverdue(b.due_date);
            const remaining = (b.quantity || 1) - (b.returned_qty || 0);
            const isSelected = returnBorrowId === b.id;
            return (
              <div key={b.id} className={`bg-white rounded-xl shadow-sm border transition-all ${isSelected ? 'border-indigo-400 ring-2 ring-indigo-100' : overdue ? 'border-red-300 bg-red-50/50' : 'border-slate-200'}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-slate-900">{getBookTitle(b.book_id)}</span>
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-blue-100 text-blue-800">SL: {b.quantity}</span>
                        {b.status === 'Trả thiếu' && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-100 text-amber-800">Còn {remaining} chưa trả</span>
                        )}
                        {overdue && (
                          <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-100 text-red-700 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Quá hạn
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 mt-1 space-x-2">
                        <span>👤 {b.borrower}</span>
                        <span>• {b.borrower_type === 'HS' ? 'Học sinh' : 'Giáo viên'}</span>
                        {b.class && <span>• Lớp {b.class}</span>}
                      </div>
                      <div className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                        <Clock className="h-3 w-3" />
                        Mượn: {b.borrow_date ? format(new Date(b.borrow_date), 'dd/MM/yyyy') : '—'}
                        <span className={overdue ? 'text-red-600 font-semibold' : ''}>
                          → Hạn: {b.due_date ? format(new Date(b.due_date), 'dd/MM/yyyy') : '—'}
                        </span>
                      </div>
                    </div>
                    {isManager && (
                      <button onClick={() => isSelected ? setReturnBorrowId('') : selectBorrowForReturn(b.id)} disabled={isLoading}
                        className={`px-3 py-2 text-xs font-semibold rounded-lg active:scale-95 transition-all flex-shrink-0 disabled:opacity-50 ${isSelected ? 'bg-slate-200 text-slate-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}>
                        {isSelected ? 'Đóng' : 'Trả sách'}
                      </button>
                    )}
                  </div>
                </div>

                {/* Return form */}
                {isSelected && (() => {
                  return (
                    <form onSubmit={handleReturn} className="border-t border-indigo-200 p-4 bg-indigo-50/50 space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-emerald-700 mb-1">Trả tốt</label>
                          <input type="number" min={0} max={remaining}
                            value={returnData.returned_qty}
                            onChange={e => {
                              const val = Math.max(0, Math.min(remaining, parseInt(e.target.value) || 0));
                              const maxOther = remaining - val;
                              setReturnData(prev => ({
                                ...prev, returned_qty: val,
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
                                ...prev, damaged_qty: val,
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

                      {(returnData.damaged_qty > 0 || returnData.lost_qty > 0) && (
                        <div>
                          <label className="block text-xs font-medium text-slate-700 flex items-center mb-1">
                            <AlertTriangle className="h-3.5 w-3.5 mr-1 text-amber-500" />
                            Ghi chú hỏng/mất <span className="text-red-500 ml-1">*</span>
                          </label>
                          <input type="text" required value={returnData.condition_note}
                            onChange={e => setReturnData({ ...returnData, condition_note: e.target.value })}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
                            placeholder="VD: 1 cuốn rách bìa, 1 cuốn mất" />
                        </div>
                      )}

                      <button type="submit"
                        disabled={isLoading || (returnData.returned_qty + returnData.damaged_qty + returnData.lost_qty === 0)}
                        className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all active:scale-[0.98]">
                        {isLoading ? 'Đang xử lý...' : (() => {
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
