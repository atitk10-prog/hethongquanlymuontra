import { useState, useEffect, useRef, useCallback } from 'react';
import { useData } from '../context/DataContext';
import {
  ClipboardCheck, BarChart3, ScanLine, BookOpen, Check, AlertTriangle,
  Camera, ImagePlus, RefreshCw, FlipHorizontal, Printer, ChevronDown, ChevronUp,
  CheckCircle, XCircle, AlertCircle, Package
} from 'lucide-react';
import { api, type Book } from '../services/api';

export default function BookInventory() {
  const { books, bookBorrows } = useData();
  const [tab, setTab] = useState<'report' | 'scan'>('report');

  // QR scan state
  const [scannedBook, setScannedBook] = useState<Book | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanSuccess, setScanSuccess] = useState<string | null>(null);
  const [invStatus, setInvStatus] = useState('Đủ');
  const [invNote, setInvNote] = useState('');
  const [invActualQty, setInvActualQty] = useState(0);
  const [isScanning, setIsScanning] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(true);
  const [cameraReady, setCameraReady] = useState(false);

  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const hasScanned = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Report: expand categories
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  // Calculations for report
  const activeBorrows = bookBorrows.filter(b => b.status === 'Đang mượn' || b.status === 'Trả thiếu');

  const getBorrowedQty = (bookId: string) => {
    return activeBorrows.filter(b => b.book_id === bookId).reduce((s, b) => {
      return s + ((b.quantity || 1) - (b.returned_qty || 0));
    }, 0);
  };

  const totalBooks = books.length;
  const totalQty = books.reduce((s, b) => s + (b.quantity || 1), 0);
  const totalBorrowed = books.reduce((s, b) => s + getBorrowedQty(b.id), 0);
  const totalAvailable = totalQty - totalBorrowed;

  const totalDamaged = bookBorrows.reduce((s, b) => s + (b.damaged_qty || 0), 0);
  const totalLost = bookBorrows.reduce((s, b) => s + (b.lost_qty || 0), 0);

  // Group by category
  const categories = [...new Set(books.map(b => b.category).filter(Boolean))];
  const categoryStats = categories.map(cat => {
    const catBooks = books.filter(b => b.category === cat);
    const qty = catBooks.reduce((s, b) => s + (b.quantity || 1), 0);
    const borrowed = catBooks.reduce((s, b) => s + getBorrowedQty(b.id), 0);
    return { category: cat, count: catBooks.length, qty, borrowed, available: qty - borrowed, books: catBooks };
  }).sort((a, b) => b.qty - a.qty);

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  // Print report
  const handlePrint = () => {
    const rows = categoryStats.map(c =>
      `<tr><td>${c.category}</td><td style="text-align:center">${c.count}</td><td style="text-align:center">${c.qty}</td><td style="text-align:center">${c.borrowed}</td><td style="text-align:center">${c.available}</td></tr>`
    ).join('');
    const pw = window.open('', '_blank');
    if (pw) {
      pw.document.write(`<html><head><title>Báo cáo kiểm kê thư viện</title><style>body{font-family:sans-serif;padding:30px}h2{text-align:center;margin-bottom:5px}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #ccc;padding:8px;font-size:13px}th{background:#f0f0f0;font-weight:600}.summary{display:flex;gap:20px;margin:15px 0;justify-content:center}.stat{text-align:center;padding:10px 20px;border:1px solid #ddd;border-radius:8px}.stat .val{font-size:22px;font-weight:bold}.stat .lbl{font-size:11px;color:#666}</style></head><body><h2>BÁO CÁO KIỂM KÊ THƯ VIỆN</h2><p style="text-align:center;color:#666;font-size:12px">Ngày: ${new Date().toLocaleDateString('vi-VN')}</p><div class="summary"><div class="stat"><div class="val">${totalBooks}</div><div class="lbl">Đầu sách</div></div><div class="stat"><div class="val">${totalQty}</div><div class="lbl">Tổng SL</div></div><div class="stat"><div class="val">${totalBorrowed}</div><div class="lbl">Đang mượn</div></div><div class="stat"><div class="val">${totalAvailable}</div><div class="lbl">Tồn kho</div></div></div><table><thead><tr><th>Thể loại</th><th>Đầu sách</th><th>Tổng SL</th><th>Đang mượn</th><th>Tồn kho</th></tr></thead><tbody>${rows}<tr style="font-weight:bold;background:#f8f8f8"><td>Tổng cộng</td><td style="text-align:center">${totalBooks}</td><td style="text-align:center">${totalQty}</td><td style="text-align:center">${totalBorrowed}</td><td style="text-align:center">${totalAvailable}</td></tr></tbody></table>${(totalDamaged > 0 || totalLost > 0) ? `<p style="margin-top:15px;color:#b91c1c;font-size:13px">Sách hỏng: ${totalDamaged} | Sách mất: ${totalLost}</p>` : ''}</body></html>`);
      pw.document.close();
      pw.print();
    }
  };

  // QR Scan logic
  const handleScanResult = useCallback(async (decodedText: string) => {
    if (hasScanned.current || !mountedRef.current) return;
    hasScanned.current = true;

    try {
      if (scannerRef.current) {
        await scannerRef.current.stop().catch(() => {});
      }
    } catch { /* ignore */ }

    setCameraReady(false);
    setIsScanning(false);

    try {
      let bookId = '';
      if (decodedText.includes('/book/')) {
        const parts = decodedText.split('/book/');
        if (parts.length > 1) bookId = parts[1].trim();
      } else {
        bookId = decodedText.trim();
      }

      const found = books.find(b => b.id === bookId);
      if (!found) throw new Error('Không tìm thấy sách: ' + bookId);
      setScannedBook(found);
      setInvActualQty(found.quantity || 1);
      setInvStatus('Đủ');
      setInvNote('');
      setScanError(null);
    } catch (e: any) {
      setScanError(e.message || 'Không tìm thấy sách');
      setScannedBook(null);
    }
  }, [books]);

  const startScanner = useCallback(async (facing: 'environment' | 'user') => {
    if (!mountedRef.current) return;

    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* ignore */ }
      scannerRef.current = null;
    }

    setCameraStarting(true);
    setScanError(null);
    setCameraReady(false);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      await new Promise(resolve => setTimeout(resolve, 300));
      if (!mountedRef.current) return;

      const el = document.getElementById('reader-book-inventory');
      if (!el) {
        setScanError('Không thể khởi tạo scanner.');
        setCameraStarting(false);
        return;
      }

      const scanner = new Html5Qrcode('reader-book-inventory');
      scannerRef.current = scanner;

      const containerWidth = containerRef.current?.offsetWidth || 300;
      const qrboxSize = Math.min(Math.floor(containerWidth * 0.65), 250);

      await scanner.start(
        { facingMode: facing },
        { fps: 10, qrbox: { width: qrboxSize, height: qrboxSize }, aspectRatio: 1 },
        (decodedText: string) => handleScanResult(decodedText),
        () => {}
      );

      if (mountedRef.current) {
        setCameraReady(true);
        setCameraStarting(false);
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      setCameraStarting(false);
      const errStr = String(err);
      if (errStr.includes('NotAllowedError') || errStr.includes('Permission')) {
        setScanError('Vui lòng cho phép truy cập camera.');
      } else if (errStr.includes('NotFoundError')) {
        setScanError('Không tìm thấy camera.');
      } else {
        setScanError('Không thể bật camera. Hãy thử chọn ảnh QR.');
      }
    }
  }, [handleScanResult]);

  useEffect(() => {
    if (tab !== 'scan') return;
    mountedRef.current = true;
    hasScanned.current = false;

    if (!isScanning) return;

    const timer = setTimeout(() => {
      startScanner(facingMode);
    }, 500);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      try {
        if (scannerRef.current) {
          scannerRef.current.stop().catch(() => {});
          scannerRef.current = null;
        }
      } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isScanning, tab]);

  const handleSwitchCamera = async () => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    await startScanner(newFacing);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanError(null);

    try {
      if (scannerRef.current && cameraReady) {
        try { await scannerRef.current.stop(); } catch { /* ignore */ }
        setCameraReady(false);
      }

      const { Html5Qrcode } = await import('html5-qrcode');
      const tempEl = document.getElementById('reader-book-inv-file');
      if (!tempEl) return;

      const scanner = new Html5Qrcode('reader-book-inv-file');
      const result = await scanner.scanFile(file, true);
      handleScanResult(result);
    } catch {
      setScanError('Không tìm thấy mã QR trong ảnh.');
      startScanner(facingMode);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleScanAgain = () => {
    setScannedBook(null);
    setScanError(null);
    setScanSuccess(null);
    setInvStatus('Đủ');
    setInvNote('');
    hasScanned.current = false;
    setIsScanning(true);
  };

  const handleUpdateInventory = async () => {
    if (!scannedBook) return;
    setIsLoading(true);

    try {
      // Update book status/quantity if needed
      if (invStatus === 'Thiếu') {
        await api.updateBook(scannedBook.id, { quantity: invActualQty });
      } else if (invStatus === 'Hỏng') {
        await api.updateBook(scannedBook.id, { quantity: invActualQty });
      }

      setScanSuccess(`Đã kiểm kê: ${scannedBook.title} — ${invStatus}${invNote ? ' (' + invNote + ')' : ''}`);
      setTimeout(() => handleScanAgain(), 2000);
    } catch (err: any) {
      setScanError(err.message || 'Lỗi khi cập nhật');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="h-6 w-6 text-indigo-600" />
            Kiểm kê Thư viện
          </h1>
          <p className="text-sm text-slate-500 mt-1">Báo cáo tồn kho và kiểm kê bằng QR</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        <button onClick={() => setTab('report')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${tab === 'report' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <BarChart3 className="h-4 w-4" /> Báo cáo
        </button>
        <button onClick={() => setTab('scan')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${tab === 'scan' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <ScanLine className="h-4 w-4" /> Quét QR
        </button>
      </div>

      {/* =========== TAB 1: REPORT =========== */}
      {tab === 'report' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Đầu sách', value: totalBooks, icon: BookOpen, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
              { label: 'Tổng SL', value: totalQty, icon: Package, color: 'text-blue-600 bg-blue-50 border-blue-100' },
              { label: 'Đang mượn', value: totalBorrowed, icon: AlertTriangle, color: 'text-amber-600 bg-amber-50 border-amber-100' },
              { label: 'Tồn kho', value: totalAvailable, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
            ].map(s => (
              <div key={s.label} className={`${s.color} rounded-xl px-4 py-3 border`}>
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className="h-4 w-4 opacity-70" />
                  <span className="text-xs font-medium opacity-80">{s.label}</span>
                </div>
                <div className="text-2xl font-bold">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Damage/Lost row */}
          {(totalDamaged > 0 || totalLost > 0) && (
            <div className="flex gap-3">
              {totalDamaged > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                  <AlertCircle className="h-4 w-4" />
                  Sách hỏng: <strong>{totalDamaged}</strong>
                </div>
              )}
              {totalLost > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                  <XCircle className="h-4 w-4" />
                  Sách mất: <strong>{totalLost}</strong>
                </div>
              )}
            </div>
          )}

          {/* Print button */}
          <div className="flex justify-end">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all">
              <Printer className="h-4 w-4" /> Xuất báo cáo
            </button>
          </div>

          {/* Category table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Thể loại</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Đầu sách</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Tổng SL</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Mượn</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Tồn kho</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categoryStats.length === 0 ? (
                  <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-400">Chưa có sách nào</td></tr>
                ) : categoryStats.map(cat => (
                  <>
                    <tr key={cat.category} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => toggleCat(cat.category)}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 flex items-center gap-2">
                        {expandedCats.has(cat.category) ?
                          <ChevronUp className="h-4 w-4 text-slate-400" /> :
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        }
                        {cat.category}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-slate-700">{cat.count}</td>
                      <td className="px-4 py-3 text-sm text-center font-semibold text-slate-900">{cat.qty}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        {cat.borrowed > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">{cat.borrowed}</span>
                        ) : <span className="text-slate-400">0</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cat.available > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {cat.available}
                        </span>
                      </td>
                    </tr>
                    {expandedCats.has(cat.category) && cat.books.map(book => (
                      <tr key={book.id} className="bg-slate-50/50">
                        <td className="px-4 py-2 text-xs text-slate-600 pl-10">
                          {book.title}
                          {book.author && <span className="text-slate-400 ml-1">— {book.author}</span>}
                        </td>
                        <td className="px-4 py-2 text-xs text-center text-slate-400">1</td>
                        <td className="px-4 py-2 text-xs text-center text-slate-600">{book.quantity || 1}</td>
                        <td className="px-4 py-2 text-xs text-center text-slate-500">{getBorrowedQty(book.id)}</td>
                        <td className="px-4 py-2 text-xs text-center text-slate-600">{(book.quantity || 1) - getBorrowedQty(book.id)}</td>
                      </tr>
                    ))}
                  </>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-3 text-sm text-slate-900">Tổng cộng</td>
                  <td className="px-4 py-3 text-sm text-center text-slate-900">{totalBooks}</td>
                  <td className="px-4 py-3 text-sm text-center text-slate-900">{totalQty}</td>
                  <td className="px-4 py-3 text-sm text-center text-amber-700">{totalBorrowed}</td>
                  <td className="px-4 py-3 text-sm text-center text-emerald-700">{totalAvailable}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========== TAB 2: QR SCAN =========== */}
      {tab === 'scan' && (
        <div className="max-w-md mx-auto space-y-4">
          {scanError && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-md flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{scanError}</p>
            </div>
          )}

          {scanSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center text-emerald-700 text-sm">
              <CheckCircle className="h-5 w-5 mr-3 flex-shrink-0" />
              {scanSuccess}
            </div>
          )}

          {isScanning ? (
            <>
              <div ref={containerRef} className="bg-black rounded-xl overflow-hidden relative" style={{ minHeight: '280px' }}>
                <div id="reader-book-inventory" className="w-full" />
                {cameraStarting && !scanError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-white mb-3" />
                    <p className="text-white text-sm">Đang khởi động camera...</p>
                  </div>
                )}
              </div>
              <div id="reader-book-inv-file" style={{ display: 'none' }} />

              <div className="flex gap-2">
                {cameraReady && (
                  <button onClick={handleSwitchCamera}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 active:scale-[0.98] transition-all">
                    <FlipHorizontal className="h-4 w-4" /> Đổi camera
                  </button>
                )}
                {(scanError || !cameraReady) && !cameraStarting && (
                  <button onClick={() => { hasScanned.current = false; startScanner(facingMode); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 active:scale-[0.98] transition-all">
                    <RefreshCw className="h-4 w-4" /> Thử lại
                  </button>
                )}
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 active:scale-[0.98] transition-all cursor-pointer">
                  <ImagePlus className="h-4 w-4" /> Chọn ảnh QR
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </>
          ) : scannedBook ? (
            <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-5 sm:px-6 bg-slate-50 border-b border-slate-200">
                <h3 className="text-lg leading-6 font-medium text-slate-900 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-indigo-600" />
                  {scannedBook.title}
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  {scannedBook.author && `${scannedBook.author} • `}{scannedBook.category} • SL: {scannedBook.quantity}
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">Tình trạng kiểm kê</label>
                  <div className="space-y-2">
                    {[
                      { value: 'Đủ', label: 'Đủ số lượng', icon: CheckCircle, color: 'border-emerald-400 bg-emerald-50' },
                      { value: 'Thiếu', label: 'Thiếu (cập nhật SL thực tế)', icon: AlertTriangle, color: 'border-amber-400 bg-amber-50' },
                      { value: 'Hỏng', label: 'Có sách hỏng', icon: XCircle, color: 'border-red-400 bg-red-50' },
                    ].map(s => (
                      <div key={s.value}
                        className={`flex items-center p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-all ${invStatus === s.value ? s.color : 'border-slate-200'}`}
                        onClick={() => setInvStatus(s.value)}>
                        <input type="radio" name="inv-status" checked={invStatus === s.value}
                          onChange={() => setInvStatus(s.value)}
                          className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-slate-300" />
                        <s.icon className={`h-4 w-4 ml-3 mr-2 ${invStatus === s.value ? 'opacity-100' : 'opacity-40'}`} />
                        <label className="text-sm font-medium text-slate-900 cursor-pointer w-full">{s.label}</label>
                      </div>
                    ))}
                  </div>
                </div>

                {(invStatus === 'Thiếu' || invStatus === 'Hỏng') && (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">SL thực tế còn</label>
                      <input type="number" min={0} max={scannedBook.quantity || 1}
                        value={invActualQty}
                        onChange={e => setInvActualQty(Math.max(0, parseInt(e.target.value) || 0))}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Ghi chú</label>
                      <input type="text" value={invNote} onChange={e => setInvNote(e.target.value)}
                        placeholder="VD: 2 cuốn bị rách bìa"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={handleScanAgain}
                    className="flex-1 bg-white py-3 px-4 border border-slate-300 rounded-xl shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all">
                    Quét lại
                  </button>
                  <button onClick={handleUpdateInventory} disabled={isLoading}
                    className="flex-1 bg-indigo-600 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 active:scale-[0.98] transition-all">
                    {isLoading ? 'Đang lưu...' : 'Xác nhận'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <button onClick={handleScanAgain}
                className="bg-indigo-600 py-3 px-6 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white hover:bg-indigo-700 active:scale-[0.98] transition-all">
                <Camera className="h-4 w-4 inline mr-2" />
                Bật Camera Quét QR
              </button>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <h3 className="text-sm font-medium text-blue-800 flex items-center gap-2">
              <ScanLine className="h-4 w-4" /> Hướng dẫn kiểm kê sách
            </h3>
            <ul className="mt-2 text-sm text-blue-700 list-disc list-inside space-y-1">
              <li>Quét QR từng sách cần kiểm kê</li>
              <li>Chọn tình trạng: Đủ / Thiếu / Hỏng</li>
              <li>Nếu thiếu hoặc hỏng, nhập SL thực tế</li>
              <li>Bấm "Xác nhận" để cập nhật</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
