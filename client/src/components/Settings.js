// client/src/components/Settings.js
import React from 'react';
import './Settings.css';

const Settings = ({ currentTheme, setTheme }) => {
    return (
        <div className="settings-page">
            <div className="settings-container">
                <h1 className="settings-title">Settings</h1>

                <div className="settings-card">
                    <h2 className="settings-card-title">Appearance</h2>
                    <p className="settings-card-description">
                        Customize the look and feel of your dashboard.
                    </p>
                    <div className="theme-switcher">
                        <button
                            className={`theme-btn ${currentTheme === 'light' ? 'active' : ''}`}
                            onClick={() => setTheme('light')}
                        >
                            ☀️ Light
                        </button>
                        <button
                            className={`theme-btn ${currentTheme === 'dark' ? 'active' : ''}`}
                            onClick={() => setTheme('dark')}
                        >
                            🌙 Dark
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;