import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { api } from '../services/api';
import { ArrowLeftRight, Lock, Mail } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  // Preload data ngầm khi đang ở trang đăng nhập
  // Dữ liệu vào localStorage cache → khi đăng nhập xong hiện ngay
  useEffect(() => {
    const preload = () => {
      api.getDevices().catch(() => {});
      api.getUsers().catch(() => {});
      api.getBorrowHistory().catch(() => {});
      api.getMaintenanceHistory().catch(() => {});
      api.getRooms().catch(() => {});
      api.getBooks().catch(() => {});
      api.getBookBorrowHistory().catch(() => {});
    };
    // Delay 500ms để không ảnh hưởng render trang login
    const timer = setTimeout(preload, 500);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const userData = await api.login(email, password);
      // Normalize: đảm bảo luôn có field 'id' (sheet có thể dùng user_id)
      const user = {
        ...userData,
        id: userData.id || userData.user_id || '',
      };
      login(user);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900" />

      {/* Animated decorative elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl animate-float-delay" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-400/10 rounded-full blur-3xl animate-pulse-soft" />

      {/* Grid pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
        backgroundSize: '60px 60px'
      }} />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-slide-up">
        <div className="flex justify-center">
          <div className="h-18 w-18 bg-gradient-to-br from-indigo-500 to-cyan-400 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/30 p-4">
            <ArrowLeftRight className="h-10 w-10 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          HỆ THỐNG QL MƯỢN-TRẢ
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Quản lý mượn-trả bằng QR Code
        </p>
        {/* Gradient accent line */}
        <div className="mt-4 flex justify-center">
          <div className="w-20 h-1 rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400" />
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <div className="glass py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-white/20">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <div className="mt-1 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-200 rounded-xl py-3 border bg-white/70 backdrop-blur-sm transition-all duration-200 focus:bg-white"
                  placeholder="teacher@school.edu.vn"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                Mật khẩu
              </label>
              <div className="mt-1 relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-slate-200 rounded-xl py-3 border bg-white/70 backdrop-blur-sm transition-all duration-200 focus:bg-white"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all duration-200 disabled:opacity-50 hover:shadow-indigo-500/25 hover:shadow-xl active:scale-[0.98]"
              >
                {isLoading ? 'Đang đăng nhập...' : 'Đăng nhập'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200" />
              </div>

            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs text-slate-500">

            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <p className="mt-8 text-center text-xs text-slate-600 relative z-10">
        © 2026 Hệ Thống Quản Lý Mượn Trả • Phiên bản 1.0
      </p>
    </div>
  );
}
