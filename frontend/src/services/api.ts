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
    // Swagger: POST /api/ai/questions/generate
    // Body: { topic, level, questionType, questionCount }
    generate: (data: { topic: string; level?: string; questionType?: string; questionCount: number }) =>
        api.post('/ai/questions/generate', data),
};

// ─── ASSESSMENT LINKS ────────────────────────────────────────────────────
export const assessmentLinksApi = {
    create:   (data: any)                        => api.post('/assessment-links', data),
    addUsers: (linkId: string, emails: string[]) => api.post(`/assessment-links/${linkId}/users`, emails),
    validate: (linkId: string, email: string)    => api.post(`/assessment-links/validate?linkId=${linkId}&email=${email}`),
    start:    (linkId: string, email: string)    => api.post(`/assessment-links/${linkId}/start?email=${email}`),
};

// ─── ASSESSMENTS ─────────────────────────────────────────────────────────
// DB confirmed: Assessments table has Id, Title, TotalQuestions, MarksPerQuestion,
// DurationMinutes, IsRandomized, IsActive, NegativeMarks
export const assessmentsApi = {
    getAll:              ()                                                        => api.get('/Assessments'),
    create:              (data: any)                                               => api.post('/Assessments', data),
    start:               (assessmentId: string, userEmail: string)                 => api.post(`/Assessments/${assessmentId}/start?userEmail=${userEmail}`),
    getAttemptQuestions: (attemptId: string)                                       => api.get(`/Assessments/attempt/${attemptId}/questions`),
    saveAnswer:          (data: { attemptQuestionId: string; answer: string })     => api.post('/Assessments/attempt/answer', data),
    submitAttempt:       (attemptId: string)                                       => api.post(`/Assessments/attempt/${attemptId}/submit`),
};

// ─── QUESTIONS ───────────────────────────────────────────────────────────
export const questionsApi = {
    // POST /api/questions  — body: CreateQuestionsRequestDto
    // { isSaveAsDraft: boolean, questions: CreateQuestionDto[] }
    // CreateQuestionDto: { questionText, topicId (uuid), levelId (uuid),
    //                      questionTypeId (uuid), options: CreateOptionDto[], textAnswer }
    createMultiple: (data: any) => api.post('/questions', data),

    // GET /api/questions?topicVersionId={uuid}   ← correct param per Swagger
    getAllByTopic: (topicVersionId: string) =>
        api.get('/questions', { params: { topicVersionId } }),

    // GET /api/questions/{id}
    getById: (id: string) => api.get(`/questions/${id}`),

    // PUT /api/questions/{id}
    // UpdateQuestionRequestDto: { questionText, options: CreateOptionDto[], textAnswer, status }
    // ⚠️  levelId / questionTypeId are NOT in UpdateQuestionRequestDto — do not send them
    update: (id: string, data: {
        questionText?: string;
        options?: { text: string; isCorrect: boolean; imageUrl?: string }[];
        textAnswer?: string;
        status?: string;
    }) => api.put(`/questions/${id}`, data),

    // DELETE /api/questions/{id}
    delete: (id: string) => api.delete(`/questions/${id}`),

    // POST /api/questions/search
    // Body: { topics[], levels[], types[], pageNumber, pageSize }
    search: (data: any) => api.post('/questions/search', data),
};

// ─── TOPICS ──────────────────────────────────────────────────────────────
export const topicsApi = {
    // GET /api/topics  — returns topic list
    // Each topic has at minimum: topicId, topicVersionId, name
    // createdAt may be on the topic object or nested in topicVersion
    getAll: () => api.get('/topics'),

    // POST /api/topics  — body: { name }
    create: (data: { name: string }) => api.post('/topics', data),
};

export const attemptsApi = assessmentsApi;

export default api;
