import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Handles the redirect from the backend after Google OAuth.
 * The backend redirects to:  /auth/callback?token=<jwt>
 *
 * We save the token (used by ProtectedRoute and axios interceptor),
 * then fetch the user profile so the landing Navbar can show the name.
 */
export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const { login }      = useAuth();
  const navigate       = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) { navigate('/'); return; }

    // 1. Save token for the dashboard auth system
    login(token);

    // 2. Fetch the user profile and save it for the landing Navbar
    const API = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/$/, '');
    fetch(`${API}/user/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((profile) => {
        if (profile) {
          localStorage.setItem('ke_user', JSON.stringify({
            name:  profile.name  || profile.email.split('@')[0],
            email: profile.email,
          }));
        }
      })
      .catch(() => {})
      .finally(() => navigate('/dashboard'));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '12px', fontFamily: 'Inter, sans-serif', color: '#94A3B8', background: '#080D1A' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #6366F1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <p>Signing you in…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
