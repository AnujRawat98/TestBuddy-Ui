import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ijpApi } from '../../services/api';
import './IJP.css';

interface IJPDetail {
  id: string;
  positionName: string;
  experienceRequired: string;
  jobDescription: string;
  closingDate: string;
  totalPositions: number;
  status: string;
  applicationsCount: number;
  interviewsCreated: number;
  createdAt: string;
}

interface IJPConfig {
  id: string;
  ijpId: string;
  totalQuestions: number;
  easyPercentage: number;
  mediumPercentage: number;
  hardPercentage: number;
  goDeeper: boolean;
  durationMinutes: number;
  welcomeMessage: string | null;
  closingMessage: string | null;
  boundaries: string | null;
  companyPolicies: string | null;
  questionsGenerated: boolean;
  generatedQuestions?: GeneratedQuestion[];
}

interface GeneratedQuestion {
  order: number;
  question: string;
  category: string;
  difficulty: string;
  expectedKeyPoints?: string;
  followUpQuestions?: string[];
}

interface Document {
  id: string;
  fileName: string;
  documentType: string;
  uploadedAt: string;
  isIndexed: boolean;
}

interface Interview {
  id: string;
  name: string;
  difficulty: string;
  totalQuestions: number;
  durationMinutes: number;
  totalCandidates: number;
  completedCandidates: number;
}

export default function IJPDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ijp, setIjp] = useState<IJPDetail | null>(null);
  const [config, setConfig] = useState<IJPConfig | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'documents' | 'interviews'>('overview');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showQuestionsModal, setShowQuestionsModal] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id]);

  const fetchData = async () => {
    if (!id) return;
    try {
      const ijpRes = await ijpApi.getById(id);
      setIjp(ijpRes.data);
      
      try {
        const configRes = await ijpApi.getInterviewConfig(id);
        setConfig(configRes.data || null);
      } catch { /* config not found */ }
      
      try {
        const docsRes = await ijpApi.getDocuments(id);
        setDocuments(docsRes.data || []);
      } catch { /* docs not found */ }
      
      try {
        const interviewsRes = await ijpApi.getInterviews(id);
        setInterviews(interviewsRes.data || []);
      } catch { /* interviews not found */ }
    } catch (err) {
      console.error('Failed to fetch IJP data', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async (data: any) => {
    if (!id) return;
    try {
      await ijpApi.saveInterviewConfig(id, data);
      setShowConfigModal(false);
      fetchData();
    } catch (err) {
      alert('Failed to save configuration');
    }
  };

  const getDominantDifficulty = () => {
    if (!config) return 'Medium';
    if (config.hardPercentage >= config.mediumPercentage && config.hardPercentage >= config.easyPercentage) return 'Hard';
    if (config.mediumPercentage >= config.easyPercentage) return 'Medium';
    return 'Easy';
  };

  const handleCreateInterview = async () => {
    if (!id) return;
    try {
      await ijpApi.createInterview({
        ijpId: id,
        ijpConfigId: config?.id,
        name: config ? `${ijp?.positionName} - Interview ${(interviews.length + 1)}` : undefined,
        difficulty: getDominantDifficulty(),
        totalQuestions: config?.totalQuestions || 10,
        durationMinutes: config?.durationMinutes || 30,
        welcomeMessage: config?.welcomeMessage || undefined,
        closingMessage: config?.closingMessage || undefined,
        boundaries: config?.boundaries || undefined,
        companyPolicies: config?.companyPolicies || undefined
      });
      navigate('/interviews');
    } catch (err) {
      alert('Failed to create interview');
    }
  };

  if (loading) {
    return (
      <div className="ijp-detail-page">
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <div className="empty-title">Loading…</div>
        </div>
      </div>
    );
  }

  if (!ijp) {
    return (
      <div className="ijp-detail-page">
        <div className="empty-state">
          <div className="empty-state-icon">❌</div>
          <p className="empty-state-text">Job posting not found</p>
          <button onClick={() => navigate('/ijp')} className="btn btn-primary">Back to List</button>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'var(--green)';
      case 'Closed': return 'var(--red)';
      default: return 'var(--muted)';
    }
  };

  const fmtDate = (s: string) => !s ? '—' : new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="ijp-detail-page">
      <div className="ijp-detail-header">
        <div>
          <h1 className="ijp-detail-title">{ijp.positionName}</h1>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
            <span className="ijp-badge">{ijp.experienceRequired}</span>
            <span className="ijp-badge">📍 {ijp.totalPositions} positions</span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: getStatusColor(ijp.status) }}>
              {ijp.status}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => navigate('/ijp')} className="btn btn-secondary">← Back</button>
          {config && (
            <button onClick={handleCreateInterview} className="btn btn-primary">
              🎙️ Create Interview
            </button>
          )}
        </div>
      </div>

      <div className="ijp-tabs">
        <button className={`ijp-tab ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')}>
          Overview
        </button>
        <button className={`ijp-tab ${activeTab === 'config' ? 'active' : ''}`} onClick={() => setActiveTab('config')}>
          Interview Config
        </button>
        <button className={`ijp-tab ${activeTab === 'documents' ? 'active' : ''}`} onClick={() => setActiveTab('documents')}>
          Documents ({documents.length})
        </button>
        <button className={`ijp-tab ${activeTab === 'interviews' ? 'active' : ''}`} onClick={() => setActiveTab('interviews')}>
          Interviews ({interviews.length})
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="ijp-section">
          <h3 className="ijp-section-title">Job Details</h3>
          <div className="config-grid">
            <div className="config-item">
              <div className="config-item-label">Position</div>
              <div className="config-item-value">{ijp.positionName}</div>
            </div>
            <div className="config-item">
              <div className="config-item-label">Experience</div>
              <div className="config-item-value">{ijp.experienceRequired || '—'}</div>
            </div>
            <div className="config-item">
              <div className="config-item-label">Closing Date</div>
              <div className="config-item-value">{fmtDate(ijp.closingDate)}</div>
            </div>
            <div className="config-item">
              <div className="config-item-label">Total Positions</div>
              <div className="config-item-value">{ijp.totalPositions}</div>
            </div>
            <div className="config-item">
              <div className="config-item-label">Applications</div>
              <div className="config-item-value">{ijp.applicationsCount}</div>
            </div>
            <div className="config-item">
              <div className="config-item-label">Interviews</div>
              <div className="config-item-value">{ijp.interviewsCreated}</div>
            </div>
          </div>
          {ijp.jobDescription && (
            <div style={{ marginTop: '20px' }}>
              <h4 className="config-item-label">Job Description</h4>
              <p className="ijp-description">{ijp.jobDescription}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'config' && (
        <div className="ijp-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="ijp-section-title" style={{ margin: 0 }}>Interview Configuration</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              {config && (
                <button 
                  onClick={async () => {
                    try {
                      setGenerating(true);
                      const res = await ijpApi.generateQuestions(id!, {
                        totalQuestions: config.totalQuestions,
                        easyPercentage: config.easyPercentage,
                        mediumPercentage: config.mediumPercentage,
                        hardPercentage: config.hardPercentage,
                        goDeeper: config.goDeeper
                      });
                      setConfig({ ...config, questionsGenerated: true });
                      setGeneratedQuestions(res.data.questions);
                      setShowQuestionsModal(true);
                      setGenerating(false);
                    } catch (err) {
                      alert('Failed to generate questions');
                      setGenerating(false);
                    }
                  }} 
                  className="btn btn-secondary btn-sm"
                  disabled={generating}
                >
                  {generating ? '🤖 Generating...' : '🤖 Generate Questions'}
                </button>
              )}
              <button onClick={() => setShowConfigModal(true)} className="btn btn-primary btn-sm">
                {config ? 'Edit Config' : 'Setup Interview'}
              </button>
            </div>
          </div>
          {config ? (
            <div>
              <div className="config-grid">
                <div className="config-item">
                  <div className="config-item-label">Total Questions</div>
                  <div className="config-item-value">{config.totalQuestions}</div>
                </div>
                <div className="config-item">
                  <div className="config-item-label">Difficulty Mix</div>
                  <div className="config-item-value">Easy: {config.easyPercentage}% / Medium: {config.mediumPercentage}% / Hard: {config.hardPercentage}%</div>
                </div>
                <div className="config-item">
                  <div className="config-item-label">Duration</div>
                  <div className="config-item-value">{config.durationMinutes} min</div>
                </div>
                <div className="config-item">
                  <div className="config-item-label">Go Deeper</div>
                  <div className="config-item-value">{config.goDeeper ? 'Yes' : 'No'}</div>
                </div>
              </div>
              {config.welcomeMessage && (
                <div style={{ marginTop: '16px' }}>
                  <h4 className="config-item-label">Welcome Message</h4>
                  <p className="ijp-description">{config.welcomeMessage}</p>
                </div>
              )}
              {config.closingMessage && (
                <div style={{ marginTop: '16px' }}>
                  <h4 className="config-item-label">Closing Message</h4>
                  <p className="ijp-description">{config.closingMessage}</p>
                </div>
              )}
              {config.boundaries && (
                <div style={{ marginTop: '16px' }}>
                  <h4 className="config-item-label">Boundaries</h4>
                  <p className="ijp-description">{config.boundaries}</p>
                </div>
              )}
              <div style={{ marginTop: '16px', padding: '12px', background: 'var(--surface)', borderRadius: '8px', fontSize: '13px', color: 'var(--muted)' }}>
                Questions {config.questionsGenerated ? '✅ Generated' : '❌ Not yet generated'}
              </div>
              {generatedQuestions.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <h4 className="config-item-label">Generated Questions ({generatedQuestions.length})</h4>
                  <div style={{ marginTop: '8px' }}>
                    {generatedQuestions.slice(0, 3).map((q, i) => (
                      <div key={i} style={{ padding: '8px 12px', background: 'var(--surface)', borderRadius: '6px', marginBottom: '6px', fontSize: '13px' }}>
                        <strong>Q{i + 1}:</strong> {q.question}
                      </div>
                    ))}
                    {generatedQuestions.length > 3 && (
                      <button onClick={() => setShowQuestionsModal(true)} className="btn btn-secondary btn-sm" style={{ marginTop: '8px' }}>
                        View All {generatedQuestions.length} Questions
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '40px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚙️</div>
              <p className="empty-state-text">No interview configuration set up yet.</p>
              <button onClick={() => setShowConfigModal(true)} className="btn btn-primary">
                Setup Interview Configuration
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="ijp-section">
          <h3 className="ijp-section-title" style={{ marginBottom: '20px' }}>Documents</h3>
          
          {/* Job Description Section */}
          <div style={{ 
            border: '1px solid var(--border)', 
            borderRadius: '12px', 
            padding: '20px', 
            marginBottom: '16px',
            background: 'var(--card)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '16px' }}>📄 Job Description</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                  Required for AI interviews to understand role requirements
                </p>
              </div>
            </div>
            {ijp?.jobDescriptionFileName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '14px' }}>{ijp.jobDescriptionFileName}</span>
                <span style={{ fontSize: '12px', color: 'var(--green)' }}>✅ Uploaded</span>
              </div>
            ) : (
              <UploadDocumentBtn ijpId={id!} onUpload={() => fetchData()} docType={1} label="Upload Job Description" />
            )}
          </div>

          {/* Company Policy Section */}
          <div style={{ 
            border: '1px solid var(--border)', 
            borderRadius: '12px', 
            padding: '20px', 
            marginBottom: '16px',
            background: 'var(--card)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '16px' }}>📋 Company Policy</h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                  Required for AI interviews to understand company culture & policies
                </p>
              </div>
            </div>
            {ijp?.companyPoliciesFileName ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '14px' }}>{ijp.companyPoliciesFileName}</span>
                <span style={{ fontSize: '12px', color: 'var(--green)' }}>✅ Uploaded</span>
              </div>
            ) : (
              <UploadDocumentBtn ijpId={id!} onUpload={() => fetchData()} docType={2} label="Upload Company Policy" />
            )}
          </div>

          <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
            💡 Note: Candidate resumes should be uploaded when adding candidates from the Links section.
          </p>
        </div>
      )}

      {activeTab === 'interviews' && (
        <div className="ijp-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="ijp-section-title" style={{ margin: 0 }}>Interviews</h3>
            {config && (
              <button onClick={handleCreateInterview} className="btn btn-primary btn-sm">
                + Create Interview
              </button>
            )}
          </div>
          {interviews.length > 0 ? (
            <div className="interview-list">
              {interviews.map(interview => (
                <div key={interview.id} className="interview-item">
                  <div className="interview-item-info">
                    <h4>{interview.name}</h4>
                    <div className="interview-item-meta">
                      {interview.difficulty} • {interview.totalQuestions} Qs • {interview.durationMinutes} min
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      {interview.completedCandidates}/{interview.totalCandidates} completed
                    </span>
                    <button onClick={() => navigate('/interviews')} className="btn btn-secondary btn-sm">View</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '40px' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎙️</div>
              <p className="empty-state-text">No interviews created yet.</p>
              {config ? (
                <button onClick={handleCreateInterview} className="btn btn-primary">
                  Create First Interview
                </button>
              ) : (
                <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Setup interview config first</p>
              )}
            </div>
          )}
        </div>
      )}

      {showConfigModal && (
        <ConfigModal
          config={config}
          onClose={() => setShowConfigModal(false)}
          onSubmit={handleSaveConfig}
        />
      )}

      {showQuestionsModal && (
        <QuestionsModal
          questions={generatedQuestions}
          onClose={() => setShowQuestionsModal(false)}
        />
      )}
    </div>
  );
}

interface ConfigModalProps {
  config: IJPConfig | null;
  onClose: () => void;
  onSubmit: (data: any) => Promise<void>;
}

function ConfigModal({ config, onClose, onSubmit }: ConfigModalProps) {
  const [form, setForm] = useState({
    totalQuestions: config?.totalQuestions || 10,
    easyPercentage: config?.easyPercentage ?? 30,
    mediumPercentage: config?.mediumPercentage ?? 40,
    hardPercentage: config?.hardPercentage ?? 30,
    goDeeper: config?.goDeeper || false,
    durationMinutes: config?.durationMinutes || 30,
    welcomeMessage: config?.welcomeMessage || '',
    closingMessage: config?.closingMessage || '',
    boundaries: config?.boundaries || '',
    companyPolicies: config?.companyPolicies || ''
  });
  const [loading, setLoading] = useState(false);
  const [percentageError, setPercentageError] = useState<string | null>(null);

  const totalPercentage = form.easyPercentage + form.mediumPercentage + form.hardPercentage;

  const handlePercentageChange = (field: 'easy' | 'medium' | 'hard', value: number) => {
    const newValue = Math.max(0, Math.min(100, value || 0));
    setForm({ ...form, [`${field}Percentage`]: newValue });
    setPercentageError(null);
  };

  const validatePercentages = () => {
    const total = form.easyPercentage + form.mediumPercentage + form.hardPercentage;
    if (total !== 100) {
      setPercentageError(`Total must be 100% (currently ${total}%)`);
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePercentages()) return;
    setLoading(true);
    await onSubmit(form);
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Interview Configuration</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Total Questions</label>
              <input
                type="number"
                className="form-input"
                value={form.totalQuestions}
                onChange={(e) => setForm({ ...form, totalQuestions: parseInt(e.target.value) || 10 })}
                min={1}
                max={50}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Duration (minutes)</label>
              <input
                type="number"
                className="form-input"
                value={form.durationMinutes}
                onChange={(e) => setForm({ ...form, durationMinutes: parseInt(e.target.value) || 30 })}
                min={5}
                max={120}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Difficulty Distribution (Must total 100%)</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginTop: '8px' }}>
              <div style={{ background: 'rgba(34,197,94,.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(34,197,94,.3)' }}>
                <label style={{ fontSize: '12px', color: '#22c55e', fontWeight: '600' }}>Easy %</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.easyPercentage}
                  onChange={(e) => handlePercentageChange('easy', parseInt(e.target.value))}
                  min={0}
                  max={100}
                  style={{ borderColor: 'rgba(34,197,94,.3)' }}
                />
              </div>
              <div style={{ background: 'rgba(234,179,8,.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(234,179,8,.3)' }}>
                <label style={{ fontSize: '12px', color: '#eab308', fontWeight: '600' }}>Medium %</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.mediumPercentage}
                  onChange={(e) => handlePercentageChange('medium', parseInt(e.target.value))}
                  min={0}
                  max={100}
                  style={{ borderColor: 'rgba(234,179,8,.3)' }}
                />
              </div>
              <div style={{ background: 'rgba(239,68,68,.1)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,.3)' }}>
                <label style={{ fontSize: '12px', color: '#ef4444', fontWeight: '600' }}>Hard %</label>
                <input
                  type="number"
                  className="form-input"
                  value={form.hardPercentage}
                  onChange={(e) => handlePercentageChange('hard', parseInt(e.target.value))}
                  min={0}
                  max={100}
                  style={{ borderColor: 'rgba(239,68,68,.3)' }}
                />
              </div>
            </div>
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ 
                fontSize: '12px', 
                fontWeight: '600',
                color: totalPercentage === 100 ? '#22c55e' : '#ef4444',
                background: totalPercentage === 100 ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
                padding: '4px 8px',
                borderRadius: '4px'
              }}>
                Total: {totalPercentage}%
              </span>
              {percentageError && (
                <span style={{ fontSize: '12px', color: '#ef4444' }}>{percentageError}</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={form.goDeeper}
                onChange={(e) => setForm({ ...form, goDeeper: e.target.checked })}
              />
              <span className="form-label" style={{ margin: 0 }}>Enable "Go Deeper" follow-up questions</span>
            </label>
          </div>
          <div className="form-group">
            <label className="form-label">Welcome Message</label>
            <textarea
              className="form-textarea"
              value={form.welcomeMessage}
              onChange={(e) => setForm({ ...form, welcomeMessage: e.target.value })}
              placeholder="Message shown to candidates at the start..."
              rows={3}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Closing Message</label>
            <textarea
              className="form-textarea"
              value={form.closingMessage}
              onChange={(e) => setForm({ ...form, closingMessage: e.target.value })}
              placeholder="Message shown to candidates at the end..."
              rows={3}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Boundaries (topics to avoid)</label>
            <textarea
              className="form-textarea"
              value={form.boundaries}
              onChange={(e) => setForm({ ...form, boundaries: e.target.value })}
              placeholder="e.g., Salary, personal questions, etc."
              rows={2}
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface UploadBtnProps {
  ijpId: string;
  onUpload: () => void;
  docType?: number;
  label?: string;
}

function UploadDocumentBtn({ ijpId, onUpload, docType, label }: UploadBtnProps) {
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        // Use provided docType or detect automatically
        let type = docType;
        if (!type) {
          const lowerName = file.name.toLowerCase();
          if (lowerName.includes('job') || lowerName.includes('jd') || lowerName.includes('description')) {
            type = 1;
          } else if (lowerName.includes('policy') || lowerName.includes('guideline')) {
            type = 2;
          } else if (lowerName.includes('resume') || lowerName.includes('cv')) {
            type = 3;
          } else {
            type = 4;
          }
        }
        console.log("Uploading document:", file.name, "Type:", type);
        await ijpApi.uploadDocument(ijpId, {
          documentType: type,
          fileName: file.name,
          fileBase64: base64
        });
        onUpload();
      };
      reader.readAsDataURL(file);
    } catch (err) {
      alert('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  return (
    <label className="btn btn-secondary" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '13px' }}>
      {uploading ? (
        <>⏳ Uploading...</>
      ) : (
        <>
          {label || '📎 Upload Document'}
        </>
      )}
      <input 
        type="file" 
        accept=".pdf,.doc,.docx,.txt,.md" 
        onChange={handleUpload} 
        style={{ display: 'none' }} 
      />
    </label>
  );
}

interface QuestionsModalProps {
  questions: any[];
  onClose: () => void;
}

function QuestionsModal({ questions, onClose }: QuestionsModalProps) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '800px', maxHeight: '80vh', overflow: 'auto' }}>
        <div className="modal-header">
          <h2 className="modal-title">🤖 Generated Interview Questions</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '24px' }}>
          <div style={{ marginBottom: '16px', color: 'var(--muted)', fontSize: '14px' }}>
            Total Questions: {questions.length}
          </div>
          {questions.map((q, index) => (
            <div key={index} style={{ 
              marginBottom: '20px', 
              padding: '16px', 
              background: 'var(--surface)', 
              borderRadius: '12px',
              border: '1px solid var(--border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ 
                  width: '32px', 
                  height: '32px', 
                  borderRadius: '50%', 
                  background: 'var(--primary)', 
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 'bold',
                  flexShrink: 0
                }}>
                  {q.order || index + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', fontSize: '15px', marginBottom: '4px' }}>{q.question}</div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ 
                      fontSize: '11px', 
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      background: 'rgba(59,130,246,.1)', 
                      color: '#3b82f6' 
                    }}>
                      {q.category || 'General'}
                    </span>
                    <span style={{ 
                      fontSize: '11px', 
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      background: 'rgba(168,85,247,.1)', 
                      color: '#a855f7' 
                    }}>
                      {q.difficulty}
                    </span>
                  </div>
                  {q.expectedKeyPoints && (
                    <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
                      <strong>Key Points:</strong> {q.expectedKeyPoints}
                    </div>
                  )}
                  {q.followUpQuestions && q.followUpQuestions.length > 0 && (
                    <div style={{ marginTop: '8px' }}>
                      <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>Follow-up Questions:</div>
                      {q.followUpQuestions.map((followUp: string, fIndex: number) => (
                        <div key={fIndex} style={{ 
                          fontSize: '13px', 
                          padding: '6px 10px', 
                          background: 'var(--card)', 
                          borderRadius: '6px',
                          marginBottom: '4px',
                          color: 'var(--ink)'
                        }}>
                          → {followUp}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div className="modal-footer">
            <button className="btn btn-secondary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
