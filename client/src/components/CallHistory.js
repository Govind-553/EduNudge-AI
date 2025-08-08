// client/src/components/CallHistory.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './CallHistory.css'; 

const CallHistory = ({ studentId = null, limit = 50 }) => {
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCalls();
  }, [studentId, limit]);

  const fetchCalls = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const params = { limit };
      if (studentId) {
        params.studentId = studentId;
      }
      
      const response = await axios.get('/api/voice/calls', { params });
      setCalls(response.data.calls || []);
    } catch (err) {
      console.error('Error fetching calls:', err);
      setError('Failed to load call history');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'completed': '#10b981',
      'failed': '#ef4444',
      'no_answer': '#f59e0b',
      'initiated': '#3b82f6',
      'in_progress': '#8b5cf6'
    };
    return colors[status] || '#6b7280';
  };

  const formatDuration = (duration) => {
    if (!duration) return 'N/A';
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="call-history-loading">
        <div className="loading-spinner"></div>
        <p>Loading call history...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="call-history-error">
        <p>{error}</p>
        <button onClick={fetchCalls}>Retry</button>
      </div>
    );
  }

  return (
    <div className="call-history">
      <div className="call-history-header">
        <h3>Call History ({calls.length})</h3>
        <button onClick={fetchCalls} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>

      {calls.length === 0 ? (
        <div className="no-calls">
          <p>No calls found</p>
        </div>
      ) : (
        <div className="calls-table">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Date & Time</th>
                <th>Duration</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Reason</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {calls.map(call => (
                <tr key={call.id}>
                  <td>
                    <div className="call-student">
                      <div className="student-name">
                        {call.studentName || 'Unknown'}
                      </div>
                      <div className="student-phone">
                        {call.toNumber}
                      </div>
                    </div>
                  </td>
                  <td>{formatDate(call.startTime || call.createdAt)}</td>
                  <td>{formatDuration(call.duration)}</td>
                  <td>
                    <span 
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(call.status) }}
                    >
                      {call.status}
                    </span>
                  </td>
                  <td>
                    <span className={`priority-badge priority-${call.priority}`}>
                      {call.priority || 'medium'}
                    </span>
                  </td>
                  <td>{call.reason || 'follow_up'}</td>
                  <td>
                    <div className="call-actions">
                      <button 
                        className="action-btn view-btn"
                        onClick={() => {/* View call details */}}
                        title="View Details"
                      >
                        👁️
                      </button>
                      {call.recordingUrl && (
                        <button 
                          className="action-btn play-btn"
                          onClick={() => window.open(call.recordingUrl)}
                          title="Play Recording"
                        >
                          ▶️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default CallHistory;