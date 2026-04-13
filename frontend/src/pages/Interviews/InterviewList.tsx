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
  ijpId?: string;
  ijpName?: string;
  ijpConfigId?: string;
  welcomeMessage?: string;
  closingMessage?: string;
  boundaries?: string;
  companyPolicies?: string;
}

interface CandidateInfo {
  id?: string;
  interviewLinkId?: string;
  email: string;
  candidateName: string;
  phoneNumber?: string;
  whatsAppNumber?: string;
  accessCode?: string;
  interviewToken?: string;
  resumePath?: string;
  startTime: string;
  endTime: string;
  bufferStartMinutes?: number;
  bufferEndMinutes?: number;
  rescheduleCount?: number;
  status?: string;
  score?: number;
  completedAt?: string;
}

interface InterviewLink {
  id: string;
  interviewId: string;
  interviewName: string;
  name: string;
  instructions: string;
  isActive: boolean;
  totalCandidates: number;
  completedCandidates: number;
  createdAt: string;
  welcomeMessage?: string;
  closingMessage?: string;
  candidates?: CandidateInfo[];
}

interface InlineCandidateDraft {
  email: string;
  candidateName: string;
  phoneNumber: string;
  whatsAppNumber: string;
  startTime: string;
  endTime: string;
  bufferStartMinutes: number;
  bufferEndMinutes: number;
  resumeBase64?: string;
  fileName?: string;
}

const parseInterviewDateTime = (value?: string) => {
  if (!value) return null;
  const normalized = value.replace(' ', 'T');
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getLinkStatus = (link: InterviewLink) => {
  const now = new Date();
  
  if (!link.candidates || link.candidates.length === 0) {
    return 'scheduled';
  }
  
  const hasScheduled = link.candidates?.some(c => {
    if (!c.startTime) return false;
    const start = parseInterviewDateTime(c.startTime);
    if (!start) return false;
    return start > now;
  });
  
  const hasActive = link.candidates?.some(c => {
    if (!c.startTime || !c.endTime) return false;
    const start = parseInterviewDateTime(c.startTime);
    const end = parseInterviewDateTime(c.endTime);
    if (!start || !end) return false;
    return now >= start && now <= end;
  });
  
  const hasExpired = link.candidates?.every(c => {
    if (!c.endTime) return false;
    const end = parseInterviewDateTime(c.endTime);
    if (!end) return false;
    return end < now;
  });
  
  if (hasExpired && !hasActive && !hasScheduled) return 'expired';
  if (hasScheduled && !hasActive) return 'scheduled';
  if (hasActive) return 'active';
  return 'scheduled';
};

const getCandidateStatusColor = (status: string) => {
  switch (status) {
    case 'Completed': return { bg: 'rgba(0,194,113,.12)', color: 'var(--green)' };
    case 'InProgress': return { bg: 'rgba(245,166,35,.12)', color: 'var(--yellow)' };
    case 'NoShow': return { bg: 'rgba(224,59,59,.1)', color: 'var(--red)' };
    default: return { bg: 'rgba(138,138,138,.1)', color: 'var(--muted)' };
  }
};

const fmtDT = (s: string) => {
  const parsed = parseInterviewDateTime(s);
  return parsed
    ? parsed.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';
};

interface BulkUploadModalProps {
  onClose: () => void;
  onUpload: (candidates: {
    email: string;
    candidateName: string;
    phoneNumber: string;
    whatsAppNumber: string;
  }[]) => Promise<void>;
  linkName: string;
}

function InterviewBulkUploadModal({ onClose, onUpload, linkName }: BulkUploadModalProps) {
  const [step, setStep] = useState<'initial' | 'preview' | 'uploading' | 'success'>('initial');
  const [candidates, setCandidates] = useState<{
    email: string;
    candidateName: string;
    phoneNumber: string;
    whatsAppNumber: string;
  }[]>([]);
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

          const processedCandidates: { email: string; candidateName: string; phoneNumber: string; whatsAppNumber: string }[] = [];
          const validationErrors: { row: number; email: string; name: string; error: string }[] = [];
          const emailSet = new Set<string>();

          jsonData.forEach((row, index) => {
            const rowNum = index + 2;
            const nameValue = row.Name || row.name || row.NAME || row['Candidate Name'] || row['Full Name'] || '';
            const emailValue = row.Email || row.email || row.EMAIL || row['Email Address'] || row['email address'] || '';
            const phoneValue = row.Phone || row.phone || row.PHONE || row['Phone Number'] || row['PhoneNumber'] || row['phone number'] || '';
            const whatsappValue = row.WhatsApp || row.whatsapp || row.WHATSAPP || row['WhatsApp Number'] || row['WhatsAppNumber'] || row['whatsapp number'] || '';
            
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
            processedCandidates.push({
              email,
              candidateName: String(nameValue).trim(),
              phoneNumber: String(phoneValue).trim(),
              whatsAppNumber: String(whatsappValue).trim()
            });
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
    const csv = 'Name,Email,Phone,WhatsApp\nJohn Doe,john@example.com,1234567890,1234567890\nJane Smith,jane@example.com,0987654321,0987654321';
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
                  <strong>Format:</strong> Excel (.xlsx, .xls) or CSV with <code>Name</code>, <code>Email</code>, <code>Phone</code>, <code>WhatsApp</code> columns
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px', fontFamily: 'monospace' }}>
                  <div style={{ padding: '6px 12px', background: 'rgba(255,92,0,.05)', borderBottom: '1px solid var(--border)', fontSize: '11px', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.5px' }}>
                    Name,Email,Phone,WhatsApp
                  </div>
                  {['John Doe,john@example.com,1234567890,1234567890', 'Jane Smith,jane@example.com,0987654321,0987654321'].map((e, i) => (
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
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>Phone</th>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', borderBottom: '1px solid var(--border)' }}>WhatsApp</th>
                      </tr>
                    </thead>
                    <tbody>
                      {candidates.slice(0, 5).map((c, idx) => (
                        <tr key={idx}>
                          <td style={{ padding: '8px 12px', borderBottom: idx < Math.min(5, candidates.length) - 1 ? '1px solid var(--border)' : 'none' }}>{c.candidateName || '—'}</td>
                          <td style={{ padding: '8px 12px', borderBottom: idx < Math.min(5, candidates.length) - 1 ? '1px solid var(--border)' : 'none', fontFamily: 'monospace', fontSize: '11px' }}>{c.email}</td>
                          <td style={{ padding: '8px 12px', borderBottom: idx < Math.min(5, candidates.length) - 1 ? '1px solid var(--border)' : 'none' }}>{c.phoneNumber || '—'}</td>
                          <td style={{ padding: '8px 12px', borderBottom: idx < Math.min(5, candidates.length) - 1 ? '1px solid var(--border)' : 'none' }}>{c.whatsAppNumber || '—'}</td>
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
  const [viewLinksModal, setViewLinksModal] = useState<{ open: boolean; interviewId: string; interviewName: string; links: InterviewLink[]; loading: boolean; isAIInterview: boolean; createdAt?: string }>({
    open: false,
    interviewId: '',
    interviewName: '',
    links: [],
    loading: false,
    isAIInterview: false
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
      console.log('Response type:', typeof res.data);
      console.log('Is array:', Array.isArray(res.data));
      
      // Handle both array and object responses
      let interviewsArray = [];
      if (Array.isArray(res.data)) {
        interviewsArray = res.data;
      } else if (res.data && typeof res.data === 'object') {
        // Check for various possible response structures
        interviewsArray = res.data.items || res.data.data || res.data.Interviews || [];
      }
      
      console.log('Parsed interviews array:', interviewsArray);
      console.log('Array length:', interviewsArray.length);
      
      const transformedData = interviewsArray.map((item: any) => ({
        id: item.id || item.Id,
        name: item.name || item.Name,
        ijpId: item.ijpId || item.IJPId,
        ijpName: item.ijpName || item.IJPName,
        difficulty: item.difficulty || item.Difficulty,
        totalQuestions: item.totalQuestions ?? item.TotalQuestions ?? 10,
        durationMinutes: item.durationMinutes ?? item.DurationMinutes ?? 30,
        topics: item.topics || item.Topics || [],
        isActive: item.isActive ?? item.IsActive ?? true,
        totalLinks: item.totalLinks ?? item.TotalLinks ?? 0,
        totalCandidates: item.totalCandidates ?? item.TotalCandidates ?? 0,
        completedCandidates: item.completedCandidates ?? item.CompletedCandidates ?? 0,
        createdAt: item.createdAt || item.CreatedAt
      }));
      
      console.log('Transformed data:', transformedData);
      setInterviews(transformedData);
      
      const linksMap = new Map<string, InterviewLink[]>();
      for (const interview of transformedData) {
        try {
          const linksRes = await api.get(`/interviews/${interview.id}/links`);
          console.log(`Links for interview ${interview.id}:`, linksRes.data);
          
          const linksArray = Array.isArray(linksRes.data) ? linksRes.data : [];
          console.log(`Links array for ${interview.id}:`, linksArray, 'length:', linksArray.length);
          
          const transformedLinks = linksArray.map((link: any) => {
            const candidatesArray = link.Candidates || link.candidates || [];
            return {
              id: link.Id || link.id || '',
              interviewId: link.InterviewId || link.interviewId || interview.id,
              interviewName: link.InterviewName || link.interviewName || interview.name,
              name: link.Name || link.name || '',
              instructions: link.Instructions || link.instructions || '',
              isActive: link.IsActive ?? link.isActive ?? true,
              totalCandidates: link.TotalCandidates ?? link.totalCandidates ?? candidatesArray.length,
              completedCandidates: link.CompletedCandidates ?? link.completedCandidates ?? 
                candidatesArray.filter((c: any) => 
                  c.Status === 'Completed' || c.status === 'Completed'
                ).length,
              createdAt: link.CreatedAt || link.createdAt || new Date().toISOString(),
              welcomeMessage: link.WelcomeMessage || link.welcomeMessage,
              closingMessage: link.ClosingMessage || link.closingMessage,
              candidates: candidatesArray.map((c: any) => ({
                id: c.Id || c.id,
                interviewLinkId: c.InterviewLinkId || c.interviewLinkId,
                email: c.Email || c.email || '',
                candidateName: c.CandidateName || c.candidateName || '',
                phoneNumber: c.PhoneNumber || c.phoneNumber,
                whatsAppNumber: c.WhatsAppNumber || c.whatsAppNumber,
                accessCode: c.AccessCode || c.accessCode,
                interviewToken: c.InterviewToken || c.interviewToken,
                resumePath: c.ResumePath || c.resumePath,
                startTime: c.StartTime || c.startTime,
                endTime: c.EndTime || c.endTime,
                bufferStartMinutes: c.BufferStartMinutes ?? c.bufferStartMinutes ?? 0,
                bufferEndMinutes: c.BufferEndMinutes ?? c.bufferEndMinutes ?? 0,
                rescheduleCount: c.RescheduleCount ?? c.rescheduleCount ?? 0,
                status: (c.Status || c.status || 'Pending').toString(),
                score: c.Score ?? c.score,
                createdAt: c.CreatedAt || c.createdAt
              }))
            };
          });
          console.log(`Transformed links for ${interview.id}:`, transformedLinks);
          linksMap.set(interview.id, transformedLinks);
        } catch (linkErr: any) {
          console.error(`Failed to fetch links for interview ${interview.id}:`, linkErr);
          console.error('Link error status:', linkErr.response?.status);
          console.error('Link error data:', linkErr.response?.data);
          linksMap.set(interview.id, []);
        }
      }
      console.log('Final linksMap:', linksMap);
      setLinks(linksMap);
    } catch (err: any) {
      console.error('Failed to fetch interviews', err);
      console.log('Error status:', err.response?.status);
      console.log('Error data:', err.response?.data);
      console.log('Error message:', err.message);
      console.log('Error config:', err.config?.url);
      setInterviews([]);
      if (err.response?.status === 401) {
        alert('Please login as admin first!');
        window.location.href = '/login';
      } else {
        alert('Failed to get interviews: ' + (err.response?.data?.message || err.message));
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
    setViewLinksModal({ open: true, interviewId: interview.id, interviewName: interview.name, links: [], loading: true, isAIInterview: !!interview.ijpId });
    try {
      console.log('handleViewLinks: fetching links for', interview.id);
      const res = await api.get(`/interviews/${interview.id}/links`);
      console.log('handleViewLinks: response data:', res.data);
      const linksArray = Array.isArray(res.data) ? res.data : [];
      console.log('handleViewLinks: linksArray:', linksArray, 'length:', linksArray.length);
      
      const transformedLinks: InterviewLink[] = linksArray.map((link: any) => {
        const candidatesArray = link.Candidates || link.candidates || [];
        return {
          id: link.Id || link.id || '',
          interviewId: link.InterviewId || link.interviewId || interview.id,
          interviewName: link.InterviewName || link.interviewName || interview.name,
          name: link.Name || link.name || '',
          instructions: link.Instructions || link.instructions || '',
          isActive: link.IsActive ?? link.isActive ?? true,
          totalCandidates: link.TotalCandidates ?? link.totalCandidates ?? candidatesArray.length,
          completedCandidates: link.CompletedCandidates ?? link.completedCandidates ?? 
            candidatesArray.filter((c: any) => 
              c.Status === 'Completed' || c.status === 'Completed'
            ).length,
          createdAt: link.CreatedAt || link.createdAt || new Date().toISOString(),
          welcomeMessage: link.WelcomeMessage || link.welcomeMessage,
          closingMessage: link.ClosingMessage || link.closingMessage,
          candidates: candidatesArray.map((c: any) => ({
            id: c.Id || c.id,
            interviewLinkId: c.InterviewLinkId || c.interviewLinkId,
            email: c.Email || c.email || '',
            candidateName: c.CandidateName || c.candidateName || '',
            phoneNumber: c.PhoneNumber || c.phoneNumber,
            whatsAppNumber: c.WhatsAppNumber || c.whatsAppNumber,
            accessCode: c.AccessCode || c.accessCode,
            interviewToken: c.InterviewToken || c.interviewToken,
            resumePath: c.ResumePath || c.resumePath,
            startTime: c.StartTime || c.startTime,
            endTime: c.EndTime || c.endTime,
            bufferStartMinutes: c.BufferStartMinutes ?? c.bufferStartMinutes ?? 0,
            bufferEndMinutes: c.BufferEndMinutes ?? c.bufferEndMinutes ?? 0,
            rescheduleCount: c.RescheduleCount ?? c.rescheduleCount ?? 0,
            status: (c.Status || c.status || 'Pending').toString(),
            score: c.Score ?? c.score,
            createdAt: c.CreatedAt || c.createdAt,
            instructions: c.Instructions || c.instructions || '',
          }))
        };
      });
      console.log('handleViewLinks: transformedLinks:', transformedLinks);
      setViewLinksModal(prev => ({ 
        ...prev, 
        links: transformedLinks, 
        loading: false,
        createdAt: prev.createdAt || new Date().toISOString()
      }));
    } catch (err: any) {
      console.error('handleViewLinks: Failed to fetch links', err);
      console.error('Error status:', err.response?.status);
      console.error('Error data:', err.response?.data);
      setViewLinksModal(prev => ({ ...prev, loading: false }));
    }
  };

  const [bulkUploadModal, setBulkUploadModal] = useState<{ open: boolean; linkId: string; linkName: string }>({ open: false, linkId: '', linkName: '' });
  const [expandedLinkId, setExpandedLinkId] = useState<string | null>(null);
  const [rescheduleModal, setRescheduleModal] = useState<{ open: boolean; candidate: CandidateInfo | null }>({ open: false, candidate: null });
  const [inlineCandidateDrafts, setInlineCandidateDrafts] = useState<Record<string, InlineCandidateDraft | undefined>>({});
  const [uploadingResumeCandidateId, setUploadingResumeCandidateId] = useState<string | null>(null);

  const createDefaultCandidateDraft = (): InlineCandidateDraft => {
    const now = new Date();
    const defaultEnd = new Date(now);
    defaultEnd.setMinutes(defaultEnd.getMinutes() + 60);

    const formatDateLocal = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    return {
      email: '',
      candidateName: '',
      phoneNumber: '',
      whatsAppNumber: '',
      startTime: formatDateLocal(now),
      endTime: formatDateLocal(defaultEnd),
      bufferStartMinutes: 0,
      bufferEndMinutes: 0,
      resumeBase64: undefined,
      fileName: undefined,
    };
  };

  const openInlineCandidateRow = (linkId: string) => {
    setInlineCandidateDrafts(prev => ({
      ...prev,
      [linkId]: prev[linkId] ?? createDefaultCandidateDraft(),
    }));
  };

  const closeInlineCandidateRow = (linkId: string) => {
    setInlineCandidateDrafts(prev => ({
      ...prev,
      [linkId]: undefined,
    }));
  };

  const updateInlineCandidateDraft = (linkId: string, field: keyof InlineCandidateDraft, value: string | number | undefined) => {
    setInlineCandidateDrafts(prev => ({
      ...prev,
      [linkId]: {
        ...(prev[linkId] ?? createDefaultCandidateDraft()),
        [field]: value,
      },
    }));
  };

  const handleAddCandidates = async (candidates: {
    email: string;
    candidateName: string;
    phoneNumber: string;
    whatsAppNumber: string;
  }[]) => {
    try {
      const now = new Date();
      const defaultEnd = new Date(now);
      defaultEnd.setMinutes(defaultEnd.getMinutes() + 60);
      
      const formatDateLocal = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
      };
      
      await api.post('/interviews/links/candidates', {
        linkId: bulkUploadModal.linkId,
        candidates: candidates.map(c => ({
          email: c.email,
          candidateName: c.candidateName || null,
          phoneNumber: c.phoneNumber || null,
          whatsAppNumber: c.whatsAppNumber || null,
          startTime: formatDateLocal(now),
          endTime: formatDateLocal(defaultEnd),
          bufferStartMinutes: 0,
          bufferEndMinutes: 0,
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

  const handleAddSingleCandidate = async (linkId: string) => {
    const draft = inlineCandidateDrafts[linkId];
    if (!draft || !draft.email.trim()) {
      alert('Candidate email is required');
      return;
    }

    try {
      await api.post(`/interviews/links/${linkId}/candidates`, [{
        linkId,
        email: draft.email.trim(),
        candidateName: draft.candidateName.trim() || null,
        phoneNumber: draft.phoneNumber.trim() || null,
        whatsAppNumber: draft.whatsAppNumber.trim() || null,
        startTime: draft.startTime,
        endTime: draft.endTime,
        bufferStartMinutes: draft.bufferStartMinutes || 0,
        bufferEndMinutes: draft.bufferEndMinutes || 0,
        resumeBase64: draft.resumeBase64 || null,
        fileName: draft.fileName || null,
      }]);

      closeInlineCandidateRow(linkId);
      await handleViewLinks({ id: viewLinksModal.interviewId, name: viewLinksModal.interviewName } as Interview);
      fetchInterviews();
      setToast('Candidate added successfully!');
      setTimeout(() => setToast(null), 2000);
    } catch (err: any) {
      console.error('Failed to add candidate', err);
      alert(err.response?.data?.message || 'Failed to add candidate');
    }
  };

  const candidateHasResume = (candidate: CandidateInfo) => Boolean(candidate.resumePath && candidate.resumePath.trim());

  const handleUploadCandidateResume = async (candidate: CandidateInfo, file?: File | null) => {
    if (!candidate.id || !file) {
      return;
    }

    try {
      setUploadingResumeCandidateId(candidate.id);

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] || '');
        };
        reader.onerror = () => reject(new Error('Failed to read resume file'));
        reader.readAsDataURL(file);
      });

      await api.post(`/interviews/candidates/${candidate.id}/resume`, {
        resumeBase64: base64,
        fileName: file.name,
      });

      await handleViewLinks({ id: viewLinksModal.interviewId, name: viewLinksModal.interviewName } as Interview);
      fetchInterviews();
      setToast('Resume uploaded successfully!');
      setTimeout(() => setToast(null), 2000);
    } catch (err: any) {
      console.error('Failed to upload candidate resume', err);
      alert(err.response?.data?.message || 'Failed to upload candidate resume');
    } finally {
      setUploadingResumeCandidateId(null);
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

  const getCandidateUrl = (candidate: CandidateInfo, isAIInterview: boolean = false) => {
    const basePath = isAIInterview ? '/ai-interview/c' : '/interview/c';
    return `${window.location.origin}${basePath}/${candidate.interviewToken}`;
  };

  const shareWALink = (candidate: CandidateInfo, isAIInterview: boolean = false) => {
    const candidateUrl = getCandidateUrl(candidate, isAIInterview);
    const interviewType = isAIInterview ? 'AI ' : '';
    const text = encodeURIComponent(`🎙️ ${interviewType}Interview: ${viewLinksModal.interviewName}\n🔗 ${candidateUrl}\n🔑 Access Code: ${candidate.accessCode || 'Check email'}\n⏰ ${fmtDT(candidate.startTime)} → ${fmtDT(candidate.endTime)}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };
  const shareEmailLink = (candidate: CandidateInfo, isAIInterview: boolean = false) => {
    const candidateUrl = getCandidateUrl(candidate, isAIInterview);
    const interviewType = isAIInterview ? 'AI ' : '';
    const subject = encodeURIComponent(`${interviewType}Interview Invitation: ${viewLinksModal.interviewName}`);
    const body = encodeURIComponent(`You are invited to an interview.\n\nInterview: ${viewLinksModal.interviewName}\nYour Link: ${candidateUrl}\nAccess Code: ${candidate.accessCode || 'Check email'}\n\nScheduled: ${fmtDT(candidate.startTime)} → ${fmtDT(candidate.endTime)}\n\nPlease use your access code to begin.`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const handleCreateLink = async (data: {
    name: string;
    instructions: string;
    welcomeMessage: string;
    closingMessage: string;
    candidates: {
      email: string;
      candidateName: string;
      phoneNumber: string;
      whatsAppNumber: string;
      startTime: string;
      endTime: string;
      bufferStartMinutes: number;
      bufferEndMinutes: number;
      resumeBase64?: string;
      fileName?: string;
    }[];
  }) => {
    try {
      await api.post('/interviews/links', {
        interviewId: showLinkModal,
        name: data.name,
        instructions: data.instructions,
        welcomeMessage: data.welcomeMessage || undefined,
        closingMessage: data.closingMessage || undefined,
        candidates: data.candidates.map(c => ({
          email: c.email,
          candidateName: c.candidateName || null,
          phoneNumber: c.phoneNumber || null,
          whatsAppNumber: c.whatsAppNumber || null,
          startTime: c.startTime, // Send as local string (YYYY-MM-DDTHH:mm)
          endTime: c.endTime,     // Send as local string (YYYY-MM-DDTHH:mm)
          bufferStartMinutes: c.bufferStartMinutes || 0,
          bufferEndMinutes: c.bufferEndMinutes || 0,
          resumeBase64: c.resumeBase64 || null,
          fileName: c.fileName || null,
        })),
      });
      setShowLinkModal(null);
      fetchInterviews();
      if (viewLinksModal.open && viewLinksModal.interviewId === showLinkModal) {
        const res = await api.get(`/interviews/${showLinkModal}/links`);
        const transformedLinks = (res.data || []).map((link: any) => {
          const candidatesArray = link.Candidates || link.candidates || [];
          return {
            ...link,
            candidates: candidatesArray.map((c: any) => ({
              id: c.id || c.Id,
              interviewLinkId: c.interviewLinkId || c.InterviewLinkId,
              email: c.email || c.Email,
              candidateName: c.candidateName || c.CandidateName,
              phoneNumber: c.phoneNumber || c.PhoneNumber,
              whatsAppNumber: c.whatsAppNumber || c.WhatsAppNumber,
              accessCode: c.accessCode || c.AccessCode,
              interviewToken: c.interviewToken || c.InterviewToken,
              resumePath: c.resumePath || c.ResumePath,
              startTime: c.startTime || c.StartTime,
              endTime: c.endTime || c.EndTime,
              bufferStartMinutes: c.bufferStartMinutes ?? c.BufferStartMinutes,
              bufferEndMinutes: c.bufferEndMinutes ?? c.BufferEndMinutes,
              rescheduleCount: c.rescheduleCount ?? c.RescheduleCount,
              status: c.status || c.Status,
              score: c.score || c.Score,
              createdAt: c.createdAt || c.CreatedAt
            }))
          };
        });
        setViewLinksModal(prev => ({ ...prev, links: transformedLinks }));
      }
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
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => fetchInterviews()}
            className="btn btn-outline"
            style={{ padding: '8px 16px' }}
          >
            🔄 Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            + Create Interview
          </button>
        </div>
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
                    {interview.topics?.map((t) => (
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
                                👥 {link.completedCandidates}/{link.totalCandidates} completed
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <button className="share-btn" title="Copy link" onClick={() => copyLink(link.id)}>📋</button>
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
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button 
                                    className="btn btn-outline btn-sm"
                                    onClick={() => setBulkUploadModal({ open: true, linkId: link.id, linkName: link.name })}
                                  >
                                    Bulk Candidates
                                  </button>
                                  <button 
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => openInlineCandidateRow(link.id)}
                                  >
                                    + Add
                                  </button>
                                </div>
                              )}
                            </div>
                            {(link.candidates && link.candidates.length > 0) || inlineCandidateDrafts[link.id] ? (
                              <div style={{ borderRadius: '8px', border: '1px solid var(--border)', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                  <thead>
                                    <tr style={{ background: 'var(--surface)' }}>
                                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>Name</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>Email</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>Time Slot</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>Code</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>Status</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>Actions</th>
                                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase' }}>Resume</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {inlineCandidateDrafts[link.id] && (
                                      <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255, 92, 0, 0.04)' }}>
                                        <td style={{ padding: '8px' }}>
                                          <input value={inlineCandidateDrafts[link.id]?.candidateName || ''} onChange={(e) => updateInlineCandidateDraft(link.id, 'candidateName', e.target.value)} className="form-input" placeholder="Candidate name" style={{ padding: '8px', fontSize: '12px' }} />
                                        </td>
                                        <td style={{ padding: '8px' }}>
                                          <input value={inlineCandidateDrafts[link.id]?.email || ''} onChange={(e) => updateInlineCandidateDraft(link.id, 'email', e.target.value)} className="form-input" placeholder="Email" style={{ padding: '8px', fontSize: '12px' }} />
                                        </td>
                                        <td style={{ padding: '8px' }}>
                                          <div style={{ display: 'grid', gap: '6px' }}>
                                            <input type="datetime-local" value={inlineCandidateDrafts[link.id]?.startTime || ''} onChange={(e) => updateInlineCandidateDraft(link.id, 'startTime', e.target.value)} className="form-input" style={{ padding: '8px', fontSize: '11px' }} />
                                            <input type="datetime-local" value={inlineCandidateDrafts[link.id]?.endTime || ''} onChange={(e) => updateInlineCandidateDraft(link.id, 'endTime', e.target.value)} className="form-input" style={{ padding: '8px', fontSize: '11px' }} />
                                          </div>
                                        </td>
                                        <td style={{ padding: '8px', verticalAlign: 'top' }}>
                                          <input value="" readOnly className="form-input" placeholder="Auto-generated" style={{ padding: '8px', fontSize: '11px', opacity: 0.7 }} />
                                        </td>
                                        <td style={{ padding: '8px', verticalAlign: 'top' }}>
                                          <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '100px', background: 'rgba(138,138,138,.1)', color: 'var(--muted)' }}>New</span>
                                        </td>
                                        <td style={{ padding: '8px', verticalAlign: 'top' }}>
                                          <div style={{ display: 'flex', gap: '6px' }}>
                                            <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAddSingleCandidate(link.id)}>Save</button>
                                            <button type="button" className="btn btn-outline btn-sm" onClick={() => closeInlineCandidateRow(link.id)}>Cancel</button>
                                          </div>
                                        </td>
                                        <td style={{ padding: '8px', verticalAlign: 'top' }}>
                                          <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px', color: 'var(--primary)', fontWeight: 500, padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--primary)', background: 'rgba(99, 102, 241, 0.05)' }}>
                                            <input type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (!file) return;
                                              const reader = new FileReader();
                                              reader.onload = () => {
                                                const base64 = reader.result as string;
                                                updateInlineCandidateDraft(link.id, 'resumeBase64', base64.split(',')[1]);
                                                updateInlineCandidateDraft(link.id, 'fileName', file.name);
                                              };
                                              reader.readAsDataURL(file);
                                            }} />
                                            {inlineCandidateDrafts[link.id]?.fileName ? 'Resume Added' : 'Upload Resume'}
                                          </label>
                                        </td>
                                      </tr>
                                    )}
                                    {(link.candidates || []).map((candidate, idx) => {
                                      const statusStyle = getCandidateStatusColor(candidate.status || 'Pending');
                                      return (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                          <td style={{ padding: '8px 12px', color: 'var(--ink)' }}>{candidate.candidateName || '—'}</td>
                                          <td style={{ padding: '8px 12px', color: 'var(--muted)', fontSize: '11px' }}>{candidate.email}</td>
                                          <td style={{ padding: '8px 12px', color: 'var(--muted)', fontSize: '11px' }}>
                                            <div>{fmtDT(candidate.startTime)}</div>
                                            <div style={{ fontSize: '10px', color: 'var(--muted)' }}>→ {fmtDT(candidate.endTime)}</div>
                                          </td>
                                          <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--accent2)' }}>{candidate.accessCode || '—'}</td>
                                          <td style={{ padding: '8px 12px' }}>
                                            <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '100px', background: statusStyle.bg, color: statusStyle.color }}>
                                              {candidate.status || 'Pending'}
                                            </span>
                                          </td>
                                          <td style={{ padding: '8px 12px' }}>
                                            <div style={{ display: 'flex', gap: '4px' }}>
                                              <button 
                                                className="share-btn" 
                                                title="Copy link"
                                                onClick={() => {
                                                  const url = getCandidateUrl(candidate);
                                                  navigator.clipboard.writeText(url);
                                                  setToast('Link copied!');
                                                  setTimeout(() => setToast(null), 2000);
                                                }}
                                                style={{ fontSize: '11px' }}
                                              >📋</button>
                                              <button 
                                                className="share-btn" 
                                                title="Reschedule"
                                                onClick={() => setRescheduleModal({ open: true, candidate })}
                                                style={{ fontSize: '11px' }}
                                              >📅</button>
                                              <button 
                                                className="share-btn" 
                                                title="View Report"
                                                onClick={() => navigate(`/interviews/reports/${candidate.id}`)}
                                                style={{ fontSize: '11px', color: 'var(--green)' }}
                                              >📊</button>
                                            </div>
                                          </td>
                                          <td style={{ padding: '8px 12px' }}>
                                            {candidateHasResume(candidate) ? (
                                              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--green)' }}>Uploaded</span>
                                            ) : (
                                              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>
                                                <input
                                                  type="file"
                                                  accept=".pdf,.doc,.docx,.txt"
                                                  style={{ display: 'none' }}
                                                  onChange={(e) => {
                                                    void handleUploadCandidateResume(candidate, e.target.files?.[0]);
                                                    e.currentTarget.value = '';
                                                  }}
                                                />
                                                {uploadingResumeCandidateId === candidate.id ? 'Uploading...' : 'Upload Resume'}
                                              </label>
                                            )}
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
                                <span>👥 {completedCount}/{link.totalCandidates || 0} completed</span>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <button className="share-btn" title="Copy link" onClick={() => copyLink(link.id)}>📋</button>
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
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button 
                                    className="btn btn-outline btn-sm"
                                    onClick={() => setBulkUploadModal({ open: true, linkId: link.id, linkName: link.name })}
                                  >
                                    Bulk Candidates
                                  </button>
                                  <button 
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => openInlineCandidateRow(link.id)}
                                  >
                                    + Add Candidate
                                  </button>
                                </div>
                              </div>
                              {(link.candidates && link.candidates.length > 0) || inlineCandidateDrafts[link.id] ? (
                                <div style={{ maxHeight: '320px', overflowY: 'auto', borderRadius: '10px', border: '1px solid var(--border)' }}>
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    <thead>
                                      <tr style={{ background: 'var(--surface)', position: 'sticky', top: 0 }}>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Name</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Email</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Time Slot</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Code</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Status</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Share</th>
                                        <th style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--muted)', fontWeight: 600, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '.5px' }}>Resume</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {inlineCandidateDrafts[link.id] && (
                                        <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255, 92, 0, 0.04)' }}>
                                          <td style={{ padding: '8px' }}>
                                            <input value={inlineCandidateDrafts[link.id]?.candidateName || ''} onChange={(e) => updateInlineCandidateDraft(link.id, 'candidateName', e.target.value)} className="form-input" placeholder="Candidate name" style={{ padding: '8px', fontSize: '12px' }} />
                                          </td>
                                          <td style={{ padding: '8px' }}>
                                            <input value={inlineCandidateDrafts[link.id]?.email || ''} onChange={(e) => updateInlineCandidateDraft(link.id, 'email', e.target.value)} className="form-input" placeholder="Email" style={{ padding: '8px', fontSize: '12px' }} />
                                          </td>
                                          <td style={{ padding: '8px' }}>
                                            <div style={{ display: 'grid', gap: '6px' }}>
                                              <input type="datetime-local" value={inlineCandidateDrafts[link.id]?.startTime || ''} onChange={(e) => updateInlineCandidateDraft(link.id, 'startTime', e.target.value)} className="form-input" style={{ padding: '8px', fontSize: '11px' }} />
                                              <input type="datetime-local" value={inlineCandidateDrafts[link.id]?.endTime || ''} onChange={(e) => updateInlineCandidateDraft(link.id, 'endTime', e.target.value)} className="form-input" style={{ padding: '8px', fontSize: '11px' }} />
                                            </div>
                                          </td>
                                          <td style={{ padding: '8px', verticalAlign: 'top' }}>
                                            <input value="" readOnly className="form-input" placeholder="Auto-generated" style={{ padding: '8px', fontSize: '11px', opacity: 0.7 }} />
                                          </td>
                                          <td style={{ padding: '8px' }}>
                                            <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '100px', background: 'rgba(138,138,138,.1)', color: 'var(--muted)' }}>New</span>
                                          </td>
                                          <td style={{ padding: '8px' }}>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                              <button type="button" className="btn btn-primary btn-sm" onClick={() => handleAddSingleCandidate(link.id)}>Save</button>
                                              <button type="button" className="btn btn-outline btn-sm" onClick={() => closeInlineCandidateRow(link.id)}>Cancel</button>
                                            </div>
                                          </td>
                                          <td style={{ padding: '8px' }}>
                                            <label style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', cursor: 'pointer', fontSize: '10px', color: 'var(--primary)', fontWeight: 500, padding: '6px 8px', borderRadius: '4px', border: '1px solid var(--primary)', background: 'rgba(99, 102, 241, 0.05)' }}>
                                              <input type="file" accept=".pdf,.doc,.docx,.txt" style={{ display: 'none' }} onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (!file) return;
                                                const reader = new FileReader();
                                                reader.onload = () => {
                                                  const base64 = reader.result as string;
                                                  updateInlineCandidateDraft(link.id, 'resumeBase64', base64.split(',')[1]);
                                                  updateInlineCandidateDraft(link.id, 'fileName', file.name);
                                                };
                                                reader.readAsDataURL(file);
                                              }} />
                                              {inlineCandidateDrafts[link.id]?.fileName ? 'Resume Added' : 'Upload Resume'}
                                            </label>
                                          </td>
                                        </tr>
                                      )}
                                      {(link.candidates || []).map((candidate, idx) => {
                                        const statusStyle = getCandidateStatusColor(candidate.status || 'Pending');
                                        const candidateUrl = candidate.interviewToken ? getCandidateUrl(candidate, viewLinksModal.isAIInterview) : '';
                                        const copyCandidateLink = () => {
                                          if (candidateUrl) {
                                            navigator.clipboard.writeText(candidateUrl);
                                            setToast('Link copied!');
                                            setTimeout(() => setToast(null), 2000);
                                          }
                                        };
                                        return (
                                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                                            <td style={{ padding: '8px 12px', color: 'var(--ink)' }}>{candidate.candidateName || '—'}</td>
                                            <td style={{ padding: '8px 12px', color: 'var(--muted)', fontFamily: 'monospace', fontSize: '11px' }}>{candidate.email}</td>
                                            <td style={{ padding: '8px 12px', color: 'var(--muted)', fontSize: '11px' }}>
                                              <div>{fmtDT(candidate.startTime)}</div>
                                              <div style={{ color: 'var(--muted)', fontSize: '10px' }}>→ {fmtDT(candidate.endTime)}</div>
                                            </td>
                                            <td style={{ padding: '8px 12px', fontFamily: 'monospace', fontSize: '11px', color: 'var(--accent2)' }}>{candidate.accessCode || '—'}</td>
                                            <td style={{ padding: '8px 12px' }}>
                                              <span style={{ fontSize: '10px', fontWeight: 500, padding: '2px 6px', borderRadius: '100px', background: statusStyle.bg, color: statusStyle.color }}>
                                                {candidate.status || 'Pending'}
                                              </span>
                                            </td>
                                            <td style={{ padding: '8px 12px' }}>
                                              <div style={{ display: 'flex', gap: '6px' }}>
                                                <button 
                                                  className="share-btn" 
                                                  title="Copy unique link"
                                                  onClick={copyCandidateLink}
                                                  style={{ fontSize: '12px' }}
                                                >📋</button>
                                                {candidate.whatsAppNumber && (
                                                  <button 
                                                    className="share-btn share-wa" 
                                                    title="WhatsApp"
                                                    onClick={() => shareWALink(candidate, viewLinksModal.isAIInterview)}
                                                    style={{ fontSize: '12px' }}
                                                  >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.555 4.122 1.528 5.855L0 24l6.326-1.508C8.02 23.459 9.972 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818c-1.907 0-3.682-.527-5.192-1.438l-.37-.22-3.753.894.939-3.652-.243-.385C2.618 15.452 2.182 13.77 2.182 12 2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/>
                                                    </svg>
                                                  </button>
                                                )}
                                                <button 
                                                  className="share-btn share-email" 
                                                  title="Email"
                                                  onClick={() => shareEmailLink(candidate, viewLinksModal.isAIInterview)}
                                                  style={{ fontSize: '12px' }}
                                                >✉️</button>
                                                <button 
                                                  className="share-btn" 
                                                  title="Reschedule"
                                                  onClick={() => setRescheduleModal({ open: true, candidate })}
                                                  style={{ fontSize: '12px' }}
                                                >📅</button>
                                              </div>
                                            </td>
                                            <td style={{ padding: '8px 12px' }}>
                                              {candidateHasResume(candidate) ? (
                                                <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--green)' }}>Uploaded</span>
                                              ) : (
                                                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>
                                                  <input
                                                    type="file"
                                                    accept=".pdf,.doc,.docx,.txt"
                                                    style={{ display: 'none' }}
                                                    onChange={(e) => {
                                                      void handleUploadCandidateResume(candidate, e.target.files?.[0]);
                                                      e.currentTarget.value = '';
                                                    }}
                                                  />
                                                  {uploadingResumeCandidateId === candidate.id ? 'Uploading...' : 'Upload Resume'}
                                                </label>
                                              )}
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

      {rescheduleModal.open && rescheduleModal.candidate && (
        <RescheduleCandidateModal
          candidate={rescheduleModal.candidate}
          onClose={() => setRescheduleModal({ open: false, candidate: null })}
          onReschedule={async (data) => {
            try {
              await api.put(`/interviews/candidates/${rescheduleModal.candidate?.id}/reschedule`, {
                startTime: new Date(data.startTime).toISOString(),
                endTime: new Date(data.endTime).toISOString(),
                bufferStartMinutes: data.bufferStartMinutes,
                bufferEndMinutes: data.bufferEndMinutes,
              });
              setRescheduleModal({ open: false, candidate: null });
              fetchInterviews();
              if (viewLinksModal.open) {
                handleViewLinks({ id: viewLinksModal.interviewId, name: viewLinksModal.interviewName } as Interview);
              }
              setToast('Candidate rescheduled successfully!');
              setTimeout(() => setToast(null), 2000);
            } catch (err: any) {
              console.error('Failed to reschedule', err);
              alert(err.response?.data?.message || 'Failed to reschedule candidate');
            }
          }}
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
    instructions: string;
    welcomeMessage: string;
    closingMessage: string;
    candidates: {
      email: string;
      candidateName: string;
      phoneNumber: string;
      whatsAppNumber: string;
      startTime: string;
      endTime: string;
      bufferStartMinutes: number;
      bufferEndMinutes: number;
      resumeBase64?: string;
      fileName?: string;
    }[];
  }) => void;
}) {
  const now = new Date();
  const defaultSlot = new Date(now);
  defaultSlot.setMinutes(defaultSlot.getMinutes() + 30);
  
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
    instructions: '',
    welcomeMessage: '',
    closingMessage: '',
    candidates: [] as {
      email: string;
      candidateName: string;
      phoneNumber: string;
      whatsAppNumber: string;
      startTime: string;
      endTime: string;
      bufferStartMinutes: number;
      bufferEndMinutes: number;
      resumeBase64?: string;
      fileName?: string;
    }[],
  });
  const [showBulkUpload, setShowBulkUpload] = useState(false);

  const addCandidate = () => {
    const newCandidate = {
      email: '',
      candidateName: '',
      phoneNumber: '',
      whatsAppNumber: '',
      startTime: formatDateLocal(now),
      endTime: formatDateLocal(defaultSlot),
      bufferStartMinutes: 0,
      bufferEndMinutes: 0,
      resumeBase64: undefined,
      fileName: undefined,
    };
    setFormData({
      ...formData,
      candidates: [...formData.candidates, newCandidate],
    });
  };

  const updateCandidate = (index: number, field: string, value: string | number) => {
    const updated = [...formData.candidates];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, candidates: updated });
  };

  const handleBulkUploadComplete = (uploadedCandidates: {
    email: string;
    candidateName: string;
    phoneNumber: string;
    whatsAppNumber: string;
  }[]) => {
    const candidatesWithTime = uploadedCandidates.map(c => ({
      ...c,
      startTime: formatDateLocal(now),
      endTime: formatDateLocal(defaultSlot),
      bufferStartMinutes: 0,
      bufferEndMinutes: 0,
    }));
    setFormData({
      ...formData,
      candidates: [...formData.candidates, ...candidatesWithTime],
    });
    setShowBulkUpload(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '95vw', maxHeight: '95vh', width: '1200px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 className="modal-title" style={{ margin: 0 }}>Create Interview Link</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div className="form-group">
              <label className="form-label">Link Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="form-input"
                placeholder="e.g., Q1 2026 Batch"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Instructions</label>
              <textarea
                value={formData.instructions}
                onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                className="form-textarea"
                placeholder="Any specific instructions..."
                style={{ minHeight: '60px' }}
              />
            </div>
          </div>

          <div className="form-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div className="form-group">
              <label className="form-label">Welcome Message</label>
              <textarea
                value={formData.welcomeMessage}
                onChange={(e) => setFormData({ ...formData, welcomeMessage: e.target.value })}
                className="form-textarea"
                placeholder="Welcome message shown to candidates..."
                style={{ minHeight: '60px' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Closing Message</label>
              <textarea
                value={formData.closingMessage}
                onChange={(e) => setFormData({ ...formData, closingMessage: e.target.value })}
                className="form-textarea"
                placeholder="Closing message shown after interview..."
                style={{ minHeight: '60px' }}
              />
            </div>
          </div>

          <div className="form-group">
            <div className="flex justify-between items-center mb-2">
              <label className="form-label" style={{ marginBottom: 0, fontSize: '16px', fontWeight: 600 }}>
                👥 Candidates ({formData.candidates.length})
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" onClick={() => setShowBulkUpload(true)} className="btn btn-outline btn-sm">
                  📊 Bulk Upload
                </button>
                <button type="button" onClick={addCandidate} className="btn btn-primary btn-sm">
                  + Add Candidate
                </button>
              </div>
            </div>
            {formData.candidates.length > 0 ? (
              <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                  <thead>
                    <tr style={{ background: 'var(--surface)', position: 'sticky', top: 0, zIndex: 1 }}>
                      <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', fontSize: '10px', width: '130px' }}>Name</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', fontSize: '10px', width: '180px' }}>Email</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', fontSize: '10px', width: '150px' }}>Start Time</th>
                      <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', fontSize: '10px', width: '150px' }}>End Time</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: 'var(--muted)', fontSize: '10px', width: '80px' }}>Buffer</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: 'var(--muted)', fontSize: '10px', width: '70px' }}>Resume</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: 600, color: 'var(--muted)', fontSize: '10px', width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {formData.candidates.map((c, i) => (
                      <tr key={i} style={{ borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                        <td style={{ padding: '8px' }}>
                          <input
                            type="text"
                            placeholder="Name"
                            value={c.candidateName}
                            onChange={(e) => updateCandidate(i, 'candidateName', e.target.value)}
                            className="form-input"
                            style={{ padding: '8px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }}
                          />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <input
                            type="email"
                            placeholder="Email"
                            value={c.email}
                            onChange={(e) => updateCandidate(i, 'email', e.target.value)}
                            className="form-input"
                            style={{ padding: '8px', fontSize: '12px', width: '100%', boxSizing: 'border-box' }}
                          />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <input
                            type="datetime-local"
                            value={c.startTime}
                            onChange={(e) => updateCandidate(i, 'startTime', e.target.value)}
                            className="form-input"
                            style={{ padding: '8px', fontSize: '11px', width: '100%', boxSizing: 'border-box' }}
                          />
                        </td>
                        <td style={{ padding: '8px' }}>
                          <input
                            type="datetime-local"
                            value={c.endTime}
                            onChange={(e) => updateCandidate(i, 'endTime', e.target.value)}
                            className="form-input"
                            style={{ padding: '8px', fontSize: '11px', width: '100%', boxSizing: 'border-box' }}
                          />
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', gap: '2px', alignItems: 'center', justifyContent: 'center' }}>
                            <input
                              type="number"
                              min="0"
                              value={c.bufferStartMinutes}
                              onChange={(e) => updateCandidate(i, 'bufferStartMinutes', parseInt(e.target.value) || 0)}
                              className="form-input"
                              style={{ padding: '6px 2px', fontSize: '10px', width: '32px', textAlign: 'center' }}
                              title="Buffer before"
                            />
                            <span style={{ color: 'var(--muted)', fontSize: '9px' }}>→</span>
                            <input
                              type="number"
                              min="0"
                              value={c.bufferEndMinutes}
                              onChange={(e) => updateCandidate(i, 'bufferEndMinutes', parseInt(e.target.value) || 0)}
                              className="form-input"
                              style={{ padding: '6px 2px', fontSize: '10px', width: '32px', textAlign: 'center' }}
                              title="Buffer after"
                            />
                          </div>
                        </td>
                          <td style={{ padding: '8px', textAlign: 'center' }}>
                          <label style={{ 
                            display: 'inline-flex', 
                            alignItems: 'center', 
                            gap: '4px', 
                            cursor: 'pointer', 
                            fontSize: '10px', 
                            color: 'var(--primary)',
                            fontWeight: 500,
                            padding: '4px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--primary)',
                            background: 'rgba(99, 102, 241, 0.05)'
                          }}>
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.txt"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = () => {
                                  const base64 = reader.result as string;
                                  updateCandidate(i, 'resumeBase64', base64.split(',')[1]);
                                  updateCandidate(i, 'fileName', file.name);
                                };
                                reader.readAsDataURL(file);
                              }}
                              style={{ display: 'none' }}
                            />
                            {c.fileName ? (
                              <span style={{ color: 'var(--green)' }} title={c.fileName}>✓ Uploaded</span>
                            ) : (
                              '📄 Upload'
                            )}
                          </label>
                        </td>
                        <td style={{ padding: '8px', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, candidates: formData.candidates.filter((_, idx) => idx !== i) })}
                            style={{ background: 'rgba(239, 68, 68, 0.1)', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: '12px', padding: '4px 8px', borderRadius: '4px' }}
                            title="Remove candidate"
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
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)', fontSize: '13px', border: '1px dashed var(--border)', borderRadius: '8px', background: 'var(--surface)' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>👥</div>
                No candidates added yet.<br />
                Click "+ Add Candidate" or "Bulk Upload" to add candidates.
              </div>
            )}
          </div>

          <div className="form-actions" style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
            <button type="button" onClick={onClose} className="btn btn-outline">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={formData.candidates.length === 0} style={{ padding: '12px 24px', fontSize: '14px' }}>
              🎙️ Create Link with {formData.candidates.length} Candidate{formData.candidates.length !== 1 ? 's' : ''}
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

function RescheduleCandidateModal({
  candidate,
  onClose,
  onReschedule,
}: {
  candidate: CandidateInfo;
  onClose: () => void;
  onReschedule: (data: {
    startTime: string;
    endTime: string;
    bufferStartMinutes: number;
    bufferEndMinutes: number;
  }) => void;
}) {
  const formatDateLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [formData, setFormData] = useState({
    startTime: candidate.startTime ? formatDateLocal(new Date(candidate.startTime)) : formatDateLocal(new Date()),
    endTime: candidate.endTime ? formatDateLocal(new Date(candidate.endTime)) : formatDateLocal(new Date(Date.now() + 60 * 60 * 1000)),
    bufferStartMinutes: candidate.bufferStartMinutes ?? 0,
    bufferEndMinutes: candidate.bufferEndMinutes ?? 0,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onReschedule(formData);
  };

  return (
    <ModalPortal onClose={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 className="modal-title" style={{ margin: 0 }}>Reschedule Interview</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--surface)', borderRadius: '8px', fontSize: '13px' }}>
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>{candidate.candidateName || 'Unknown'}</div>
          <div style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: '12px' }}>{candidate.email}</div>
          {candidate.rescheduleCount !== undefined && candidate.rescheduleCount > 0 && (
            <div style={{ marginTop: '6px', fontSize: '11px', color: 'var(--yellow)' }}>
              Previous reschedules: {candidate.rescheduleCount}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">New Start Time</label>
            <input
              type="datetime-local"
              required
              value={formData.startTime}
              onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">New End Time</label>
            <input
              type="datetime-local"
              required
              value={formData.endTime}
              onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Buffer Before (min)</label>
              <input
                type="number"
                min="0"
                value={formData.bufferStartMinutes}
                onChange={(e) => setFormData({ ...formData, bufferStartMinutes: parseInt(e.target.value) || 0 })}
                className="form-input"
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Buffer After (min)</label>
              <input
                type="number"
                min="0"
                value={formData.bufferEndMinutes}
                onChange={(e) => setFormData({ ...formData, bufferEndMinutes: parseInt(e.target.value) || 0 })}
                className="form-input"
                placeholder="0"
              />
            </div>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', gap: '12px' }}>
            <button type="button" onClick={onClose} className="btn btn-outline" style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
              Reschedule
            </button>
          </div>
        </form>
      </div>
    </ModalPortal>
  );
}
