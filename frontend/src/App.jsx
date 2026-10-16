import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Dashboard auth (reads/writes "token" in localStorage)
import { AuthProvider as DashAuthProvider } from './context/AuthContext';

// Landing auth (reads/writes "token" + "ke_user", wraps landing section)
import { AuthProvider as LandingAuthProvider } from './landing/context/AuthContext';

// Pages
import Dashboard    from './pages/Dashboard';
import Analytics    from './pages/Analytics';
import AuthCallback from './pages/AuthCallback';
import Login        from './pages/Login';
import Register     from './pages/Register';
import ProtectedRoute from './components/ProtectedRoute';
import LandingApp   from './landing/components/LandingApp';

function App() {
  return (
    /*
     * DashAuthProvider wraps everything so ProtectedRoute and the
     * dashboard components can always read the token.
     *
     * LandingAuthProvider wraps only the "/" route because it needs
     * useNavigate (which requires BrowserRouter to already be in context).
     * It is defined INSIDE BrowserRouter below.
     */
    <DashAuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Landing section (home / solutions / contact / auth modal) ── */}
          <Route
            path="/"
            element={
              <LandingAuthProvider>
                <LandingApp />
              </LandingAuthProvider>
            }
          />

          {/* ── Auth callback from backend Google OAuth redirect ── */}
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* ── Fallback login / register pages (plain UI, kept as safety net) ── */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* ── Protected dashboard routes ── */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <ProtectedRoute>
                <Analytics />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </DashAuthProvider>
  );
}

export default App;
