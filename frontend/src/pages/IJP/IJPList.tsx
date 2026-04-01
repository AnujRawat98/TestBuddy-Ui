import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ijpApi } from '../../services/api';
import './IJP.css';

interface IJP {
  id: string;
  positionName: string;
  experienceRequired: string;
  closingDate: string;
  totalPositions: number;
  status: string;
  applicationsCount: number;
  interviewsCreated: number;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Active': return { bg: 'rgba(0,194,113,.12)', color: 'var(--green)' };
    case 'Closed': return { bg: 'rgba(224,59,59,.1)', color: 'var(--red)' };
    case 'Draft': return { bg: 'rgba(138,138,138,.1)', color: 'var(--muted)' };
    default: return { bg: 'rgba(138,138,138,.1)', color: 'var(--muted)' };
  }
};

const fmtDate = (s: string) => !s ? '—' : new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function IJPList() {
  const [ijps, setIjps] = useState<IJP[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchIJPs();
  }, []);

  const fetchIJPs = async () => {
    try {
      const res = await ijpApi.getAll();
      setIjps(res.data);
    } catch (err) {
      console.error('Failed to fetch IJPs', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this job posting?')) return;
    try {
      await ijpApi.delete(id);
      setToast('Job posting deleted!');
      fetchIJPs();
    } catch (err) {
      alert('Failed to delete');
    }
    setTimeout(() => setToast(null), 2000);
  };

  const handleClose = async (id: string) => {
    try {
      await ijpApi.close(id);
      setToast('Job posting closed!');
      fetchIJPs();
    } catch (err) {
      alert('Failed to close');
    }
    setTimeout(() => setToast(null), 2000);
  };

  if (loading) {
    return (
      <div className="ijp-page">
        <div className="empty-state">
          <div className="empty-icon">⏳</div>
          <div className="empty-title">Loading…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ijp-page">
      <div className="page-header">
        <h1 className="page-title">Internal Job Postings</h1>
        <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
          + Create Job Posting
        </button>
      </div>

      <div className="ijp-stats">
        <div className="ijp-stat-card stat-1">
          <div className="ijp-stat-icon">📋</div>
          <div className="ijp-stat-num">{ijps.length}</div>
          <div className="ijp-stat-label">Total Postings</div>
        </div>
        <div className="ijp-stat-card stat-2">
          <div className="ijp-stat-icon">✅</div>
          <div className="ijp-stat-num">{ijps.filter(i => i.status === 'Active').length}</div>
          <div className="ijp-stat-label">Active</div>
        </div>
        <div className="ijp-stat-card stat-3">
          <div className="ijp-stat-icon">👥</div>
          <div className="ijp-stat-num">{ijps.reduce((acc, i) => acc + i.applicationsCount, 0)}</div>
          <div className="ijp-stat-label">Applications</div>
        </div>
        <div className="ijp-stat-card stat-4">
          <div className="ijp-stat-icon">🎙️</div>
          <div className="ijp-stat-num">{ijps.reduce((acc, i) => acc + i.interviewsCreated, 0)}</div>
          <div className="ijp-stat-label">Interviews</div>
        </div>
      </div>

      {ijps.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <p className="empty-state-text">No job postings yet.</p>
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary">
            Create Your First Job Posting
          </button>
        </div>
      ) : (
        <div className="ijp-grid">
          {ijps.map((ijp, index) => {
            const statusStyle = getStatusColor(ijp.status);
            return (
              <div key={ijp.id} className="ijp-card" style={{ animationDelay: `${0.1 + index * 0.05}s` }}>
                <div className="ijp-card-header">
                  <div>
                    <h2 className="ijp-card-title">{ijp.positionName}</h2>
                    <div className="ijp-card-meta">
                      <span className="ijp-badge">{ijp.experienceRequired}</span>
                      <span className="ijp-badge">📍 {ijp.totalPositions} positions</span>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px', background: statusStyle.bg, color: statusStyle.color }}>
                        {ijp.status}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="ijp-card-body">
                  <div className="ijp-info-row">
                    <span className="ijp-info-label">📅 Closing Date</span>
                    <span className="ijp-info-value">{fmtDate(ijp.closingDate)}</span>
                  </div>
                  <div className="ijp-info-row">
                    <span className="ijp-info-label">👥 Applications</span>
                    <span className="ijp-info-value">{ijp.applicationsCount}</span>
                  </div>
                  <div className="ijp-info-row">
                    <span className="ijp-info-label">🎙️ Interviews Created</span>
                    <span className="ijp-info-value">{ijp.interviewsCreated}</span>
                  </div>
                </div>
                <div className="ijp-card-actions">
                  <button onClick={() => navigate(`/ijp/${ijp.id}`)} className="btn btn-primary btn-sm">
                    View Details
                  </button>
                  {ijp.status === 'Active' && (
                    <button onClick={() => handleClose(ijp.id)} className="btn btn-secondary btn-sm">
                      Close
                    </button>
                  )}
                  <button onClick={() => handleDelete(ijp.id)} className="btn btn-danger btn-sm">
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateIJPModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={async (data) => {
            try {
              const res = await ijpApi.create(data);
              setShowCreateModal(false);
              navigate(`/ijp/${res.data.id}`);
            } catch (err) {
              alert('Failed to create job posting');
            }
          }}
        />
      )}

      {toast && (
        <div className="toast">{toast}</div>
      )}
    </div>
  );
}

interface CreateModalProps {
  onClose: () => void;
  onSubmit: (data: {
    positionName: string;
    experienceRequired: string;
    jobDescription?: string;
    closingDate: string;
    totalPositions: number;
    jobDescriptionFileName?: string;
    jobDescriptionBase64?: string;
    companyPoliciesFileName?: string;
    companyPoliciesBase64?: string;
  }) => Promise<void>;
}

function CreateIJPModal({ onClose, onSubmit }: CreateModalProps) {
  const [form, setForm] = useState({
    positionName: '',
    experienceRequired: '',
    jobDescription: '',
    closingDate: '',
    totalPositions: 1,
    jobDescriptionFileName: '',
    jobDescriptionBase64: '',
    companyPoliciesFileName: '',
    companyPoliciesBase64: ''
  });
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'jd' | 'policy') => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      if (field === 'jd') {
        setForm({ ...form, jobDescriptionFileName: file.name, jobDescriptionBase64: base64 });
      } else {
        setForm({ ...form, companyPoliciesFileName: file.name, companyPoliciesBase64: base64 });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(form);
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: '600px' }}>
        <div className="modal-header">
          <h2 className="modal-title">Create Job Posting</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          <div className="form-group">
            <label className="form-label">Position Name *</label>
            <input
              type="text"
              className="form-input"
              value={form.positionName}
              onChange={(e) => setForm({ ...form, positionName: e.target.value })}
              placeholder="e.g., Senior Software Engineer"
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Experience Required</label>
            <input
              type="text"
              className="form-input"
              value={form.experienceRequired}
              onChange={(e) => setForm({ ...form, experienceRequired: e.target.value })}
              placeholder="e.g., 3-5 years"
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">Job Description - Upload File (PDF/DOCX/TXT)</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                📎 Upload JD File
                <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={(e) => handleFileUpload(e, 'jd')} style={{ display: 'none' }} />
              </label>
              {form.jobDescriptionFileName && (
                <span style={{ fontSize: '13px', color: 'var(--green)' }}>✅ {form.jobDescriptionFileName}</span>
              )}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Or Enter Job Description Manually</label>
            <textarea
              className="form-textarea"
              value={form.jobDescription}
              onChange={(e) => setForm({ ...form, jobDescription: e.target.value })}
              placeholder="Enter job description, requirements, responsibilities..."
              rows={4}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Company Policies - Upload File (PDF/DOCX)</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
                📋 Upload Policies
                <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => handleFileUpload(e, 'policy')} style={{ display: 'none' }} />
              </label>
              {form.companyPoliciesFileName && (
                <span style={{ fontSize: '13px', color: 'var(--green)' }}>✅ {form.companyPoliciesFileName}</span>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Closing Date *</label>
              <input
                type="date"
                className="form-input"
                value={form.closingDate}
                onChange={(e) => setForm({ ...form, closingDate: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Total Positions</label>
              <input
                type="number"
                className="form-input"
                value={form.totalPositions}
                onChange={(e) => setForm({ ...form, totalPositions: parseInt(e.target.value) || 1 })}
                min={1}
              />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Creating...' : 'Create Posting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
