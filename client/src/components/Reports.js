// client/src/components/Reports.js
import React from 'react';
import './Reports.css';

const ReportCard = ({ title, description, icon }) => (
  <div className="report-card">
    <div className="report-card-icon">{icon}</div>
    <div className="report-card-content">
      <h3 className="report-card-title">{title}</h3>
      <p className="report-card-description">{description}</p>
    </div>
    <button className="report-card-button">Generate Report</button>
  </div>
);

const Reports = () => {
  const availableReports = [
    {
      title: 'Student Conversion Funnel',
      description: 'Analyze the student journey from inquiry to enrollment, identifying key drop-off points.',
      icon: '📊',
    },
    {
      title: 'Call Outcome Analysis',
      description: 'Detailed breakdown of voice call outcomes, including success rates and emotional analysis.',
      icon: '📞',
    },
    {
      title: 'Dropout Risk Trends',
      description: 'Track the number of high-risk students over time and identify patterns.',
      icon: '⚠️',
    },
    {
      title: 'Counselor Performance',
      description: 'Review key metrics related to counselor outreach, engagement, and success rates.',
      icon: '🧑‍🏫',
    },
    {
      title: 'Notification Engagement',
      description: 'Measure the effectiveness of WhatsApp and email campaigns based on student responses.',
      icon: '💬',
    },
    {
      title: 'Quarterly Admissions Summary',
      description: 'A comprehensive overview of all admission activities for the selected quarter.',
      icon: '📅',
    },
  ];

  return (
    <div className="reports-page">
      <div className="reports-container">
        <h1 className="reports-title">Reports</h1>
        <p className="reports-subtitle">
          Generate detailed reports to gain deeper insights into your admissions process.
        </p>
        <div className="reports-grid">
          {availableReports.map((report) => (
            <ReportCard key={report.title} {...report} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Reports;