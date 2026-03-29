import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import api from '../../services/api';
import * as XLSX from 'xlsx';
import './Interviews.css';

function ModalPortal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100vw',
        height: '100vh',
        background: 'rgba(13, 17, 23, 0.65)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)'
      }}
      onClick={onClose ? (e) => { if (e.target === e.currentTarget) onClose(); } : undefined}
    >
      {children}
    </div>,
    document.body
  );
}

interface TopicInfo {
  id: string;
  name: string;
}

interface Interview {
  id: string;
  name: string;
  difficulty: string;
  totalQuestions: number;
  instructions: string;
  durationMinutes: number;
  isActive: boolean;
  createdAt: string;
  topics: TopicInfo[];
}

interface CandidateInfo {
  id?: string;
  email: string;
  candidateName: string;
  accessCode?: string;
  status?: string;
  score?: number;
  completedAt?: string;
}

interface InterviewLink {
  id: string;
  interviewId: string;
  interviewName: string;
  name: string;
  startTime: string;
  endTime: string;
  instructions: string;
  isActive: boolean;
  totalCandidates: number;
  completedCandidates: number;
  createdAt: string;
  candidates?: CandidateInfo[];
}

const getLinkStatus = (link: InterviewLink) => {
  const now = new Date();
  const start = new Date(link.startTime);
  const end = new Date(link.endTime);
  if (now < start) return 'scheduled';
  if (now > end) return 'expired';
  return 'active';
};

const getCandidateStatusColor = (status: string) => {
  switch (status) {
    case 'Completed': return { bg: 'rgba(0,194,113,.12)', color: 'var(--green)' };
    case 'InProgress': return { bg: 'rgba(245,166,35,.12)', color: 'var(--yellow)' };
    case 'NoShow': return { bg: 'rgba(224,59,59,.1)', color: 'var(--red)' };
    default: return { bg: 'rgba(138,138,138,.1)', color: 'var(--muted)' };
  }
};

const getScoreColor = (score: number) => {
  if (score >= 80) return 'var(--green)';
  if (score >= 60) return 'var(--yellow)';
  return 'var(--red)';
};

const fmtDT = (s: string) => !s ? '—' : new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

interface BulkUploadModalProps {
  onClose: () => void;
  onUpload: (candidates: { email: string; candidateName: string }[]) => Promise<void>;
  linkName: string;
}

function InterviewBulkUploadModal({ onClose, onUpload, linkName }: BulkUploadModalProps) {
  const [step, setStep] = useState<'initial' | 'preview' | 'uploading' | 'success'>('initial');
  const [candidates, setCandidates] = useState<{ email: string; candidateName: string }[]>([]);
  const [errors, setErrors] = useState<{ row: number; email: string; name: string; error: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateEmail = (email: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErrors([{ row: 0, email: '', name: '', error: 'File size exceeds 5MB limit' }]);
      return;
    }
    setLoading(true);
    setErrors([]);
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          const workbook = XLSX.read(arrayBuffer, { type: 'array' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<Record<string, unknown>>;

          if (jsonData.length === 0) {
            setErrors([{ row: 0, email: '', name: '', error: 'No data found in spreadsheet' }]);
            setLoading(false); return;
          }
          if (jsonData.length > 500) {
            setErrors([{ row: 0, email: '', name: '', error: 'Maximum 500 candidates allowed per upload' }]);
            setLoading(false); return;
          }

          const processedCandidates: { email: string; candidateName: string }[] = [];
          const validationErrors: { row: number; email: string; name: string; error: string }[] = [];
          const emailSet = new Set<string>();

          jsonData.forEach((row, index) => {
            const rowNum = index + 2;
            const nameValue = row.Name || row.name || row.NAME || row['Candidate Name'] || row['Full Name'] || '';
            const emailValue = row.Email || row.email || row.EMAIL || row['Email Address'] || row['email address'] || '';
            
            if (!emailValue) {
              validationErrors.push({ row: rowNum, email: '', name: '', error: 'Email column not found' }); return;
            }
            
            const email = String(emailValue).trim().toLowerCase();
            if (!validateEmail(email)) {
              validationErrors.push({ row: rowNum, email, name: '', error: 'Invalid email format' }); return;
            }
            if (emailSet.has(email)) {
              validationErrors.push({ row: rowNum, email, name: '', error: 'Duplicate email in file' }); return;
            }
            emailSet.add(email);
            processedCandidates.push({ email, candidateName: String(nameValue).trim() });
          });

          setCandidates(processedCandidates);
          setErrors(validationErrors);
          setStep('preview');
        } catch (err: unknown) {
          setErrors([{ row: 0, email: '', name: '', error: 'Error reading file: ' + (err instanceof Error ? err.message : 'Unknown error') }]);
        }
        setLoading(false);
      };
      reader.readAsArrayBuffer(file);
    } catch (err: unknown) {
      setErrors([{ row: 0, email: '', name: '', error: 'Error: ' + (err instanceof Error ? err.message : 'Unknown error') }]);
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (candidates.length === 0) return;
    setLoading(true);
    setStep('uploading');
    try {
      await onUpload(candidates);
      setStep('success');
      setTimeout(() => { resetModal(); onClose(); }, 2000);
    } catch (err: unknown) {
      setErrors([{ row: 0, email: '', name: '', error: err instanceof Error ? err.message : 'Upload failed' }]);
      setStep('preview');
      setLoading(false);
    }
  };

  const handleDownloadSample = () => {
    const csv = 'Name,Email\nJohn Doe,john@example.com\nJane Smith,jane@example.com';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample_candidates.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetModal = () => {
    setStep('initial'); setCandidates([]); setErrors([]); setLoading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="modal-overlay" onClick={(e) => {
      if (e.target === e.currentTarget && step === 'initial') { resetModal(); onClose(); }
    }}>
      <div className="modal" style={{ width: '600px', maxWidth: '90vw' }}>
        <div className="modal-header">
          <h2 className="modal-title">
            {step === 'success' ? '✓ Upload Successful' : 'Bulk Upload Candidates'}
          </h2>
          <button className="modal-close" onClick={() => { resetModal(); onClose(); }} disabled={step === 'uploading'}>✕</button>
        </div>

        <div style={{ padding: '24px' }}>
          {step === 'initial' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '80px', height: '80px', margin: '0 auto 20px', background: 'rgba(255,92,0,.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' }}>
                📊
              </div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>Upload Candidate List</h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px', lineHeight: 1.6 }}>
                Select an Excel or CSV file with candidate names and emails. Max 500 candidates per file.
              </p>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: 'var(--accent)', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 500 }}
                onMouseEnter={e => (e.currentTarget.style.background = '#e64d00')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent)')}
              >
                📁 Choose File
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} disabled={loading} style={{ display: 'none' }} />
              </label>

              <div style={{ marginTop: '24px', padding: '16px', background: 'var(--surface)', borderRadius: '10px', fontSize: '12px', color: 'var(--muted)', textAlign: 'left' }}>
                <div style={{ marginBottom: '10px' }}>
                  <strong>Format:</strong> Excel (.xlsx, .xls) or CSV with <code>Name</code> and <code>Email</code> columns
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px', fontFamily: 'monospace' }}>
                  <div style={{ padding: '6px 12px', background: 'rgba(255,92,0,.05)', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.5px' }}>
                    Name,Email
                  </div>
                  {['John Doe,john@example.com', 'Jane Smith,jane@example.com'].map((e, i) => (
                    <div key={i} style={{ padding: '5px 12px', borderBottom: i < 1 ? '1px solid var(--border)' : 'none', fontSize: '11px', color: 'var(--ink)' }}>{e}</div>
                  ))}
                </div>
                <button onClick={handleDownloadSample}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'var(--card)', border: '1.5px solid var(--border)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, color: 'var(--ink)', transition: 'border-color .15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                >
                  ⬇ Download Sample CSV
                </button>
              </div>
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: 'rgba(255,92,0,.08)', border: '1px solid rgba(255,92,0,.2)', borderRadius: '8px', marginBottom: '18px', fontSize: '13px', color: 'var(--accent)' }}>
                ✓ {candidates.length} valid candidate(s) found
              </div>
              {errors.length > 0 && (
                <div style={{ padding: '12px', background: 'rgba(224,59,59,.08)', border: '1px solid rgba(224,59,59,.2)', borderRadius: '8px', marginBottom: '18px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--red)', marginBottom: '8px' }}>⚠ {errors.length} row(s) with errors:</div>
                  <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '12px', color: 'var(--muted)' }}>
                    {errors.map((err, idx) => (
                      <div key={idx} style={{ marginBottom: '6px' }}>
                        <div style={{ fontWeight: 500 }}>Row {err.row}: {err.email || '(empty)'}</div>
                        <div style={{ fontSize: '11px', marginLeft: '8px' }}>• {err.error}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: '10px' }}>Preview ({Math.min(5, candidates.length)} of {candidates.length}):</div>
                <div style={{ border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: 'var(--surface)' }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>Name</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.slice(0, 5).map((c, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '8px 12px', borderBottom: idx < Math.min(5, candidates.length) - 1 ? '1px solid var(--border)' : 'none' }}>{c.candidateName || '—'}</td>
                          <td style={{ padding: '8px 12px', borderBottom: idx < Math.min(5, candidates.length) - 1 ? '1px solid var(--border)' : 'none', fontFamily: 'monospace', fontSize: '11px' }}>{c.email}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {step === 'uploading' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: '60px', height: '60px', margin: '0 auto 20px', background: 'rgba(255,92,0,.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', animation: 'spin 1s linear infinite' }}>⏳</div>
              <p style={{ fontSize: '14px', fontWeight: 500 }}>Adding {candidates.length} candidate(s)...</p>
            </div>
          )}

          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: '80px', height: '80px', margin: '0 auto 20px', background: 'rgba(0,194,113,.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>✓</div>
              <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>Candidates Added!</h3>
              <p style={{ fontSize: '13px', color: 'var(--muted)' }}>{candidates.length} candidate(s) added to "{linkName}".</p>
            </div>
          )}
        </div>

        {step === 'preview' && (
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px' }}>
            <button onClick={() => fileInputRef.current?.click()} style={{ flex: 1, padding: '10px 16px', border: '1.5px solid var(--border)', borderRadius: '8px', background: 'var(--card)', color: 'var(--ink)', cursor: 'pointer', fontSize: '13px', fontWeight: 500 }}>
              Choose Different File
            </button>
            <button onClick={handleUpload} disabled={candidates.length === 0 || loading} style={{ flex: 1, padding: '10px 16px', background: candidates.length === 0 ? 'var(--border)' : 'var(--accent)', color: '#fff', border: 'none', borderRadius: '8px', cursor: candidates.length === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 500 }}>
              Add {candidates.length} to Link
            </button>
          </div>
        )}
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  );
}

export default function InterviewList() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [links, setLinks] = useState<Map<string, InterviewLink[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState<string | null>(null);
  const [viewLinksModal, setViewLinksModal] = useState<{ open: boolean; interviewId: string; interviewName: string; links: InterviewLink[]; loading: boolean }>({
    open: false,
    interviewId: '',
    interviewName: '',
    links: [],
    loading: false
  });
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [toast, setToast] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchInterviews();
    fetchTopics();
  }, []);

  const fetchInterviews = async () => {
    try {
      console.log('Fetching interviews from /interviews');
      const res = await api.get('/interviews');
      console.log('Interviews response:', res.data);
      setInterviews(res.data);
      
      const linksMap = new Map<string, InterviewLink[]>();
      for (const interview of res.data) {
        const linksRes = await api.get(`/interviews/${interview.id}/links`);
        linksMap.set(interview.id, linksRes.data);
      }
      setLinks(linksMap);
    } catch (err: any) {
      console.error('Failed to fetch interviews', err);
      console.log('Error status:', err.response?.status);
      console.log('Error data:', err.response?.data);
      if (err.response?.status === 401) {
        alert('Please login as admin first!');
        window.location.href = '/login';
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchTopics = async () => {
    try {
      console.log('Fetching topics from /topics');
      const res = await api.get('/topics');
      console.log('Topics response:', res.data);
      const topicsData = Array.isArray(res.data) ? res.data : res.data?.items || [];
      setTopics(topicsData);
      
      // Show warning if no topics
      if (topicsData.length === 0) {
        console.log('No topics found in database');
      }
    } catch (err: any) {
      console.error('Failed to fetch topics', err);
      console.log('Error status:', err.response?.status);
      console.log('Error response:', err.response?.data);
      
      if (err.response?.status === 401) {
        alert('Please login as admin first!');
        window.location.href = '/login';
      } else {
        // Show error in console
        console.log('Topics fetch failed - Topics might not exist yet');
      }
    }
  };

  const handleCreateInterview = async (data: {
    name: string;
    difficulty: string;
    totalQuestions: number;
    instructions: string;
    durationMinutes: number;
    topicIds: string[];
  }) => {
    try {
      await api.post('/interviews', data);
      setShowCreateModal(false);
      fetchInterviews();
    } catch (err: any) {
      console.error('Failed to create interview', err);
      alert(err.response?.data?.message || err.response?.data?.inner || 'Failed to create interview');
    }
  };

  const handleViewLinks = async (interview: Interview) => {
    setViewLinksModal({ open: true, interviewId: interview.id, interviewName: interview.name, links: [], loading: true });
    try {
      const res = await api.get(`/interviews/${interview.id}/links`);
      setViewLinksModal(prev => ({ ...prev, links: res.data, loading: false }));
    } catch (err) {
      console.error('Failed to fetch links', err);
      setViewLinksModal(prev => ({ ...prev, loading: false }));
    }
  };

  const [bulkUploadModal, setBulkUploadModal] = useState<{ open: boolean; linkId: string; linkName: string }>({ open: false, linkId: '', linkName: '' });
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);

  const handleAddCandidates = async (candidates: { email: string; candidateName: string }[]) => {
    try {
      await api.post('/interviews/links/candidates', {
        linkId: bulkUploadModal.linkId,
        candidates: candidates.map(c => ({
          email: c.email,
          candidateName: c.candidateName || null,
        })),
      });
      setBulkUploadModal({ open: false, linkId: '', linkName: '' });
      handleViewLinks({ id: viewLinksModal.interviewId, name: viewLinksModal.interviewName } as Interview);
      setToast(`${candidates.length} candidate(s) added!`);
      setTimeout(() => setToast(null), 2000);
    } catch (err: any) {
      console.error('Failed to add candidates', err);
      alert(err.response?.data?.message || 'Failed to add candidates');
    }
  };

  const toggleExpandLink = (link: InterviewLink) => {
    if (expandedLinkId === link.id) {
      setExpandedLinkId(null);
    } else {
      setExpandedLinkId(link.id);
    }
  };

  const interviewUrl = (linkId: string) => `${window.location.origin}/interview/${linkId}`;
  const copyLink = (linkId: string) => {
    navigator.clipboard.writeText(interviewUrl(linkId));
    setToast('Link copied!');
    setTimeout(() => setToast(null), 2000);
  };
  const shareWA = (link: InterviewLink) => {
    const text = encodeURIComponent(`🎙️ Interview: ${viewLinksModal.interviewName}\n🔗 ${interviewUrl(link.id)}\n🔑 Code: ${link.candidates?.[0]?.accessCode || 'Check email'}\n⏰ ${fmtDT(link.startTime)} → ${fmtDT(link.endTime)}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };
  const shareEmail = (link: InterviewLink) => {
    const subject = encodeURIComponent(`Interview Invitation: ${viewLinksModal.interviewName}`);
    const body = encodeURIComponent(`You are invited to an interview.\n\nInterview: ${viewLinksModal.interviewName}\nLink: ${interviewUrl(link.id)}\n\nStart: ${fmtDT(link.startTime)}\nEnd: ${fmtDT(link.endTime)}\n\nPlease use your access code to begin.`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const shareWALink = (link: InterviewLink) => {
    const interview = interviews.find(i => i.id === link.interviewId);
    const interviewName = interview?.name || 'Interview';
    const text = encodeURIComponent(`🎙️ Interview: ${interviewName}\n🔗 ${interviewUrl(link.id)}\n🔑 Code: ${link.candidates?.[0]?.accessCode || 'Check email'}\n⏰ ${fmtDT(link.startTime)} → ${fmtDT(link.endTime)}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };
  const shareEmailLink = (link: InterviewLink) => {
    const interview = interviews.find(i => i.id === link.interviewId);
    const interviewName = interview?.name || 'Interview';
    const subject = encodeURIComponent(`Interview Invitation: ${interviewName}`);
    const body = encodeURIComponent(`You are invited to an interview.\n\nInterview: ${interviewName}\nLink: ${interviewUrl(link.id)}\n\nStart: ${fmtDT(link.startTime)}\nEnd: ${fmtDT(link.endTime)}\n\nPlease use your access code to begin.`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const handleCreateLink = async (data: {
    name: string;
    startTime: string;
    endTime: string;
    instructions: string;
    candidates: { email: string; candidateName: string }[];
  }) => {
    try {
      await api.post('/interviews/links', {
        interviewId: showLinkModal,
        name: data.name,
        startTime: new Date(data.startTime).toISOString(),
        endTime: new Date(data.endTime).toISOString(),
        instructions: data.instructions,
        candidates: data.candidates.map(c => ({
          email: c.email,
          candidateName: c.candidateName || null,
        })),
      });
      setShowLinkModal(null);
      fetchInterviews();
    } catch (err: any) {
      console.error('Failed to create link', err);
      alert(err.response?.data?.message || err.response?.data?.inner || 'Failed to create link');
    }
  };

  const getTotalCandidates = () => {
    let total = 0;
    links.forEach((linkList) => {
      linkList.forEach((link) => {
        total += link.totalCandidates;
      });
    });
    return total;
  };

  const getTotalCompleted = () => {
    let completed = 0;
    links.forEach((linkList) => {
      linkList.forEach((link) => {
        completed += link.completedCandidates;
      });
    });
    return completed;
  };

  if (loading) {
    return (
      <div className="interview-page">
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <div className="empty-title">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="interview-page">
      <div className="page-header">
        <h1 className="page-title">Interviews</h1>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          + Create Interview
        </button>
      </div>

      <div className="interview-stats">
        <div className="interview-stat-card stat-1">
          <div className="interview-stat-icon">🎙️</div>
          <div className="interview-stat-num">{interviews.length}</div>
          <div className="interview-stat-label">Total Interviews</div>
        </div>
        <div className="interview-stat-card stat-2">
          <div className="interview-stat-icon">🔗</div>
          <div className="interview-stat-num">{links.size}</div>
          <div className="interview-stat-label">Links Created</div>
        </div>
        <div className="interview-stat-card stat-3">
          <div className="interview-stat-icon">👥</div>
          <div className="interview-stat-num">{getTotalCandidates()}</div>
          <div className="interview-stat-label">Candidates</div>
        </div>
        <div className="interview-stat-card stat-4">
          <div className="interview-stat-icon">✅</div>
          <div className="interview-stat-num">{getTotalCompleted()}</div>
          <div className="interview-stat-label">Completed</div>
        </div>
      </div>

      {interviews.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🎙️</div>
          <p className="empty-state-text">No interviews created yet.</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            Create Your First Interview
          </button>
        </div>
      ) : (
        <div>
          {interviews.map((interview, index) => (
            <div key={interview.id} className="interview-card" style={{ animationDelay: `${0.1 + index * 0.05}s` }}>
              <div className="interview-card-header">
                <div>
                  <h2 className="interview-card-title">{interview.name}</h2>
                  <div className="interview-card-meta">
                    <span className="interview-badge interview-badge-difficulty">{interview.difficulty}</span>
                    <span className="interview-badge interview-badge-questions">{interview.totalQuestions} questions</span>
                    <span className="interview-badge interview-badge-duration">{interview.durationMinutes} min</span>
                    {interview.topics.map((t) => (
                      <span key={t.id} className="interview-badge interview-badge-topic">{t.name}</span>
                    ))}
                  </div>
                </div>
                <div className="interview-card-actions">
                  <button
                    onClick={() => setShowLinkModal(interview.id)}
                    className="btn btn-secondary btn-sm"
                  >
                    Create Link
                  </button>
                </div>
              </div>

              {interview.instructions && (
                <p className="text-sm" style={{ color: 'var(--muted)', fontFamily: 'DM Sans, sans-serif', marginBottom: '12px', fontSize: '13px' }}>
                  {interview.instructions}
                </p>
              )}

              <div className="interview-links-section">
                <h3 className="interview-links-title">Interview Links</h3>
                {links.get(interview.id)?.length ? (
                  links.get(interview.id)?.map((link) => {
                    const st = getLinkStatus(link);
                    const statusColor = st === 'active' ? 'var(--green)' : st === 'expired' ? 'var(--red)' : 'var(--yellow)';
                    const statusBg = st === 'active' ? 'rgba(0,194,113,.12)' : st === 'expired' ? 'rgba(224,59,59,.1)' : 'rgba(245,166,35,.1)';
                    const statusLabel = st === 'active' ? 'Running' : st === 'expired' ? 'Expired' : 'Scheduled';
                    const isExpanded = expandedLinkId === link.id;
                    
                    return (
                      <div key={link.id} style={{ border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden', background: isExpanded ? 'var(--surface)' : 'var(--card)' }}>
                        <div style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                            <div style={{ flex: 1 }}>
                              <div className="interview-link-name">
                                {link.name}
                                <span style={{ 
                                  marginLeft: '10px',
                                  fontSize: '11px', 
                                  fontWeight: 600, 
                                  padding: '2px 8px', 
                                  borderRadius: '100px', 
                                  background: statusBg, 
                                  color: statusColor 
                                }}>
                                  {statusLabel}
                                </span>
                              </div>
                              <div className="interview-link-meta">
                                📅 {new Date(link.startTime).toLocaleDateString()} - {new Date(link.endTime).toLocaleDateString()}
                                <span style={{ marginLeft: '12px' }}>👥 {link.completedCandidates}/{link.totalCandidates} completed</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <button className="share-btn" title="Copy link" onClick={() => copyLink(link.id)}>📋</button>
                              <button className="share-btn share-wa" title="WhatsApp" onClick={() => shareWALink(link)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.555 4.122 1.528 5.855L0 24l6.326-1.508C8.02 23.459 9.972 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.907 0-3.682-.527-5.192-1.438l-.37-.22-3.753.894.939-3.652-.243-.385C2.618 15.452 2.182 13.77 2.182 12 2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
                                </svg>
                              </button>
                              <button className="share-btn share-email" title="Email" onClick={() => shareEmailLink(link)}>✉️</button>
                              <button 
                                className="share-btn" 
                                title={isExpanded ? "Hide candidates" : "View candidates"}
                                onClick={() => toggleExpandLink(link)}
                                style={{ background: isExpanded ? 'var(--accent2)' : 'transparent', color: isExpanded ? 'white' : 'var(--ink)' }}
                              >👥</button>
                              <button 
                                className="share-btn" 
                                title="View report"
                                onClick={() => navigate(`/interviews/reports/${link.id}`)}
                                style={{ color: 'var(--green)' }}
                              >📊</button>
                            </div>
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div style={{ padding: '0 16px 16px 16px', borderTop: '1px solid var(--border)', marginTop: '0' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0' }}>
                              <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--ink)' }}>Candidates ({link.candidates?.length || 0})</span>
                              {st === 'scheduled' && (
                                <button 
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setBulkUploadModal({ open: true, linkId: link.id, linkName: link.name })}
                                >
                                  + Add
                                </button>
                              )}
                            </div>
                            {link.candidates && link.candidates.length > 0 ? (
                              <div style={{ borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                  <thead>
                                    <tr style={{ background: 'var(--surface)' }}>
                                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>Name</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>Email</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>Code</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>Status</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>Score</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {link.candidates.map((candidate, idx) => {
                                      const statusStyle = getCandidateStatusColor(candidate.status || 'Pending');
                                      return (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                          <td style={{ padding: '8px 12px', color: 'var(--ink)' }}>{candidate.candidateName || '—'}</td>
                                          <td style={{ padding: '8px 12px', color: 'var(--muted)' }}>{candidate.email}</td>
                                          <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--accent2)' }}>{candidate.accessCode || '—'}</td>
                                          <td style={{ padding: '8px 12px' }}>
                                            <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '100px', background: statusStyle.bg, color: statusStyle.color }}>
                                              {candidate.status || 'Pending'}
                                            </span>
                                          </td>
                                          <td style={{ padding: '8px 12px', fontWeight: candidate.score ? 600 : 400, color: candidate.score ? getScoreColor(candidate.score) : 'var(--muted)' }}>
                                            {candidate.score ? `${candidate.score}%` : '—'}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)', fontSize: '13px', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                                No candidates added yet.
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="no-links">No links created yet. Create a link to invite candidates.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateInterviewModal
          topics={topics}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateInterview}
          onTopicsRefresh={fetchTopics}
        />
      )}

      {showLinkModal && (
        <CreateLinkModal
          onClose={() => setShowLinkModal(null)}
          onSubmit={handleCreateLink}
        />
      )}

      {viewLinksModal.open && (
        <ModalPortal onClose={() => setViewLinksModal(p => ({ ...p, open: false }))}>
          <div className="modal" style={{ maxWidth: '920px', width: '96vw', position: 'relative', maxHeight: '85vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0 16px 0', borderBottom: '1px solid var(--border)', marginBottom: '20px' }}>
              <div>
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: '18px', fontWeight: 800, color: 'var(--ink)', margin: 0 }}>Interview Links</h2>
                <p style={{ fontSize: '13px', color: 'var(--muted)', margin: '4px 0 0 0' }}>{viewLinksModal.interviewName}</p>
              </div>
              <button className="modal-close" onClick={() => setViewLinksModal(p => ({ ...p, open: false }))}>✕</button>
            </div>

            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {viewLinksModal.loading ? (
                <div style={{ textAlign: 'center', padding: '48px', color: 'var(--muted)' }}>Loading links...</div>
              ) : viewLinksModal.links.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px' }}>
                  <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔗</div>
                  <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '8px', color: 'var(--ink)' }}>No links yet</div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '20px' }}>Create a link to share this interview with candidates.</div>
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    setViewLinksModal(p => ({ ...p, open: false }));
                    setShowLinkModal(viewLinksModal.interviewId);
                  }}>🔗 Create Interview Link</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {viewLinksModal.links.map((link, i) => {
                    const st = getLinkStatus(link);
                    const sColor = st === 'active' ? 'var(--green)' : st === 'expired' ? 'var(--red)' : 'var(--yellow)';
                    const sBg = st === 'active' ? 'rgba(0,194,113,.12)' : st === 'expired' ? 'rgba(224,59,59,.1)' : 'rgba(245,166,35,.1)';
                    const isExpanded = expandedLinkId === link.id;
                    const completedCount = link.candidates?.filter(c => c.status === 'Completed').length || 0;
                    
                    return (
                      <div key={link.id || i} style={{ border: '1px solid var(--border)', borderRadius: '14px', overflow: 'hidden', background: isExpanded ? 'var(--surface)' : 'var(--card)' }}>
                        <div style={{ padding: '16px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                <span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: '15px' }}>{link.name || 'Unnamed Link'}</span>
                                <span style={{ 
                                  fontSize: '11px', 
                                  fontWeight: 600, 
                                  padding: '3px 10px', 
                                  borderRadius: '100px', 
                                  background: sBg, 
                                  color: sColor 
                                }}>
                                  {st === 'active' ? 'Running' : st === 'expired' ? 'Expired' : 'Scheduled'}
                                </span>
                              </div>
                              <div style={{ display: 'flex', gap: '20px', fontSize: '13px', color: 'var(--muted)', fontFamily: "'DM Sans', sans-serif" }}>
                                <span>📅 {fmtDT(link.startTime)} — {fmtDT(link.endTime)}</span>
                                <span>👥 {completedCount}/{link.totalCandidates || 0} completed</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <button className="share-btn" title="Copy link" onClick={() => copyLink(link.id)}>📋</button>
                              <button className="share-btn share-wa" title="WhatsApp" onClick={() => shareWA(link)}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.555 4.122 1.528 5.855L0 24l6.326-1.508C8.02 23.459 9.972 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.907 0-3.682-.527-5.192-1.438l-.37-.22-3.753.894.939-3.652-.243-.385C2.618 15.452 2.182 13.77 2.182 12 2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
                                </svg>
                              </button>
                              <button className="share-btn share-email" title="Email" onClick={() => shareEmail(link)}>✉️</button>
                              <button 
                                className="share-btn" 
                                title={isExpanded ? "Hide candidates" : "View candidates"}
                                onClick={() => toggleExpandLink(link)}
                                style={{ background: isExpanded ? 'var(--accent2)' : 'transparent', color: isExpanded ? 'white' : 'var(--ink)' }}
                              >👥</button>
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--ink)' }}>Candidates ({link.candidates?.length || 0})</span>
                                <button 
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setBulkUploadModal({ open: true, linkId: link.id, linkName: link.name })}
                                >
                                  + Add Candidates
                                </button>
                              </div>
                              {link.candidates && link.candidates.length > 0 ? (
                                <div style={{ maxHeight: '280px', overflowY: 'auto', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                    <thead>
                                      <tr style={{ background: 'var(--surface)', position: 'sticky', top: 0 }}>
                                        <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Name</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Email</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Access Code</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Status</th>
                                        <th style={{ padding: '10px 14px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Score</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {link.candidates.map((candidate, idx) => {
                                        const statusStyle = getCandidateStatusColor(candidate.status || 'Pending');
                                        return (
                                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '8px 10px', color: 'var(--ink)' }}>{candidate.candidateName || '—'}</td>
                                            <td style={{ padding: '8px 10px', color: 'var(--muted)' }}>{candidate.email}</td>
                                            <td style={{ padding: '8px 10px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--accent2)' }}>{candidate.accessCode || '—'}</td>
                                            <td style={{ padding: '8px 10px' }}>
                                              <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '100px', background: statusStyle.bg, color: statusStyle.color }}>
                                                {candidate.status || 'Pending'}
                                              </span>
                                            </td>
                                            <td style={{ padding: '8px 10px', fontWeight: candidate.score ? 600 : 400, color: candidate.score ? getScoreColor(candidate.score) : 'var(--muted)' }}>
                                              {candidate.score ? `${candidate.score}%` : '—'}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)', fontSize: '13px' }}>
                                  No candidates added yet. Click "Add Candidates" to add candidates.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border)', marginTop: '16px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setViewLinksModal(p => ({ ...p, open: false }))}>Close</button>
              <button className="btn btn-primary btn-sm" onClick={() => {
                setViewLinksModal(p => ({ ...p, open: false }));
                setShowLinkModal(viewLinksModal.interviewId);
              }}>🔗 Create New Link</button>
            </div>
          </div>
        </ModalPortal>
      )}

      {bulkUploadModal.open && (
        <InterviewBulkUploadModal
          onClose={() => setBulkUploadModal({ open: false, linkId: '', linkName: '' })}
          onUpload={handleAddCandidates}
          linkName={bulkUploadModal.linkName}
        />
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--green)',
          color: 'white',
          padding: '12px 24px',
          borderRadius: '8px',
          fontSize: '14px',
          fontFamily: 'DM Sans, sans-serif',
          zIndex: 100,
          animation: 'fadeUp .2s ease both'
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}

function CreateInterviewModal({
  topics,
  onClose,
  onSubmit,
  onTopicsRefresh,
}: {
  topics: TopicInfo[];
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    difficulty: string;
    totalQuestions: number;
    instructions: string;
    durationMinutes: number;
    topicIds: string[];
  }) => void;
  onTopicsRefresh: () => void;
}) {
  // Refresh topics when modal opens
  useEffect(() => {
    onTopicsRefresh();
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    difficulty: 'Medium',
    totalQuestions: 10,
    instructions: '',
    durationMinutes: 30,
    topicIds: [] as string[],
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h2 className="modal-title">Create Interview</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Interview Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="form-input"
              placeholder="e.g., Senior Developer Interview"
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Difficulty</label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                className="form-select"
              >
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Total Questions</label>
              <input
                type="number"
                min="1"
                value={formData.totalQuestions}
                onChange={(e) => setFormData({ ...formData, totalQuestions: parseInt(e.target.value) })}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Duration (minutes)</label>
              <input
                type="number"
                min="5"
                value={formData.durationMinutes}
                onChange={(e) => setFormData({ ...formData, durationMinutes: parseInt(e.target.value) })}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Topics (select multiple)</label>
              <div style={{ 
                border: '1.5px solid var(--border)', 
                borderRadius: '8px', 
                maxHeight: '120px', 
                overflowY: 'auto',
                padding: '8px',
                background: 'var(--surface)'
              }}>
                {topics.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '12px' }}>
                    <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>
                      No topics found
                    </p>
                    <a 
                      href="/topics" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        fontSize: '12px', 
                        color: 'var(--accent2)', 
                        textDecoration: 'none',
                        fontFamily: 'DM Sans, sans-serif'
                      }}
                    >
                      Go to Topics page to create one →
                    </a>
                  </div>
                ) : (
                  topics.map((t) => (
                    <label
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        borderRadius: '4px',
                        transition: 'background .15s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,92,0,.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <input
                        type="checkbox"
                        checked={formData.topicIds.includes(t.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({ ...formData, topicIds: [...formData.topicIds, t.id] });
                          } else {
                            setFormData({ ...formData, topicIds: formData.topicIds.filter(id => id !== t.id) });
                          }
                        }}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                      />
                      <span style={{ fontSize: '13px', fontFamily: 'DM Sans, sans-serif' }}>{t.name}</span>
                    </label>
                  ))
                )}
              </div>
              {formData.topicIds.length > 0 && (
                <p style={{ fontSize: '11px', color: 'var(--accent)', marginTop: '4px', fontFamily: 'DM Sans, sans-serif' }}>
                  {formData.topicIds.length} topic(s) selected
                </p>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Instructions</label>
            <textarea
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="form-textarea"
              placeholder="Additional instructions for the AI interviewer..."
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Create Interview
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}

function CreateLinkModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    startTime: string;
    endTime: string;
    instructions: string;
    candidates: { email: string; candidateName: string }[];
  }) => void;
}) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [formData, setFormData] = useState({
    name: '',
    startTime: formatDateLocal(now),
    endTime: formatDateLocal(tomorrow),
    instructions: '',
    candidates: [] as { email: string; candidateName: string }[],
  });
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const addCandidate = () => {
    setFormData({
      ...formData,
      candidates: [...formData.candidates, { email: '', candidateName: '' }],
    });
  };

  const updateCandidate = (index: number, field: 'email' | 'candidateName', value: string) => {
    const updated = [...formData.candidates];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, candidates: updated });
  };

  const handleBulkUploadComplete = (uploadedCandidates: { email: string; candidateName: string }[]) => {
    setFormData({
      ...formData,
      candidates: [...formData.candidates, ...uploadedCandidates],
    });
    setShowBulkUpload(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
        <h2 className="modal-title">Create Interview Link</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Link Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="form-input"
              placeholder="e.g., Q1 2026 Batch"
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Start Time</label>
              <input
                type="datetime-local"
                required
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">End Time</label>
              <input
                type="datetime-local"
                required
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Instructions for Candidates</label>
            <textarea
              value={formData.instructions}
              onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
              className="form-textarea"
              placeholder="Any specific instructions for candidates..."
            />
          </div>

          <div className="form-group">
            <div className="flex justify-between items-center mb-2">
              <label className="form-label" style={{ marginBottom: 0 }}>Candidates ({formData.candidates.length})</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setShowBulkUpload(true)} className="btn btn-outline btn-sm">
                  📊 Bulk Upload
                </button>
                <button type="button" onClick={addCandidate} className="btn btn-outline btn-sm">
                  + Add
                </button>
              </div>
            </div>
            {formData.candidates.length > 0 ? (
              <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)' }}>Name</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)' }}>Email</th>
                      <th style={{ padding: '8px 10px', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.candidates.map((c, i) => (
                      <tr key={i} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '6px 10px' }}>
                          <input
                            type="text"
                            placeholder="Name"
                            value={c.candidateName}
                            onChange={(e) => updateCandidate(i, 'candidateName', e.target.value)}
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '12px' }}
                          />
                        </td>
                        <td style={{ padding: '6px 10px' }}>
                          <input
                            type="email"
                            placeholder="Email"
                            value={c.email}
                            onChange={(e) => updateCandidate(i, 'email', e.target.value)}
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '12px' }}
                          />
                        </td>
                        <td style={{ padding: '6px 10px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, candidates: formData.candidates.filter((_, idx) => idx !== i) })}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: '14px' }}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--muted)', fontSize: '13px', border: '1px dashed var(--border)', borderRadius: '8px' }}>
                No candidates added. Click "Bulk Upload" or "Add" to add candidates.
              </div>
            )}
          </div>

          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-secondary" disabled={formData.candidates.length === 0}>
              Create Link ({formData.candidates.length} candidates)
            </button>
          </div>
        </form>

        {showBulkUpload && (
          <InterviewBulkUploadModal
            onClose={() => setShowBulkUpload(false)}
            onUpload={async (candidates) => { handleBulkUploadComplete(candidates); }}
            linkName=""
          />
        )}
      </div>
    </ModalPortal>
  );
}
