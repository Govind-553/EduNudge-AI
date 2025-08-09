import React, { useState } from 'react';
import Dashboard from './components/Dashboard';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', component: Dashboard },
    { id: 'analytics', label: 'Analytics', component: () => <div className="container" style={{ padding: '2rem' }}><h1>Analytics Page</h1><p>Analytics content coming soon...</p></div> },
    { id: 'reports', label: 'Reports', component: () => <div className="container" style={{ padding: '2rem' }}><h1>Reports Page</h1><p>Reports content coming soon...</p></div> },
    { id: 'settings', label: 'Settings', component: () => <div className="container" style={{ padding: '2rem' }}><h1>Settings Page</h1><p>Settings content coming soon...</p></div> }
  ];

  const currentComponent = navigationItems.find(item => item.id === currentPage)?.component || Dashboard;
  const CurrentPageComponent = currentComponent;

  const handleNavigation = (pageId) => {
    setCurrentPage(pageId);
    setMobileNavOpen(false);
  };

  const toggleMobileNav = () => {
    setMobileNavOpen(!mobileNavOpen);
  };

  return (
    <div className="App">
      {/* Navigation */}
      <nav className="app-nav">
        <div className="nav-container">
          <a href="#" className="nav-logo" onClick={(e) => { e.preventDefault(); handleNavigation('dashboard'); }}>
            AppName
          </a>
          
          {/* Desktop Navigation */}
          <ul className="nav-links">
            {navigationItems.map((item) => (
              <li key={item.id}>
                <a
                  href="#"
                  className={`nav-link ${currentPage === item.id ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavigation(item.id);
                  }}
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Mobile Menu Toggle */}
          <button className="mobile-nav-toggle" onClick={toggleMobileNav}>
            ☰
          </button>
        </div>
      </nav>

      {/* Mobile Navigation */}
      <div className={`mobile-nav ${mobileNavOpen ? 'active' : ''}`}>
        <div className="mobile-nav-header">
          <a href="#" className="nav-logo" onClick={(e) => { e.preventDefault(); handleNavigation('dashboard'); }}>
            AppName
          </a>
          <button className="mobile-nav-close" onClick={toggleMobileNav}>
            ✕
          </button>
        </div>
        <ul className="mobile-nav-links">
          {navigationItems.map((item) => (
            <li key={item.id}>
              <a
                href="#"
                className={`mobile-nav-link ${currentPage === item.id ? 'active' : ''}`}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavigation(item.id);
                }}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      {/* Main Content */}
      <main className="app-main">
        <CurrentPageComponent />
      </main>
    </div>
  );
}

export default App;