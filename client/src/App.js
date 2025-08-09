import React, { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import Navbar from './components/Navbar';
import Settings from './components/Settings';
import Analytics from './components/Analytics';
import Reports from './components/Reports';
import Footer from './components/Footer';
import './App.css';

function App() {
  const [page, setPage] = useState('dashboard');
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    if (!savedTheme) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return savedTheme;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard />;
      case 'analytics':
        return <Analytics />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <Settings currentTheme={theme} setTheme={setTheme} />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="App">
      <Navbar currentPage={page} setPage={setPage} />
      <main className="app-main">
        {renderPage()}
      </main>
    <Footer />  
    </div>
  );
}

export default App;