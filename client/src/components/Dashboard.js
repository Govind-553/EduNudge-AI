// client/src/components/Dashboard.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';
import Analytics from './Analytics';
import StudentList from './StudentList';
import CallHistory from './CallHistory';

const Dashboard = () => {
    const [students, setStudents] = useState([]);
    const [analytics, setAnalytics] = useState({});
    const [calls, setCalls] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        status: 'all',
        riskLevel: 'all',
        dateRange: '7'
    });

    useEffect(() => {
        fetchDashboardData();
        const interval = setInterval(fetchDashboardData, 30000); // 30 seconds
        return () => clearInterval(interval);
    }, [filters]);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);

            const studentsResponse = await axios.get('/api/students', {
                params: filters
            });
            setStudents(studentsResponse.data.students || []);

            const analyticsResponse = await axios.get('/api/admin/analytics', {
                params: { dateRange: filters.dateRange }
            });
            setAnalytics(analyticsResponse.data || {});

            const callsResponse = await axios.get('/api/admin/calls', {
                params: { limit: 50 }
            });
            setCalls(callsResponse.data.calls || []);

        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const triggerVoiceCall = async (studentId) => {
        try {
            await axios.post('/api/voice/create-call', {
                studentId,
                priority: 'high',
                reason: 'manual_trigger'
            });
            alert('Voice call initiated successfully!');
            fetchDashboardData();
        } catch (error) {
            console.error('Error triggering voice call:', error);
            alert('Failed to initiate voice call');
        }
    };

    const sendWhatsAppMessage = async (studentId, messageType) => {
        try {
            await axios.post('/api/notifications/whatsapp', {
                studentId,
                messageType,
                urgency: 'normal'
            });
            alert('WhatsApp message sent successfully!');
            fetchDashboardData();
        } catch (error) {
            console.error('Error sending WhatsApp message:', error);
            alert('Failed to send WhatsApp message');
        }
    };

    const updateStudentStatus = async (studentId, newStatus) => {
        try {
            await axios.put(`/api/students/${studentId}`, {
                status: newStatus,
                updatedBy: 'counselor'
            });
            fetchDashboardData();
        } catch (error) {
            console.error('Error updating student status:', error);
            alert('Failed to update student status');
        }
    };

    const getRiskColor = (riskLevel) => {
        switch (riskLevel) {
            case 'high': return '#ff4757';
            case 'medium': return '#ffa502';
            case 'low': return '#2ed573';
            default: return '#57606f';
        }
    };

    const getStatusColor = (status) => {
        const statusColors = {
            'inquiry_submitted': '#70a1ff',
            'documents_pending': '#ffa502',
            'application_completed': '#2ed573',
            'dropout_risk': '#ff4757',
            'counselor_required': '#ff3838',
            'engaged': '#5352ed'
        };
        return statusColors[status] || '#57606f';
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p>Loading dashboard data...</p>
            </div>
        );
    }

    return (
        <div className="dashboard">
            <header className="dashboard-header">
                <h1>Admission Management Dashboard</h1>
                <div className="header-actions">
                    <button onClick={fetchDashboardData} className="refresh-btn">
                        🔄 Refresh
                    </button>
                </div>
            </header>

            <Analytics analytics={analytics} filters={filters} students={students} />

            <section className="filters-section">
                <div className="filters">
                    <select
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    >
                        <option value="all">All Statuses</option>
                        <option value="inquiry_submitted">Inquiry Submitted</option>
                        <option value="documents_pending">Documents Pending</option>
                        <option value="dropout_risk">Dropout Risk</option>
                        <option value="counselor_required">Counselor Required</option>
                    </select>

                    <select
                        value={filters.riskLevel}
                        onChange={(e) => setFilters({ ...filters, riskLevel: e.target.value })}
                    >
                        <option value="all">All Risk Levels</option>
                        <option value="high">High Risk</option>
                        <option value="medium">Medium Risk</option>
                        <option value="low">Low Risk</option>
                    </select>

                    <select
                        value={filters.dateRange}
                        onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
                    >
                        <option value="1">Last 24 hours</option>
                        <option value="7">Last 7 days</option>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                    </select>
                </div>
            </section>

            <StudentList
                students={students}
                triggerVoiceCall={triggerVoiceCall}
                sendWhatsAppMessage={sendWhatsAppMessage}
                updateStudentStatus={updateStudentStatus}
                formatDate={formatDate}
                getRiskColor={getRiskColor}
                getStatusColor={getStatusColor}
            />

            <CallHistory
                calls={calls}
                formatDate={formatDate}
                fetchDashboardData={fetchDashboardData}
            />
        </div>
    );
};

export default Dashboard;