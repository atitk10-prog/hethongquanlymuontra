import { useState } from 'react';
import { useData } from '../context/DataContext';
import { api } from '../services/api';
import { useAuth } from '../store/auth';
import { BookOpen, Search, ShoppingCart, Plus, Minus, X, CheckCircle, Library, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, addDays } from 'date-fns';

type CartItem = {
  book_id: string;
  title: string;
  author: string;
  available: number;
  quantity: number;
};

const DEFAULT_CATEGORIES = ['Sách giáo khoa', 'Tham khảo', 'Khoa học', 'Văn học', 'Ngoại ngữ', 'Tin học', 'Lịch sử', 'Khác'];

export default function LibraryBrowse() {
  const { books, bookBorrows, refreshBooks, refreshBookBorrows } = useData();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  // Borrower info
  const [borrower, setBorrower] = useState(user?.name || '');
  const [borrowerType, setBorrowerType] = useState<'GV' | 'HS'>('GV');
  const [borrowClass, setBorrowClass] = useState('');
  const [borrowNote, setBorrowNote] = useState('');
  const [borrowDate, setBorrowDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...books.map(b => b.category).filter(Boolean)])];

  // Calculate available qty for each book
  const getAvailable = (bookId: string, totalQty: number) => {
    const borrowed = bookBorrows
      .filter(b => b.book_id === bookId && (b.status === 'Đang mượn' || b.status === 'Trả thiếu'))
      .reduce((s, b) => s + ((b.quantity || 1) - (b.returned_qty || 0)), 0);
    return totalQty - borrowed;
  };

  const filtered = books.filter(b => {
    const matchSearch = !search ||
      b.title.toLowerCase().includes(search.toLowerCase()) ||
      b.author.toLowerCase().includes(search.toLowerCase()) ||
      b.id.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCategory || b.category === filterCategory;
    const available = getAvailable(b.id, b.quantity);
    return matchSearch && matchCat && available > 0;
  });

  const addToCart = (book: typeof books[0]) => {
    const available = getAvailable(book.id, book.quantity);
    if (available <= 0) return;

    setCart(prev => {
      const existing = prev.find(c => c.book_id === book.id);
      if (existing) {
        if (existing.quantity >= available) return prev;
        return prev.map(c => c.book_id === book.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { book_id: book.id, title: book.title, author: book.author, available, quantity: 1 }];
    });
  };

  const updateCartQty = (bookId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.book_id !== bookId) return c;
      const newQty = Math.max(1, Math.min(c.available, c.quantity + delta));
      return { ...c, quantity: newQty };
    }));
  };

  const removeFromCart = (bookId: string) => {
    setCart(prev => prev.filter(c => c.book_id !== bookId));
  };

  const totalCartQty = cart.reduce((s, c) => s + c.quantity, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!borrower.trim() || cart.length === 0) return;

    setIsSubmitting(true);
    setError('');
    try {
      await api.borrowMultipleBooks({
        borrower: borrower.trim(),
        borrower_type: borrowerType,
        class: borrowClass,
        note: borrowNote,
        items: cart.map(c => ({ book_id: c.book_id, quantity: c.quantity }))
      });
      setSuccess(`Mượn thành công ${totalCartQty} cuốn (${cart.length} đầu sách)!`);
      setCart([]);
      setShowCart(false);
      await Promise.all([refreshBooks(), refreshBookBorrows()]);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inCart = (bookId: string) => cart.find(c => c.book_id === bookId);

  return (
    <div className="max-w-2xl mx-auto space-y-4 animate-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-700">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <Library className="h-5 w-5 text-indigo-600" />
              Thư viện — Duyệt & Mượn
            </h1>
            <p className="text-xs text-slate-500">Chọn sách → Thêm vào giỏ → Mượn tất cả</p>
          </div>
        </div>
        {cart.length > 0 && (
          <button onClick={() => setShowCart(!showCart)}
            className="relative px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Giỏ ({totalCartQty})
            <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {cart.length}
            </span>
          </button>
        )}
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center text-emerald-700">
          <CheckCircle className="h-5 w-5 mr-3 flex-shrink-0" />
          {success}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
      )}

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input type="text" placeholder="Tìm sách..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500" />
        </div>
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-2.5 border border-slate-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-indigo-500">
          <option value="">Tất cả</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Book list */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-slate-400">
            <BookOpen className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Không tìm thấy sách còn trong kho</p>
          </div>
        ) : filtered.map(book => {
          const available = getAvailable(book.id, book.quantity);
          const cartItem = inCart(book.id);
          return (
            <div key={book.id}
              className={`bg-white rounded-xl border p-4 flex items-center gap-3 transition-all ${cartItem ? 'border-indigo-300 bg-indigo-50/30' : 'border-slate-200 hover:border-slate-300'}`}>
              <div className="h-12 w-12 rounded-lg bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center flex-shrink-0">
                <BookOpen className="h-5 w-5 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{book.title}</p>
                <p className="text-xs text-slate-500">{book.author || 'Chưa rõ tác giả'} • {book.category}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-semibold">Còn {available}</span>
                  {book.location && <span className="text-[10px] text-slate-400">{book.location}</span>}
                </div>
              </div>
              <div className="flex-shrink-0">
                {cartItem ? (
                  <div className="flex items-center gap-1">
                    <button onClick={() => { if (cartItem.quantity <= 1) removeFromCart(book.id); else updateCartQty(book.id, -1); }}
                      className="h-8 w-8 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center hover:bg-slate-300 transition-all">
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="w-8 text-center text-sm font-bold text-indigo-700">{cartItem.quantity}</span>
                    <button onClick={() => updateCartQty(book.id, 1)} disabled={cartItem.quantity >= available}
                      className="h-8 w-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-50 transition-all">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => addToCart(book)}
                    className="px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-semibold hover:bg-indigo-100 transition-all flex items-center gap-1">
                    <Plus className="h-3.5 w-3.5" /> Thêm
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart Panel — Slide up */}
      {showCart && cart.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowCart(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 pt-5 pb-3 border-b border-slate-100 flex items-center justify-between z-10">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-indigo-600" />
                Giỏ mượn ({totalCartQty} cuốn)
              </h3>
              <button onClick={() => setShowCart(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>

            {/* Cart items */}
            <div className="px-5 py-3 space-y-2">
              {cart.map(item => (
                <div key={item.book_id} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-medium text-slate-900 truncate">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.author}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { if (item.quantity <= 1) removeFromCart(item.book_id); else updateCartQty(item.book_id, -1); }}
                      className="h-7 w-7 rounded-md bg-slate-200 text-slate-600 flex items-center justify-center text-xs hover:bg-slate-300">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{item.quantity}</span>
                    <button onClick={() => updateCartQty(item.book_id, 1)} disabled={item.quantity >= item.available}
                      className="h-7 w-7 rounded-md bg-indigo-600 text-white flex items-center justify-center text-xs hover:bg-indigo-700 disabled:opacity-50">
                      <Plus className="h-3 w-3" />
                    </button>
                    <button onClick={() => removeFromCart(item.book_id)}
                      className="h-7 w-7 rounded-md text-red-400 hover:bg-red-50 hover:text-red-600 flex items-center justify-center ml-1">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Borrower form */}
            <form onSubmit={handleSubmit} className="px-5 pb-5 space-y-3 border-t border-slate-100 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Người mượn <span className="text-red-500">*</span></label>
                  <input type="text" required value={borrower} onChange={e => setBorrower(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="Họ tên" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Loại</label>
                  <select value={borrowerType} onChange={e => {
                    const t = e.target.value as 'GV' | 'HS';
                    setBorrowerType(t);
                    setDueDate(format(addDays(new Date(borrowDate), t === 'GV' ? 30 : 14), 'yyyy-MM-dd'));
                  }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500">
                    <option value="GV">Giáo viên</option>
                    <option value="HS">Học sinh</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Ngày mượn</label>
                  <input type="date" value={borrowDate}
                    onChange={e => {
                      setBorrowDate(e.target.value);
                      setDueDate(format(addDays(new Date(e.target.value), borrowerType === 'GV' ? 30 : 14), 'yyyy-MM-dd'));
                    }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Hạn trả</label>
                  <input type="date" value={dueDate} min={borrowDate}
                    onChange={e => setDueDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Lớp</label>
                  <input type="text" value={borrowClass} onChange={e => setBorrowClass(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" placeholder="10A1" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Ghi chú</label>
                  <input type="text" value={borrowNote} onChange={e => setBorrowNote(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>

              {error && <div className="text-red-600 text-xs bg-red-50 p-2 rounded-lg">{error}</div>}

              <button type="submit" disabled={isSubmitting || !borrower.trim() || cart.length === 0}
                className="w-full py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-xl disabled:opacity-50 transition-all active:scale-[0.98]">
                {isSubmitting ? 'Đang xử lý...' : `Mượn ${totalCartQty} cuốn (${cart.length} đầu sách)`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Floating cart button on mobile */}
      {cart.length > 0 && !showCart && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 sm:hidden">
          <button onClick={() => setShowCart(true)}
            className="px-6 py-3 bg-indigo-600 text-white rounded-full shadow-xl shadow-indigo-500/30 text-sm font-semibold flex items-center gap-2 active:scale-95 transition-all">
            <ShoppingCart className="h-4 w-4" />
            Giỏ mượn ({totalCartQty}) — Xác nhận
          </button>
        </div>
      )}
    </div>
  );
}
