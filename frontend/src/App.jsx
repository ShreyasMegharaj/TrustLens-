import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Navbar      from "./components/Navbar";
import HomePage    from "./pages/HomePage";
import LoginPage   from "./pages/LoginPage";
import SignupPage  from "./pages/SignupPage";
import UploadPage  from "./pages/UploadPage";
import HistoryPage from "./pages/HistoryPage";

// Protected route wrapper
function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? children : <Navigate to="/login" replace />;
}

// Redirect logged-in users away from auth pages
function Guest({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Navigate to="/upload" replace /> : children;
}

function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-paper">
      <svg className="w-8 h-8 animate-spin text-brand" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
      </svg>
      <p className="font-heading font-bold text-faint text-sm">Opening case files...</p>
    </div>
  );
}

function AppRoutes() {
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <div className="flex-1">
        <Routes>
          <Route path="/"        element={<HomePage />} />
          <Route path="/login"   element={<Guest><LoginPage /></Guest>} />
          <Route path="/signup"  element={<Guest><SignupPage /></Guest>} />
          <Route path="/upload"  element={<Protected><UploadPage /></Protected>} />
          <Route path="/history" element={<Protected><HistoryPage /></Protected>} />
          <Route path="*"        element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
