import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut } from 'firebase/auth';
import { auth, googleProvider, isAllowedEmail } from '../firebase';
import LoginPage from './LoginPage';

export default function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Capture result if we just returned from a signInWithRedirect flow.
    // This is a no-op on normal page loads. onAuthStateChanged also fires,
    // so we don't need to setUser here — the listener below handles it.
    getRedirectResult(auth).catch((err) => {
      console.error('Redirect sign-in error:', err);
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        if (isAllowedEmail(currentUser.email)) {
          setUser(currentUser);
        } else {
          signOut(auth).then(() => {
            setUser(null);
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleSignIn = async () => {
    try {
      // Try popup first — faster UX, no full page navigation.
      const result = await signInWithPopup(auth, googleProvider);

      if (!isAllowedEmail(result.user.email)) {
        await signOut(auth);
        alert('This email is not on the allowlist. Contact the admin to be added.');
      }
    } catch (error) {
      // Browsers (especially on localhost) often block OAuth popups.
      // Fall back to redirect — slower but works everywhere.
      if (
        error.code === 'auth/popup-blocked' ||
        error.code === 'auth/popup-closed-by-user' ||
        error.code === 'auth/cancelled-popup-request'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          // Page navigates away to Google. We come back via getRedirectResult().
        } catch (redirectError) {
          console.error('Redirect sign-in error:', redirectError);
        }
      } else {
        console.error('Sign-in error:', error);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <div className="text-center">
          <p className="text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage onSignIn={handleSignIn} />;
  }

  return children;
}
