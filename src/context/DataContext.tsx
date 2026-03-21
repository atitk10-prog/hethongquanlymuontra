import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { api, type Device, type User, type BorrowRecord, type MaintenanceRecord, type Room, type Book, type BookBorrow } from '../services/api';

// Auto-refresh interval (30 seconds)
const AUTO_REFRESH_INTERVAL = 30_000;

interface DataContextType {
    devices: Device[];
    users: User[];
    borrowHistory: BorrowRecord[];
    maintenanceHistory: MaintenanceRecord[];
    rooms: Room[];
    books: Book[];
    bookBorrows: BookBorrow[];
    isLoading: boolean;
    refreshDevices: () => Promise<void>;
    refreshUsers: () => Promise<void>;
    refreshHistory: () => Promise<void>;
    refreshMaintenance: () => Promise<void>;
    refreshRooms: () => Promise<void>;
    refreshBooks: () => Promise<void>;
    refreshBookBorrows: () => Promise<void>;
    refreshAll: () => Promise<void>;

    // Optimistic Update Helpers
    setDevices: React.Dispatch<React.SetStateAction<Device[]>>;
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
    setBooks: React.Dispatch<React.SetStateAction<Book[]>>;
    setBookBorrows: React.Dispatch<React.SetStateAction<BookBorrow[]>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export function DataProvider({ children }: { children: React.ReactNode }) {
    const [devices, setDevices] = useState<Device[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [borrowHistory, setBorrowHistory] = useState<BorrowRecord[]>([]);
    const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceRecord[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [books, setBooks] = useState<Book[]>([]);
    const [bookBorrows, setBookBorrows] = useState<BookBorrow[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hasInitialLoaded, setHasInitialLoaded] = useState(false);
    const isRefreshing = useRef(false);

    const refreshDevices = useCallback(async () => {
        try {
            const data = await api.getDevices();
            setDevices(data);
        } catch (error) {
            console.error('Failed to refresh devices', error);
        }
    }, []);

    const refreshUsers = useCallback(async () => {
        try {
            const data = await api.getUsers();
            setUsers(data);
        } catch (error) {
            console.error('Failed to refresh users', error);
        }
    }, []);

    const refreshHistory = useCallback(async () => {
        try {
            const data = await api.getBorrowHistory();
            setBorrowHistory(data);
        } catch (error) {
            console.error('Failed to refresh history', error);
        }
    }, []);

    const refreshMaintenance = useCallback(async () => {
        try {
            const data = await api.getMaintenanceHistory();
            setMaintenanceHistory(data);
        } catch (error) {
            console.error('Failed to refresh maintenance', error);
        }
    }, []);

    const refreshRooms = useCallback(async () => {
        try {
            const data = await api.getRooms();
            setRooms(data);
        } catch (error) {
            console.error('Failed to refresh rooms', error);
        }
    }, []);

    const refreshBooks = useCallback(async () => {
        try {
            const data = await api.getBooks();
            setBooks(data);
        } catch (error) {
            console.error('Failed to refresh books', error);
        }
    }, []);

    const refreshBookBorrows = useCallback(async () => {
        try {
            const data = await api.getBookBorrowHistory();
            setBookBorrows(data);
        } catch (error) {
            console.error('Failed to refresh book borrows', error);
        }
    }, []);

    const refreshAll = useCallback(async () => {
        if (!hasInitialLoaded) setIsLoading(true);
        await Promise.all([
            refreshDevices(),
            refreshUsers(),
            refreshHistory(),
            refreshMaintenance(),
            refreshRooms(),
            refreshBooks(),
            refreshBookBorrows()
        ]);
        setIsLoading(false);
        setHasInitialLoaded(true);
    }, [hasInitialLoaded, refreshDevices, refreshUsers, refreshHistory, refreshMaintenance, refreshRooms, refreshBooks, refreshBookBorrows]);

    // Background refresh — silently updates data without showing loading spinner
    const backgroundRefresh = useCallback(async () => {
        if (isRefreshing.current) return; // Prevent concurrent refreshes
        isRefreshing.current = true;
        try {
            // Invalidate cache so we get fresh data from GAS
            api.clearCache();
            await Promise.all([
                refreshDevices(),
                refreshHistory(),
                refreshRooms(),
                refreshBooks(),
                refreshBookBorrows()
            ]);
        } catch {
            // Silent — don't show errors for background refresh
        } finally {
            isRefreshing.current = false;
        }
    }, [refreshDevices, refreshHistory, refreshRooms, refreshBooks, refreshBookBorrows]);

    // --- Stale-While-Revalidate: show cached data instantly, then refresh ---
    useEffect(() => {
        const savedUser = localStorage.getItem('auth_user');
        if (!savedUser) {
            setIsLoading(false);
            return;
        }

        // Hydrate from localStorage cache instantly (stale data)
        let hasCachedData = false;
        const tryCache = (key: string) => {
            try {
                const raw = localStorage.getItem(`api_cache_${key}`);
                if (raw) {
                    const entry = JSON.parse(raw);
                    return entry.data;
                }
            } catch {}
            return null;
        };

        const cachedDevices = tryCache('devices');
        const cachedUsers = tryCache('users');
        const cachedHistory = tryCache('borrowHistory');
        const cachedMaintenance = tryCache('maintenance');
        const cachedRooms = tryCache('rooms');
        const cachedBooks = tryCache('books');
        const cachedBookBorrows = tryCache('bookBorrows');

        if (cachedDevices) { setDevices(cachedDevices); hasCachedData = true; }
        if (cachedUsers) { setUsers(cachedUsers); hasCachedData = true; }
        if (cachedHistory) { setBorrowHistory(cachedHistory); hasCachedData = true; }
        if (cachedMaintenance) { setMaintenanceHistory(cachedMaintenance); hasCachedData = true; }
        if (cachedRooms) { setRooms(cachedRooms); hasCachedData = true; }
        if (cachedBooks) { setBooks(cachedBooks); hasCachedData = true; }
        if (cachedBookBorrows) { setBookBorrows(cachedBookBorrows); hasCachedData = true; }

        if (hasCachedData) {
            // Show stale data immediately — no loading screen
            setIsLoading(false);
            setHasInitialLoaded(true);
            // Then revalidate in background
            Promise.all([
                refreshDevices(), refreshUsers(), refreshHistory(),
                refreshMaintenance(), refreshRooms(), refreshBooks(), refreshBookBorrows()
            ]).catch(() => {});
        } else {
            // No cache at all — must show loading
            refreshAll();
        }
    }, []);

    // Auto-polling: refresh data every 30 seconds in background
    useEffect(() => {
        if (!hasInitialLoaded) return;

        const interval = setInterval(() => {
            backgroundRefresh();
        }, AUTO_REFRESH_INTERVAL);

        return () => clearInterval(interval);
    }, [hasInitialLoaded, backgroundRefresh]);

    // Refresh on tab focus — when user switches back to the app
    useEffect(() => {
        if (!hasInitialLoaded) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                backgroundRefresh();
            }
        };

        const handleFocus = () => {
            backgroundRefresh();
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleFocus);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, [hasInitialLoaded, backgroundRefresh]);

    return (
        <DataContext.Provider value={{
            devices,
            users,
            borrowHistory,
            maintenanceHistory,
            rooms,
            books,
            bookBorrows,
            isLoading,
            refreshDevices,
            refreshUsers,
            refreshHistory,
            refreshMaintenance,
            refreshRooms,
            refreshBooks,
            refreshBookBorrows,
            refreshAll,
            setDevices,
            setUsers,
            setRooms,
            setBooks,
            setBookBorrows
        }}>
            {children}
        </DataContext.Provider>
    );
}

export function useData() {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
}
