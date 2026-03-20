export default function LoginPage({ onSignIn }) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-lg)',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '450px',
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div style={{ marginBottom: 'var(--space-3xl)' }}>
          <h1
            style={{
              fontSize: '3rem',
              marginBottom: 'var(--space-md)',
              fontFamily: 'var(--font-heading)',
              letterSpacing: 'var(--letter-spacing-heading)',
            }}
          >
            SomaPym
          </h1>
          <p className="text-muted" style={{ fontSize: '1rem', letterSpacing: '0.05em' }}>
            Creative Intelligence Hub
          </p>
        </div>

        <p
          className="text-muted"
          style={{
            marginBottom: 'var(--space-2xl)',
            lineHeight: 'var(--line-height-body)',
            fontSize: '0.95rem',
          }}
        >
          A unified dashboard for managing creative projects, tracking progress, and launching new ideas.
        </p>

        <button className="btn btn-primary" onClick={onSignIn} style={{ width: '100%', justifyContent: 'center' }}>
          <span className="icon icon-sm">login</span>
          Sign in with Google
        </button>

        <p
          className="text-muted"
          style={{
            marginTop: 'var(--space-xl)',
            fontSize: '0.8125rem',
          }}
        >
          pixelartinc@gmail.com only
        </p>
      </div>
    </div>
  );
}
