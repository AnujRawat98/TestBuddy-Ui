import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://localhost:7162/api';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000, // 60 seconds timeout
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

// ─── ADMIN ───────────────────────────────────────────────────────────────────
export const adminApi = {
    login: (data: any) => api.post('/admin/login', data),
};

// ─── AI QUESTIONS ─────────────────────────────────────────────────────────────
// Matches GenerateQuestionsRequestDto (camelCase per Swagger)
export const aiQuestionsApi = {
    generate: (data: { topic: string; level: string; questionType: string; questionCount: number }) =>
        api.post('/ai/questions/generate', data),
};

// ─── LEVELS & QUESTION TYPES ──────────────────────────────────────────────────
// These call the new LevelsController and QuestionTypesController.
// Even if they fail, AIGenerator.tsx falls back to hardcoded seeded GUIDs.
export const levelsApi = {
    getAll: () => api.get('/levels'),
};

export const questionTypesApi = {
    getAll: () => api.get('/question-types'),
};

// ─── ASSESSMENT LINKS ─────────────────────────────────────────────────────────
export const assessmentLinksApi = {
    create:          (data: any)                     => api.post('/assessment-links', data),
    getByAssessment: (assessmentId: string)          => api.get('/assessment-links', { params: { assessmentId } }),
    getById:         (linkId: string)                => api.get(`/assessment-links/${linkId}`),
    validate:        (linkId: string, email: string, accessCode: string = '') =>
        api.post(`/assessment-links/validate?linkId=${linkId}&email=${email}&accessCode=${encodeURIComponent(accessCode)}`),
    start:           (linkId: string, email: string) => api.post(`/assessment-links/${linkId}/start?email=${email}`),
};

// ─── ASSESSMENTS ──────────────────────────────────────────────────────────────
export const assessmentsApi = {
    getAll:              ()                                                     => api.get('/Assessments'),
    create:              (data: any)                                            => api.post('/Assessments', data),
    updateStatus:        (id: string, isActive: boolean)                       => api.put(`/Assessments/${id}/status`, { isActive }),
    start:               (assessmentId: string, userEmail: string)             => api.post(`/Assessments/${assessmentId}/start?userEmail=${userEmail}`),
    getAttemptQuestions: (attemptId: string)                                   => api.get(`/Assessments/attempt/${attemptId}/questions`),
    saveAnswer:          (data: { attemptQuestionId: string; answer: string }) => api.post('/Assessments/attempt/answer', data),
    submitAttempt:       (attemptId: string)                                   => api.post(`/Assessments/attempt/${attemptId}/submit`),
    getAttemptsByLink:   (linkId: string)                                      => api.get(`/Assessments/attempts/by-link/${linkId}`),
    getAttemptFullReport:     (attemptId: string)                              => api.get(`/Assessments/attempt/${attemptId}/full-report`),
    getAttemptQuestionReview: (attemptId: string)                              => api.get(`/Assessments/attempt/${attemptId}/question-review`),
};

// ─── QUESTIONS ────────────────────────────────────────────────────────────────
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

// ─── TOPICS ───────────────────────────────────────────────────────────────────
export const topicsApi = {
    getAll: ()                       => api.get('/topics'),
    create: (data: { name: string }) => api.post('/topics', data),
};

// ─── BULK UPLOAD ──────────────────────────────────────────────────────────────
export const bulkUploadApi = {
    uploadTopicsQuestions: (file: File, saveAsDraft = false) => {
        const formData = new FormData();
        formData.append('file', file);
        return api.post(
            `/bulk-upload/topics-questions?saveAsDraft=${saveAsDraft}`,
            formData,
            { headers: { 'Content-Type': 'multipart/form-data' } }
        );
    },
    downloadTemplate: () =>
        api.get('/bulk-upload/template', { responseType: 'blob' }),
};

// ─── PROCTORING ───────────────────────────────────────────────────────────────
export const proctoringApi = {
    startSession: (data: {
        attemptId: string; assessmentLinkId: string;
        webProctoringEnabled: boolean; imageProctoringEnabled: boolean;
        screenRecordingEnabled: boolean; screenRecordingDuration?: number;
        screenRecordingQuality?: string;
    }) => api.post('/proctoring/sessions/start', data),

    endSession: (data: { sessionId: string; attemptId: string }) =>
        api.post('/proctoring/sessions/end', data),

    getSessionByAttempt: (attemptId: string) =>
        api.get(`/proctoring/sessions/attempt/${attemptId}`),

    logViolation: (data: {
        sessionId: string; attemptId: string; violationType: string;
        description?: string; occurredAt: string; ipAddress?: string; userAgent?: string;
    }) => api.post('/proctoring/violations', data),

    getViolations:   (sessionId: string) => api.get(`/proctoring/violations/${sessionId}`),

    uploadSnapshot: (data: {
        sessionId: string; attemptId: string; imageBase64: string;
        capturedAt: string; sequenceNumber: number;
    }) => api.post('/proctoring/snapshots', data),

    getSnapshots: (sessionId: string) => api.get(`/proctoring/snapshots/${sessionId}`),

    uploadRecording: (formData: FormData) =>
        api.post('/proctoring/recordings/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 300_000,
        }),

    getFlaggedSessions: (page = 1, pageSize = 20) =>
        api.get('/proctoring/admin/flagged', { params: { page, pageSize } }),

    reviewSession: (sessionId: string, data: {
        reviewStatus: 'Flagged' | 'Cleared' | 'Reviewed';
        reviewNotes?: string;
    }) => api.put(`/proctoring/admin/sessions/${sessionId}/review`, data),
};

export const attemptsApi = assessmentsApi;

// ─── INTERVIEWS ───────────────────────────────────────────────────────────────
export const interviewsApi = {
    getAll: () => api.get('/interviews'),
    create: (data: any) => api.post('/interviews', data),
    getById: (id: string) => api.get(`/interviews/${id}`),
};

export const interviewLinksApi = {
    getByInterview: (interviewId: string) => api.get(`/interviews/${interviewId}/links`),
    getById: (linkId: string) => api.get(`/interviews/links/${linkId}`),
};

export const interviewCandidatesApi = {
    getByLink: (linkId: string) => api.get('/interviews/candidates', { params: { linkId } }),
};

export default api;