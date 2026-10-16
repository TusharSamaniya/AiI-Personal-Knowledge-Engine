import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { useHash } from "../lib/useHash.js";

const links = [
  { label: "Home",       href: "#home"      },
  { label: "Solutions",  href: "#solutions" },
  { label: "Connect Us", href: "#connect"   },
];

export default function Navbar() {
  const { user, openAuth, logout } = useAuth();
  const [scrolled, setScrolled]   = useState(false);
  const [open, setOpen]           = useState(false);
  const hash       = useHash();
  const navigate   = useNavigate();
  const onSolutions = hash === "#solutions";
  const onContact   = hash === "#connect";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`navbar ${scrolled ? "navbar--solid" : ""} ${
        onSolutions || onContact ? "navbar--sol" : ""
      }`}
    >
      <div className="navbar__inner">
        <a href="#home" className="navbar__logo">
          Knowledge Engine
        </a>

        <button
          className="navbar__toggle"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span /><span />
        </button>

        <nav className={`navbar__menu ${open ? "is-open" : ""}`}>
          <ul className="navbar__links">
            {links.map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  className={
                    (onSolutions && l.href === "#solutions") ||
                    (onContact   && l.href === "#connect")
                      ? "is-active"
                      : undefined
                  }
                  onClick={() => setOpen(false)}
                >
                  {l.label}
                </a>
              </li>
            ))}

            {/* After login: "Work" navigates to dashboard. Before login: "Get Started" */}
            <li>
              {user ? (
                <button
                  className="navbar__work-link"
                  onClick={() => { setOpen(false); navigate("/dashboard"); }}
                >
                  Work
                </button>
              ) : (
                <a
                  href="#get-started"
                  onClick={(e) => {
                    e.preventDefault();
                    setOpen(false);
                    openAuth("signup");
                  }}
                >
                  Get Started
                </a>
              )}
            </li>
          </ul>

          <div className="navbar__auth">
            {user ? (
              <>
                <span className="navbar__welcome">Welcome, {user.name}</span>
                <button className="btn btn--ghost btn--sm" onClick={logout}>
                  Log out
                </button>
              </>
            ) : (
              <button
                className="btn btn--light btn--sm"
                onClick={() => { setOpen(false); openAuth("login"); }}
              >
                Login / Sign Up
              </button>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
