// API Service with Caching for Google Apps Script Backend
// Uses sessionStorage cache to reduce redundant API calls and improve load time

const GAS_URL = import.meta.env.VITE_GAS_URL || '';

// --- Cache Layer ---
const CACHE_DURATION = 2 * 60 * 1000; // 2 minutes

interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache = {
  get(key: string): any | null {
    try {
      const raw = localStorage.getItem(`api_cache_${key}`);
      if (!raw) return null;
      const entry: CacheEntry = JSON.parse(raw);
      if (Date.now() - entry.timestamp > CACHE_DURATION) {
        localStorage.removeItem(`api_cache_${key}`);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  },

  set(key: string, data: any): void {
    try {
      const entry: CacheEntry = { data, timestamp: Date.now() };
      localStorage.setItem(`api_cache_${key}`, JSON.stringify(entry));
    } catch {
      // localStorage full — ignore
    }
  },

  invalidate(prefix: string): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(`api_cache_${prefix}`)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {
      // ignore
    }
  },

  invalidateAll(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('api_cache_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {
      // ignore
    }
  }
};

// --- Types ---
export type Device = {
  id: string;
  name: string;
  subject: string;
  room: string;
  status: string;
  purchase_date: string;
  value: number;
  qr_code?: string;
  quantity: number;
  created_by: string;
  description?: string;
  supplier?: string;
  model?: string;
  damaged_qty?: number;
};

export type BorrowRecord = {
  id: string;
  device_id: string;
  teacher: string;
  class: string;
  period: string;
  borrow_date: string;
  return_date: string | null;
  status: string;
  note: string;
  quantity: number;
  returned_qty: number;
  missing_qty: number;
  missing_note: string;
};

export type MaintenanceRecord = {
  id: string;
  device_id: string;
  date: string;
  content: string;
  technician: string;
  result: string;
  room?: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  department: string;
  managed_rooms?: string;
  date_of_birth?: string;
  gender?: string;
  class_group?: string;
  photo_url?: string;
};

export type DashboardStats = {
  total: number;
  borrowing: number;
  broken: number;
  maintenance: number;
};

export type Room = {
  id: string;
  name: string;
  subject: string;
  description: string;
};

export type Book = {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  publisher: string;
  year: string;
  quantity: number;
  location: string;
  created_date: string;
};

export type BookBorrow = {
  id: string;
  book_id: string;
  borrower: string;
  borrower_type: string;
  class: string;
  borrow_date: string;
  due_date: string;
  return_date: string | null;
  status: string;
  quantity: number;
  note: string;
  returned_qty: number;
  damaged_qty: number;
  lost_qty: number;
  condition_note: string;
};

export type BookStats = {
  totalBooks: number;
  totalQuantity: number;
  activeBorrows: number;
  overdue: number;
  available: number;
  topBooks: { id: string; title: string; count: number }[];
  categoryStats: Record<string, number>;
};

// Helper function to call the GAS backend
const callApi = async (action: string, data: any = {}) => {
  if (!GAS_URL) {
    throw new Error('VITE_GAS_URL is not defined in .env file');
  }

  const url = `${GAS_URL}?action=${encodeURIComponent(action)}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const result = await response.json();

  if (result.error) {
    throw new Error(result.error);
  }

  return result;
};

// --- Mappers to handle backend column names ---
const mapDevice = (row: any): Device => ({
  id: row.device_id || row.id || '',
  name: row.device_name || row.name || '',
  subject: row.subject || '',
  room: row.room || '',
  status: row.status || '',
  purchase_date: row.purchase_date || '',
  value: Number(row.value) || 0,
  qr_code: row.qr_code || '',
  quantity: parseInt(row.quantity) || 1,
  created_by: row.created_by || '',
  description: row.description || '',
  supplier: row.supplier || '',
  model: row.model || '',
  damaged_qty: parseInt(row.damaged_qty) || 0,
});

const mapBorrow = (row: any): BorrowRecord => ({
  id: row.borrow_id || row.id || '',
  device_id: row.device_id || '',
  teacher: row.teacher || '',
  class: row.class || '',
  period: row.period || '',
  borrow_date: row.borrow_date || '',
  return_date: row.return_date || null,
  status: row.status || '',
  note: row.note || '',
  quantity: parseInt(row.quantity) || 1,
  returned_qty: parseInt(row.returned_qty) || 0,
  missing_qty: parseInt(row.missing_qty) || 0,
  missing_note: row.missing_note || '',
});

const mapMaintenance = (row: any): MaintenanceRecord => ({
  id: row.maintenance_id || row.id || '',
  device_id: row.device_id || '',
  date: row.date || '',
  content: row.content || '',
  technician: row.technician || '',
  result: row.result || '',
});

const mapBook = (row: any): Book => ({
  id: row.id || '',
  title: row.title || '',
  author: row.author || '',
  isbn: row.isbn || '',
  category: row.category || 'Khác',
  publisher: row.publisher || '',
  year: String(row.year || ''),
  quantity: parseInt(row.quantity) || 1,
  location: row.location || '',
  created_date: row.created_date || '',
});

const mapBookBorrow = (row: any): BookBorrow => ({
  id: row.id || '',
  book_id: row.book_id || '',
  borrower: row.borrower || '',
  borrower_type: row.borrower_type || 'GV',
  class: row.class || '',
  borrow_date: row.borrow_date || '',
  due_date: row.due_date || '',
  return_date: row.return_date || null,
  status: row.status || '',
  quantity: parseInt(row.quantity) || 1,
  note: row.note || '',
  returned_qty: parseInt(row.returned_qty) || 0,
  damaged_qty: parseInt(row.damaged_qty) || 0,
  lost_qty: parseInt(row.lost_qty) || 0,
  condition_note: row.condition_note || '',
});

const mapUser = (row: any): User => ({
  id: String(row.user_id || row.id || ''),
  name: row.name || '',
  email: row.email || '',
  password: row.password || '',
  role: row.role || '',
  department: row.department || '',
  managed_rooms: row.managed_rooms || '',
  date_of_birth: row.date_of_birth || '',
  gender: row.gender || '',
  class_group: row.class_group || '',
  photo_url: row.photo_url || '',
});

export const api = {
  // Cache management
  clearCache: () => cache.invalidateAll(),

  // Auth
  login: async (email: string, password: string) => {
    cache.invalidateAll(); // Clear cache on login
    return await callApi('login', { email, password });
  },

  // Devices (with caching)
  getDevices: async (): Promise<Device[]> => {
    const cached = cache.get('devices');
    if (cached) return cached;

    const data = await callApi('getDevices');
    const devices = data.map(mapDevice);
    cache.set('devices', devices);
    return devices;
  },

  getDevice: async (id: string): Promise<Device> => {
    // Always fetch fresh — this is used on DeviceAction where real-time data is critical
    const data = await callApi('getDevice', { id });
    return mapDevice(data);
  },

  addDevice: async (device: Omit<Device, 'id' | 'purchase_date' | 'value'>): Promise<{ success: boolean, id: string }> => {
    const result = await callApi('addDevice', device);
    cache.invalidate('devices'); // Invalidate device cache
    cache.invalidate('dashboard'); // Dashboard depends on devices
    return result;
  },

  updateDevice: async (id: string, updates: Partial<Device>): Promise<{ success: boolean }> => {
    const result = await callApi('updateDevice', { id, ...updates });
    cache.invalidate('devices');
    cache.invalidate('dashboard');
    return result;
  },

  deleteDevice: async (id: string): Promise<{ success: boolean }> => {
    const result = await callApi('deleteDevice', { id });
    cache.invalidate('devices');
    cache.invalidate('dashboard');
    return result;
  },

  // Borrow
  borrowDevice: async (data: { device_id: string; teacher: string; class: string; period: string; note: string; quantity?: number; borrow_date?: string; status?: string }): Promise<{ success: boolean, id: string, available: number }> => {
    const result = await callApi('borrowDevice', data);
    cache.invalidateAll(); // Clear all caches for realtime updates
    return result;
  },

  returnDevice: async (data: { device_id: string; borrow_id: string; teacher: string; returned_qty?: number; damaged_qty?: number; missing_qty?: number; missing_note?: string; status: string; note: string }): Promise<{ success: boolean }> => {
    const result = await callApi('returnDevice', data);
    cache.invalidateAll(); // Clear all caches for realtime updates
    return result;
  },

  getActiveBorrows: async (device_id: string): Promise<BorrowRecord[]> => {
    const data = await callApi('getActiveBorrows', { device_id });
    return data.map(mapBorrow);
  },

  returnMissing: async (data: { borrow_id: string; teacher: string; returned_qty: number; note?: string }): Promise<{ success: boolean }> => {
    const result = await callApi('returnMissing', data);
    cache.invalidate('borrow');
    cache.invalidate('devices');
    return result;
  },

  approveDeviceBorrow: async (data: { id: string }): Promise<{ success: boolean }> => {
    const result = await callApi('approveDeviceBorrow', data);
    cache.invalidate('borrow');
    return result;
  },

  rejectDeviceBorrow: async (data: { id: string }): Promise<{ success: boolean }> => {
    const result = await callApi('rejectDeviceBorrow', data);
    cache.invalidate('borrow');
    return result;
  },

  getBorrowHistory: async (): Promise<BorrowRecord[]> => {
    const cached = cache.get('borrowHistory');
    if (cached) return cached;

    const data = await callApi('getBorrowHistory');
    const history = data.map(mapBorrow);
    cache.set('borrowHistory', history);
    return history;
  },

  // Maintenance (with caching)
  getMaintenanceHistory: async (): Promise<MaintenanceRecord[]> => {
    const cached = cache.get('maintenance');
    if (cached) return cached;

    const data = await callApi('getMaintenanceHistory');
    const records = data.map(mapMaintenance);
    cache.set('maintenance', records);
    return records;
  },

  addMaintenance: async (data: Omit<MaintenanceRecord, 'id'>): Promise<{ success: boolean, id: string }> => {
    const result = await callApi('addMaintenance', data);
    cache.invalidate('maintenance');
    return result;
  },

  updateMaintenanceResult: async (data: { id: string; result: string; damaged_qty?: number; repaired_qty?: number }): Promise<{ success: boolean; auto_reset?: boolean }> => {
    const result = await callApi('updateMaintenanceResult', data);
    cache.invalidate('maintenance');
    cache.invalidate('devices');
    return result;
  },

  // Dashboard Stats — use backend getDashboardStats directly instead of downloading all devices
  getDashboardStats: async (department?: string): Promise<DashboardStats> => {
    const cacheKey = `dashboard_stats_${department || 'all'}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const stats = await callApi('getDashboardStats', { department: department || '' });
    cache.set(cacheKey, stats);
    return stats;
  },

  // Weekly usage stats — use backend directly
  getWeeklyUsageStats: async (department?: string): Promise<{ name: string; borrow: number; return: number }[]> => {
    const cacheKey = `dashboard_weekly_${department || 'all'}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

    const stats = await callApi('getWeeklyUsageStats', { department: department || '' });
    cache.set(cacheKey, stats);
    return stats;
  },

  // Users (with caching)
  getUsers: async (): Promise<User[]> => {
    const cached = cache.get('users');
    if (cached) return cached;

    const data = await callApi('getUsers');
    const users = data.map(mapUser);
    cache.set('users', users);
    return users;
  },

  addUser: async (user: Omit<User, 'id'> & { password?: string }): Promise<{ success: boolean, id: string }> => {
    const result = await callApi('addUser', user);
    cache.invalidate('users');
    return result;
  },

  updateUser: async (id: string, updates: Partial<User>): Promise<{ success: boolean }> => {
    const result = await callApi('updateUser', { id, user_id: id, ...updates });
    cache.invalidate('users');
    return result;
  },

  deleteUser: async (id: string): Promise<{ success: boolean }> => {
    const result = await callApi('deleteUser', { id, user_id: id });
    cache.invalidate('users');
    return result;
  },

  changePassword: async (id: string, currentPassword: string, newPassword: string): Promise<{ success: boolean }> => {
    return await callApi('changePassword', { id, user_id: id, currentPassword, newPassword });
  },

  // Rooms (with caching)
  getRooms: async (): Promise<Room[]> => {
    const cached = cache.get('rooms');
    if (cached) return cached;

    const data = await callApi('getRooms');
    cache.set('rooms', data);
    return data;
  },

  addRoom: async (room: Omit<Room, 'id'>): Promise<{ success: boolean; id: string }> => {
    const result = await callApi('addRoom', room);
    cache.invalidate('rooms');
    return result;
  },

  updateRoom: async (id: string, updates: Partial<Room>): Promise<{ success: boolean }> => {
    const result = await callApi('updateRoom', { id, ...updates });
    cache.invalidate('rooms');
    return result;
  },

  deleteRoom: async (id: string): Promise<{ success: boolean }> => {
    const result = await callApi('deleteRoom', { id });
    cache.invalidate('rooms');
    return result;
  },

  // Books (with caching)
  getBooks: async (): Promise<Book[]> => {
    const cached = cache.get('books');
    if (cached) return cached;

    const data = await callApi('getBooks');
    const books = data.map(mapBook);
    cache.set('books', books);
    return books;
  },

  addBook: async (book: Omit<Book, 'id' | 'created_date'>): Promise<{ success: boolean; id: string }> => {
    const result = await callApi('addBook', book);
    cache.invalidate('books');
    return result;
  },

  updateBook: async (id: string, updates: Partial<Book>): Promise<{ success: boolean }> => {
    const result = await callApi('updateBook', { id, ...updates });
    cache.invalidate('books');
    return result;
  },

  deleteBook: async (id: string): Promise<{ success: boolean }> => {
    const result = await callApi('deleteBook', { id });
    cache.invalidate('books');
    return result;
  },

  // Book Borrow
  borrowBook: async (data: { book_id: string; borrower: string; borrower_type: string; class?: string; quantity?: number; note?: string; borrow_date?: string; due_date?: string; status?: string }): Promise<{ success: boolean; id: string; available: number }> => {
    const result = await callApi('borrowBook', data);
    cache.invalidateAll();
    return result;
  },

  returnBook: async (data: { borrow_id: string; returned_qty?: number; damaged_qty?: number; lost_qty?: number; condition_note?: string; note?: string }): Promise<{ success: boolean; status: string }> => {
    const result = await callApi('returnBook', data);
    cache.invalidateAll();
    return result;
  },

  approveBookBorrow: async (borrowId: string): Promise<{ success: boolean }> => {
    const result = await callApi('approveBookBorrow', { borrow_id: borrowId });
    cache.invalidate('bookBorrows');
    cache.invalidate('books');
    return result;
  },

  rejectBookBorrow: async (borrowId: string): Promise<{ success: boolean }> => {
    const result = await callApi('rejectBookBorrow', { borrow_id: borrowId });
    cache.invalidate('bookBorrows');
    return result;
  },

  borrowMultipleBooks: async (data: { borrower: string; borrower_type: string; class?: string; note?: string; status?: string; items: { book_id: string; quantity: number }[] }): Promise<{ success: boolean; ids: string[]; count: number }> => {
    const result = await callApi('borrowMultipleBooks', data);
    cache.invalidateAll();
    return result;
  },

  getBookBorrowHistory: async (): Promise<BookBorrow[]> => {
    const cached = cache.get('bookBorrows');
    if (cached) return cached;

    const data = await callApi('getBookBorrowHistory');
    const borrows = data.map(mapBookBorrow);
    cache.set('bookBorrows', borrows);
    return borrows;
  },

  getBookStats: async (): Promise<BookStats> => {
    const cached = cache.get('bookStats');
    if (cached) return cached;

    const stats = await callApi('getBookStats');
    cache.set('bookStats', stats);
    return stats;
  },

  // Upload photo to Google Drive
  uploadPhoto: async (base64: string, fileName: string, mimeType: string): Promise<{ success: boolean; url: string; fileId: string }> => {
    return await callApi('uploadPhoto', { base64, fileName, mimeType });
  },
};
