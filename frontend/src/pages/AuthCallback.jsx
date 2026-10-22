import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { API_BASE } from '../api/config';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      navigate('/');
      return;
    }

    // Save the token for the dashboard authentication system.
    login(token);

    // Fetch the user profile from the configured backend.
    fetch(`${API_BASE}/user/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((response) => response.ok ? response.json() : null)
      .then((profile) => {
        if (profile) {
          localStorage.setItem('ke_user', JSON.stringify({
            name: profile.name || profile.email?.split('@')[0] || '',
            email: profile.email
          }));
        }
      })
      .catch((err) => {
        console.error('Failed to fetch user profile:', err);
      })
      .finally(() => {
        navigate('/dashboard');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        flexDirection: 'column',
        gap: '12px',
        fontFamily: 'Inter, sans-serif',
        color: '#94A3B8',
        background: '#080D1A'
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: '3px solid #6366F1',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }}
      />

      <p>Signing you in…</p>

      <style>
        {`@keyframes spin { to { transform: rotate(360deg); } }`}
      </style>
    </div>
  );
}