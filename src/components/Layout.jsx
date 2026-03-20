import { useState } from 'react';
import { Link } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';

export default function Layout({ user, children }) {
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleSignOut = async () => {
    await signOut(auth);
    setShowUserMenu(false);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Navigation */}
      <nav
        className="glass"
        style={{
          padding: 'var(--space-lg) var(--space-xl)',
          borderBottom: `1px solid var(--border)`,
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <div className="container">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <Link
              to="/"
              style={{
                fontSize: '1.25rem',
                fontWeight: '700',
                fontFamily: 'var(--font-heading)',
                letterSpacing: 'var(--letter-spacing-heading)',
                color: 'var(--text)',
                textDecoration: 'none',
              }}
            >
              SomaPym
            </Link>

            {/* Nav Links */}
            <div className="flex items-center gap-xl">
              <Link
                to="/"
                style={{
                  color: 'var(--text)',
                  fontWeight: '500',
                  fontSize: '0.95rem',
                  transition: 'color var(--transition-fast)',
                }}
                onMouseEnter={(e) => (e.target.style.color = 'var(--accent)')}
                onMouseLeave={(e) => (e.target.style.color = 'var(--text)')}
              >
                Dashboard
              </Link>
              <a
                href="#"
                style={{
                  color: 'var(--text)',
                  fontWeight: '500',
                  fontSize: '0.95rem',
                  transition: 'color var(--transition-fast)',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.target.style.color = 'var(--accent)')}
                onMouseLeave={(e) => (e.target.style.color = 'var(--text)')}
              >
                Apps
              </a>
            </div>

            {/* User Menu */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'var(--surface-high)',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text)',
                  fontSize: '1.25rem',
                  transition: 'all var(--transition-fast)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--primary)';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface-high)';
                  e.currentTarget.style.color = 'var(--text)';
                }}
              >
                <span className="icon icon-sm">account_circle</span>
              </button>

              {/* Dropdown Menu */}
              {showUserMenu && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 'var(--space-sm)',
                    background: 'var(--surface)',
                    border: `1px solid var(--border)`,
                    borderRadius: 'var(--radius)',
                    minWidth: '200px',
                    boxShadow: 'var(--shadow-lg)',
                    zIndex: 200,
                  }}
                >
                  <div style={{ padding: 'var(--space-md) var(--space-lg)' }}>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
                      Signed in as
                    </p>
                    <p style={{ fontSize: '0.9375rem', fontWeight: '500', marginBottom: 'var(--space-md)' }}>
                      {user?.email}
                    </p>
                    <button
                      onClick={handleSignOut}
                      className="btn btn-ghost"
                      style={{
                        width: '100%',
                        justifyContent: 'flex-start',
                        padding: 'var(--space-sm) 0',
                      }}
                    >
                      <span className="icon icon-sm">logout</span>
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main style={{ flex: 1, padding: 'var(--space-2xl) var(--space-lg)' }}>
        <div className="container">{children}</div>
      </main>
    </div>
  );
}
