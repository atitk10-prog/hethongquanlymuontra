import { useState, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { format } from 'date-fns';
import { exportToXlsx } from '../utils/exportXlsx';
import {
  BarChart3, Download, Printer, Package, AlertTriangle, TrendingUp,
  Users, Monitor, Wrench, ChevronDown, ChevronUp
} from 'lucide-react';

export default function DeviceReport() {
  const { devices, borrowHistory, maintenanceHistory } = useData();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (s: string) => setExpandedSection(expandedSection === s ? null : s);

  // Filter borrows by date range
  const filteredBorrows = useMemo(() => {
    return borrowHistory.filter(b => {
      if (dateFrom) {
        try { if (new Date(b.borrow_date) < new Date(dateFrom)) return false; } catch {}
      }
      if (dateTo) {
        try {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59);
          if (new Date(b.borrow_date) > to) return false;
        } catch {}
      }
      return true;
    });
  }, [borrowHistory, dateFrom, dateTo]);

  // Summary stats
  const stats = useMemo(() => {
    const totalDevices = devices.length;
    const totalQty = devices.reduce((s, d) => s + (d.quantity || 1), 0);
    const totalValue = devices.reduce((s, d) => s + ((d.value || 0) * (d.quantity || 1)), 0);
    const damagedDevices = devices.filter(d => d.status === 'Hỏng' || d.status === 'Hỏng nhẹ');
    const totalDamaged = damagedDevices.reduce((s, d) => s + (d.damaged_qty || 0), 0);
    const activeBorrows = filteredBorrows.filter(b => b.status === 'Đang mượn' || b.status === 'Trả thiếu');
    const completedBorrows = filteredBorrows.filter(b => b.status === 'Đã trả');
    const totalMissing = filteredBorrows.reduce((s, b) => s + (b.missing_qty || 0), 0);
    const totalBorrowCount = filteredBorrows.length;
    const maintenanceCount = maintenanceHistory.length;
    const pendingMaintenance = maintenanceHistory.filter(m => m.result !== 'Đã sửa').length;

    return {
      totalDevices, totalQty, totalValue, damagedDevices, totalDamaged,
      activeBorrows, completedBorrows, totalMissing, totalBorrowCount,
      maintenanceCount, pendingMaintenance
    };
  }, [devices, filteredBorrows, maintenanceHistory]);

  // Top borrowed devices
  const topDevices = useMemo(() => {
    const counts: Record<string, { name: string; count: number; missingTotal: number }> = {};
    filteredBorrows.forEach(b => {
      if (!counts[b.device_id]) {
        const d = devices.find(dv => dv.id === b.device_id);
        counts[b.device_id] = { name: d?.name || b.device_id, count: 0, missingTotal: 0 };
      }
      counts[b.device_id].count++;
      counts[b.device_id].missingTotal += (b.missing_qty || 0);
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([id, data]) => ({ id, ...data }));
  }, [filteredBorrows, devices]);

  // Top teachers
  const topTeachers = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredBorrows.forEach(b => {
      counts[b.teacher] = (counts[b.teacher] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [filteredBorrows]);

  // By subject breakdown
  const bySubject = useMemo(() => {
    const groups: Record<string, { count: number; qty: number; damaged: number; value: number }> = {};
    devices.forEach(d => {
      const sub = d.subject || 'Khác';
      if (!groups[sub]) groups[sub] = { count: 0, qty: 0, damaged: 0, value: 0 };
      groups[sub].count++;
      groups[sub].qty += (d.quantity || 1);
      groups[sub].damaged += (d.damaged_qty || 0);
      groups[sub].value += (d.value || 0) * (d.quantity || 1);
    });
    return Object.entries(groups).sort(([, a], [, b]) => b.qty - a.qty);
  }, [devices]);

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const headers = ['STT', 'Mã TB', 'Tên TB', 'Bộ môn', 'Phòng', 'Số lượng', 'Hỏng', 'Tình trạng', 'Đơn giá', 'Tổng giá trị'];
    const rows = devices.map((d, i) => [
      i + 1, d.id, d.name, d.subject, d.room, d.quantity || 1, d.damaged_qty || 0,
      d.status, d.value || 0, (d.value || 0) * (d.quantity || 1)
    ]);
    exportToXlsx('Báo cáo thiết bị', headers, rows, `BaoCao_ThietBi_${format(new Date(), 'yyyyMMdd')}.xls`);
  };

  const formatCurrency = (v: number) => v.toLocaleString('vi-VN') + 'đ';

  const StatCard = ({ icon: Icon, label, value, sub, color }: { icon: any; label: string; value: string | number; sub?: string; color: string }) => (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-bold text-slate-900">{value}</div>
          <div className="text-xs text-slate-500">{label}</div>
          {sub && <div className="text-[10px] text-slate-400 mt-0.5">{sub}</div>}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-indigo-600" />
            Báo cáo tổng hợp thiết bị
          </h1>
          <p className="text-sm text-slate-500 mt-1">Thống kê và phân tích tình hình thiết bị</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport}
            className="inline-flex items-center px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 shadow-sm">
            <Download className="h-4 w-4 mr-1.5" /> Xuất Excel
          </button>
          <button onClick={handlePrint}
            className="inline-flex items-center px-3 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 shadow-sm">
            <Printer className="h-4 w-4 mr-1.5" /> In báo cáo
          </button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block text-center mb-4">
        <h1 className="text-xl font-bold">BÁO CÁO TỔNG HỢP THIẾT BỊ</h1>
        <p className="text-sm text-slate-600">Ngày: {format(new Date(), 'dd/MM/yyyy')}</p>
        {dateFrom && dateTo && <p className="text-sm">Kỳ: {dateFrom} → {dateTo}</p>}
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3 print:hidden">
        <label className="text-sm text-slate-600">Kỳ báo cáo:</label>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        <span className="text-slate-400">→</span>
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        {(dateFrom || dateTo) && (
          <button onClick={() => { setDateFrom(''); setDateTo(''); }}
            className="text-xs text-indigo-600 hover:underline">Xóa lọc</button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard icon={Monitor} label="Loại thiết bị" value={stats.totalDevices} sub={`${stats.totalQty} đơn vị`} color="bg-indigo-500" />
        <StatCard icon={Package} label="Tổng giá trị" value={formatCurrency(stats.totalValue)} color="bg-emerald-500" />
        <StatCard icon={TrendingUp} label="Lượt mượn" value={stats.totalBorrowCount} sub={`${stats.activeBorrows.length} đang mượn`} color="bg-blue-500" />
        <StatCard icon={AlertTriangle} label="Hỏng / Mất" value={`${stats.totalDamaged} / ${stats.totalMissing}`} color="bg-amber-500" />
        <StatCard icon={Wrench} label="Bảo trì" value={stats.maintenanceCount} sub={`${stats.pendingMaintenance} chưa xong`} color="bg-red-500" />
      </div>

      {/* By Subject */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button onClick={() => toggleSection('subject')} className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-800">Phân bổ theo bộ môn</h3>
          {expandedSection === 'subject' ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
        {expandedSection === 'subject' && (
          <div className="border-t border-slate-100">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-slate-500 uppercase">Bộ môn</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Loại</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Số lượng</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Hỏng</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-slate-500 uppercase">Giá trị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bySubject.map(([subject, data]) => (
                  <tr key={subject} className="hover:bg-slate-50">
                    <td className="px-4 py-2 text-sm font-medium text-slate-900">{subject}</td>
                    <td className="px-4 py-2 text-sm text-right text-slate-600">{data.count}</td>
                    <td className="px-4 py-2 text-sm text-right text-slate-600">{data.qty}</td>
                    <td className="px-4 py-2 text-sm text-right text-red-600">{data.damaged || 0}</td>
                    <td className="px-4 py-2 text-sm text-right text-slate-600">{formatCurrency(data.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Devices */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button onClick={() => toggleSection('devices')} className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-800">TOP 10 thiết bị mượn nhiều nhất</h3>
          {expandedSection === 'devices' ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
        {expandedSection === 'devices' && (
          <div className="border-t border-slate-100 divide-y divide-slate-100">
            {topDevices.map((d, i) => (
              <div key={d.id} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-slate-900">{d.name}</div>
                    <div className="text-xs text-slate-400 font-mono">{d.id}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-indigo-600">{d.count} lượt</div>
                  {d.missingTotal > 0 && <div className="text-[10px] text-red-500">Mất: {d.missingTotal}</div>}
                </div>
              </div>
            ))}
            {topDevices.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-400">Chưa có dữ liệu mượn</div>}
          </div>
        )}
      </div>

      {/* Top Teachers */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button onClick={() => toggleSection('teachers')} className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50">
          <h3 className="text-sm font-semibold text-slate-800">TOP 10 giáo viên mượn nhiều nhất</h3>
          {expandedSection === 'teachers' ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
        {expandedSection === 'teachers' && (
          <div className="border-t border-slate-100 divide-y divide-slate-100">
            {topTeachers.map((t, i) => (
              <div key={t.name} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-slate-900">{t.name}</span>
                </div>
                <span className="text-sm font-semibold text-emerald-600">{t.count} lượt</span>
              </div>
            ))}
            {topTeachers.length === 0 && <div className="px-4 py-6 text-center text-sm text-slate-400">Chưa có dữ liệu</div>}
          </div>
        )}
      </div>

      {/* Damaged Devices List */}
      {stats.damagedDevices.length > 0 && (
        <div className="bg-white rounded-xl border border-red-200 shadow-sm overflow-hidden">
          <button onClick={() => toggleSection('damaged')} className="w-full px-4 py-3 flex items-center justify-between hover:bg-red-50 bg-red-50/50">
            <h3 className="text-sm font-semibold text-red-800 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Thiết bị hỏng ({stats.damagedDevices.length})
            </h3>
            {expandedSection === 'damaged' ? <ChevronUp className="h-4 w-4 text-red-400" /> : <ChevronDown className="h-4 w-4 text-red-400" />}
          </button>
          {expandedSection === 'damaged' && (
            <div className="border-t border-red-100 divide-y divide-slate-100">
              {stats.damagedDevices.map(d => (
                <div key={d.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{d.name}</div>
                    <div className="text-xs text-slate-400">{d.room} - {d.subject}</div>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${d.status === 'Hỏng' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
