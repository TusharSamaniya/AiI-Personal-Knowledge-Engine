/* ------------------------------------------------------------------ *
 *  Auth API layer – the ONLY place that talks to your backend.
 *
 *  Set VITE_API_URL in .env (see .env.example) and implement:
 *
 *    POST {API}/auth/signup   body: { email, password }
 *    POST {API}/auth/login    body: { email, password }
 *    POST {API}/auth/google   body: { code }            (OAuth2 auth-code flow, redirect_uri "postmessage")
 *
 *  Every endpoint should answer with:
 *    { token: "<jwt or session id>", user: { name?, email, picture? } }
 *  and on failure a non-2xx status with { message: "..." }.
 *
 *  DEMO MODE: while VITE_API_URL is empty, no request is sent and any
 *  well-formed credentials "succeed". It exists only so you can develop the
 *  UI – never ship it.
 * ------------------------------------------------------------------ */

const API = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
export const isDemoMode = !API;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const nameFromEmail = (email) => email.split("@")[0];

async function post(path, body) {
  let res;
  try {
    res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Can't reach the server. Please check your connection and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.detail || "Something went wrong. Please try again.");
  return data;
}

export async function signupWithEmail({ email, password }) {
  if (isDemoMode) {
    await wait(600);
    return { token: "demo-token", user: { name: nameFromEmail(email), email } };
  }
  return post("/auth/signup", { email, password });
}

export async function loginWithEmail({ email, password }) {
  if (isDemoMode) {
    await wait(600);
    return { token: "demo-token", user: { name: nameFromEmail(email), email } };
  }
  return post("/auth/login", { email, password });
}

/** `response` is what @react-oauth/google gives us: { code } (auth-code flow) or { access_token } (demo / implicit flow) */
export async function loginWithGoogle(response) {
  if (!isDemoMode) return post("/auth/google", { code: response.code });

  // demo: read the profile straight from Google with the access token
  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${response.access_token}` },
  });
  if (!res.ok) throw new Error("Couldn't read your Google profile.");
  const p = await res.json();
  return { token: "demo-token", user: { name: p.name || nameFromEmail(p.email), email: p.email, picture: p.picture } };
}
