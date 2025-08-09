// client/src/components/sampleData.js

export const sampleAnalyticsData = {
  totalStudents: 152,
  totalCalls: 320,
  totalNotifications: 890,
  conversionRate: 28,
  callSuccessRate: 85,
  highRiskStudents: 18,
  counselorRequired: 9,
  statusBreakdown: [
      { name: 'Inquiry', value: 64, fill: '#3b82f6' },
      { name: 'Docs Pending', value: 42, fill: '#f59e0b' },
      { name: 'Completed', value: 21, fill: '#22c55e' },
      { name: 'Dropout Risk', value: 18, fill: '#ef4444' },
      { name: 'Counselor', value: 9, fill: '#8b5cf6' },
  ],
  dailyTrends: [
    { name: '7 days ago', students: 12, calls: 30 },
    { name: '6 days ago', students: 15, calls: 35 },
    { name: '5 days ago', students: 18, calls: 40 },
    { name: '4 days ago', students: 22, calls: 42 },
    { name: '3 days ago', students: 25, calls: 48 },
    { name: '2 days ago', students: 28, calls: 55 },
    { name: 'Yesterday', students: 30, calls: 60 },
  ],
  riskDistribution: [
    { name: 'Low Risk', value: 125, fill: '#22c55e' },
    { name: 'Medium Risk', value: 27, fill: '#f59e0b' },
    { name: 'High Risk', value: 18, fill: '#ef4444' },
  ],
};