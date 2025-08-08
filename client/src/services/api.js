// client/src/services/api.js
import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_BASE_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('authToken');
      window.location.href = '/login';
    }
    
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Student API endpoints
export const studentApi = {
  // Get all students with filters
  getStudents: (filters = {}) => {
    return api.get('/students', { params: filters });
  },
  
  // Get specific student
  getStudent: (id) => {
    return api.get(`/students/${id}`);
  },
  
  // Create new student
  createStudent: (data) => {
    return api.post('/students', data);
  },
  
  // Update student
  updateStudent: (id, data) => {
    return api.put(`/students/${id}`, data);
  },
  
  // Delete student
  deleteStudent: (id) => {
    return api.delete(`/students/${id}`);
  },
  
  // Search students
  searchStudents: (query, limit = 20) => {
    return api.get(`/students/search/${query}`, { params: { limit } });
  },
  
  // Get student statistics
  getStudentStats: (dateRange = '7') => {
    return api.get('/students/stats/overview', { params: { dateRange } });
  },
  
  // Bulk update student statuses
  bulkUpdateStatus: (studentIds, status, reason) => {
    return api.put('/students/bulk/status', { studentIds, status, reason });
  }
};

// Voice API endpoints
export const voiceApi = {
  // Create voice call
  createCall: (data) => {
    return api.post('/voice/create-call', data);
  },
  
  // Get call status
  getCallStatus: (callId) => {
    return api.get(`/voice/status/${callId}`);
  },
  
  // Get call history
  getCalls: (params = {}) => {
    return api.get('/voice/calls', { params });
  }
};

// Admin API endpoints
export const adminApi = {
  // Get analytics
  getAnalytics: (dateRange = '7') => {
    return api.get('/admin/analytics', { params: { dateRange } });
  },
  
  // Get recent calls
  getCalls: (limit = 50) => {
    return api.get('/admin/calls', { params: { limit } });
  },
  
  // Log activity
  logActivity: (data) => {
    return api.post('/admin/log', data);
  }
};

// Webhook API endpoints
export const webhookApi = {
  // Submit inquiry form
  submitInquiry: (data) => {
    return api.post('/webhook/inquiry', data);
  }
};

// Authentication API endpoints
export const authApi = {
  // Login
  login: (credentials) => {
    return api.post('/auth/login', credentials);
  },
  
  // Logout
  logout: () => {
    return api.post('/auth/logout');
  },
  
  // Refresh token
  refreshToken: (refreshToken) => {
    return api.post('/auth/refresh', { refreshToken });
  }
};

// Utility functions
export const apiUtils = {
  // Set auth token
  setAuthToken: (token) => {
    localStorage.setItem('authToken', token);
  },
  
  // Remove auth token
  removeAuthToken: () => {
    localStorage.removeItem('authToken');
  },
  
  // Get auth token
  getAuthToken: () => {
    return localStorage.getItem('authToken');
  },
  
  // Check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('authToken');
  }
};

export default api;