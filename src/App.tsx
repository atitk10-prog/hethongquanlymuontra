import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './store/auth';
import { DataProvider } from './context/DataContext';
import ErrorBoundary from './components/ErrorBoundary';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Scan from './pages/Scan';
import DeviceAction from './pages/DeviceAction';
import History from './pages/History';
import Maintenance from './pages/Maintenance';
import Inventory from './pages/Inventory';
import PrintQRs from './pages/PrintQRs';
import Users from './pages/Users';
import Profile from './pages/Profile';
import RoomAction from './pages/RoomAction';
import PrintQRRoom from './pages/PrintQRRoom';
import Rooms from './pages/Rooms';
import ReturnByTeacher from './pages/ReturnByTeacher';
import DeviceBorrow from './pages/DeviceBorrow';
import DeviceReport from './pages/DeviceReport';
import Books from './pages/Books';
import BookBorrow from './pages/BookBorrow';
import BookHistory from './pages/BookHistory';
import BookAction from './pages/BookAction';
import LibraryBrowse from './pages/LibraryBrowse';
import BookInventory from './pages/BookInventory';

// Protected Route wrapper
function ProtectedRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: string[] }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Users with managed_rooms can access device management pages
    if (!user.managed_rooms) {
      return <Navigate to="/" replace />;
    }
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <DataProvider>
          <Router>
            <Routes>
              <Route path="/login" element={<Login />} />

              <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                <Route index element={<Dashboard />} />
                <Route path="devices" element={<ProtectedRoute allowedRoles={['equipment', 'vice_principal', 'admin']}><Devices /></ProtectedRoute>} />
                <Route path="scan" element={<Scan />} />
                <Route path="device/:id" element={<DeviceAction />} />
                <Route path="room/:subject/:room" element={<RoomAction />} />
                <Route path="history" element={<ProtectedRoute allowedRoles={['teacher', 'equipment', 'leader', 'vice_principal', 'admin']}><History /></ProtectedRoute>} />
                <Route path="return/:teacher" element={<ReturnByTeacher />} />
                <Route path="inventory" element={<ProtectedRoute allowedRoles={['equipment', 'vice_principal', 'admin']}><Inventory /></ProtectedRoute>} />
                <Route path="device-borrow" element={<ProtectedRoute allowedRoles={['teacher', 'equipment', 'leader', 'vice_principal', 'admin']}><DeviceBorrow /></ProtectedRoute>} />
                <Route path="device-report" element={<ProtectedRoute allowedRoles={['equipment', 'vice_principal', 'admin']}><DeviceReport /></ProtectedRoute>} />
                <Route path="maintenance" element={<ProtectedRoute allowedRoles={['equipment', 'vice_principal', 'admin']}><Maintenance /></ProtectedRoute>} />
                <Route path="print-qr" element={<ProtectedRoute allowedRoles={['equipment', 'vice_principal', 'admin']}><PrintQRs /></ProtectedRoute>} />
                <Route path="print-qr-room" element={<ProtectedRoute allowedRoles={['equipment', 'vice_principal', 'admin']}><PrintQRRoom /></ProtectedRoute>} />
                <Route path="rooms" element={<ProtectedRoute allowedRoles={['equipment', 'vice_principal', 'admin']}><Rooms /></ProtectedRoute>} />
                <Route path="users" element={<ProtectedRoute allowedRoles={['admin', 'vice_principal']}><Users /></ProtectedRoute>} />
                <Route path="books" element={<ProtectedRoute allowedRoles={['equipment', 'vice_principal', 'admin', 'librarian']}><Books /></ProtectedRoute>} />
                <Route path="book-borrow" element={<BookBorrow />} />
                <Route path="book-history" element={<BookHistory />} />
                <Route path="book-action/:id" element={<BookAction />} />
                <Route path="library" element={<LibraryBrowse />} />
                <Route path="book-inventory" element={<ProtectedRoute allowedRoles={['equipment', 'vice_principal', 'admin', 'librarian']}><BookInventory /></ProtectedRoute>} />
                <Route path="profile" element={<Profile />} />

                {/* Fallback for unimplemented routes */}
                <Route path="*" element={
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                    <h2 className="text-xl font-semibold text-slate-900 mb-2">Tính năng đang phát triển</h2>
                    <p className="text-slate-500 text-sm">Chức năng này sẽ sớm được hoàn thiện.</p>
                  </div>
                } />
              </Route>
            </Routes>
          </Router>
        </DataProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
