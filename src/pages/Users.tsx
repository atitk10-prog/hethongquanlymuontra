import React, { useState, useRef } from 'react';
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
    ChevronRight,
    Upload,
    Printer,
    FileSpreadsheet,
    QrCode,
    Download
} from 'lucide-react';
import { useAuth } from '../store/auth';
import { useData } from '../context/DataContext';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';
import { createRoot } from 'react-dom/client';

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
    const [isUploading, setIsUploading] = useState(false);

    const { user: currentUser } = useAuth();

    // Auto-convert old Drive thumbnail URLs to displayable format
    const fixPhotoUrl = (url: string) => {
        if (!url) return '';
        // Convert: drive.google.com/thumbnail?id=XXX&sz=w400 -> lh3.googleusercontent.com/d/XXX=w400
        const thumbMatch = url.match(/drive\.google\.com\/thumbnail\?id=([^&]+)/);
        if (thumbMatch) return 'https://lh3.googleusercontent.com/d/' + thumbMatch[1] + '=w400';
        return url;
    };

    // Permission helpers
    const canManage = (u: User) => {
        if (u.id === currentUser?.id) return false; // Không sửa/xóa chính mình
        return true;
    };

    const [formUser, setFormUser] = useState({
        name: '',
        email: '',
        role: 'teacher',
        department: '',
        password: '',
        managed_rooms: '' as string,
        date_of_birth: '',
        gender: '',
        class_group: '',
        photo_url: ''
    });

    // Import & Print states
    const [showImportModal, setShowImportModal] = useState(false);
    const [importData, setImportData] = useState<any[]>([]);
    const [importProgress, setImportProgress] = useState({ done: 0, total: 0, running: false });
    const [showPrintModal, setShowPrintModal] = useState(false);
    const [schoolName, setSchoolName] = useState('');
    const [logoBase64, setLogoBase64] = useState('');
    const [selectedForPrint, setSelectedForPrint] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

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
            managed_rooms: '',
            date_of_birth: '',
            gender: '',
            class_group: '',
            photo_url: ''
        });
        setShowAddModal(true);
    };

    // Convert any date format to YYYY-MM-DD for HTML date input
    const toDateInputFormat = (dateStr: string): string => {
        if (!dateStr) return '';
        // Already YYYY-MM-DD
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
        // Try DD/MM/YYYY
        const parts = dateStr.split('/');
        if (parts.length === 3 && parts[2].length === 4) {
            return parts[2] + '-' + parts[1].padStart(2, '0') + '-' + parts[0].padStart(2, '0');
        }
        // Try Date parsing
        try {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) {
                return d.toISOString().split('T')[0];
            }
        } catch {}
        return dateStr;
    };

    const openEditModal = (user: User) => {
        setEditingUser(user);
        setFormUser({
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department,
            password: '',
            managed_rooms: user.managed_rooms || '',
            date_of_birth: toDateInputFormat(user.date_of_birth || ''),
            gender: user.gender || '',
            class_group: user.class_group || '',
            photo_url: user.photo_url || ''
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
                    managed_rooms: formUser.managed_rooms,
                    date_of_birth: formUser.date_of_birth,
                    gender: formUser.gender,
                    class_group: formUser.class_group,
                    photo_url: formUser.photo_url
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
                    password: formUser.password || '123456',
                    date_of_birth: formUser.date_of_birth,
                    gender: formUser.gender,
                    class_group: formUser.class_group,
                    photo_url: formUser.photo_url
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
                    password: '',
                    date_of_birth: formUser.date_of_birth,
                    gender: formUser.gender,
                    class_group: formUser.class_group,
                    photo_url: formUser.photo_url
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
            case 'librarian': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
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
            case 'librarian': return 'Thủ thư';
            case 'student': return 'Học sinh';
            default: return role;
        }
    };

    // Excel import handler
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const wb = XLSX.read(evt.target?.result, { type: 'binary' });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const data = XLSX.utils.sheet_to_json(ws) as any[];
            setImportData(data);
            setShowImportModal(true);
        };
        reader.readAsBinaryString(file);
        e.target.value = '';
    };

    const runImport = async () => {
        setImportProgress({ done: 0, total: importData.length, running: true });
        let successCount = 0;
        for (let i = 0; i < importData.length; i++) {
            const row = importData[i];
            try {
                await api.addUser({
                    name: String(row['Họ tên'] || row['name'] || row['Name'] || ''),
                    email: String(row['Email'] || row['email'] || ''),
                    role: String(row['Vai trò'] || row['role'] || 'student'),
                    department: String(row['Phòng ban'] || row['Lớp'] || row['department'] || row['Tổ'] || ''),
                    password: String(row['Mật khẩu'] || row['password'] || '123456'),
                    date_of_birth: String(row['Ngày sinh'] || row['dob'] || ''),
                    gender: String(row['Giới tính'] || row['gender'] || ''),
                    class_group: String(row['Lớp/Tổ'] || row['class'] || row['Lớp'] || '')
                });
                successCount++;
            } catch (e) { /* skip failed row */ }
            setImportProgress({ done: i + 1, total: importData.length, running: true });
        }
        setImportProgress(p => ({ ...p, running: false }));
        showToast(`Nhập thành công ${successCount}/${importData.length} tài khoản`);
        setShowImportModal(false);
        setImportData([]);
        refreshUsers();
    };

    // Format date to DD/MM/YYYY
    const formatDateDMY = (dateStr: string): string => {
        if (!dateStr) return '';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            return dd + '/' + mm + '/' + yyyy;
        } catch { return dateStr; }
    };

    // Convert image URL to base64 data URL for reliable printing
    // Falls back to original URL if CORS blocks conversion
    const imgToBase64 = (url: string): Promise<string> => {
        return new Promise((resolve) => {
            if (!url) { resolve(''); return; }
            if (url.startsWith('data:')) { resolve(url); return; }
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    const ctx = canvas.getContext('2d');
                    if (ctx) { ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL('image/png')); }
                    else resolve(url); // fallback to original URL
                } catch { resolve(url); } // CORS blocked → use original URL
            };
            img.onerror = () => resolve(url); // load failed → still try original URL
            img.src = url;
        });
    };

    // Generate card HTML
    const generateCardHtml = async (usersToPrint: User[]) => {
        // Convert all user photos to base64 in parallel
        const photoMap: Record<string, string> = {};
        await Promise.all(usersToPrint.map(async u => {
            if (u.photo_url) {
                photoMap[u.id] = await imgToBase64(u.photo_url);
            }
        }));

        // Generate QR codes
        const qrMap: Record<string, string> = {};
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'absolute';
        tempDiv.style.left = '-9999px';
        document.body.appendChild(tempDiv);

        usersToPrint.forEach(u => {
            const qrContainer = document.createElement('div');
            tempDiv.appendChild(qrContainer);
            const root = createRoot(qrContainer);
            root.render(React.createElement(QRCodeSVG, { value: `USER:${u.id}`, size: 110, level: 'M' }));
        });

        return new Promise<string>((resolve) => {
            setTimeout(() => {
                const qrDivs = tempDiv.querySelectorAll('div');
                usersToPrint.forEach((u, i) => {
                    const svg = qrDivs[i]?.querySelector('svg');
                    qrMap[u.id] = svg ? svg.outerHTML : '';
                });
                document.body.removeChild(tempDiv);

                const getTheme = (role: string) => {
                    switch (role) {
                        case 'student':      return { hdr: '#6b21a8', hdr2: '#9333ea', gold: '#f0c040', type: '#6b21a8' };
                        case 'teacher':      return { hdr: '#1e6e3e', hdr2: '#27ae60', gold: '#f0c040', type: '#1e6e3e' };
                        case 'librarian':    return { hdr: '#7d6608', hdr2: '#d4ac0d', gold: '#f8d030', type: '#7d6608' };
                        case 'admin': case 'vice_principal': return { hdr: '#922b21', hdr2: '#c0392b', gold: '#f0c040', type: '#922b21' };
                        default:             return { hdr: '#1b4f72', hdr2: '#2e86c1', gold: '#f0c040', type: '#1b4f72' };
                    }
                };

                const getCardLabel = (role: string) => {
                    switch (role) {
                        case 'student':        return 'TH\u1eba H\u1eccC SINH';
                        case 'teacher':        return 'TH\u1eba GI\u00c1O VI\u00caN';
                        case 'librarian':      return 'TH\u1eba TH\u1ee6 TH\u01af';
                        case 'admin':          return 'TH\u1eba QU\u1ea2N TR\u1eca';
                        case 'vice_principal': return 'TH\u1eba BAN GI\u00c1M HI\u1ec6U';
                        case 'equipment':      return 'TH\u1eba QU\u1ea2N L\u00dd THI\u1ebeT B\u1eca';
                        default:               return 'TH\u1eba C\u00c1N B\u1ed8 THI\u1ebeT B\u1eca';
                    }
                };

                // Big centered watermark logo, moved further down for better centering
                const logoWatermark = logoBase64
                    ? '<div style="position:absolute;top:64%;left:50%;transform:translate(-50%,-50%);width:180px;height:180px;opacity:0.06;pointer-events:none;z-index:0"><img src="' + logoBase64 + '" style="width:100%;height:100%;object-fit:contain" /></div>'
                    : '';

                const buildCard = (u: User) => {
                    const t = getTheme(u.role);
                    const cardLabel = getCardLabel(u.role);
                    const initial = u.name.charAt(0);
                    const dob = u.date_of_birth ? formatDateDMY(u.date_of_birth) : '';
                    const gender = u.gender || '';
                    const isStudent = u.role === 'student';
                    const groupLabel = isStudent ? 'L\u1edbp' : 'T\u1ed5/Ph\u00f2ng';
                    const groupVal = u.class_group || u.department || '';
                    // Smart name: viết tắt tên đệm nếu quá dài
                    const fullUpper = u.name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
                    let upperName = fullUpper;
                    if (fullUpper.length > 14) {
                        const parts = fullUpper.split(' ').filter(Boolean);
                        if (parts.length > 2) {
                            const ho = parts[0];
                            const ten = parts[parts.length - 1];
                            const dem = parts.slice(1, -1).map(p => p.charAt(0) + '.').join(' ');
                            upperName = ho + ' ' + dem + ' ' + ten;
                        }
                    }

                    const b64 = photoMap[u.id] || '';
                    const photoHtml = b64
                        ? '<img src="' + b64 + '" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:3px" />'
                        : '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#dbeafe,#bfdbfe);color:#1e40af;font-size:24px;font-weight:900;border-radius:3px">' + initial + '</div>';

                    const logoHtml = logoBase64
                        ? '<img src="' + logoBase64 + '" style="height:34px;width:34px;object-fit:contain;border-radius:50%;background:#fff;border:2px solid rgba(255,255,255,0.5)" />'
                        : '';

                    var infoLines = '';
                    if (dob) infoLines += '<div class="info-line"><span class="il">Ng\u00e0y sinh:</span> <span class="iv">' + dob + '</span></div>';
                    if (groupVal) infoLines += '<div class="info-line"><span class="il">' + groupLabel + ':</span> <span class="iv">' + groupVal + '</span></div>';
                    if (gender) infoLines += '<div class="info-line"><span class="il">Gi\u1edbi t\u00ednh:</span> <span class="iv">' + gender + '</span></div>';

                    return '<div class="card">' +
                        logoWatermark +
                        '<div class="hdr" style="background:linear-gradient(135deg,' + t.hdr + ' 0%,' + t.hdr2 + ' 100%)">' +
                            (logoHtml ? '<div class="logo-wrap">' + logoHtml + '</div>' : '') +
                            '<div class="hdr-txt">' + (schoolName || '') + '</div>' +
                        '</div>' +
                        '<div class="gold-bar" style="background:linear-gradient(90deg,' + t.hdr + ' 0%,' + t.gold + ' 35%,' + t.gold + ' 65%,' + t.hdr2 + ' 100%)"></div>' +
                        '<div class="card-type-row"><div class="card-type" style="color:' + t.type + '">' + cardLabel + '</div></div>' +
                        '<div class="body">' +
                            '<div class="photo-frame">' + photoHtml + '</div>' +
                            '<div class="info-col">' +
                                '<div class="info-line name-line"><span class="il">H\u1ecd v\u00e0 t\u00ean:</span> <span class="iv-name" style="' + (upperName.length > 20 ? 'font-size:9px' : upperName.length > 16 ? 'font-size:10px' : '') + '">' + upperName + '</span></div>' +
                                infoLines +
                            '</div>' +
                            '<div class="qr-col"><div class="qr-frame">' + qrMap[u.id] + '</div></div>' +
                        '</div>' +
                        '<div class="footer-bar" style="background:linear-gradient(90deg,' + t.hdr + ',' + t.hdr2 + ')"></div>' +
                    '</div>';
                };

                const pages: string[] = [];
                for (let i = 0; i < usersToPrint.length; i += 4) {
                    const pageCards = usersToPrint.slice(i, i + 4).map(buildCard).join('');
                    pages.push('<div class="page"><div class="grid">' + pageCards + '</div></div>');
                }

                const css = `@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap');
@page{size:A4 portrait;margin:10mm}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Be Vietnam Pro',system-ui,sans-serif;background:#cbd5e1;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.page{width:190mm;margin:6px auto;background:#f1f5f9;padding:6mm;page-break-after:always}
.page:last-child{page-break-after:auto}
.grid{display:grid;grid-template-columns:repeat(2,85.6mm);grid-template-rows:repeat(2,54mm);gap:5mm;justify-content:center}
.card{width:85.6mm;height:54mm;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;background:#fefefe;box-shadow:0 2px 8px rgba(0,0,0,.18);position:relative}
.hdr{display:flex;align-items:center;gap:7px;padding:4px 9px;flex-shrink:0;z-index:1;position:relative}
.logo-wrap{flex-shrink:0}
.hdr-txt{font-size:11px;font-weight:900;color:#fff;text-transform:uppercase;letter-spacing:.5px;text-shadow:0 1px 2px rgba(0,0,0,.25);line-height:1.2;flex:1}
.gold-bar{height:3px;flex-shrink:0;z-index:1;position:relative}
.card-type-row{text-align:center;padding:22px 0 3px;z-index:1;position:relative}
.card-type{font-size:18px;font-weight:900;letter-spacing:.5px;line-height:1.1}
.body{display:flex;flex:1;padding:0 7px 3px;gap:7px;overflow:hidden;position:relative;z-index:1;align-items:flex-start}
.photo-frame{width:50px;height:65px;border-radius:4px;overflow:hidden;border:1.5px solid #94a3b8;box-shadow:0 1px 3px rgba(0,0,0,.12);flex-shrink:0;margin-top:2px}
.info-col{flex:1;min-width:0;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-start;align-items:flex-start;padding-top:2px}
.info-line{font-size:8.5px;margin-bottom:1.5px;text-align:left;overflow:hidden}
.info-line .il{color:#555;font-weight:500;display:inline-block;width:52px}
.info-line .iv{color:#111;font-weight:700;margin-left:2px}
.info-line .name-line{text-align:center;white-space:normal!important}
.iv-name{color:#111;font-weight:800;font-size:11px;display:inline;word-break:break-word}
.qr-col{flex-shrink:0;display:flex;align-items:flex-start;justify-content:flex-end;padding-top:2px;margin-left:auto}
.qr-frame{border:1.5px solid #94a3b8;border-radius:4px;padding:2px;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.1)}
.qr-frame svg{display:block;width:66px!important;height:66px!important}
.footer-bar{height:24px;flex-shrink:0;z-index:1;position:relative;margin-top:auto}
@media print{body{background:#fff}.page{margin:0;box-shadow:none;background:transparent;padding:4mm 5mm}}
@media screen{.page{box-shadow:0 4px 20px rgba(0,0,0,.12);border-radius:4px}}`;

                const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Th\u1ebb m\u01b0\u1ee3n tr\u1ea3</title><style>' + css + '</style></head><body>' + pages.join('') + '</body></html>';
                resolve(html);
            }, 150);
        });
    };


    // Print cards (open in new tab)
    const printCards = async () => {
        const usersToPrint = selectedForPrint.length > 0 ? users.filter(u => selectedForPrint.includes(u.id)) : users;
        const html = await generateCardHtml(usersToPrint);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    };

    // Download cards as HTML file
    const downloadCards = async () => {
        const usersToPrint = selectedForPrint.length > 0 ? users.filter(u => selectedForPrint.includes(u.id)) : users;
        const html = await generateCardHtml(usersToPrint);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `the_muon_tra_${new Date().toISOString().split('T')[0]}.html`;
        a.click();
        URL.revokeObjectURL(url);
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
                <div className="flex items-center gap-2 flex-wrap">
                    <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
                    <button onClick={() => {
                        const ws = XLSX.utils.aoa_to_sheet([
                            ['Họ tên', 'Email', 'Vai trò', 'Tổ/Lớp', 'Ngày sinh', 'Giới tính', 'Mật khẩu'],
                            ['Nguyễn Văn A', 'nva@school.edu.vn', 'student', '10A1', '2010-05-15', 'Nam', '123456'],
                            ['Trần Thị B', 'ttb@school.edu.vn', 'student', '10A2', '2010-08-20', 'Nữ', '123456'],
                            ['Lê Văn C', 'lvc@school.edu.vn', 'teacher', 'Toán - Tin', '', 'Nam', '123456']
                        ]);
                        ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 12 }, { wch: 15 }, { wch: 14 }, { wch: 10 }, { wch: 12 }];
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, 'Danh sách');
                        XLSX.writeFile(wb, 'mau_nhap_tai_khoan.xlsx');
                    }}
                        className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-all">
                        <FileSpreadsheet className="-ml-0.5 mr-1.5 h-4 w-4 text-emerald-600" /> File mẫu
                    </button>
                    <button onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-all">
                        <Upload className="-ml-0.5 mr-1.5 h-4 w-4" /> Nhập Excel
                    </button>
                    <button onClick={() => { setSelectedForPrint([]); setShowPrintModal(true); }}
                        className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-all">
                        <Printer className="-ml-0.5 mr-1.5 h-4 w-4" /> In thẻ
                    </button>
                    <button onClick={openAddModal}
                        className="inline-flex items-center rounded-xl border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 transition-all active:scale-95">
                        <UserPlus className="-ml-1 mr-2 h-5 w-5" /> Thêm tài khoản
                    </button>
                </div>
            </div>

            {/* Toast Notification */}
            {toast && (
                <div className="fixed bottom-20 md:bottom-4 right-4 z-[100] animate-in fade-in slide-in-from-bottom-4 duration-300">
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
                                                <div className="h-10 w-10 flex-shrink-0 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold overflow-hidden">
                                                    {u.photo_url ? <img src={fixPhotoUrl(u.photo_url)} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling && ((e.target as HTMLImageElement).parentElement!.innerHTML = u.name.charAt(0).toUpperCase()); }} /> : u.name.charAt(0).toUpperCase()}
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
                                                    disabled={!canManage(u)}
                                                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                                    title={!canManage(u) ? 'Không có quyền' : 'Reset mật khẩu'}
                                                >
                                                    <Key className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => openEditModal(u)}
                                                    disabled={!canManage(u)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                                    title={!canManage(u) ? 'Không có quyền' : 'Sửa'}
                                                >
                                                    <Edit className="h-5 w-5" />
                                                </button>
                                                <button
                                                    onClick={() => setConfirmDeleteId(u)}
                                                    disabled={!canManage(u)}
                                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                                                    title={!canManage(u) ? 'Không có quyền' : 'Xóa'}
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
                                        <div className="h-9 w-9 flex-shrink-0 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-sm overflow-hidden">
                                            {u.photo_url ? <img src={fixPhotoUrl(u.photo_url)} className="w-full h-full object-cover" /> : u.name.charAt(0).toUpperCase()}
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
                                        <button onClick={() => handleResetPassword(u)} disabled={!canManage(u)} className="p-2 text-slate-400 hover:text-amber-600 rounded-lg disabled:opacity-30" title={!canManage(u) ? 'Không có quyền' : 'Reset'}>
                                            <Key className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => openEditModal(u)} disabled={!canManage(u)} className="p-2 text-slate-400 hover:text-indigo-600 rounded-lg disabled:opacity-30" title={!canManage(u) ? 'Không có quyền' : 'Sửa'}>
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => setConfirmDeleteId(u)} disabled={!canManage(u)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg disabled:opacity-30" title={!canManage(u) ? 'Không có quyền' : 'Xóa'}>
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
                                                    className="w-full rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 transition-all border p-2 disabled:opacity-60 disabled:bg-slate-100"
                                                    value={formUser.role}
                                                    onChange={(e) => setFormUser({ ...formUser, role: e.target.value })}
                                                    disabled={editingUser?.id === currentUser?.id}
                                                >
                                                    <option value="teacher">Giáo viên</option>
                                                    <option value="student">Học sinh</option>
                                                    <option value="leader">Tổ trưởng</option>
                                                    <option value="equipment">Cán bộ thiết bị</option>
                                                    <option value="librarian">Thủ thư</option>
                                                    <option value="vice_principal">BGH</option>
                                                    {(currentUser?.role === 'admin' || currentUser?.role === 'vice_principal') && <option value="admin">Quản trị viên</option>}
                                                </select>
                                                {editingUser?.id === currentUser?.id && <p className="text-[10px] text-amber-600 mt-1">Không thể tự đổi vai trò của mình</p>}
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1">Tổ/Lớp</label>
                                                <input
                                                    type="text"
                                                    required
                                                    className="w-full rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 transition-all border p-2"
                                                    value={formUser.department}
                                                    onChange={(e) => setFormUser({ ...formUser, department: e.target.value })}
                                                    placeholder="Toán - Tin / 10A1"
                                                />
                                            </div>
                                        </div>

                                        {rooms.length > 0 && ['equipment', 'teacher', 'leader'].includes(formUser.role) && (
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-2">Phòng quản lý</label>
                                                <p className="text-xs text-slate-400 mb-2">Chọn phòng mà người dùng sẽ quản lý thiết bị. Được phân phòng = thấy thiết bị phòng đó và cho phép mượn/trả.</p>
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

                                        {/* DOB, Gender fields */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1">Ngày sinh</label>
                                                <input type="date" className="w-full rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 border p-2 text-sm"
                                                    value={formUser.date_of_birth} onChange={e => setFormUser({ ...formUser, date_of_birth: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-semibold text-slate-700 mb-1">Giới tính</label>
                                                <select className="w-full rounded-xl border-slate-300 focus:ring-2 focus:ring-indigo-500 border p-2 text-sm"
                                                    value={formUser.gender} onChange={e => setFormUser({ ...formUser, gender: e.target.value })}>
                                                    <option value="">--</option>
                                                    <option value="Nam">Nam</option>
                                                    <option value="Nữ">Nữ</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* Photo Upload */}
                                        <div>
                                            <label className="block text-sm font-semibold text-slate-700 mb-1">{'Ảnh thẻ'}</label>
                                            <div className="flex items-start gap-3">
                                                <div className="w-16 h-16 rounded-lg border border-slate-200 overflow-hidden flex-shrink-0 bg-indigo-50 flex items-center justify-center">
                                                    {formUser.photo_url ? (
                                                        <img src={fixPhotoUrl(formUser.photo_url)} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                                    ) : (
                                                        <span className="text-indigo-600 font-bold text-xl">{formUser.name?.charAt(0) || '?'}</span>
                                                    )}
                                                </div>
                                                <div className="flex-1">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={async (e) => {
                                                            const file = e.target.files?.[0];
                                                            if (!file) return;
                                                            if (file.size > 1 * 1024 * 1024) {
                                                                showToast('Ảnh quá lớn (' + (file.size / 1024 / 1024).toFixed(2) + 'MB)! Tối đa 1MB', 'error');
                                                                e.target.value = '';
                                                                return;
                                                            }
                                                            const reader = new FileReader();
                                                            reader.onload = async (ev) => {
                                                                const base64 = ev.target?.result as string;
                                                                if (!base64) return;
                                                                setIsUploading(true);
                                                                showToast('Đang tải ảnh lên Google Drive...');
                                                                try {
                                                                    const uniqueName = Date.now() + '_' + file.name.replace(/[^a-zA-Z0-9.]/g, '_');
                                                                    const result = await api.uploadPhoto(base64, uniqueName, file.type);
                                                                    setFormUser(prev => ({ ...prev, photo_url: result.url }));
                                                                    setIsUploading(false);
                                                                    showToast('Tải ảnh lên thành công!');
                                                                } catch (err: any) {
                                                                    setIsUploading(false);
                                                                    showToast(err.message || 'Lỗi tải ảnh lên', 'error');
                                                                }
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }}
                                                        className="w-full rounded-xl border-slate-300 border p-1.5 text-xs file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-semibold file:text-xs hover:file:bg-indigo-100 cursor-pointer"
                                                    />
                                                    <p className={"text-[10px] text-slate-400 mt-0.5"}>{'Chọn ảnh từ máy tính (tối đa 1MB)'}</p>
                                                </div>
                                            </div>
                                        </div>

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
                                        disabled={isSubmitting || isUploading}
                                        className="w-full inline-flex justify-center rounded-xl border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 transition-all active:scale-95"
                                    >
                                        {isUploading ? 'Đang tải ảnh...' : isSubmitting ? 'Đang lưu...' : 'Lưu tài khoản'}
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

            {/* Import Excel Modal */}
            {showImportModal && (
                <div className="fixed inset-0 z-[60] overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen p-4">
                        <div className="fixed inset-0 bg-slate-500/75 backdrop-blur-sm" onClick={() => !importProgress.running && setShowImportModal(false)}></div>
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-200 z-10">
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
                                    Nhập từ Excel ({importData.length} dòng)
                                </h3>
                                <button onClick={() => !importProgress.running && setShowImportModal(false)} className="text-slate-400 hover:text-slate-600">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                            <div className="p-5 max-h-80 overflow-auto">
                                <table className="w-full text-xs">
                                    <thead>
                                        <tr className="bg-slate-50">
                                            <th className="p-2 text-left">#</th>
                                            <th className="p-2 text-left">Họ tên</th>
                                            <th className="p-2 text-left">Email</th>
                                            <th className="p-2 text-left">Vai trò</th>
                                            <th className="p-2 text-left">Lớp/Tổ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {importData.slice(0, 50).map((row, i) => (
                                            <tr key={i} className="border-t border-slate-100">
                                                <td className="p-2 text-slate-400">{i + 1}</td>
                                                <td className="p-2 font-medium">{row['Họ tên'] || row['name'] || row['Name'] || '-'}</td>
                                                <td className="p-2 text-slate-500">{row['Email'] || row['email'] || '-'}</td>
                                                <td className="p-2">{row['Vai trò'] || row['role'] || 'student'}</td>
                                                <td className="p-2">{row['Lớp/Tổ'] || row['Lớp'] || row['class'] || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {importData.length > 50 && <p className="text-xs text-slate-400 mt-2 text-center">... và {importData.length - 50} dòng nữa</p>}
                                <p className="text-xs text-slate-400 mt-3">Cột Excel: Họ tên, Email, Vai trò, Phòng ban, Lớp/Tổ, Ngày sinh, Giới tính, Mật khẩu</p>
                            </div>
                            {importProgress.running && (
                                <div className="px-5 pb-3">
                                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                                        <div className="h-full bg-indigo-600 rounded-full transition-all" style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}></div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1 text-center">{importProgress.done}/{importProgress.total}</p>
                                </div>
                            )}
                            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
                                <button onClick={() => setShowImportModal(false)} disabled={importProgress.running}
                                    className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
                                <button onClick={runImport} disabled={importProgress.running || importData.length === 0}
                                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5">
                                    <Upload className="h-4 w-4" /> {importProgress.running ? `Đang nhập ${importProgress.done}/${importProgress.total}...` : `Nhập ${importData.length} tài khoản`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Cards Modal */}
            {showPrintModal && (
                <div className="fixed inset-0 z-[60] overflow-y-auto">
                    <div className="flex items-center justify-center min-h-screen p-4">
                        <div className="fixed inset-0 bg-slate-500/75 backdrop-blur-sm" onClick={() => setShowPrintModal(false)}></div>
                        <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 z-10">
                            <div className="p-5 border-b border-slate-100">
                                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                    <Printer className="h-5 w-5 text-indigo-600" />
                                    In thẻ mượn trả
                                </h3>
                            </div>
                            <div className="p-5 space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Tên trường / Đơn vị</label>
                                    <input type="text" value={schoolName} onChange={e => setSchoolName(e.target.value)}
                                        placeholder="VD: TRƯỜNG THCS NGUYỄN DU" className="w-full rounded-xl border-slate-300 border p-2.5 text-sm focus:ring-2 focus:ring-indigo-500" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Logo trường (upload từ máy)</label>
                                    <input type="file" accept="image/*" onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (ev) => setLogoBase64(ev.target?.result as string || '');
                                            reader.readAsDataURL(file);
                                        }
                                    }} className="w-full rounded-xl border-slate-300 border p-2 text-sm file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:text-indigo-700 file:font-semibold file:text-xs hover:file:bg-indigo-100" />
                                    {logoBase64 && <img src={logoBase64} alt="Logo" className="mt-2 h-12 w-12 object-contain rounded-lg border border-slate-200" />}
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">In cho ai?</label>
                                    <div className="space-y-1 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2">
                                        <label className="flex items-center p-2 rounded-lg cursor-pointer hover:bg-indigo-50">
                                            <input type="checkbox" checked={selectedForPrint.length === 0}
                                                onChange={() => setSelectedForPrint([])} className="rounded border-slate-300 text-indigo-600 mr-3" />
                                            <span className="text-sm font-medium">Tất cả ({users.length} người)</span>
                                        </label>
                                        {users.map(u => (
                                            <label key={u.id} className={`flex items-center p-1.5 rounded-lg cursor-pointer text-sm ${selectedForPrint.includes(u.id) ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                                                <input type="checkbox" checked={selectedForPrint.includes(u.id)}
                                                    onChange={() => setSelectedForPrint(prev => prev.includes(u.id) ? prev.filter(id => id !== u.id) : [...prev, u.id])}
                                                    className="rounded border-slate-300 text-indigo-600 mr-2" />
                                                <span>{u.name}</span>
                                                <span className="ml-auto text-xs text-slate-400">{getRoleLabel(u.role)}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                                {/* Preview */}
                                <div className="border border-indigo-200 rounded-xl p-3 text-center bg-indigo-50/50">
                                    <p className="text-[10px] font-bold text-slate-600 uppercase">{schoolName || 'TÊN TRƯỜNG'}</p>
                                    <p className="text-sm font-black text-indigo-700 mt-1">THẺ HỌC SINH</p>
                                    <div className="flex items-center justify-center gap-4 mt-2">
                                        <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 font-bold text-lg">A</div>
                                        <QRCodeSVG value="USER:PREVIEW" size={48} />
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Họ tên • Ngày sinh • Lớp</p>
                                </div>
                            </div>
                            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
                                <button onClick={() => setShowPrintModal(false)}
                                    className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50">Hủy</button>
                                <button onClick={() => { downloadCards(); setShowPrintModal(false); }}
                                    className="px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 text-sm font-medium hover:bg-emerald-100 flex items-center gap-1.5">
                                    <Download className="h-4 w-4" /> Tải file
                                </button>
                                <button onClick={() => { printCards(); setShowPrintModal(false); }}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 flex items-center gap-1.5">
                                    <Printer className="h-4 w-4" /> In {selectedForPrint.length > 0 ? selectedForPrint.length : users.length} thẻ
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
