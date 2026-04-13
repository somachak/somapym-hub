import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import AuthGate from './components/AuthGate';
import Layout from './components/Layout';
import CommandCentre from './components/CommandCentre';
import AppDetail from './components/AppDetail';

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && currentUser.email === 'pixelartinc@gmail.com') {
        setUser(currentUser);
      }
    });

    return unsubscribe;
  }, []);

  return (
    <BrowserRouter>
      <AuthGate>
        <Layout user={user}>
          <Routes>
            <Route path="/" element={<CommandCentre />} />
            <Route path="/app/:slug" element={<AppDetail />} />
          </Routes>
        </Layout>
      </AuthGate>
    </BrowserRouter>
  );
}
