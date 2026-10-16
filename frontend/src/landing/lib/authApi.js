/* ------------------------------------------------------------------ *
 *  Auth API layer – talks to the FastAPI backend.
 *
 *  Backend endpoints:
 *    POST /auth/register?email=&password=&name=   → { message, user_id }
 *    POST /auth/login?email=&password=            → { access_token, token_type }
 *    GET  /user/me  (Bearer token)                → { id, email, name, ... }
 *
 *  Google OAuth uses a backend redirect flow (not auth-code popup):
 *    GET /auth/google  → Google → GET /auth/google/callback → redirect to
 *    http://localhost:5173/auth/callback?token=<jwt>
 *
 *  DEMO MODE: when VITE_API_URL is empty, no requests are sent.
 * ------------------------------------------------------------------ */

const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const isDemoMode = !API;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const nameFromEmail = (email) => email.split("@")[0];

/* Fetch user profile from backend using a token */
async function fetchUserProfile(token) {
  try {
    const res = await fetch(`${API}/user/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json(); // { id, email, name, oauth_provider, active_project_id }
  } catch {
    return null;
  }
}

export async function signupWithEmail({ email, password, name }) {
  if (isDemoMode) {
    await wait(600);
    const fakeName = name || nameFromEmail(email);
    return { token: "demo-token", user: { name: fakeName, email } };
  }

  // Step 1: register the user (returns { message, user_id } — no token)
  const registerUrl = `${API}/auth/register?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&name=${encodeURIComponent(name || nameFromEmail(email))}`;
  let res;
  try {
    res = await fetch(registerUrl, { method: "POST" });
  } catch {
    throw new Error("Can't reach the server. Please check your connection and try again.");
  }
  const registerData = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(registerData.detail || registerData.message || "Registration failed.");

  // Step 2: immediately log them in to get a token
  return loginWithEmail({ email, password });
}

export async function loginWithEmail({ email, password }) {
  if (isDemoMode) {
    await wait(600);
    return { token: "demo-token", user: { name: nameFromEmail(email), email } };
  }

  const loginUrl = `${API}/auth/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  let res;
  try {
    res = await fetch(loginUrl, { method: "POST" });
  } catch {
    throw new Error("Can't reach the server. Please check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.detail || data.message || "Invalid email or password.");

  const token = data.access_token;
  if (!token) throw new Error("No token received from server.");

  // Fetch the user profile so we have the name for the Navbar
  const profile = await fetchUserProfile(token);
  const user = profile
    ? { name: profile.name || nameFromEmail(email), email: profile.email }
    : { name: nameFromEmail(email), email };

  return { token, user };
}

/**
 * Google OAuth uses the backend redirect flow, NOT the popup flow.
 * Clicking "Continue with Google" redirects to GET /auth/google,
 * which bounces through Google and lands on /auth/callback?token=xxx.
 * AuthCallback.jsx handles saving the token and redirecting to /dashboard.
 *
 * This function is only used in DEMO MODE (no backend).
 */
export async function loginWithGoogle(response) {
  if (!isDemoMode) {
    // Should not be called in production — Google button redirects via backend instead
    throw new Error("Use the backend Google OAuth redirect flow.");
  }

  // Demo mode: read the profile straight from Google with the access token
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${response.access_token}` },
  });
  if (!res.ok) throw new Error("Couldn't read your Google profile.");
  const p = await res.json();
  return { token: "demo-token", user: { name: p.name || nameFromEmail(p.email), email: p.email, picture: p.picture } };
}
