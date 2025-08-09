// client/src/components/StudentList.js
import React, { useState } from 'react';
import './StudentList.css';

const StudentList = ({ students, triggerVoiceCall, sendWhatsAppMessage, updateStudentStatus, formatDate, getRiskColor, getStatusColor }) => {
    const [selectedStudent, setSelectedStudent] = useState(null);

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
                        {student.status.replace(/_/g, ' ')}
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

    return (
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
            {selectedStudent && (
                <StudentModal
                    student={selectedStudent}
                    onClose={() => setSelectedStudent(null)}
                />
            )}
        </section>
    );
};

export default StudentList;