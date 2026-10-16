import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { useAuth } from "../../context/AuthContext.jsx";
import { isDemoMode, loginWithEmail, loginWithGoogle, signupWithEmail } from "../../lib/authApi.js";
import { createAuthMachine } from "./machine.js";
import { MACHINE_SVG } from "./machineSvg.js";
import "./auth.css";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const PASSWORD_MIN = 8;
const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const PLAIN_QUERY = "(max-width: 719px)"; // phones: skip the big machine, show a normal form

/* ---------------------------- Google button ---------------------------- */
function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function GoogleButtonView({ onClick, disabled }) {
  return (
    <button type="button" className="am__google" onClick={onClick} disabled={disabled}>
      <GoogleLogo />
      <span>Continue with Google</span>
    </button>
  );
}

/** only rendered when a client id exists, because useGoogleLogin needs <GoogleOAuthProvider> */
function GoogleLoginButton({ disabled, onResponse, onFail }) {
  const login = useGoogleLogin({
    // With a backend we use the secure OAuth2 authorization-code flow;
    // in demo mode (no backend) the implicit flow gives us an access token to read the profile.
    flow: isDemoMode ? "implicit" : "auth-code",
    onSuccess: onResponse,
    onError: () => onFail("Google sign-in failed. Please try again."),
    onNonOAuthError: () => onFail("The Google window was closed before finishing."),
  });
  return <GoogleButtonView disabled={disabled} onClick={() => login()} />;
}

/* ------------------------------- helpers ------------------------------- */
function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}

/* -------------------------------- screen -------------------------------- */
function AuthScreen() {
  const { authMode, closeAuth, setSession } = useAuth();
  const plain = useMediaQuery(PLAIN_QUERY);

  const [mode, setMode] = useState(authMode || "login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null); // { type: "error" | "info" | "ok", text }

  const rootRef = useRef(null);
  const headRef = useRef(null);
  const containerRef = useRef(null);
  const machineRef = useRef(null);
  const applied = useRef({ email: false, password: false, agreed: false });
  const [machineKey, setMachineKey] = useState(0);

  const emailValid = EMAIL_RE.test(email);
  const passwordValid = password.length >= PASSWORD_MIN;

  /* ---- build / tear down the machine (not on phones) ---- */
  useLayoutEffect(() => {
    if (plain) return undefined;
    const machine = createAuthMachine(rootRef.current);
    machineRef.current = machine;
    applied.current = { email: false, password: false, agreed: false };
    setMachineKey((k) => k + 1);
    return () => {
      machine.destroy();
      machineRef.current = null;
    };
  }, [plain]);

  /* ---- fit the machine into the window (below the header) ---- */
  useLayoutEffect(() => {
    if (plain) return undefined;
    const fit = () => {
      const head = headRef.current;
      const container = containerRef.current;
      if (!head || !container) return;
      const headBottom = head.getBoundingClientRect().bottom;
      const s = Math.max(0.45, Math.min(1, (window.innerHeight - 26 - headBottom) / 520, window.innerWidth / 760));
      container.style.top = `${headBottom + 16 + 120 * s}px`;
      machineRef.current?.setScale(s);
    };
    fit();
    window.addEventListener("resize", fit);
    const ro = new ResizeObserver(fit);
    ro.observe(headRef.current);
    return () => {
      window.removeEventListener("resize", fit);
      ro.disconnect();
    };
  }, [plain, machineKey]);

  /* ---- tell the machine what the form is doing ---- */
  useEffect(() => {
    const m = machineRef.current;
    if (m && applied.current.email !== emailValid) {
      applied.current.email = emailValid;
      m.setEmailValid(emailValid);
    }
  }, [emailValid, machineKey]);

  useEffect(() => {
    const m = machineRef.current;
    if (m && applied.current.password !== passwordValid) {
      applied.current.password = passwordValid;
      m.setPasswordValid(passwordValid);
    }
  }, [passwordValid, machineKey]);

  useEffect(() => {
    const m = machineRef.current;
    if (m && applied.current.agreed !== agreed) {
      applied.current.agreed = agreed;
      m.setAgreed(agreed);
    }
  }, [agreed, machineKey]);

  /* ---- close on Escape + lock page scroll ---- */
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !busy && closeAuth();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [busy, closeAuth]);

  /* ---- submit ---- */
  async function finish(result) {
    setStatus({ type: "ok", text: "Success! Welcome in." });
    await machineRef.current?.playExit();
    setSession(result.user, result.token);
    closeAuth();
  }

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    if (!emailValid) return setStatus({ type: "error", text: "Enter a valid e-mail address." });
    if (!passwordValid) return setStatus({ type: "error", text: `Password needs at least ${PASSWORD_MIN} characters.` });
    if (!agreed) return setStatus({ type: "error", text: "Please accept the Terms & Privacy Policy." });

    setBusy(true);
    setStatus({ type: "info", text: mode === "login" ? "Signing you in…" : "Creating your account…" });
    try {
      const fn = mode === "login" ? loginWithEmail : signupWithEmail;
      await finish(await fn({ email: email.trim(), password }));
    } catch (err) {
      setStatus({ type: "error", text: err.message || "Something went wrong." });
      setBusy(false);
    }
  }

  async function onGoogle(response) {
    setBusy(true);
    setStatus({ type: "info", text: "Signing you in with Google…" });
    try {
      await finish(await loginWithGoogle(response));
    } catch (err) {
      setStatus({ type: "error", text: err.message || "Google sign-in failed." });
      setBusy(false);
    }
  }

  const onGoogleFail = (text) => setStatus({ type: "error", text });
  const switchMode = () => {
    setMode((m) => (m === "login" ? "signup" : "login"));
    setStatus(null);
  };
  const submitLabel = mode === "login" ? "Log in" : "Sign up";

  return (
    <div className={`am ${plain ? "am--plain" : ""}`} ref={rootRef} role="dialog" aria-modal="true" aria-label={submitLabel}>
      <button type="button" className="am__close" aria-label="Close" onClick={closeAuth} disabled={busy}>
        ×
      </button>

      <div className="am__head" ref={headRef}>
        <h2 className="am__title">{mode === "login" ? "Welcome back" : "Create your account"}</h2>
        <p className="am__switch">
          {mode === "login" ? "New here?" : "Already have an account?"}{" "}
          <button type="button" onClick={switchMode} disabled={busy}>
            {mode === "login" ? "Sign up" : "Log in"}
          </button>
        </p>

        {GOOGLE_CLIENT_ID ? (
          <GoogleLoginButton disabled={busy} onResponse={onGoogle} onFail={onGoogleFail} />
        ) : (
          <GoogleButtonView
            disabled={busy}
            onClick={() =>
              setStatus({ type: "error", text: "Google sign-in isn't set up yet – add VITE_GOOGLE_CLIENT_ID to your .env file." })
            }
          />
        )}

        <div className="am__or"><span>or use your e-mail</span></div>
        <p className={`am__status ${status ? `am__status--${status.type}` : ""}`} role="status" aria-live="polite">
          {status ? status.text : ""}
        </p>
      </div>

      <div className="am-container" ref={containerRef}>
        <form className="am-form" onSubmit={onSubmit} noValidate>
          <div className="am-row">
            <input
              type="email"
              name="email"
              className={emailValid ? "valid" : ""}
              placeholder="e-mail"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={busy}
              required
            />
          </div>

          <div className="am-row am-row--pw">
            <input
              type={showPw ? "text" : "password"}
              name="password"
              className={passwordValid ? "valid" : ""}
              placeholder={`password (min ${PASSWORD_MIN} characters)`}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              required
            />
            <button type="button" className="am-pw-toggle" onClick={() => setShowPw((v) => !v)} tabIndex={-1}>
              {showPw ? "hide" : "show"}
            </button>
          </div>

          <label className="am-row am-row--check">
            <input
              type="checkbox"
              className="am-checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={busy}
            />
            <span>I agree to the Terms &amp; Privacy Policy</span>
          </label>

          <div className="am-row">
            <button type="submit" className="am-submit" disabled={busy}>
              {submitLabel}
            </button>
          </div>
        </form>

        {!plain && (
          <svg
            className="am-svg"
            viewBox="0 0 1000 1000"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: MACHINE_SVG }}
          />
        )}
      </div>
    </div>
  );
}

export default function AuthPage() {
  const { authMode } = useAuth();
  return authMode ? <AuthScreen /> : null;
}
