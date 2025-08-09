// client/src/components/Footer.js
import React from 'react';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="app-footer">
      <div className="footer-main-content">
        {/* Column 1: About */}
        <div className="footer-column">
          <h3 className="footer-logo">EduNudge AI</h3>
          <p className="footer-description">
            An intelligent voice-powered system to proactively prevent student dropouts during the admission process.
          </p>
        </div>

        {/* Column 2: Quick Links */}
        <div className="footer-column">
          <h4 className="footer-column-title">Quick Links</h4>
          <ul className="footer-links-list">
            <li><a href="#dashboard" className="footer-link">Dashboard</a></li>
            <li><a href="#analytics" className="footer-link">Analytics</a></li>
            <li><a href="#reports" className="footer-link">Reports</a></li>
            <li><a href="#settings" className="footer-link">Settings</a></li>
          </ul>
        </div>

        {/* Column 3: Legal */}
        <div className="footer-column">
          <h4 className="footer-column-title">Legal</h4>
          <ul className="footer-links-list">
            <li><a href="#privacy" className="footer-link">Privacy Policy</a></li>
            <li><a href="#terms" className="footer-link">Terms of Service</a></li>
            <li><a href="#contact" className="footer-link">Contact Us</a></li>
          </ul>
        </div>

        {/* Column 4: Stay Updated */}
        <div className="footer-column">
            <h4 className="footer-column-title">Stay Updated</h4>
            <p className="footer-description">
                Get the latest news and updates from EduNudge AI.
            </p>
            <form className="footer-subscribe-form">
                <input type="email" placeholder="Enter your email" />
                <button type="submit">Subscribe</button>
            </form>
        </div>
      </div>
      <div className="footer-bottom-bar">
        <p>Made with ❤️ by QuadCoders &copy; {currentYear}</p>
      </div>
    </footer>
  );
};

export default Footer;