// client/src/components/Navbar.js
import React, { useState } from 'react';
import './Navbar.css';

const Navbar = ({ currentPage, setPage }) => {
    const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

    const navLinks = [
        { key: 'dashboard', name: 'Dashboard' },
        { key: 'analytics', name: 'Analytics' },
        { key: 'reports', name: 'Reports' },
        { key: 'settings', name: 'Settings' },
    ];

    const handleNavClick = (page) => {
        setPage(page);
        setMobileMenuOpen(false); // Close mobile menu on navigation
    };

    return (
        <header className="navbar">
            <div className="nav-container">
                <a href="#dashboard" onClick={() => handleNavClick('dashboard')} className="nav-logo">
                    EduNudge AI
                </a>

                <nav className={`nav-links ${isMobileMenuOpen ? 'active' : ''}`}>
                    {navLinks.map(link => (
                        <a
                            key={link.key}
                            href={`#${link.key}`}
                            className={`nav-link ${currentPage === link.key ? 'active' : ''}`}
                            onClick={() => handleNavClick(link.key)}
                        >
                            {link.name}
                        </a>
                    ))}
                </nav>

                <button className="mobile-nav-toggle" onClick={() => setMobileMenuOpen(!isMobileMenuOpen)}>
                    {isMobileMenuOpen ? '✕' : '☰'}
                </button>
            </div>
        </header>
    );
};

export default Navbar;