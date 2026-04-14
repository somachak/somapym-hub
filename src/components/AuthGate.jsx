import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider, isAllowedEmail } from '../firebase';
import LoginPage from './LoginPage';

export default function AuthGate({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
      const result = await signInWithPopup(auth, googleProvider);

      if (!isAllowedEmail(result.user.email)) {
        await signOut(auth);
        alert('This email is not on the allowlist. Contact the admin to be added.');
      }
    } catch (error) {
      console.error('Sign-in error:', error);
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
