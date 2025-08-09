// client/src/components/Analytics.js
import React from 'react';
import './Analytics.css';

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

const Analytics = ({ analytics, filters, students }) => {
    return (
        <section className="analytics-section">
            <div className="analytics-grid">
                <AnalyticsCard
                    title="Total Students"
                    value={analytics.totalStudents || 0}
                    subtitle={`Last ${filters.dateRange} days`}
                    color="#3742fa"
                    icon="👥"
                />
                <AnalyticsCard
                    title="Voice Calls Made"
                    value={analytics.totalCalls || 0}
                    subtitle={`Success rate: ${analytics.callSuccessRate || 0}%`}
                    color="#5352ed"
                    icon="📞"
                />
                <AnalyticsCard
                    title="WhatsApp Messages"
                    value={analytics.totalNotifications || 0}
                    subtitle="Automated notifications sent"
                    color="#00d2d3"
                    icon="💬"
                />
                <AnalyticsCard
                    title="Conversion Rate"
                    value={`${analytics.conversionRate || 0}%`}
                    subtitle="Inquiries to applications"
                    color="#2ed573"
                    icon="📈"
                />
                <AnalyticsCard
                    title="High Risk Students"
                    value={students.filter(s => s.riskLevel === 'high').length}
                    subtitle="Require immediate attention"
                    color="#ff4757"
                    icon="⚠️"
                />
                <AnalyticsCard
                    title="Counselor Required"
                    value={students.filter(s => s.status === 'counselor_required').length}
                    subtitle="Need human intervention"
                    color="#ff3838"
                    icon="🧑‍🏫"
                />
            </div>
        </section>
    );
};

export default Analytics;