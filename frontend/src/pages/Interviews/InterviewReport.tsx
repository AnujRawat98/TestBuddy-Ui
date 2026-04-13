import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './Interviews.css';

interface TopicScore {
  topicName: string;
  score: number;
  comments: string;
  strengths: string;
  areasForImprovement: string;
}

interface Feedback {
  feedbackId: string;
  overallScore: number;
  topicScores: TopicScore[];
  aIComments: string;
  recommendation: string;
  generatedAt: string;
}

interface TranscriptEntry {
  speaker: string;
  text: string;
  timestamp: string;
}

interface Session {
  sessionId: string;
  startTime: string;
  endTime: string;
  duration: string;
  interruptCount: number;
  averageLatencyMs: number;
  speechConfidence: number;
  transcript: TranscriptEntry[];
}

interface Report {
  candidateId: string;
  candidateName: string;
  email: string;
  interviewName: string;
  difficulty: string;
  session: Session;
  feedback: Feedback;
}

export default function InterviewReport() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReport();
  }, [candidateId]);

  const fetchReport = async () => {
    if (!candidateId) return;
    
    try {
      const res = await api.get(`/interviews/reports/${candidateId}`);
      const data = res.data;
      
      const reportData: Report = {
        candidateId: data.candidateId || data.CandidateId,
        candidateName: data.candidateName || data.CandidateName || 'Unknown',
        email: data.email || data.Email || '',
        interviewName: data.interviewName || data.InterviewName || '',
        difficulty: data.difficulty || data.Difficulty || 'Medium',
        session: data.session || data.Session ? {
          sessionId: data.session?.sessionId || data.Session?.SessionId || '',
          startTime: data.session?.startTime || data.Session?.StartTime || '',
          endTime: data.session?.endTime || data.Session?.EndTime || '',
          duration: data.session?.duration || data.Session?.Duration || 'N/A',
          interruptCount: data.session?.interruptCount || data.Session?.InterruptCount || 0,
          averageLatencyMs: data.session?.averageLatencyMs || data.Session?.AverageLatencyMs || 0,
          speechConfidence: data.session?.speechConfidence || data.Session?.SpeechConfidence || 0,
          transcript: (data.session?.transcript || data.Session?.Transcript || []).map((t: any) => ({
            speaker: t.speaker || t.Speaker || 'assistant',
            text: t.text || t.Text || '',
            timestamp: t.timestamp || t.Timestamp || ''
          }))
        } : null as any,
        feedback: data.feedback || data.Feedback ? {
          feedbackId: data.feedback?.feedbackId || data.Feedback?.FeedbackId || '',
          overallScore: data.feedback?.overallScore || data.Feedback?.OverallScore || data.feedback?.marksObtained || 0,
          topicScores: data.feedback?.topicScores || data.Feedback?.TopicScores || [],
          aIComments: data.feedback?.aIComments || data.Feedback?.AIComments || data.feedback?.remarks || '',
          recommendation: data.feedback?.recommendation || data.Feedback?.Recommendation || data.feedback?.finalAIResult || 'Pending',
          generatedAt: data.feedback?.generatedAt || data.Feedback?.GeneratedAt || data.feedback?.createdAt || new Date().toISOString()
        } : null as any
      };
      
      setReport(reportData);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'var(--green)';
    if (score >= 50) return 'var(--yellow)';
    return 'var(--red)';
  };

  const getRecommendationColor = (rec: string) => {
    const r = rec?.toLowerCase() || '';
    if (r.includes('strong')) return 'var(--green)';
    if (r.includes('average') || r.includes('hire')) return 'var(--yellow)';
    if (r.includes('below') || r.includes('no hire')) return 'var(--red)';
    return 'var(--muted)';
  };

  const formatScore = (score: number, total: number) => {
    if (total > 0) {
      return `${Math.round((score / total) * 100)}% (${score}/${total})`;
    }
    return score;
  };

  if (loading) {
    return (
      <div className="interview-page">
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <div className="empty-title">Loading report...</div>
        </div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="interview-page">
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <p className="empty-state-text">{error || 'Report not found'}</p>
          <button className="btn btn-outline" onClick={() => navigate('/interviews')}>
            ← Back to Interviews
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="interview-page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button 
            onClick={() => navigate('/interviews')} 
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', padding: '8px', display: 'flex', alignItems: 'center' }}
          >
            ←
          </button>
          <h1 className="page-title">Interview Report</h1>
        </div>
      </div>

      {/* Candidate Info Card */}
      <div className="interview-card">
        <div className="interview-card-header">
          <div>
            <h2 className="interview-card-title">{report.candidateName}</h2>
            <div className="interview-card-meta">
              <span className="interview-badge interview-badge-difficulty">{report.difficulty}</span>
              <span className="interview-badge interview-badge-topic">{report.interviewName}</span>
            </div>
          </div>
        </div>
        <p style={{ fontSize: '13px', color: 'var(--muted)', fontFamily: 'DM Sans, sans-serif' }}>
          Email: {report.email}
        </p>
      </div>

      {/* AI Feedback Card */}
      {report.feedback && (
        <div className="interview-card">
          <h3 className="interview-card-title" style={{ marginBottom: '16px' }}>AI Feedback</h3>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '20px' }}>
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: `conic-gradient(${getScoreColor(report.feedback.overallScore)} ${Math.min(report.feedback.overallScore, 100)}%, var(--border) 0%)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative'
            }}>
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                background: 'var(--card)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                fontWeight: 'bold',
                color: getScoreColor(report.feedback.overallScore)
              }}>
                {report.feedback.overallScore}
              </div>
            </div>
            <div>
              <div style={{
                display: 'inline-block',
                padding: '6px 16px',
                borderRadius: '100px',
                background: `${getRecommendationColor(report.feedback.recommendation)}20`,
                color: getRecommendationColor(report.feedback.recommendation),
                fontWeight: '600',
                fontSize: '14px',
                fontFamily: 'DM Sans, sans-serif'
              }}>
                {report.feedback.recommendation}
              </div>
              <p style={{ marginTop: '8px', fontSize: '13px', color: 'var(--muted)', fontFamily: 'DM Sans, sans-serif' }}>
                Generated: {new Date(report.feedback.generatedAt).toLocaleString()}
              </p>
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', fontFamily: 'DM Sans, sans-serif' }}>AI Assessment</h4>
            <p style={{ fontSize: '14px', color: 'var(--ink)', fontFamily: 'DM Sans, sans-serif', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
              {report.feedback.aIComments || 'No assessment comments available.'}
            </p>
          </div>

          {report.feedback.topicScores && report.feedback.topicScores.length > 0 && (
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', fontFamily: 'DM Sans, sans-serif' }}>Topic-wise Scores</h4>
              <div style={{ display: 'grid', gap: '12px' }}>
                {report.feedback.topicScores.map((topic, i) => (
                  <div key={i} style={{
                    padding: '12px',
                    background: 'var(--surface)',
                    borderRadius: '8px'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <span style={{ fontWeight: '500', fontFamily: 'DM Sans, sans-serif' }}>{topic.topicName}</span>
                      <span style={{ fontWeight: 'bold', color: getScoreColor(topic.score) }}>{topic.score}%</span>
                    </div>
                    <div style={{ height: '4px', background: 'var(--border)', borderRadius: '100px', marginBottom: '8px' }}>
                      <div style={{
                        height: '100%',
                        width: `${topic.score}%`,
                        background: getScoreColor(topic.score),
                        borderRadius: '100px'
                      }} />
                    </div>
                    {topic.strengths && (
                      <div style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'DM Sans, sans-serif' }}>
                        <strong>Strengths:</strong> {topic.strengths}
                      </div>
                    )}
                    {topic.areasForImprovement && (
                      <div style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'DM Sans, sans-serif', marginTop: '4px' }}>
                        <strong>Improvements:</strong> {topic.areasForImprovement}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* No Feedback Message */}
      {!report.feedback && (
        <div className="interview-card">
          <div style={{ textAlign: 'center', padding: '32px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📝</div>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Feedback Pending</h3>
            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>
              AI feedback will be generated after the interview is completed.
            </p>
          </div>
        </div>
      )}

      {/* Session Metrics */}
      {report.session && (
        <div className="interview-card">
          <h3 className="interview-card-title" style={{ marginBottom: '16px' }}>Session Details</h3>
          
          <div className="interview-stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="interview-stat-card stat-1">
              <div className="interview-stat-icon">⏱️</div>
              <div className="interview-stat-num">
                {report.session.duration && report.session.duration !== '00:00:00' 
                  ? report.session.duration 
                  : 'N/A'}
              </div>
              <div className="interview-stat-label">Duration</div>
            </div>
            <div className="interview-stat-card stat-2">
              <div className="interview-stat-icon">🔇</div>
              <div className="interview-stat-num">{report.session.interruptCount}</div>
              <div className="interview-stat-label">Interruptions</div>
            </div>
            <div className="interview-stat-card stat-3">
              <div className="interview-stat-icon">🎤</div>
              <div className="interview-stat-num">{report.session.speechConfidence.toFixed(1)}%</div>
              <div className="interview-stat-label">Speech Clarity</div>
            </div>
          </div>
        </div>
      )}

      {/* Transcript */}
      {report.session?.transcript && report.session.transcript.length > 0 && (
        <div className="interview-card">
          <h3 className="interview-card-title" style={{ marginBottom: '16px' }}>Conversation Transcript</h3>
          
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {report.session.transcript.map((entry, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: entry.speaker === 'assistant' || entry.speaker === 'interviewer' ? 'flex-start' : 'flex-end',
                  marginBottom: '12px'
                }}
              >
                <div style={{
                  maxWidth: '70%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  background: entry.speaker === 'assistant' || entry.speaker === 'interviewer' ? 'var(--accent2)' : 'var(--accent)',
                  color: 'white',
                  fontSize: '14px',
                  fontFamily: 'DM Sans, sans-serif'
                }}>
                  <div style={{ fontSize: '11px', opacity: 0.7, marginBottom: '4px' }}>
                    {entry.speaker === 'assistant' || entry.speaker === 'interviewer' ? 'AI Interviewer' : 'Candidate'}
                  </div>
                  {entry.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
