import { StrictMode } from 'react';
import { createRoot }  from 'react-dom/client';
import './index.css';
import App from './App.jsx';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

async function boot() {
  let root = (
    <StrictMode>
      <App />
    </StrictMode>
  );

  // Wrap with GoogleOAuthProvider only when a client id is configured.
  // In production the Google button uses a backend redirect so the provider
  // is not strictly required, but it is needed in demo mode.
  if (GOOGLE_CLIENT_ID) {
    const { GoogleOAuthProvider } = await import('@react-oauth/google');
    root = (
      <StrictMode>
        <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
          <App />
        </GoogleOAuthProvider>
      </StrictMode>
    );
  }

  createRoot(document.getElementById('root')).render(root);
}

boot();
