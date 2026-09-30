import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export default function Dashboard() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    // Fetch current user info
    api.get('/user/me')
      .then(res => setUser(res.data))
      .catch(() => {
        logout();
        navigate('/login');
      });
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Dashboard</h1>
      {user && <p>Welcome back, <strong>{user.name}</strong>!</p>}
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}