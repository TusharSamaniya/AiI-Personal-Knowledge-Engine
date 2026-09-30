import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<div>Register Page Placeholder</div>} />
          <Route path="/dashboard" element={<div>Dashboard Placeholder</div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;