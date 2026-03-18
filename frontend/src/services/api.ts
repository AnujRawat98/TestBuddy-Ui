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
    create:          (data: any)                     => api.post('/assessment-links', data),
    getByAssessment: (assessmentId: string)          => api.get('/assessment-links', { params: { assessmentId } }),
    getById:         (linkId: string)                => api.get(`/assessment-links/${linkId}`),
    validate:        (linkId: string, email: string) => api.post(`/assessment-links/validate?linkId=${linkId}&email=${email}`),
    start:           (linkId: string, email: string) => api.post(`/assessment-links/${linkId}/start?email=${email}`),
};

// ─── ASSESSMENTS ─────────────────────────────────────────────────────────
export const assessmentsApi = {
    getAll:              ()                                                     => api.get('/Assessments'),
    create:              (data: any)                                            => api.post('/Assessments', data),
    updateStatus:        (id: string, isActive: boolean)                       => api.put(`/Assessments/${id}/status`, { isActive }),
    start:               (assessmentId: string, userEmail: string)             => api.post(`/Assessments/${assessmentId}/start?userEmail=${userEmail}`),
    getAttemptQuestions: (attemptId: string)                                   => api.get(`/Assessments/attempt/${attemptId}/questions`),
    saveAnswer:          (data: { attemptQuestionId: string; answer: string }) => api.post('/Assessments/attempt/answer', data),
    submitAttempt:       (attemptId: string)                                   => api.post(`/Assessments/attempt/${attemptId}/submit`),
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
    getAll: ()                       => api.get('/topics'),
    create: (data: { name: string }) => api.post('/topics', data),
};

// ─── PROCTORING ──────────────────────────────────────────────────────────
// All proctoring endpoints from swagger — used by ExamScreen and admin panel.
export const proctoringApi = {

    // ── Session ────────────────────────────────────────────────────────────
    // POST /api/proctoring/sessions/start
    // Called once when exam loads. Returns { sessionId, startedAt }.
    startSession: (data: {
        attemptId:               string;
        assessmentLinkId:        string;
        webProctoringEnabled:    boolean;
        imageProctoringEnabled:  boolean;
        screenRecordingEnabled:  boolean;
        screenRecordingDuration?: number;
        screenRecordingQuality?:  string;
    }) => api.post('/proctoring/sessions/start', data),

    // POST /api/proctoring/sessions/end
    // Called after exam submit. Returns { sessionId, totalViolations, riskScore, riskLevel }.
    endSession: (data: {
        sessionId: string;
        attemptId: string;
    }) => api.post('/proctoring/sessions/end', data),

    // GET /api/proctoring/sessions/attempt/{attemptId}
    // Returns full SessionSummaryDto. Used by admin review panel.
    getSessionByAttempt: (attemptId: string) =>
        api.get(`/proctoring/sessions/attempt/${attemptId}`),

    // ── Violations ─────────────────────────────────────────────────────────
    // POST /api/proctoring/violations
    // Called on every proctoring event (tab switch, fullscreen exit, devtools).
    // Returns { violationId, violationNumber, totalViolations, riskScore, riskLevel }.
    logViolation: (data: {
        sessionId:     string;
        attemptId:     string;
        violationType: string;   // 'TAB_SWITCH' | 'FULLSCREEN_EXIT' | 'DEVTOOLS_OPEN' | 'COPY_ATTEMPT' | 'PASTE_ATTEMPT'
        description?:  string;
        occurredAt:    string;   // ISO datetime string
        ipAddress?:    string;
        userAgent?:    string;
    }) => api.post('/proctoring/violations', data),

    // GET /api/proctoring/violations/{sessionId}
    // Returns ViolationDto[]. Admin use.
    getViolations: (sessionId: string) =>
        api.get(`/proctoring/violations/${sessionId}`),

    // ── Snapshots (webcam) ─────────────────────────────────────────────────
    // POST /api/proctoring/snapshots
    // Sends base64 JPEG. Returns { snapshotId, analysisStatus, imageUrl }.
    uploadSnapshot: (data: {
        sessionId:      string;
        attemptId:      string;
        imageBase64:    string;   // data:image/jpeg;base64,... OR raw base64
        capturedAt:     string;   // ISO datetime string
        sequenceNumber: number;
    }) => api.post('/proctoring/snapshots', data),

    // GET /api/proctoring/snapshots/{sessionId}
    // Returns SnapshotDto[]. Admin use.
    getSnapshots: (sessionId: string) =>
        api.get(`/proctoring/snapshots/${sessionId}`),

    // ── Recordings (screen) ────────────────────────────────────────────────
    // POST /api/proctoring/recordings/upload
    // Multipart form-data. IMPORTANT: do NOT set Content-Type header manually —
    // axios sets it automatically with the correct boundary when FormData is passed.
    // Returns { recordingId, videoUrl, uploadStatus }.
    uploadRecording: (formData: FormData) =>
        api.post('/proctoring/recordings/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            // Large file — increase timeout to 5 minutes
            timeout: 300_000,
        }),

    // ── Admin ──────────────────────────────────────────────────────────────
    // GET /api/proctoring/admin/flagged?page=1&pageSize=20
    // Returns PagedResult<SessionSummaryDto>.
    getFlaggedSessions: (page = 1, pageSize = 20) =>
        api.get('/proctoring/admin/flagged', { params: { page, pageSize } }),

    // PUT /api/proctoring/admin/sessions/{sessionId}/review
    // Body: { reviewStatus: 'Flagged' | 'Cleared', reviewNotes?: string }
    reviewSession: (sessionId: string, data: {
        reviewStatus: 'Flagged' | 'Cleared' | 'Reviewed';
        reviewNotes?: string;
    }) => api.put(`/proctoring/admin/sessions/${sessionId}/review`, data),
};

export const attemptsApi = assessmentsApi;

export default api;
