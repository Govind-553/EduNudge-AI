// client/src/components/Analytics.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Analytics.css'; 

const Analytics = ({ dateRange = '7' }) => {
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('/api/students/stats/overview', {
        params: { dateRange }
      });
      
      setAnalytics(response.data.analytics || {});
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const AnalyticsCard = ({ title, value, subtitle, color = '#3b82f6', icon = '📊' }) => (
    <div className="analytics-card">
      <div className="analytics-icon" style={{ backgroundColor: color }}>
        {icon}
      </div>
      <div className="analytics-content">
        <h3>{value}</h3>
        <p>{title}</p>
        {subtitle && <small>{subtitle}</small>}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analytics-error">
        <p>{error}</p>
        <button onClick={fetchAnalytics}>Retry</button>
      </div>
    );
  }

  return (
    <div className="analytics">
      <div className="analytics-header">
        <h2>Analytics Overview</h2>
        <span className="date-range">Last {dateRange} days</span>
      </div>
      
      <div className="analytics-grid">
        <AnalyticsCard
          title="Total Students"
          value={analytics.totalStudents || 0}
          subtitle="New inquiries"
          color="#3b82f6"
          icon="👥"
        />
        
        <AnalyticsCard
          title="Total Calls"
          value={analytics.totalCalls || 0}
          subtitle="Voice interactions"
          color="#10b981"
          icon="📞"
        />
        
        <AnalyticsCard
          title="Notifications Sent"
          value={analytics.totalNotifications || 0}
          subtitle="Automated messages"
          color="#f59e0b"
          icon="💬"
        />
        
        <AnalyticsCard
          title="Conversion Rate"
          value={`${analytics.conversionRate || 0}%`}
          subtitle="Inquiries to applications"
          color="#8b5cf6"
          icon="📈"
        />
      </div>

      {analytics.statusBreakdown && (
        <div className="status-breakdown">
          <h3>Status Breakdown</h3>
          <div className="breakdown-grid">
            {Object.entries(analytics.statusBreakdown).map(([status, count]) => (
              <div key={status} className="breakdown-item">
                <span className="status-name">{status.replace('_', ' ')}</span>
                <span className="status-count">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="analytics-footer">
        <button onClick={fetchAnalytics} className="refresh-btn">
          🔄 Refresh Analytics
        </button>
      </div>
    </div>
  );
};

export default Analytics;