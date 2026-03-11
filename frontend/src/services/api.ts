import axios from 'axios';

// Ensure this matches your backend API base URL when deployed or running locally
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://untinged-dominique-uncollapsed.ngrok-free.dev/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor to add auth token in the future if needed
api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});

// Response interceptor to handle global errors like unauthenticated
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            localStorage.removeItem('token');
            // maybe redirect to login logic
        }
        return Promise.reject(error);
    }
);


// ─── ADMIN API ──────────────────────────────────────────────────────────
export const adminApi = {
    login: (data: any) => api.post('/admin/login', data),
};

// ─── AI QUESTIONS API ───────────────────────────────────────────────────
export const aiQuestionsApi = {
    generate: (data: any) => api.post('/ai/questions/generate', data),
};

// ─── ASSESSMENT LINKS API ───────────────────────────────────────────────
export const assessmentLinksApi = {
    create: (data: any) => api.post('/assessment-links', data),
    addUsers: (linkId: string, emails: string[]) => api.post(`/assessment-links/${linkId}/users`, emails),
    validate: (linkId: string, email: string) => api.post(`/assessment-links/validate?linkId=${linkId}&email=${email}`),
    start: (linkId: string, email: string) => api.post(`/assessment-links/${linkId}/start?email=${email}`),
};

// ─── ASSESSMENTS API ────────────────────────────────────────────────────
export const assessmentsApi = {
    getAll: () => api.get('/Assessments'),
    create: (data: any) => api.post('/Assessments', data),
    start: (assessmentId: string, userEmail: string) => api.post(`/Assessments/${assessmentId}/start?userEmail=${userEmail}`),
    getAttemptQuestions: (attemptId: string) => api.get(`/Assessments/attempt/${attemptId}/questions`),
    saveAnswer: (data: { attemptQuestionId: string, answer: string }) => api.post(`/Assessments/attempt/answer`, data),
    submitAttempt: (attemptId: string) => api.post(`/Assessments/attempt/${attemptId}/submit`),
};

// ─── QUESTIONS API ──────────────────────────────────────────────────────
export const questionsApi = {
    createMultiple: (data: any) => api.post('/questions', data),
    getAllByTopic: (topicId: string) => api.get(`/questions?topicId=${topicId}`),
    getById: (id: string) => api.get(`/questions/${id}`),
    update: (id: string, data: any) => api.put(`/questions/${id}`, data),
    delete: (id: string) => api.delete(`/questions/${id}`),
    search: (data: any) => api.post('/questions/search', data),
};

// ─── TOPICS API ─────────────────────────────────────────────────────────
export const topicsApi = {
    getAll: () => api.get('/topics'),
    create: (data: { name: string }) => api.post('/topics', data),
};

export const attemptsApi = assessmentsApi;

export default api;
