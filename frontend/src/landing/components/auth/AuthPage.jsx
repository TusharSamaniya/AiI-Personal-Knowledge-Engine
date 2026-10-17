import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext.jsx";
import { isDemoMode, loginWithEmail, loginWithGoogle, signupWithEmail } from "../../lib/authApi.js";
import "./auth.css";

const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const PASSWORD_MIN = 8;
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/* ---------------------------- Google button ---------------------------- */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

/**
 * In production (with a real backend), clicking Google redirects to
 * GET /auth/google which handles the OAuth flow server-side and
 * redirects back to /auth/callback?token=<jwt>.
 *
 * In demo mode (no backend), we use @react-oauth/google popup flow.
 */
function GoogleButton({ disabled, onDemoResponse, onFail }) {
  if (!isDemoMode) {
    // Production: redirect to backend
    return (
      <button
        type="button"
        className="am__google"
        disabled={disabled}
        onClick={() => { window.location.href = `${API}/auth/google`; }}
      >
        <GoogleLogo />
        <span>Continue with Google</span>
      </button>
    );
  }

  // Demo mode only — use popup via @react-oauth/google if client id is set
  if (GOOGLE_CLIENT_ID) {
    return <DemoGoogleButton disabled={disabled} onResponse={onDemoResponse} onFail={onFail} />;
  }

  return (
    <button type="button" className="am__google" disabled={true}>
      <GoogleLogo />
      <span>Google (set VITE_GOOGLE_CLIENT_ID)</span>
    </button>
  );
}

function DemoGoogleButton({ disabled, onResponse, onFail }) {
  // Dynamic import so the bundle doesn't break when @react-oauth/google
  // GoogleOAuthProvider is not present (production path never needs it here)
  const [useGoogleLogin, setHook] = useState(null);
  useEffect(() => {
    import("@react-oauth/google")
      .then((m) => setHook(() => m.useGoogleLogin))
      .catch(() => {});
  }, []);

  if (!useGoogleLogin) return null;
  return <DemoGoogleInner useGoogleLogin={useGoogleLogin} disabled={disabled} onResponse={onResponse} onFail={onFail} />;
}

function DemoGoogleInner({ useGoogleLogin, disabled, onResponse, onFail }) {
  const login = useGoogleLogin({
    flow: "implicit",
    onSuccess: onResponse,
    onError: () => onFail("Google sign-in failed. Please try again."),
    onNonOAuthError: () => onFail("The Google window was closed before finishing."),
  });
  return (
    <button type="button" className="am__google" disabled={disabled} onClick={() => login()}>
      <GoogleLogo />
      <span>Continue with Google</span>
    </button>
  );
}

/* -------------------------------- screen -------------------------------- */
export default function AuthPage() {
  const { authMode, closeAuth, setSession } = useAuth();
  const isLogin  = authMode === "login";
  const isSignup = authMode === "signup";
  const open     = isLogin || isSignup;

  const [mode,     setMode]    = useState("login");
  const [name,     setName]    = useState("");
  const [email,    setEmail]   = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]   = useState("");
  const [busy,     setBusy]    = useState(false);

  // Sync mode from context
  useEffect(() => {
    if (authMode) setMode(authMode);
  }, [authMode]);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setName(""); setEmail(""); setPassword(""); setError("");
    }
  }, [open]);

  // Close on Escape + lock page scroll while the dialog is open
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && closeAuth();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, closeAuth]);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (mode === "signup" && !name.trim()) return setError("Please enter your name.");
    if (!EMAIL_RE.test(email)) return setError("Please enter a valid email address.");
    if (mode === "signup" && password.length < PASSWORD_MIN)
      return setError(`Password must be at least ${PASSWORD_MIN} characters.`);
    if (!password) return setError("Please enter your password.");
    setBusy(true);
    try {
      const fn = mode === "signup" ? signupWithEmail : loginWithEmail;
      const result = await fn({ email, password, name });
      setSession(result.user, result.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogleDemo(response) {
    setError("");
    setBusy(true);
    try {
      const result = await loginWithGoogle(response);
      setSession(result.user, result.token);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="am__overlay" onClick={(e) => e.target === e.currentTarget && closeAuth()}>
      <div className="am__dialog" role="dialog" aria-modal="true">
        <div className="am__form-side">
          <button type="button" className="am__close" aria-label="Close" onClick={closeAuth}>✕</button>

          <div className="am__tabs">
            <button
              type="button"
              className={`am__tab ${mode === "login" ? "is-active" : ""}`}
              onClick={() => { setMode("login"); setError(""); }}
            >
              Log in
            </button>
            <button
              type="button"
              className={`am__tab ${mode === "signup" ? "is-active" : ""}`}
              onClick={() => { setMode("signup"); setError(""); }}
            >
              Sign up
            </button>
          </div>

          <form className="am__form" onSubmit={submit} noValidate>
            {mode === "signup" && (
              <label className="am__label">
                <span>Full name</span>
                <input
                  className="am__input"
                  type="text"
                  placeholder="Tushar Samaniya"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={busy}
                />
              </label>
            )}

            <label className="am__label">
              <span>Email</span>
              <input
                className="am__input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={busy}
              />
            </label>

            <label className="am__label">
              <span>Password</span>
              <input
                className="am__input"
                type="password"
                placeholder={mode === "signup" ? `At least ${PASSWORD_MIN} characters` : "Your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={busy}
              />
            </label>

            {error && <p className="am__error">{error}</p>}

            <button className="am__submit" type="submit" disabled={busy}>
              {busy ? "Please wait…" : mode === "signup" ? "Create account" : "Log in"}
            </button>
          </form>

          <div className="am__divider"><span>or</span></div>

          <GoogleButton
            disabled={busy}
            onDemoResponse={handleGoogleDemo}
            onFail={setError}
          />
        </div>
      </div>
    </div>
  );
}
