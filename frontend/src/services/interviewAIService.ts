import api from './api';

const interviewAIService = {
  async startInterview(interviewId: string, candidateId: string) {
    const response = await api.post(`/interview-ai/start/${interviewId}`, { candidateId });
    return response.data;
  },

  async getWelcomeMessage(sessionId: string) {
    const response = await api.get(`/interview-ai/${sessionId}/welcome`);
    return response.data;
  },

  async getNextQuestion(sessionId: string, request?: { lastAnswer?: string; audioData?: string }) {
    const response = await api.post(`/interview-ai/${sessionId}/next-question`, request || {});
    return response.data;
  },

  async getSession(sessionId: string) {
    const response = await api.get(`/interview-ai/${sessionId}/session`);
    return response.data;
  },

  async endInterview(sessionId: string) {
    await api.post(`/interview-ai/${sessionId}/end`);
  },

  async saveResumeSummary(candidateId: string, summary: string) {
    await api.post(`/interview-ai/candidates/${candidateId}/resume-summary`, { summary });
  },

  async storeJobDescription(ijpId: string, content: string) {
    await api.post(`/interview-ai/ijp/${ijpId}/job-description`, { content });
  },

  async storeCompanyPolicy(ijpId: string, content: string) {
    await api.post(`/interview-ai/ijp/${ijpId}/company-policy`, { content });
  }
};

export default interviewAIService;
