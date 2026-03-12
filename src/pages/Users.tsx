import React, { useState } from 'react';
import { api, type User } from '../services/api';
import {
    UserPlus,
    Search,
    Edit,
    Trash2,
    X,
    Shield,
    Mail,
    Building2,
    Key,
    CheckCircle2,
    AlertTriangle,
    ChevronLeft,
    ChevronRight
} from 'lucide-react';
import { useAuth } from '../store/auth';
import { useData } from '../context/DataContext';

export default function Users() {
    const { users, setUsers, rooms, isLoading, refreshUsers } = useData();
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<User | null>(null);
    const [confirmResetUser, setConfirmResetUser] = useState<User | null>(null);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { user: currentUser } = useAuth();

    const [formUser, setFormUser] = useState({
        name: '',
        email: '',
        role: 'teacher',
        department: '',
        password: '',
        managed_rooms: '' as string
    });

    const showToast = (message: string, type: 'success' | 'error' = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const openAddModal = () => {
        setEditingUser(null);
        setFormUser({
            name: '',
            email: '',
            role: 'teacher',
            department: '',
            password: '',
            managed_rooms: ''
        });
        setShowAddModal(true);
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setFormUser({
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
            password: '',
            managed_rooms: user.managed_rooms || ''
        });
        setShowAddModal(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        const previousUsers = users;

        try {
            if (editingUser) {
                // Update
                const updates: Partial<User> = {
                    name: formUser.name,
                    email: formUser.email,
                    role: formUser.role,
                    department: formUser.department,
                    managed_rooms: formUser.managed_rooms
                };
                if (formUser.password) updates.password = formUser.password;

                // Optimistic Update (edit chỉ thay đổi data, không tạo ID mới)
                setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...updates } : u));
                setShowAddModal(false);

                await api.updateUser(editingUser.id, updates);
                showToast('Cập nhật người dùng thành công');
            } else {
                // Add — gọi API trước, nhận ID thật, rồi mới thêm vào list
                const userToSave = {
                    name: formUser.name,
                    email: formUser.email,
                    role: formUser.role,
                    department: formUser.department,
                    password: formUser.password || '123456'
                };

                setShowAddModal(false);
                showToast('Đang tạo tài khoản...'); 

                const result = await api.addUser(userToSave);
                
                // Thêm vào list với ID thật từ server
                const newUser: User = {
                    id: result.id,
                    name: formUser.name,
                    email: formUser.email,
                    role: formUser.role,
                    department: formUser.department,
                    password: ''
                };
                setUsers(prev => [...prev, newUser]);
                showToast('Thêm người dùng thành công');
            }
            refreshUsers(); // Refresh in background để đồng bộ
        } catch (error) {
            console.error('Failed to save user', error);
            setUsers(previousUsers);
            showToast('Lỗi khi lưu thông tin người dùng', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!confirmDeleteId) return;

        setIsSubmitting(true);
        const previousUsers = users;
        setUsers(prev => prev.filter(u => u.id !== confirmDeleteId.id));

        try {
            await api.deleteUser(confirmDeleteId.id);
            showToast('Đã xóa người dùng thành công');
            refreshUsers();
        } catch (error) {
            console.error('Failed to delete user', error);
            setUsers(previousUsers);
            showToast('Lỗi khi xóa người dùng', 'error');
        } finally {
            setIsSubmitting(false);
            setConfirmDeleteId(null);
        }
    };

    const handleResetPassword = (user: User) => {
        setConfirmResetUser(user);
    };

    const doResetPassword = async () => {
        if (!confirmResetUser) return;

        setIsSubmitting(true);
        showToast('Đang đặt lại mật khẩu...');
        try {
            await api.updateUser(confirmResetUser.id, { password: '123456' });
            showToast('Đã đặt lại mật khẩu thành công');
        } catch (error: any) {
            console.error('Failed to reset password', error);
            showToast(error.message || 'Lỗi khi reset mật khẩu', 'error');
        } finally {
            setIsSubmitting(false);
            setConfirmResetUser(null);
        }
    };

    const filteredUsers = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.department.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin': return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'equipment': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'vice_principal': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'leader': return 'bg-amber-100 text-amber-800 border-amber-200';
            default: return 'bg-slate-100 text-slate-800 border-slate-200';
        }
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'admin': return 'Quản trị viên';
            case 'equipment': return 'Cán bộ thiết bị';
            case 'vice_principal': return 'Ban giám hiệu';
            case 'leader': return 'Tổ trưởng';
            case 'teacher': return 'Giáo viên';
            default: return role;
        }
    };

    // Pagination
    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    const paginatedUsers = filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    const handleSearch = (term: string) => { setSearchTerm(term); setCurrentPage(1); };

    const PaginationControls = () => {
        if (filteredUsers.length <= ITEMS_PER_PAGE) return null;
        return (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
                <div className="text-xs text-slate-500">{startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredUsers.length)} / {filteredUsers.length}</div>
                <div className="flex items-center gap-1">
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safeCurrentPage <= 1}
                        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                    <span className="text-xs font-medium text-slate-700 px-2">{safeCurrentPage}/{totalPages}</span>
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safeCurrentPage >= totalPages}
                        className="p-1.5 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-4 sm:space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Quản lý tài khoản</h1>
                <button
                    onClick={openAddModal}
                    className="inline-flex items-center justify-center rounded-xl border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-all active:scale-95"
                >
                    <UserPlus className="-ml-1 mr-2 h-5 w-5" />
                    Thêm tài khoản
                </button>
            </div>

            {/* Toast Notification */}
            {toast && (
                <div className="fixed bottom-20 md:bottom-4 right-4 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg border ${toast.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
                        }`}>
                        <CheckCircle2 className={`h-5 w-5 ${toast.type === 'success' ? 'text-emerald-500' : 'text-red-500'}`} />
                        <span className="font-medium text-sm">{toast.message}</span>
                    </div>
                </div>
            )}

            <div className="bg-white shadow-sm rounded-2xl border border-slate-200 overflow-hidden">
                <div className="p-3 sm:p-4 border-b border-slate-200 bg-slate-50/50">
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Search className="h-5 w-5 text-slate-400" />
                        </div>
                        <input
                            type="text"
                            className="block w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl leading-5 bg-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-all"
                            placeholder="Tìm tên, email hoặc phòng ban..."
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                        />
                    </div>
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50/50">
                            <tr>
                                <th className="px-3 py-3 text-center text-xs font-semibold text-slate-500 uppercase w-12">STT</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Người dùng</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Vai trò</th>
                                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Phòng ban</th>
                                <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-200">
                            {isLoading ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-10 bg-slate-100 rounded-lg w-40"></div></td>
                                        <td className="px-6 py-4"><div className="h-6 bg-slate-100 rounded-full w-24"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-32"></div></td>
                                        <td className="px-6 py-4"><div className="h-8 bg-slate-100 rounded-lg w-20 ml-auto"></div></td>
                                    </tr>
                                ))
                            ) : paginatedUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                                        Không tìm thấy người dùng nào
                                    </td>
                                </tr>
                            ) : (
                                paginatedUsers.map((u, idx) => (
                                    <tr key={u.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="px-3 py-3 text-center text-sm text-slate-400">{startIndex + idx + 1}</td>
                                        <td className="px-4 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="h-10 w-10 flex-shrink-0 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                                    {u.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-bold text-slate-900">{u.name}</div>
                                                    <div className="text-xs text-slate-500 flex items-center">
                                                        <Mail className="h-3 w-3 mr-1" />
                                                        {u.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadge(u.role)}`}>
                                                <Shield className="h-3 w-3 mr-1" />
                                                {getRoleLabel(u.role)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-slate-600 flex items-center">
                                                <Building2 className="h-4 w-4 mr-1.5 text-slate-400" />
                                                {u.department}
                                            </div>
                                            {u.managed_rooms && (
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    {u.managed_rooms.split(',').map(rid => {
                                                        const room = rooms.find(r => r.id === rid.trim());
                                                        return room ? (
                                                            <span key={rid} className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[10px] font-medium">
                                                                {room.name}
                                                            </span>
                                                        ) : null;
                                                    })}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    onClick={() => handleResetPassword(u)}
                                                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                    title="Reset mật khẩu"
                                                >
                                                    <Key className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(u)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Sửa"
                                                >
                                                    <Edit className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(u)}
                                                    disabled={u.id === currentUser?.id}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                                    title="Xóa"
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-slate-100">
                    {isLoading ? (
                        [...Array(3)].map((_, i) => (
                            <div key={i} className="p-4 animate-pulse space-y-2">
                                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                                <div className="h-3 bg-slate-100 rounded w-1/2"></div>
                            </div>
                        ))
                    ) : filteredUsers.length === 0 ? (
                        <div className="px-4 py-8 text-center text-sm text-slate-500">Không tìm thấy người dùng nào</div>
                    ) : (
                        paginatedUsers.map((u, idx) => (
                            <div key={u.id} className="p-3 hover:bg-slate-50 transition-colors">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center flex-1 min-w-0">
                                        <span className="text-xs text-slate-400 font-medium mr-2">{startIndex + idx + 1}</span>
                                        <div className="h-9 w-9 flex-shrink-0 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm">
                                            {u.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="ml-3 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-bold text-slate-900 truncate">{u.name}</span>
                                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium border flex-shrink-0 ${getRoleBadge(u.role)}`}>
                                                    {getRoleLabel(u.role)}
                                                </span>
                                            </div>
                                            <div className="text-xs text-slate-500 truncate">{u.email} • {u.department}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
                                        <button onClick={() => handleResetPassword(u)} className="p-2 text-slate-400 hover:text-amber-600 rounded-lg" title="Reset">
                                            <Key className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => openEditModal(u)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg" title="Sửa">
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => setConfirmDeleteId(u)} disabled={u.id === currentUser?.id} className="p-2 text-slate-400 hover:text-red-600 rounded-lg disabled:opacity-30" title="Xóa">
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                <PaginationControls />
            </div>

            {/* Add/Edit Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-slate-500/75 backdrop-blur-sm transition-opacity" onClick={() => !isSubmitting && setShowAddModal(false)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                        <div className="relative inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full animate-in zoom-in-95 duration-200">
                            <form onSubmit={handleSubmit}>
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-slate-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="text-xl font-bold text-slate-900">
                                            {editingUser ? 'Chỉnh sửa tài khoản' : 'Thêm tài khoản mới'}
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => setShowAddModal(false)}
                                            className="text-slate-400 hover:text-slate-500"
                                        >
                                            <X className="h-6 w-6" />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1">Họ và tên</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 transition-all border p-2"
                                                value={formUser.name}
                                                onChange={(e) => setFormUser({ ...formUser, name: e.target.value })}
                                                placeholder="Nguyễn Văn A"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
                                            <input
                                                type="email"
                                                required
                                                className="w-full rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 transition-all border p-2"
                                                value={formUser.email}
                                                onChange={(e) => setFormUser({ ...formUser, email: e.target.value })}
                                                placeholder="email@school.edu.vn"
                                            />
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1">Vai trò</label>
                                                <select
                                                    className="w-full rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 transition-all border p-2"
                                                    value={formUser.role}
                                                    onChange={(e) => setFormUser({ ...formUser, role: e.target.value })}
                                                >
                                                    <option value="teacher">Giáo viên</option>
                                                    <option value="leader">Tổ trưởng</option>
                                                    <option value="equipment">Cán bộ thiết bị</option>
                                                    <option value="vice_principal">BGH</option>
                                                    <option value="admin">Quản trị viên</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1">Phòng ban/Tổ</label>
                                                <input
                                                    type="text"
                                                    required
                                                    className="w-full rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 transition-all border p-2"
                                                    value={formUser.department}
                                                    onChange={(e) => setFormUser({ ...formUser, department: e.target.value })}
                                                    placeholder="Toán - Tin"
                                                />
                                            </div>
                                        </div>

                                        {rooms.length > 0 && (
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Phòng quản lý</label>
                                                <p className="text-xs text-slate-400 mb-2">Chọn phòng mà người dùng sẽ quản lý. Không chọn = xem tất cả.</p>
                                                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
                                                    {rooms.map(r => {
                                                        const selected = formUser.managed_rooms.split(',').map(s => s.trim()).filter(Boolean);
                                                        const isChecked = selected.includes(r.id);
                                                        return (
                                                            <label key={r.id} className={`flex items-center p-2 rounded-lg cursor-pointer transition-colors ${isChecked ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isChecked}
                                                                    onChange={() => {
                                                                        const newList = isChecked
                                                                            ? selected.filter(id => id !== r.id)
                                                                            : [...selected, r.id];
                                                                        setFormUser({ ...formUser, managed_rooms: newList.filter(Boolean).join(',') });
                                                                    }}
                                                                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mr-3"
                                                                />
                                                                <div>
                                                                    <div className="text-sm font-medium text-slate-800">{r.name}</div>
                                                                    <div className="text-xs text-slate-400">{r.subject}</div>
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}

                                        {!editingUser && (
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1">Mật khẩu</label>
                                                <input
                                                    type="password"
                                                    className="w-full rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 transition-all border p-2"
                                                    value={formUser.password}
                                                    onChange={(e) => setFormUser({ ...formUser, password: e.target.value })}
                                                    placeholder="Để trống nếu muốn đặt mặc định 123456"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 transition-all active:scale-95"
                                    >
                                        {isSubmitting ? 'Đang lưu...' : 'Lưu tài khoản'}
                                    </button>
                                    <button
                                        type="button"
                                        disabled={isSubmitting}
                                        onClick={() => setShowAddModal(false)}
                                        className="mt-3 w-full inline-flex justify-center rounded-xl border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 transition-all active:scale-95"
                                    >
                                        Hủy bỏ
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {confirmDeleteId && (
                <div className="fixed inset-0 z-[60] overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-slate-500/75 backdrop-blur-sm transition-opacity" onClick={() => !isSubmitting && setConfirmDeleteId(null)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                        <div className="relative inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-slate-200 animate-in zoom-in-95 duration-200">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 text-center sm:text-left">
                                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                                    <AlertTriangle className="h-6 w-6 text-red-600" />
                                </div>
                                <div className="mt-3 sm:mt-0 sm:ml-4">
                                    <h3 className="text-lg leading-6 font-bold text-slate-900">
                                        Xác nhận xóa tài khoản?
                                    </h3>
                                    <div className="mt-2">
                                        <p className="text-sm text-slate-500">
                                            Bạn đang chuẩn bị xóa tài khoản của <span className="font-bold text-slate-700">{confirmDeleteId.name}</span>. Hành động này không thể hoàn tác.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                                <button
                                    type="button"
                                    disabled={isSubmitting}
                                    className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm transition-all active:scale-95"
                                    onClick={handleDelete}
                                >
                                    {isSubmitting ? 'Đang xóa...' : 'Xác nhận xóa'}
                                </button>
                                <button
                                    type="button"
                                    disabled={isSubmitting}
                                    className="mt-3 w-full inline-flex justify-center rounded-xl border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-all active:scale-95"
                                    onClick={() => setConfirmDeleteId(null)}
                                >
                                    Hủy bỏ
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Reset Password Confirmation Modal */}
            {confirmResetUser && (
                <div className="fixed inset-0 z-[60] overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                        <div className="fixed inset-0 bg-slate-500/75 backdrop-blur-sm transition-opacity" onClick={() => !isSubmitting && setConfirmResetUser(null)}></div>
                        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

                        <div className="relative inline-block align-bottom bg-white rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-slate-200">
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 text-center sm:text-left">
                                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-amber-100 sm:mx-0 sm:h-10 sm:w-10">
                                    <Key className="h-6 w-6 text-amber-600" />
                                </div>
                                <div className="mt-3 sm:mt-0 sm:ml-4">
                                    <h3 className="text-lg leading-6 font-bold text-slate-900">
                                        Đặt lại mật khẩu?
                                    </h3>
                                    <div className="mt-2">
                                        <p className="text-sm text-slate-500">
                                            Mật khẩu của <span className="font-bold text-slate-700">{confirmResetUser.name}</span> sẽ được đặt lại về <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-indigo-600 font-bold">123456</span>.
                                        </p>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse gap-2">
                                <button
                                    type="button"
                                    disabled={isSubmitting}
                                    className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-amber-600 text-base font-medium text-white hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 sm:ml-3 sm:w-auto sm:text-sm transition-all active:scale-95"
                                    onClick={doResetPassword}
                                >
                                    {isSubmitting ? 'Đang xử lý...' : 'Xác nhận reset'}
                                </button>
                                <button
                                    type="button"
                                    disabled={isSubmitting}
                                    className="mt-3 w-full inline-flex justify-center rounded-xl border border-slate-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm transition-all active:scale-95"
                                    onClick={() => setConfirmResetUser(null)}
                                >
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
