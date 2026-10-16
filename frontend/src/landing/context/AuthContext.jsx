/**
 * Landing AuthContext
 *
 * Uses the SAME localStorage key ("token") as the dashboard AuthContext
 * so login from the landing modal is immediately recognised by ProtectedRoute.
 *
 * Also stores the user object in "ke_user" so the Navbar can show the name.
 */
import { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";

const Ctx = createContext(null);

function readUser() {
  try {
    const raw = localStorage.getItem("ke_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser]   = useState(readUser);
  const [authMode, setAuthMode] = useState(null); // "login" | "signup" | null
  const navigate = useNavigate();

  /** Called by AuthPage after a successful login / signup */
  function setSession(newUser, newToken) {
    localStorage.setItem("token",   newToken);
    localStorage.setItem("ke_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setAuthMode(null);
    navigate("/dashboard");
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("ke_user");
    setToken(null);
    setUser(null);
    navigate("/");
  }

  function openAuth(mode) { setAuthMode(mode); }
  function closeAuth()    { setAuthMode(null); }

  return (
    <Ctx.Provider value={{ token, user, authMode, openAuth, closeAuth, setSession, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
