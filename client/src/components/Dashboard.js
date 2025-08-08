// client/src/components/Dashboard.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';

const Dashboard = () => {
  const [students, setStudents] = useState([]);
  const [analytics, setAnalytics] = useState({});
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    riskLevel: 'all',
    dateRange: '7'
  });

  useEffect(() => {
    fetchDashboardData();
    // Set up real-time updates
    const interval = setInterval(fetchDashboardData, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [filters]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch students data
      const studentsResponse = await axios.get('/api/students', {
        params: filters
      });
      setStudents(studentsResponse.data.students || []);
      
      // Fetch analytics data
      const analyticsResponse = await axios.get('/api/admin/analytics', {
        params: { dateRange: filters.dateRange }
      });
      setAnalytics(analyticsResponse.data || {});
      
      // Fetch recent calls
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
      const response = await axios.post('/api/voice/create-call', {
        studentId,
        priority: 'high',
        reason: 'manual_trigger'
      });
      
      alert('Voice call initiated successfully!');
      fetchDashboardData(); // Refresh data
    } catch (error) {
      console.error('Error triggering voice call:', error);
      alert('Failed to initiate voice call');
    }
  };

  const sendWhatsAppMessage = async (studentId, messageType) => {
    try {
      const response = await axios.post('/api/notifications/whatsapp', {
        studentId,
        messageType,
        urgency: 'normal'
      });
      
      alert('WhatsApp message sent successfully!');
      fetchDashboardData(); // Refresh data
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
      
      fetchDashboardData(); // Refresh data
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

  const StudentCard = ({ student }) => (
    <div className="student-card" onClick={() => setSelectedStudent(student)}>
      <div className="student-header">
        <h3>{student.name}</h3>
        <div className="student-badges">
          <span 
            className="risk-badge" 
            style={{ backgroundColor: getRiskColor(student.riskLevel) }}
          >
            {student.riskLevel || 'unassessed'}
          </span>
          <span 
            className="status-badge"
            style={{ backgroundColor: getStatusColor(student.status) }}
          >
            {student.status.replace('_', ' ')}
          </span>
        </div>
      </div>
      
      <div className="student-info">
        <p><strong>Program:</strong> {student.inquiryType}</p>
        <p><strong>Phone:</strong> {student.phone}</p>
        <p><strong>Email:</strong> {student.email}</p>
        <p><strong>Last Activity:</strong> {formatDate(student.lastActivity || student.createdAt)}</p>
        {student.lastCallAnalysis && (
          <p><strong>Last Call Emotion:</strong> {student.lastCallAnalysis.emotion}</p>
        )}
      </div>
      
      <div className="student-actions">
        <button 
          className="action-btn voice-btn"
          onClick={(e) => {
            e.stopPropagation();
            triggerVoiceCall(student.id);
          }}
        >
          📞 Call
        </button>
        <button 
          className="action-btn whatsapp-btn"
          onClick={(e) => {
            e.stopPropagation();
            sendWhatsAppMessage(student.id, 'followUp');
          }}
        >
          💬 WhatsApp
        </button>
        <select 
          className="status-select"
          value={student.status}
          onChange={(e) => {
            e.stopPropagation();
            updateStudentStatus(student.id, e.target.value);
          }}
        >
          <option value="inquiry_submitted">Inquiry Submitted</option>
          <option value="documents_pending">Documents Pending</option>
          <option value="application_completed">Application Completed</option>
          <option value="dropout_risk">Dropout Risk</option>
          <option value="counselor_required">Counselor Required</option>
          <option value="engaged">Engaged</option>
        </select>
      </div>
    </div>
  );

  const StudentModal = ({ student, onClose }) => {
    if (!student) return null;

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{student.name}</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          
          <div className="modal-body">
            <div className="student-details">
              <h3>Contact Information</h3>
              <p><strong>Phone:</strong> {student.phone}</p>
              <p><strong>Email:</strong> {student.email}</p>
              <p><strong>Program Interest:</strong> {student.inquiryType}</p>
              
              <h3>Application Status</h3>
              <p><strong>Current Status:</strong> {student.status}</p>
              <p><strong>Risk Level:</strong> {student.riskLevel || 'Not assessed'}</p>
              <p><strong>Created:</strong> {formatDate(student.createdAt)}</p>
              <p><strong>Last Activity:</strong> {formatDate(student.lastActivity || student.createdAt)}</p>
              
              {student.lastCallAnalysis && (
                <>
                  <h3>Last Call Analysis</h3>
                  <p><strong>Emotion:</strong> {student.lastCallAnalysis.emotion}</p>
                  <p><strong>Concerns:</strong> {student.lastCallAnalysis.concerns}</p>
                  <p><strong>Next Steps:</strong> {student.lastCallAnalysis.nextSteps}</p>
                  <p><strong>Needs Counselor:</strong> {student.lastCallAnalysis.requiresCounselorFollowUp ? 'Yes' : 'No'}</p>
                </>
              )}
              
              {student.counselorBriefing && (
                <>
                  <h3>Counselor Briefing</h3>
                  <div className="counselor-briefing">
                    {student.counselorBriefing}
                  </div>
                </>
              )}
            </div>
            
            <div className="modal-actions">
              <button 
                className="action-btn voice-btn"
                onClick={() => triggerVoiceCall(student.id)}
              >
                📞 Initiate Voice Call
              </button>
              <button 
                className="action-btn whatsapp-btn"
                onClick={() => sendWhatsAppMessage(student.id, 'followUp')}
              >
                💬 Send WhatsApp
              </button>
              <button 
                className="action-btn email-btn"
                onClick={() => window.open(`mailto:${student.email}`)}
              >
                ✉️ Send Email
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const AnalyticsCard = ({ title, value, subtitle, color = '#3742fa' }) => (
    <div className="analytics-card">
      <div className="analytics-icon" style={{ backgroundColor: color }}>
        📊
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
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Loading dashboard data...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>EduNudge AI - Admission Management Dashboard</h1>
        <div className="header-actions">
          <button onClick={fetchDashboardData} className="refresh-btn">
            🔄 Refresh
          </button>
        </div>
      </header>

      {/* Analytics Section */}
      <section className="analytics-section">
        <div className="analytics-grid">
          <AnalyticsCard 
            title="Total Students" 
            value={analytics.totalStudents || 0}
            subtitle={`Last ${filters.dateRange} days`}
            color="#3742fa"
          />
          <AnalyticsCard 
            title="Voice Calls Made" 
            value={analytics.totalCalls || 0}
            subtitle={`Success rate: ${analytics.callSuccessRate || 0}%`}
            color="#5352ed"
          />
          <AnalyticsCard 
            title="WhatsApp Messages" 
            value={analytics.totalNotifications || 0}
            subtitle="Automated notifications sent"
            color="#00d2d3"
          />
          <AnalyticsCard 
            title="Conversion Rate" 
            value={`${analytics.conversionRate || 0}%`}
            subtitle="Inquiries to applications"
            color="#2ed573"
          />
          <AnalyticsCard 
            title="High Risk Students" 
            value={students.filter(s => s.riskLevel === 'high').length}
            subtitle="Require immediate attention"
            color="#ff4757"
          />
          <AnalyticsCard 
            title="Counselor Required" 
            value={students.filter(s => s.status === 'counselor_required').length}
            subtitle="Need human intervention"
            color="#ff3838"
          />
        </div>
      </section>

      {/* Filters Section */}
      <section className="filters-section">
        <div className="filters">
          <select 
            value={filters.status} 
            onChange={(e) => setFilters({...filters, status: e.target.value})}
          >
            <option value="all">All Statuses</option>
            <option value="inquiry_submitted">Inquiry Submitted</option>
            <option value="documents_pending">Documents Pending</option>
            <option value="dropout_risk">Dropout Risk</option>
            <option value="counselor_required">Counselor Required</option>
          </select>
          
          <select 
            value={filters.riskLevel} 
            onChange={(e) => setFilters({...filters, riskLevel: e.target.value})}
          >
            <option value="all">All Risk Levels</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>
          
          <select 
            value={filters.dateRange} 
            onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
          >
            <option value="1">Last 24 hours</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
        </div>
      </section>

      {/* Students Section */}
      <section className="students-section">
        <h2>Students ({students.length})</h2>
        <div className="students-grid">
          {students.map(student => (
            <StudentCard key={student.id} student={student} />
          ))}
        </div>
        
        {students.length === 0 && (
          <div className="empty-state">
            <p>No students found with current filters.</p>
          </div>
        )}
      </section>

      {/* Recent Calls Section */}
      <section className="calls-section">
        <h2>Recent Voice Calls</h2>
        <div className="calls-table">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Date</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Emotion</th>
                <th>Action Required</th>
              </tr>
            </thead>
            <tbody>
              {calls.map(call => (
                <tr key={call.id}>
                  <td>{call.studentName || 'Unknown'}</td>
                  <td>{formatDate(call.startTime)}</td>
                  <td>{call.duration ? `${Math.floor(call.duration / 1000)}s` : 'N/A'}</td>
                  <td>
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: call.status === 'completed' ? '#2ed573' : '#ff4757' }}
                    >
                      {call.status}
                    </span>
                  </td>
                  <td>{call.analysis?.emotion || 'Not analyzed'}</td>
                  <td>
                    {call.analysis?.requiresCounselorFollowUp ? (
                      <span className="action-required">Counselor Follow-up</span>
                    ) : (
                      <span className="no-action">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Student Detail Modal */}
      {selectedStudent && (
        <StudentModal 
          student={selectedStudent} 
          onClose={() => setSelectedStudent(null)} 
        />
      )}
    </div>
  );
};

export default Dashboard;