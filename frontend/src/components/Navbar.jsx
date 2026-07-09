import { Link, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

/* Hand-drawn lens + shield logo mark */
function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Shield outline */}
      <path
        d="M20 3 C20 3 8 7 8 7 L8 21 C8 30 20 36 20 36 C20 36 32 30 32 21 L32 7 Z"
        stroke="#2d2d2d" strokeWidth="2.5" strokeLinejoin="round"
        fill="#dbeafe"
      />
      {/* Lens circle */}
      <circle cx="19" cy="19" r="7" stroke="#2d5da1" strokeWidth="2.5" fill="none"/>
      {/* Lens handle */}
      <line x1="24" y1="24" x2="29" y2="29" stroke="#2d5da1" strokeWidth="3" strokeLinecap="round"/>
      {/* Shine dot */}
      <circle cx="16.5" cy="16.5" r="1.5" fill="#2d5da1" opacity="0.5"/>
    </svg>
  );
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
    setMenuOpen(false);
  };

  const isActive = (to) => location.pathname === to;

  const NavLink = ({ to, label }) => (
    <Link
      to={to}
      onClick={() => setMenuOpen(false)}
      className={`font-heading font-bold text-sm px-3 py-1.5 border-2 transition-all duration-100
        ${isActive(to)
          ? "bg-brand text-white border-ink shadow-hard-sm"
          : "bg-paper text-ink border-transparent hover:border-ink hover:shadow-hard-sm"
        }`}
      style={{ borderRadius: "6px 12px 6px 8px" }}
    >
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 bg-paper border-b-2 border-ink" style={{ boxShadow: "0 2px 0 #2d2d2d" }}>
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 group shrink-0">
          <LogoMark size={32} />
          <span className="font-heading font-bold text-xl text-ink leading-none">
            Trust<span className="text-brand">Lens</span>
          </span>
        </Link>

        {/* Desktop nav */}
        {user && (
          <nav className="hidden sm:flex items-center gap-2">
            <NavLink to="/upload"  label="Verify" />
            <NavLink to="/history" label="Case Log" />
          </nav>
        )}

        {/* Right — desktop */}
        <div className="hidden sm:flex items-center gap-2">
          <a
            href="/#extension"
            id="navbar-extension-btn"
            className="btn-secondary text-sm px-4 py-1.5 flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 15V3m0 12l-4-4m4 4l4-4"/>
              <path d="M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"/>
            </svg>
            Extension
          </a>
          {user ? (
            <>
              <span className="text-sm text-faint font-body border border-faint px-3 py-1"
                style={{ borderRadius: "4px 10px 4px 6px" }}>
                {user.name}
              </span>
              <button id="navbar-signout" onClick={handleLogout} className="btn-secondary text-sm px-4 py-1.5">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login"  className="btn-secondary text-sm px-4 py-1.5">Log in</Link>
              <Link to="/signup" className="btn-primary  text-sm px-4 py-1.5">Sign up</Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          id="navbar-menu-toggle"
          onClick={() => setMenuOpen(!menuOpen)}
          className="sm:hidden p-2 border-2 border-ink bg-paper"
          style={{ borderRadius: "6px 10px 6px 6px" }}
          aria-label="Toggle menu"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="#2d2d2d" strokeWidth="2.2" strokeLinecap="round">
            {menuOpen ? (
              <>
                <line x1="3" y1="3" x2="15" y2="15"/>
                <line x1="15" y1="3" x2="3" y2="15"/>
              </>
            ) : (
              <>
                <line x1="2" y1="5" x2="16" y2="5"/>
                <line x1="2" y1="9" x2="16" y2="9"/>
                <line x1="2" y1="13" x2="16" y2="13"/>
              </>
            )}
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <div className="sm:hidden border-t-2 border-ink bg-paper px-4 py-4 space-y-3 animate-fade-in">
          <a
            href="/#extension"
            onClick={() => setMenuOpen(false)}
            className="btn-secondary w-full py-2 flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 15V3m0 12l-4-4m4 4l4-4"/>
              <path d="M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"/>
            </svg>
            Get Extension
          </a>
          {user ? (
            <>
              <p className="text-xs text-faint font-body mb-2">Logged in as {user.name}</p>
              <NavLink to="/upload"  label="Verify" />
              <NavLink to="/history" label="Case Log" />
              <button onClick={handleLogout} className="btn-secondary w-full py-2 mt-2">Sign out</button>
            </>
          ) : (
            <>
              <Link to="/login"  onClick={() => setMenuOpen(false)} className="btn-secondary w-full py-2 block text-center">Log in</Link>
              <Link to="/signup" onClick={() => setMenuOpen(false)} className="btn-primary w-full py-2 block text-center">Sign up</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
