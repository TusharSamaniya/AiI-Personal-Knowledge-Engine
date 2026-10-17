import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

// Home / Solutions / Contact live on the landing page ("/") and are chosen by hash.
const LINKS = [
  { label: 'Home',       to: '/#home',      hideOnMobile: false },
  { label: 'Solutions',  to: '/#solutions', hideOnMobile: true  },
  { label: 'Contact Us', to: '/#connect',   hideOnMobile: true  },
];

function readStoredName() {
  try {
    return JSON.parse(localStorage.getItem('ke_user') || 'null')?.name || '';
  } catch {
    return '';
  }
}

export default function DashNavbar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const [name, setName] = useState(readStoredName);

  // Logged in through Google or the fallback page? ke_user may be missing - ask the API.
  useEffect(() => {
    if (name) return;
    api.get('/user/me')
      .then((res) => {
        const n = res.data?.name || res.data?.email?.split('@')[0] || '';
        setName(n);
        // keep the landing page's navbar in sync (it shows "Work" only when ke_user exists)
        if (n) localStorage.setItem('ke_user', JSON.stringify({ ...res.data, name: n }));
      })
      .catch(() => {});
  }, [name]);

  const go = (to) => (e) => {
    e.preventDefault();
    navigate(to);
  };

  const onLogout = () => {
    localStorage.removeItem('ke_user');
    logout();            // clears "token" + dashboard auth state
    navigate('/', { replace: true });
  };

  const onWork = pathname === '/dashboard' || pathname === '/analytics';

  const linkBase = 'text-[15px] transition-colors';

  return (
    <header className="flex-none h-14 flex items-center justify-between gap-4 px-4 sm:px-6 bg-white border-b border-gray-200">
      <a
        href="/#home"
        onClick={go('/#home')}
        className="text-[24px] leading-none text-gray-900 whitespace-nowrap"
        style={{ fontFamily: 'var(--font-display, Georgia, serif)' }}
      >
        Knowledge Engine
      </a>

      <nav className="flex items-center gap-4 sm:gap-7">
        {LINKS.map((l) => (
          <a
            key={l.label}
            href={l.to}
            onClick={go(l.to)}
            className={`${linkBase} text-gray-600 hover:text-black ${l.hideOnMobile ? 'hidden sm:inline' : ''}`}
          >
            {l.label}
          </a>
        ))}
        <a
          href="/dashboard"
          onClick={go('/dashboard')}
          aria-current={onWork ? 'page' : undefined}
          className={`${linkBase} ${onWork ? 'text-indigo-600 font-semibold' : 'text-gray-600 hover:text-black'}`}
        >
          Work
        </a>
      </nav>

      <div className="flex items-center gap-3">
        {name && <span className="hidden md:inline text-[14px] text-gray-600">Welcome, {name}</span>}
        <button
          type="button"
          onClick={onLogout}
          className="text-[14px] font-medium text-gray-800 border border-gray-300 rounded-full px-4 py-1.5 hover:border-gray-900 hover:bg-gray-50 transition-colors"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
