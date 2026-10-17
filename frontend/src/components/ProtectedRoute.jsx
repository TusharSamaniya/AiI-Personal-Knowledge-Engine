import { Navigate } from 'react-router-dom';

/**
 * Reads the token straight from localStorage so a login done from the
 * landing-page modal (which writes localStorage but not the dashboard
 * context state) is recognised immediately.
 */
export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem('token');

  if (!token) {
    return <Navigate to="/" replace />;
  }
  return children;
}
