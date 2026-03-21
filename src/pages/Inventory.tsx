import { useState, useEffect, useRef, useCallback } from 'react';
import { useData } from '../context/DataContext';
import {
  Camera, AlertCircle, CheckCircle, ImagePlus, RefreshCw, FlipHorizontal,
  ClipboardCheck, BarChart3, ScanLine, Monitor, Package, AlertTriangle,
  Printer, ChevronDown, ChevronUp, XCircle
} from 'lucide-react';
import { api, type Device } from '../services/api';

export default function Inventory() {
  const { devices, borrowHistory } = useData();
  const borrows = borrowHistory || [];
  const [tab, setTab] = useState<'report' | 'scan'>('report');

  const [device, setDevice] = useState<Device | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [status, setStatus] = useState('Có mặt');
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

  // Report state
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());

  // Report calculations
  const activeBorrows = borrows.filter(b => b.status === 'Đang mượn');

  const getBorrowedQty = (deviceId: string) => {
    return activeBorrows.filter(b => b.device_id === deviceId).reduce((s, b) => {
      return s + ((b.quantity || 1) - (b.returned_qty || 0));
    }, 0);
  };

  const getMissingQty = (deviceId: string) => {
    return borrows.filter(b => b.device_id === deviceId).reduce((s, b) => s + (b.missing_qty || 0), 0);
  };

  const totalDevices = devices.length;
  const totalQty = devices.reduce((s, d) => s + (d.quantity || 1), 0);
  const totalBorrowed = devices.reduce((s, d) => s + getBorrowedQty(d.id), 0);
  const totalAvailable = totalQty - totalBorrowed;
  const totalBroken = devices.filter(d => d.status === 'Hỏng').length;
  const totalMissing = devices.reduce((s, d) => s + getMissingQty(d.id), 0);

  // Group by subject
  const subjects = [...new Set(devices.map(d => d.subject || 'Khác').filter(Boolean))];
  const subjectStats = subjects.map(sub => {
    const subDevices = devices.filter(d => (d.subject || 'Khác') === sub);
    const qty = subDevices.reduce((s, d) => s + (d.quantity || 1), 0);
    const borrowed = subDevices.reduce((s, d) => s + getBorrowedQty(d.id), 0);
    const broken = subDevices.filter(d => d.status === 'Hỏng').length;
    return { subject: sub, count: subDevices.length, qty, borrowed, available: qty - borrowed, broken, devices: subDevices };
  }).sort((a, b) => b.qty - a.qty);

  const toggleSubject = (sub: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(sub)) next.delete(sub); else next.add(sub);
      return next;
    });
  };

  // Print report
  const handlePrint = () => {
    const rows = subjectStats.map(s =>
      `<tr><td>${s.subject}</td><td style="text-align:center">${s.count}</td><td style="text-align:center">${s.qty}</td><td style="text-align:center">${s.borrowed}</td><td style="text-align:center">${s.available}</td><td style="text-align:center">${s.broken}</td></tr>`
    ).join('');
    const pw = window.open('', '_blank');
    if (pw) {
      pw.document.write(`<html><head><title>Báo cáo kiểm kê thiết bị</title><style>body{font-family:sans-serif;padding:30px}h2{text-align:center;margin-bottom:5px}table{width:100%;border-collapse:collapse;margin-top:15px}th,td{border:1px solid #ccc;padding:8px;font-size:13px}th{background:#f0f0f0;font-weight:600}.summary{display:flex;gap:20px;margin:15px 0;justify-content:center}.stat{text-align:center;padding:10px 20px;border:1px solid #ddd;border-radius:8px}.stat .val{font-size:22px;font-weight:bold}.stat .lbl{font-size:11px;color:#666}</style></head><body><h2>BÁO CÁO KIỂM KÊ THIẾT BỊ</h2><p style="text-align:center;color:#666;font-size:12px">Ngày: ${new Date().toLocaleDateString('vi-VN')}</p><div class="summary"><div class="stat"><div class="val">${totalDevices}</div><div class="lbl">Thiết bị</div></div><div class="stat"><div class="val">${totalQty}</div><div class="lbl">Tổng SL</div></div><div class="stat"><div class="val">${totalBorrowed}</div><div class="lbl">Đang mượn</div></div><div class="stat"><div class="val">${totalAvailable}</div><div class="lbl">Tồn kho</div></div><div class="stat"><div class="val">${totalBroken}</div><div class="lbl">Hỏng</div></div></div><table><thead><tr><th>Bộ môn</th><th>Thiết bị</th><th>Tổng SL</th><th>Đang mượn</th><th>Tồn kho</th><th>Hỏng</th></tr></thead><tbody>${rows}<tr style="font-weight:bold;background:#f8f8f8"><td>Tổng cộng</td><td style="text-align:center">${totalDevices}</td><td style="text-align:center">${totalQty}</td><td style="text-align:center">${totalBorrowed}</td><td style="text-align:center">${totalAvailable}</td><td style="text-align:center">${totalBroken}</td></tr></tbody></table>${totalMissing > 0 ? `<p style="margin-top:15px;color:#b91c1c;font-size:13px">Thiết bị mất: ${totalMissing}</p>` : ''}</body></html>`);
      pw.document.close();
      pw.print();
    }
  };

  // QR scan
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
      let deviceId = '';
      if (decodedText.includes('/device/')) {
        const parts = decodedText.split('/device/');
        if (parts.length > 1) {
          deviceId = parts[1].trim().toUpperCase();
        }
      } else {
        deviceId = decodedText.trim().toUpperCase();
      }

      const deviceData = await api.getDevice(deviceId);
      setDevice(deviceData);
      setError(null);
    } catch (e: any) {
      setError(e.message || 'Không tìm thấy thiết bị');
      setDevice(null);
    }
  }, []);

  const startScanner = useCallback(async (facing: 'environment' | 'user') => {
    if (!mountedRef.current) return;

    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch { /* ignore */ }
      scannerRef.current = null;
    }

    setCameraStarting(true);
    setError(null);
    setCameraReady(false);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      await new Promise(resolve => setTimeout(resolve, 300));
      if (!mountedRef.current) return;

      const el = document.getElementById('reader-inventory');
      if (!el) {
        setError('Không thể khởi tạo scanner.');
        setCameraStarting(false);
        return;
      }

      const scanner = new Html5Qrcode('reader-inventory');
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
        setError('Vui lòng cho phép truy cập camera.');
      } else if (errStr.includes('NotFoundError')) {
        setError('Không tìm thấy camera. Hãy thử chọn ảnh QR.');
      } else {
        setError('Không thể bật camera. Hãy thử nút "Chọn ảnh QR".');
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
    setError(null);

    try {
      if (scannerRef.current && cameraReady) {
        try { await scannerRef.current.stop(); } catch { /* ignore */ }
        setCameraReady(false);
      }

      const { Html5Qrcode } = await import('html5-qrcode');
      const tempEl = document.getElementById('reader-inventory-file');
      if (!tempEl) return;

      const scanner = new Html5Qrcode('reader-inventory-file');
      const result = await scanner.scanFile(file, true);
      handleScanResult(result);
    } catch {
      setError('Không tìm thấy mã QR trong ảnh.');
      startScanner(facingMode);
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleScanAgain = () => {
    setDevice(null);
    setError(null);
    setSuccess(null);
    setStatus('Có mặt');
    hasScanned.current = false;
    setIsScanning(true);
  };

  const handleUpdateStatus = async () => {
    if (!device) return;
    setIsLoading(true);

    try {
      let newDeviceStatus = device.status;
      if (status === 'Hỏng') newDeviceStatus = 'Hỏng';
      if (status === 'Thiếu') newDeviceStatus = 'Mất';

      await api.updateDevice(device.id, { status: newDeviceStatus });

      setSuccess('Đã cập nhật trạng thái kiểm kê');
      setTimeout(() => {
        handleScanAgain();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi cập nhật');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-slide-up">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <ClipboardCheck className="h-6 w-6 text-indigo-600" />
          Kiểm kê thiết bị
        </h1>
        <p className="text-sm text-slate-500 mt-1">Báo cáo tồn kho và kiểm kê bằng QR</p>
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
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Thiết bị', value: totalDevices, icon: Monitor, color: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
              { label: 'Tổng SL', value: totalQty, icon: Package, color: 'text-blue-600 bg-blue-50 border-blue-100' },
              { label: 'Đang mượn', value: totalBorrowed, icon: AlertTriangle, color: 'text-amber-600 bg-amber-50 border-amber-100' },
              { label: 'Tồn kho', value: totalAvailable, icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
              { label: 'Hỏng', value: totalBroken, icon: XCircle, color: 'text-red-600 bg-red-50 border-red-100' },
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

          {totalMissing > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <XCircle className="h-4 w-4" />
              Thiết bị mất: <strong>{totalMissing}</strong>
            </div>
          )}

          {/* Print button */}
          <div className="flex justify-end">
            <button onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-all">
              <Printer className="h-4 w-4" /> Xuất báo cáo
            </button>
          </div>

          {/* Subject table */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase">Bộ môn</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Thiết bị</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Tổng SL</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Mượn</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Tồn kho</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-slate-500 uppercase">Hỏng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subjectStats.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-400">Chưa có thiết bị nào</td></tr>
                ) : subjectStats.map(sub => (
                  <>
                    <tr key={sub.subject} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => toggleSubject(sub.subject)}>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 flex items-center gap-2">
                        {expandedSubjects.has(sub.subject) ?
                          <ChevronUp className="h-4 w-4 text-slate-400" /> :
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        }
                        {sub.subject}
                      </td>
                      <td className="px-4 py-3 text-sm text-center text-slate-700">{sub.count}</td>
                      <td className="px-4 py-3 text-sm text-center font-semibold text-slate-900">{sub.qty}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        {sub.borrowed > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">{sub.borrowed}</span>
                        ) : <span className="text-slate-400">0</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sub.available > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                          {sub.available}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {sub.broken > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">{sub.broken}</span>
                        ) : <span className="text-slate-400">0</span>}
                      </td>
                    </tr>
                    {expandedSubjects.has(sub.subject) && sub.devices.map(dev => (
                      <tr key={dev.id} className="bg-slate-50/50">
                        <td className="px-4 py-2 text-xs text-slate-600 pl-10">
                          {dev.name}
                          <span className="text-slate-400 ml-1">— {dev.room}</span>
                        </td>
                        <td className="px-4 py-2 text-xs text-center text-slate-400">1</td>
                        <td className="px-4 py-2 text-xs text-center text-slate-600">{dev.quantity || 1}</td>
                        <td className="px-4 py-2 text-xs text-center text-slate-500">{getBorrowedQty(dev.id)}</td>
                        <td className="px-4 py-2 text-xs text-center text-slate-600">{(dev.quantity || 1) - getBorrowedQty(dev.id)}</td>
                        <td className="px-4 py-2 text-xs text-center">
                          {dev.status === 'Hỏng' ? (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">Hỏng</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700">{dev.status || 'Tốt'}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </>
                ))}
                <tr className="bg-slate-50 font-semibold">
                  <td className="px-4 py-3 text-sm text-slate-900">Tổng cộng</td>
                  <td className="px-4 py-3 text-sm text-center text-slate-900">{totalDevices}</td>
                  <td className="px-4 py-3 text-sm text-center text-slate-900">{totalQty}</td>
                  <td className="px-4 py-3 text-sm text-center text-amber-700">{totalBorrowed}</td>
                  <td className="px-4 py-3 text-sm text-center text-emerald-700">{totalAvailable}</td>
                  <td className="px-4 py-3 text-sm text-center text-red-700">{totalBroken}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =========== TAB 2: QR SCAN =========== */}
      {tab === 'scan' && (
        <div className="max-w-md mx-auto space-y-4">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-3 rounded-md">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center text-emerald-700">
              <CheckCircle className="h-5 w-5 mr-3" />
              {success}
            </div>
          )}

          {isScanning ? (
            <>
              <div
                ref={containerRef}
                className="bg-black rounded-xl overflow-hidden relative"
                style={{ minHeight: '280px' }}
              >
                <div id="reader-inventory" className="w-full" />
                {cameraStarting && !error && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-white mb-3" />
                    <p className="text-white text-sm">Đang khởi động camera...</p>
                  </div>
                )}
              </div>

              <div id="reader-inventory-file" style={{ display: 'none' }} />

              <div className="flex gap-2">
                {cameraReady && (
                  <button onClick={handleSwitchCamera}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 active:scale-[0.98] transition-all">
                    <FlipHorizontal className="h-4 w-4" />
                    Đổi camera
                  </button>
                )}
                {(error || !cameraReady) && !cameraStarting && (
                  <button onClick={() => { hasScanned.current = false; startScanner(facingMode); }}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 active:scale-[0.98] transition-all">
                    <RefreshCw className="h-4 w-4" />
                    Thử lại
                  </button>
                )}
                <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 active:scale-[0.98] transition-all cursor-pointer">
                  <ImagePlus className="h-4 w-4" />
                  Chọn ảnh QR
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>
              </div>
            </>
          ) : device ? (
            <div className="bg-white shadow-sm rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-4 py-5 sm:px-6 bg-slate-50 border-b border-slate-200">
                <h3 className="text-lg leading-6 font-medium text-slate-900 flex items-center gap-2">
                  <Monitor className="h-5 w-5 text-indigo-600" />
                  {device.name}
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">
                  ID: {device.id} | Phòng: {device.room}
                </p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-3">Trạng thái kiểm kê</label>
                  <div className="space-y-2">
                    {[
                      { value: 'Có mặt', icon: CheckCircle, color: 'border-emerald-400 bg-emerald-50' },
                      { value: 'Thiếu', icon: AlertTriangle, color: 'border-amber-400 bg-amber-50' },
                      { value: 'Hỏng', icon: XCircle, color: 'border-red-400 bg-red-50' },
                    ].map((s) => (
                      <div key={s.value}
                        className={`flex items-center p-3 border rounded-xl cursor-pointer hover:bg-slate-50 transition-all ${status === s.value ? s.color : 'border-slate-200'}`}
                        onClick={() => setStatus(s.value)}
                      >
                        <input
                          id={`inv-status-${s.value}`}
                          name="inv-status"
                          type="radio"
                          checked={status === s.value}
                          onChange={() => setStatus(s.value)}
                          className="focus:ring-indigo-500 h-4 w-4 text-indigo-600 border-slate-300"
                        />
                        <s.icon className={`h-4 w-4 ml-3 mr-2 ${status === s.value ? 'opacity-100' : 'opacity-40'}`} />
                        <label htmlFor={`inv-status-${s.value}`} className="block text-sm font-medium text-slate-900 cursor-pointer w-full">
                          {s.value}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={handleScanAgain}
                    className="flex-1 bg-white py-3 px-4 border border-slate-300 rounded-xl shadow-sm text-sm font-medium text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-all"
                  >
                    Quét lại
                  </button>
                  <button
                    onClick={handleUpdateStatus}
                    disabled={isLoading}
                    className="flex-1 bg-indigo-600 py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 active:scale-[0.98] transition-all"
                  >
                    {isLoading ? 'Đang lưu...' : 'Xác nhận'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <button
                onClick={handleScanAgain}
                className="bg-indigo-600 py-3 px-6 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white hover:bg-indigo-700 active:scale-[0.98] transition-all"
              >
                <Camera className="h-4 w-4 inline mr-2" />
                Bật Camera Quét QR
              </button>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <h3 className="text-sm font-medium text-blue-800 flex items-center gap-2">
              <ScanLine className="h-4 w-4" /> Hướng dẫn kiểm kê
            </h3>
            <ul className="mt-2 text-sm text-blue-700 list-disc list-inside space-y-1">
              <li>Quét QR từng thiết bị cần kiểm kê</li>
              <li>Chọn trạng thái: Có mặt / Thiếu / Hỏng</li>
              <li>Bấm "Xác nhận" để cập nhật</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
