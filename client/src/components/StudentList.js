// client/src/components/StudentList.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './StudentList.css';

const StudentList = ({ onStudentSelect, filters = {} }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStudents();
  }, [filters]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('/api/students', {
        params: filters
      });
      
      setStudents(response.data.students || []);
    } catch (err) {
      console.error('Error fetching students:', err);
      setError('Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'inquiry_submitted': '#3b82f6',
      'documents_pending': '#f59e0b',
      'application_completed': '#10b981',
      'dropout_risk': '#ef4444',
      'counselor_required': '#dc2626',
      'engaged': '#8b5cf6'
    };
    return colors[status] || '#6b7280';
  };

  const getRiskColor = (riskLevel) => {
    const colors = {
      'high': '#ef4444',
      'medium': '#f59e0b',
      'low': '#10b981'
    };
    return colors[riskLevel] || '#6b7280';
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="student-list-loading">
        <div className="loading-spinner"></div>
        <p>Loading students...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="student-list-error">
        <p>{error}</p>
        <button onClick={fetchStudents}>Retry</button>
      </div>
    );
  }

  return (
    <div className="student-list">
      <div className="student-list-header">
        <h3>Students ({students.length})</h3>
        <button onClick={fetchStudents} className="refresh-btn">
          🔄 Refresh
        </button>
      </div>
      
      {students.length === 0 ? (
        <div className="no-students">
          <p>No students found</p>
        </div>
      ) : (
        <div className="student-items">
          {students.map(student => (
            <div 
              key={student.id} 
              className="student-item"
              onClick={() => onStudentSelect && onStudentSelect(student)}
            >
              <div className="student-info">
                <div className="student-name">{student.name}</div>
                <div className="student-contact">
                  {student.email} • {student.phone}
                </div>
                <div className="student-program">
                  {student.inquiryType || 'General Inquiry'}
                </div>
                <div className="student-date">
                  Created: {formatDate(student.createdAt)}
                </div>
              </div>
              
              <div className="student-badges">
                <span 
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(student.status) }}
                >
                  {student.status?.replace('_', ' ')}
                </span>
                {student.riskLevel && (
                  <span 
                    className="risk-badge"
                    style={{ backgroundColor: getRiskColor(student.riskLevel) }}
                  >
                    {student.riskLevel} risk
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentList;