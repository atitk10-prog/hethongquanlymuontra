import React, { useState, useRef } from 'react';
import { api } from '../services/api';
import { useAuth } from '../store/auth';
import { QRCodeSVG } from 'qrcode.react';
import {
    User,
    Mail,
    Shield,
    Building2,
    Key,
    Save,
    CheckCircle2,
    AlertCircle,
    Printer,
    QrCode
} from 'lucide-react';

export default function Profile() {
    const { user, login } = useAuth();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    const [formData, setFormData] = useState({
        name: user?.name || '',
        email: user?.email || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const handleUpdateInfo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setIsSubmitting(true);
        try {
            await api.updateUser(user.id, {
                name: formData.name,
                email: formData.email
            });

            // Update local auth state so sidebar/header reflect changes immediately
            login({
                ...user,
                name: formData.name,
                email: formData.email
            });

            showToast('Cập nhật thông tin thành công');
        } catch (error) {
            showToast('Lỗi khi cập nhật thông tin', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (!formData.currentPassword) {
            showToast('Vui lòng nhập mật khẩu hiện tại', 'error');
            return;
        }

        if (formData.newPassword !== formData.confirmPassword) {
            showToast('Mật khẩu xác nhận không khớp', 'error');
            return;
        }

        if (formData.newPassword.length < 6) {
            showToast('Mật khẩu mới phải có ít nhất 6 ký tự', 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            await api.changePassword(user.id, formData.currentPassword, formData.newPassword);

            showToast('Đổi mật khẩu thành công');
            setFormData({ ...formData, currentPassword: '', newPassword: '', confirmPassword: '' });
        } catch (error: any) {
            showToast(error.message || 'Lỗi khi đổi mật khẩu', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Hồ sơ cá nhân</h1>
                <p className="text-slate-500 mt-1">Quản lý thông tin tài khoản và bảo mật của bạn</p>
            </div>

            {/* Toast Notification */}
            {toast && (
                <div className="fixed bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
                        }`}>
                        <CheckCircle2 className={`h-5 w-5 ${toast.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`} />
                        <span className="font-medium text-sm">{toast.message}</span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {/* Profile Card */}
                <div className="md:col-span-1">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
                        <div className="h-24 w-24 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-3xl font-bold mx-auto mb-4 border-4 border-indigo-50">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <h2 className="text-xl font-bold text-slate-900">{user.name}</h2>
                        <p className="text-sm text-slate-500 mt-1">{user.email}</p>

                        <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                            <div className="flex items-center text-sm text-slate-600">
                                <Shield className="h-4 w-4 mr-3 text-indigo-500" />
                                <span className="font-medium mr-auto">Vai trò:</span>
                                <span className="text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
                                    {user.role === 'admin' ? 'Quản trị viên' :
                                        user.role === 'vice_principal' ? 'Ban giám hiệu' :
                                        user.role === 'equipment' ? 'Cán bộ thiết bị' :
                                            user.role === 'leader' ? 'Tổ trưởng' : 'Giáo viên'}
                                </span>
                            </div>
                            <div className="flex items-center text-sm text-slate-600">
                                <Building2 className="h-4 w-4 mr-3 text-indigo-500" />
                                <span className="font-medium mr-auto">Phòng ban:</span>
                                <span className="text-slate-900">{user.department}</span>
                            </div>
                        </div>
                    </div>

                    {/* QR Code Card */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center mt-6">
                        <div className="flex items-center justify-center gap-2 mb-4">
                            <QrCode className="h-5 w-5 text-indigo-600" />
                            <h3 className="font-bold text-slate-900">Mã QR cá nhân</h3>
                        </div>
                        <div className="flex justify-center mb-3 profile-qr-print">
                            <QRCodeSVG value={`USER:${user.id}`} size={160} level="M" includeMargin={true} />
                        </div>
                        <p className="text-xs text-slate-400 mb-1">Dùng mã này để quét mượn/trả thiết bị</p>
                        <p className="text-[10px] text-slate-300 font-mono">{user.id}</p>
                        <button onClick={() => {
                            const printWin = window.open('', '_blank', 'width=400,height=600');
                            if (!printWin) return;
                            const roleName = user.role === 'admin' ? 'Quản trị viên' : user.role === 'vice_principal' ? 'Ban giám hiệu' : user.role === 'equipment' ? 'Cán bộ thiết bị' : user.role === 'leader' ? 'Tổ trưởng' : user.role === 'librarian' ? 'Thủ thư' : 'Giáo viên';
                            const qrDiv = document.querySelector('.profile-qr-print');
                            const svgEl = document.querySelector('.profile-qr-print svg');
                            const svgStr = svgEl ? new XMLSerializer().serializeToString(svgEl) : '';
                            const svgB64 = svgStr ? 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr))) : '';
                            printWin.document.write(`<!DOCTYPE html><html><head><title>Thẻ mượn trả</title>
                            <style>body{font-family:system-ui,sans-serif;text-align:center;padding:40px 20px;margin:0}
                            .card{border:2px solid #4f46e5;border-radius:16px;padding:24px;max-width:300px;margin:0 auto}
                            h2{color:#1e293b;margin:8px 0 4px;font-size:18px}p{color:#64748b;margin:4px 0;font-size:13px}
                            .role{background:#e0e7ff;color:#4338ca;padding:2px 10px;border-radius:8px;font-size:12px;display:inline-block;margin:8px 0}
                            img{margin:16px auto;display:block}
                            .id{color:#94a3b8;font-size:10px;font-family:monospace}
                            @media print{body{padding:20px}}</style></head><body>
                            <div class="card">
                            <h2>${user.name}</h2>
                            <p>${user.email}</p>
                            <div class="role">${roleName}</div>
                            <img src="${svgB64}" width="160" height="160" />
                            <p class="id">ID: ${user.id}</p>
                            <p style="margin-top:12px;font-size:11px;color:#94a3b8">HỆ THỐNG QUẢN LÝ MƯỢN TRẢ</p>
                            </div>
                            <script>setTimeout(function(){window.print()},300)<\/script>
                            </body></html>`);
                            printWin.document.close();
                        }}
                            className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-all">
                            <Printer className="h-4 w-4" />
                            In thẻ mượn trả
                        </button>
                    </div>
                </div>

                {/* Edit Forms */}
                <div className="md:col-span-2 space-y-8">
                    {/* Base Info */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="font-bold text-slate-900 flex items-center">
                                <User className="h-4 w-4 mr-2 text-indigo-600" />
                                Thông tin cơ bản
                            </h3>
                        </div>
                        <form onSubmit={handleUpdateInfo} className="p-6 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Họ và tên</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 transition-all border p-2 text-sm"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                                    <input
                                        type="email"
                                        required
                                        className="w-full rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 transition-all border p-2 text-sm"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    <Save className="h-4 w-4 mr-2" />
                                    Lưu thay đổi
                                </button>
                            </div>
                        </form>
                    </div>

                    {/* Password Change */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="font-bold text-slate-900 flex items-center">
                                <Key className="h-4 w-4 mr-2 text-indigo-600" />
                                Đổi mật khẩu
                            </h3>
                        </div>
                        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Mật khẩu hiện tại</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Key className="h-4 w-4 text-slate-400" />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        className="w-full pl-10 rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 transition-all border p-2 text-sm"
                                        value={formData.currentPassword}
                                        onChange={(e) => setFormData({ ...formData, currentPassword: e.target.value })}
                                        placeholder="Nhập mật khẩu hiện tại"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Mật khẩu mới</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Key className="h-4 w-4 text-slate-400" />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        minLength={6}
                                        className="w-full pl-10 rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 transition-all border p-2 text-sm"
                                        value={formData.newPassword}
                                        onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                                        placeholder="Ít nhất 6 ký tự"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Xác nhận mật khẩu mới</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <CheckCircle2 className="h-4 w-4 text-slate-400" />
                                    </div>
                                    <input
                                        type="password"
                                        required
                                        className="w-full pl-10 rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 transition-all border p-2 text-sm"
                                        value={formData.confirmPassword}
                                        onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                        placeholder="Nhập lại mật khẩu mới"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="inline-flex items-center px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-xl hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-50"
                                >
                                    <Save className="h-4 w-4 mr-2" />
                                    Cập nhật mật khẩu
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
