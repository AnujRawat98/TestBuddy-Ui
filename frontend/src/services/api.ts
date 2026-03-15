import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://localhost:7162/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => Promise.reject(error));

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
        }
        return Promise.reject(error);
    }
);

// ─── ADMIN ──────────────────────────────────────────────────────────────
export const adminApi = {
    login: (data: any) => api.post('/admin/login', data),
};

// ─── AI QUESTIONS ────────────────────────────────────────────────────────
export const aiQuestionsApi = {
    generate: (data: { topic: string; level?: string; questionType?: string; questionCount: number }) =>
        api.post('/ai/questions/generate', data),
};

// ─── ASSESSMENT LINKS ────────────────────────────────────────────────────
export const assessmentLinksApi = {
    create:          (data: any)                        => api.post('/assessment-links', data),
    // GET /api/assessment-links?assessmentId={uuid}  ← Swagger confirmed
    getByAssessment: (assessmentId: string)             => api.get('/assessment-links', { params: { assessmentId } }),
    // GET /api/assessment-links/{linkId}             ← Swagger confirmed
    getById:         (linkId: string)                   => api.get(`/assessment-links/${linkId}`),
    validate:        (linkId: string, email: string)    => api.post(`/assessment-links/validate?linkId=${linkId}&email=${email}`),
    start:           (linkId: string, email: string)    => api.post(`/assessment-links/${linkId}/start?email=${email}`),
};

// ─── ASSESSMENTS ─────────────────────────────────────────────────────────
export const assessmentsApi = {
    getAll:              ()                                                        => api.get('/Assessments'),
    create:              (data: any)                                               => api.post('/Assessments', data),
    // PUT /api/Assessments/{id}/status  body: { isActive: boolean } ← Swagger confirmed
    updateStatus:        (id: string, isActive: boolean)                          => api.put(`/Assessments/${id}/status`, { isActive }),
    start:               (assessmentId: string, userEmail: string)                => api.post(`/Assessments/${assessmentId}/start?userEmail=${userEmail}`),
    getAttemptQuestions: (attemptId: string)                                      => api.get(`/Assessments/attempt/${attemptId}/questions`),
    saveAnswer:          (data: { attemptQuestionId: string; answer: string })    => api.post('/Assessments/attempt/answer', data),
    submitAttempt:       (attemptId: string)                                      => api.post(`/Assessments/attempt/${attemptId}/submit`),
};

// ─── QUESTIONS ───────────────────────────────────────────────────────────
export const questionsApi = {
    createMultiple: (data: any)              => api.post('/questions', data),
    getAllByTopic:   (topicVersionId: string) => api.get('/questions', { params: { topicVersionId } }),
    getById:        (id: string)             => api.get(`/questions/${id}`),
    update: (id: string, data: {
        questionText?: string;
        options?: { text: string; isCorrect: boolean; imageUrl?: string }[];
        textAnswer?: string;
        status?: string;
    }) => api.put(`/questions/${id}`, data),
    delete: (id: string)  => api.delete(`/questions/${id}`),
    search: (data: any)   => api.post('/questions/search', data),
};

// ─── TOPICS ──────────────────────────────────────────────────────────────
export const topicsApi = {
    getAll: ()                          => api.get('/topics'),
    create: (data: { name: string })    => api.post('/topics', data),
};

export const attemptsApi = assessmentsApi;

export default api;
