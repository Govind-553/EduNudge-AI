// client/src/components/Analytics.js
import React, { useState, useEffect } from 'react';
import axios from 'axios'; // Keep this for when my backend is ready
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
// import { sampleAnalyticsData } from './sampleData'; // No longer needed
import './Analytics.css';

const AnalyticsCard = ({ title, value, subtitle, color = '#3b82f6', icon = '投' }) => (
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

const Analytics = ({ analyticsData }) => {
    const [analytics, setAnalytics] = useState({});
    const [loading, setLoading] = useState(true);
    // const [error, setError] = useState(null); // Keep for future use when API is connected
    const [dateRange] = useState('7'); // Keep for future use when API is connected

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                setLoading(true);
                const response = await axios.get('/api/admin/analytics', {
                    params: { dateRange }
                });
                setAnalytics(response.data.analytics || {});

            } catch (err) {
                console.error('Error fetching analytics:', err);
                // setError('Failed to load analytics');
            } finally {
                setLoading(false);
            }
        };

        fetchAnalytics();
    }, [dateRange]);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading Analytics...</p>
            </div>
        );
    }
    
    // Check if analytics data is available before rendering charts
    if (!analytics || Object.keys(analytics).length === 0) {
        return (
            <div className="empty-state">
                <p>No analytics data available for this date range.</p>
            </div>
        );
    }
    
    const pieData = analytics.riskAnalysis?.breakdown ? Object.entries(analytics.riskAnalysis.breakdown).map(([name, value]) => ({
      name,
      value,
      fill: { high: '#ff4757', medium: '#ffa502', low: '#2ed573' }[name] || '#ccc'
    })) : [];

    const barData = analytics.statusBreakdown ? Object.entries(analytics.statusBreakdown).map(([name, value]) => ({
      name: name.replace(/_/g, ' '),
      value,
      fill: {
          'inquiry_submitted': '#70a1ff',
          'documents_pending': '#ffa502',
          'application_completed': '#2ed573',
          'dropout_risk': '#ff4757',
          'counselor_required': '#ff3838',
          'engaged': '#5352ed'
      }[name] || '#57606f'
    })) : [];

    return (
        <div className="analytics-page">
            <h1 className="analytics-title">Admissions Analytics</h1>
            
            <section className="analytics-grid">
                <AnalyticsCard
                    title="Total Students"
                    value={analytics.overview?.totalStudents || 0}
                    subtitle={`Last ${analytics.dateRange?.days || 0} days`}
                    color="var(--color-primary-500)"
                    icon="則"
                />
                <AnalyticsCard
                    title="Voice Calls Made"
                    value={analytics.callAnalytics?.summary?.totalCalls || 0}
                    subtitle={`Success rate: ${analytics.callAnalytics?.summary?.successRate || 0}%`}
                    color="var(--color-purple-500)"
                    icon="到"
                />
                <AnalyticsCard
                    title="WhatsApp Messages"
                    value={analytics.notificationAnalytics?.delivery?.totalSent || 0}
                    subtitle="Automated notifications"
                    color="var(--color-cyan-500)"
                    icon="町"
                />
                <AnalyticsCard
                    title="Conversion Rate"
                    value={`${analytics.overview?.conversionRate || 0}%`}
                    subtitle="Inquiries to applications"
                    color="var(--color-green-500)"
                    icon="嶋"
                />
            </section>

            <div className="charts-grid">
                <div className="chart-card large-card">
                    <h3 className="chart-title">New Students & Calls Trend (Last 7 Days)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={analytics.studentAnalytics?.timeSeriesData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                            <XAxis dataKey="date" stroke="var(--color-text-secondary)" fontSize={12} />
                            <YAxis stroke="var(--color-text-secondary)" fontSize={12} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }} />
                            <Legend />
                            <Line type="monotone" dataKey="newStudents" stroke="#3742fa" strokeWidth={2} name="New Students" />
                            <Line type="monotone" dataKey="calls" stroke="#8b5cf6" strokeWidth={2} name="Calls Made" />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-card">
                    <h3 className="chart-title">Student Risk Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} labelLine={false} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-card">
                    <h3 className="chart-title">Student Status Breakdown</h3>
                    <ResponsiveContainer width="100%" height={300}>
                       <BarChart data={barData} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                            <XAxis type="number" hide />
                            <YAxis type="category" dataKey="name" stroke="var(--color-text-secondary)" fontSize={12} />
                            <Tooltip contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }} cursor={{fill: 'var(--color-background)'}} />
                            <Bar dataKey="value" name="Students" barSize={20}>
                                {barData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default Analytics;