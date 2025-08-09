// client/src/components/CallHistory.js
import React from 'react';
import './CallHistory.css';

const CallHistory = ({ calls, formatDate, fetchDashboardData }) => {

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

    return (
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
                                <td>{formatDuration(call.duration)}</td>
                                <td>
                                    <span
                                        className="status-badge"
                                        style={{ backgroundColor: getStatusColor(call.status) }}
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
    );
};

export default CallHistory;