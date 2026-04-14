import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import './Interviews.css';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SkillEvaluation {
  skill: string;
  score: number;
  feedback: string;
}

interface QuestionAnalysis {
  question: string;
  answerQuality: string;
  score: number;
  remarks: string;
}

interface InterviewReportData {
  id: string;
  interviewId: string;
  candidateId: string;
  overallScore: number;
  decision: string;
  summary: string;
  recommendation: string;
  createdAt: string;
  skillsEvaluation: SkillEvaluation[];
  strengths: string[];
  weaknesses: string[];
  questionAnalysis: QuestionAnalysis[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const getScoreColor = (score: number) => {
  if (score >= 7.5) return 'var(--green)';
  if (score >= 5) return 'var(--yellow)';
  return 'var(--red)';
};

const getDecisionColor = (decision: string) => {
  const d = decision?.toLowerCase() || '';
  if (d.includes('selected')) return { color: 'var(--green)', bg: 'rgba(0,194,113,.12)' };
  if (d.includes('hold')) return { color: 'var(--yellow)', bg: 'rgba(245,166,35,.12)' };
  if (d.includes('rejected')) return { color: 'var(--red)', bg: 'rgba(224,59,59,.12)' };
  return { color: 'var(--muted)', bg: 'rgba(138,138,138,.1)' };
};

const fmtDT = (s: string) => {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
};

// ─── Main Component ────────────────────────────────────────────────────────────
interface Props {
  candidateId?: string;
  onClose?: () => void;
  showAsPage?: boolean;
}

export default function InterviewReport({ candidateId: propCandidateId, onClose, showAsPage }: Props) {
  const params = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const candidateId = propCandidateId || params.candidateId;
  
  const [report, setReport] = useState<InterviewReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'skills' | 'questions' | 'transcript'>('overview');

  useEffect(() => {
    fetchReport();
  }, [candidateId]);

  const fetchReport = async () => {
    if (!candidateId) return;
    
    try {
      setLoading(true);
      // Fetch from new API endpoint
      const res = await api.get(`/interview-reports/candidate/${candidateId}`);
      setReport(res.data);
      setError(null);
    } catch (err: any) {
      console.error('Error fetching report:', err);
      setError(err.response?.data?.message || 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      navigate('/interviews');
    }
  };

  const content = (
    <>
      {loading ? (
        <div className="interview-page">
          <div className="empty-state">
            <div className="empty-icon">⏳</div>
            <div className="empty-title">Loading report...</div>
          </div>
        </div>
      ) : error || !report ? (
        <div className="interview-page">
          <div className="empty-state">
            <div className="empty-state-icon">⚠️</div>
            <p className="empty-state-text">{error || 'Report not found'}</p>
            <button className="btn btn-outline" onClick={handleClose}>
              ← Back
            </button>
          </div>
        </div>
      ) : (
        <div className="interview-page">
          {/* Header */}
          <div className="page-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {onClose && (
                <button 
                  onClick={onClose}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', padding: '8px', display: 'flex', alignItems: 'center' }}
                >
                  ←
                </button>
              )}
              <h1 className="page-title">Interview Report</h1>
            </div>
          </div>

          {/* Score Card */}
          <div className="interview-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '20px' }}>
              {/* Score Circle */}
              <div style={{
                width: '120px',
                height: '120px',
                borderRadius: '50%',
                background: `conic-gradient(${getScoreColor(report.overallScore)} ${Math.min(report.overallScore * 10, 100)}%, var(--border) 0%)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                flexShrink: 0
              }}>
                <div style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '50%',
                  background: 'var(--card)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  fontWeight: 'bold',
                  color: getScoreColor(report.overallScore)
                }}>
                  {report.overallScore.toFixed(1)}
                </div>
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'inline-block',
                  padding: '8px 20px',
                  borderRadius: '100px',
                  ...getDecisionColor(report.decision),
                  fontWeight: '600',
                  fontSize: '16px',
                  fontFamily: 'var(--font-body)',
                  marginBottom: '8px'
                }}>
                  {report.decision || 'Pending'}
                </div>
                <p style={{ fontSize: '13px', color: 'var(--muted)', fontFamily: 'var(--font-body)', margin: 0 }}>
                  Generated: {fmtDT(report.createdAt)}
                </p>
              </div>
            </div>

            {/* Summary */}
            {report.summary && (
              <div style={{ marginTop: '16px', padding: '16px', background: 'var(--surface)', borderRadius: '8px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', fontFamily: 'var(--font-body)' }}>Summary</h4>
                <p style={{ fontSize: '14px', color: 'var(--ink)', fontFamily: 'var(--font-body)', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {report.summary}
                </p>
              </div>
            )}
          </div>

          {/* Recommendation */}
          {report.recommendation && (
            <div className="interview-card">
              <h3 className="interview-card-title" style={{ marginBottom: '12px' }}>Recommendation</h3>
              <p style={{ fontSize: '14px', color: 'var(--ink)', fontFamily: 'var(--font-body)', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>
                {report.recommendation}
              </p>
            </div>
          )}

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '0' }}>
            {['overview', 'skills', 'questions'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as typeof activeTab)}
                style={{
                  padding: '10px 20px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid var(--accent)' : '2px solid transparent',
                  color: activeTab === tab ? 'var(--accent)' : 'var(--muted)',
                  fontWeight: activeTab === tab ? '600' : '400',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-body)',
                  textTransform: 'capitalize',
                  fontSize: '14px'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === 'overview' && (
            <div className="interview-card">
              {/* Strengths */}
              {report.strengths && report.strengths.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--green)' }}>✓</span> Strengths
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {report.strengths.map((strength, i) => (
                      <span key={i} style={{
                        padding: '6px 12px',
                        background: 'rgba(0,194,113,.12)',
                        color: 'var(--green)',
                        borderRadius: '100px',
                        fontSize: '12px',
                        fontFamily: 'var(--font-body)'
                      }}>
                        {strength}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Weaknesses */}
              {report.weaknesses && report.weaknesses.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', fontFamily: 'var(--font-body)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--red)' }}>!</span> Areas for Improvement
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {report.weaknesses.map((weakness, i) => (
                      <span key={i} style={{
                        padding: '6px 12px',
                        background: 'rgba(224,59,59,.12)',
                        color: 'var(--red)',
                        borderRadius: '100px',
                        fontSize: '12px',
                        fontFamily: 'var(--font-body)'
                      }}>
                        {weakness}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(!report.strengths?.length && !report.weaknesses?.length) && (
                <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
                  No overview data available
                </p>
              )}
            </div>
          )}

          {activeTab === 'skills' && (
            <div className="interview-card">
              {report.skillsEvaluation && report.skillsEvaluation.length > 0 ? (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {report.skillsEvaluation.map((skill, i) => (
                    <div key={i} style={{ padding: '16px', background: 'var(--surface)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontWeight: '600', fontFamily: 'var(--font-body)' }}>{skill.skill}</span>
                        <span style={{ fontWeight: 'bold', color: getScoreColor(skill.score), fontSize: '16px' }}>{skill.score}/10</span>
                      </div>
                      <div style={{ height: '6px', background: 'var(--border)', borderRadius: '100px', marginBottom: '12px' }}>
                        <div style={{
                          height: '100%',
                          width: `${skill.score * 10}%`,
                          background: getScoreColor(skill.score),
                          borderRadius: '100px'
                        }} />
                      </div>
                      {skill.feedback && (
                        <p style={{ fontSize: '13px', color: 'var(--muted)', fontFamily: 'var(--font-body)', margin: 0 }}>
                          {skill.feedback}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
                  No skills evaluation available
                </p>
              )}
            </div>
          )}

          {activeTab === 'questions' && (
            <div className="interview-card">
              {report.questionAnalysis && report.questionAnalysis.length > 0 ? (
                <div style={{ display: 'grid', gap: '16px' }}>
                  {report.questionAnalysis.map((qa, i) => (
                    <div key={i} style={{ padding: '16px', background: 'var(--surface)', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-body)' }}>Q{i + 1}</span>
                          <p style={{ fontSize: '14px', fontWeight: '500', fontFamily: 'var(--font-body)', margin: '4px 0 0 0' }}>{qa.question}</p>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <span style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: '100px',
                            background: qa.answerQuality === 'Excellent' ? 'rgba(0,194,113,.12)' :
                                        qa.answerQuality === 'Good' ? 'rgba(0,194,113,.08)' :
                                        qa.answerQuality === 'Average' ? 'rgba(245,166,35,.12)' : 'rgba(224,59,59,.12)',
                            color: qa.answerQuality === 'Excellent' || qa.answerQuality === 'Good' ? 'var(--green)' :
                                   qa.answerQuality === 'Average' ? 'var(--yellow)' : 'var(--red)',
                            fontSize: '11px',
                            fontWeight: '600',
                            fontFamily: 'var(--font-body)'
                          }}>
                            {qa.answerQuality}
                          </span>
                          <div style={{ fontSize: '14px', fontWeight: 'bold', color: getScoreColor(qa.score), marginTop: '4px' }}>{qa.score}/10</div>
                        </div>
                      </div>
                      {qa.remarks && (
                        <p style={{ fontSize: '13px', color: 'var(--muted)', fontFamily: 'var(--font-body)', margin: 0, paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                          {qa.remarks}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center' }}>
                  No question analysis available
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );

  // If showAsPage is true or there's no onClose, render as a page
  if (showAsPage || !onClose) {
    return content;
  }

  // Otherwise, render as a modal
  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      width: '100vw', height: '100vh',
      background: 'rgba(13, 17, 23, 0.85)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)'
    }}>
      <div style={{
        width: '90vw',
        maxWidth: '800px',
        maxHeight: '90vh',
        background: 'var(--background)',
        borderRadius: '16px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Modal Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)'
        }}>
          <h2 style={{ fontSize: '16px', fontWeight: '600', margin: 0, fontFamily: 'var(--font-body)' }}>
            Interview Report
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
              color: 'var(--muted)'
            }}
          >
            ✕
          </button>
        </div>
        
        {/* Modal Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {content}
        </div>
      </div>
    </div>,
    document.body
  );
}
