import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, AlertCircle, ImagePlus, RefreshCw, FlipHorizontal } from 'lucide-react';

export default function Scan() {
  const [error, setError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(true);
  const navigate = useNavigate();
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasNavigated = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const handleScanResult = useCallback((decodedText: string) => {
    if (hasNavigated.current || !mountedRef.current) return;
    hasNavigated.current = true;

    // Stop scanner before navigating
    try {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    } catch { /* ignore */ }

    try {
      // Library general QR: /library
      if (decodedText.includes('/library')) {
        navigate('/library');
        return;
      }
      // Return QR: /return/teacherName
      if (decodedText.includes('/return/')) {
        const parts = decodedText.split('/return/');
        if (parts.length > 1) {
          const teacherPath = parts[1].trim();
          navigate(`/return/${teacherPath}`);
          return;
        }
      }
      // Book QR: /book/BK...
      if (decodedText.includes('/book/')) {
        const parts = decodedText.split('/book/');
        if (parts.length > 1) {
          const bookId = parts[1].trim();
          navigate(`/book-action/${bookId}`);
          return;
        }
      }
      // Room QR: /room/subject/room
      if (decodedText.includes('/room/')) {
        const parts = decodedText.split('/room/');
        if (parts.length > 1) {
          const roomPath = parts[1].trim();
          navigate(`/room/${roomPath}`);
          return;
        }
      }
      // Device QR: /device/TBXXX
      if (decodedText.includes('/device/')) {
        const parts = decodedText.split('/device/');
        if (parts.length > 1) {
          const id = parts[1].trim().toUpperCase();
          navigate(`/device/${id}`);
          return;
        }
      }
      // If starts with BK → book
      if (decodedText.trim().toUpperCase().startsWith('BK')) {
        navigate(`/book-action/${decodedText.trim()}`);
        return;
      }
      // If it's just an ID → device
      navigate(`/device/${decodedText.trim().toUpperCase()}`);
    } catch {
      setError('Mã QR không hợp lệ');
      hasNavigated.current = false;
    }
  }, [navigate]);

  const startScanner = useCallback(async (facing: 'environment' | 'user') => {
    if (!mountedRef.current) return;

    // Clean up any existing scanner
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch { /* ignore */ }
      scannerRef.current = null;
    }

    setCameraStarting(true);
    setError(null);
    setIsScanning(false);

    try {
      // Dynamic import to prevent build-time crashes
      const { Html5Qrcode } = await import('html5-qrcode');

      // Wait for DOM element to be ready
      await new Promise(resolve => setTimeout(resolve, 300));

      if (!mountedRef.current) return;

      const readerEl = document.getElementById('qr-reader');
      if (!readerEl) {
        setError('Không thể khởi tạo scanner. Vui lòng tải lại trang.');
        setCameraStarting(false);
        return;
      }

      const scanner = new Html5Qrcode('qr-reader');
      scannerRef.current = scanner;

      // Calculate responsive qrbox
      const containerWidth = containerRef.current?.offsetWidth || 300;
      const qrboxSize = Math.min(Math.floor(containerWidth * 0.65), 250);

      await scanner.start(
        { facingMode: facing },
        {
          fps: 10,
          qrbox: { width: qrboxSize, height: qrboxSize },
          aspectRatio: 1,
        },
        (decodedText: string) => {
          handleScanResult(decodedText);
        },
        () => {
          // Ignore per-frame errors
        }
      );

      if (mountedRef.current) {
        setIsScanning(true);
        setCameraStarting(false);
      }
    } catch (err: any) {
      if (!mountedRef.current) return;
      console.error('Camera error:', err);
      setCameraStarting(false);

      const errStr = String(err);
      if (errStr.includes('NotAllowedError') || errStr.includes('Permission')) {
        setError('Vui lòng cho phép truy cập camera trong cài đặt trình duyệt, sau đó tải lại trang.');
      } else if (errStr.includes('NotFoundError') || errStr.includes('device')) {
        setError('Không tìm thấy camera. Hãy thử chọn ảnh QR ở dưới.');
      } else if (errStr.includes('NotReadableError') || errStr.includes('track')) {
        setError('Camera đang được dùng bởi ứng dụng khác. Hãy đóng các app camera rồi thử lại.');
      } else {
        setError('Không thể bật camera. Hãy thử nút "Chọn ảnh QR" bên dưới.');
      }
    }
  }, [handleScanResult]);

  useEffect(() => {
    mountedRef.current = true;
    hasNavigated.current = false;

    // Delay start to ensure DOM is fully ready
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
  }, []);

  const handleSwitchCamera = async () => {
    const newFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newFacing);
    await startScanner(newFacing);
  };

  const handleRetry = () => {
    hasNavigated.current = false;
    setError(null);
    startScanner(facingMode);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    try {
      // Stop camera first if running
      if (scannerRef.current && isScanning) {
        try {
          await scannerRef.current.stop();
        } catch { /* ignore */ }
        setIsScanning(false);
      }

      const { Html5Qrcode } = await import('html5-qrcode');

      // Need a visible div for scanFile
      const tempDiv = document.getElementById('qr-reader-file');
      if (!tempDiv) {
        setError('Lỗi hệ thống. Vui lòng tải lại trang.');
        return;
      }

      const scanner = new Html5Qrcode('qr-reader-file');
      const result = await scanner.scanFile(file, true);
      handleScanResult(result);
    } catch {
      setError('Không tìm thấy mã QR trong ảnh. Vui lòng thử ảnh khác hoặc quét bằng camera.');
      // Restart camera
      startScanner(facingMode);
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-md mx-auto space-y-4">
      <div className="text-center">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Quét mã QR</h1>
        <p className="mt-1 text-sm text-slate-600">
          Đưa mã QR thiết bị hoặc sách vào khung hình
        </p>
      </div>

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

      {/* Camera Scanner */}
      <div
        ref={containerRef}
        className="bg-black rounded-xl overflow-hidden relative"
        style={{ minHeight: '280px' }}
      >
        <div id="qr-reader" className="w-full" />

        {/* Loading overlay */}
        {cameraStarting && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 z-10">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-white/20 border-t-white mb-3" />
            <p className="text-white text-sm">Đang khởi động camera...</p>
          </div>
        )}
      </div>

      {/* Hidden div for file scanning */}
      <div id="qr-reader-file" style={{ display: 'none' }} />

      {/* Action buttons */}
      <div className="flex gap-2">
        {isScanning && (
          <button
            onClick={handleSwitchCamera}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-200 active:scale-[0.98] transition-all"
          >
            <FlipHorizontal className="h-4 w-4" />
            Đổi camera
          </button>
        )}

        {(error || !isScanning) && !cameraStarting && (
          <button
            onClick={handleRetry}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 active:scale-[0.98] transition-all"
          >
            <RefreshCw className="h-4 w-4" />
            Thử lại camera
          </button>
        )}

        <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 active:scale-[0.98] transition-all cursor-pointer">
          <ImagePlus className="h-4 w-4" />
          Chọn ảnh QR
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
        <h3 className="text-sm font-medium text-blue-800 flex items-center">
          <Camera className="h-4 w-4 mr-2" />
          Hướng dẫn
        </h3>
        <ul className="mt-2 text-sm text-blue-700 list-disc list-inside space-y-1">
          <li>Cho phép trình duyệt sử dụng camera</li>
          <li>Giữ điện thoại ổn định, hướng camera vào mã QR</li>
          <li>Đảm bảo đủ ánh sáng</li>
          <li>Nếu camera không hoạt động, bấm "Chọn ảnh QR"</li>
        </ul>
      </div>
    </div>
  );
}
