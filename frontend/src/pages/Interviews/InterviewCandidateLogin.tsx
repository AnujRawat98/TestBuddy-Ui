import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './Interviews.css';

export default function InterviewCandidateLogin() {
  const { linkId } = useParams<{ linkId: string }>();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f4f0',
        fontFamily: 'DM Sans, sans-serif'
      }}>
        <div style={{ color: '#8a8a8a', fontSize: '14px' }}>Loading...</div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/interview-candidates/login', {
        accessCode,
        email,
      });
      
      sessionStorage.setItem('interviewCandidate', JSON.stringify(res.data));
      sessionStorage.setItem('interviewLinkId', linkId || '');
      
      navigate(`/interview-system-check/${res.data.candidateId}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid access code or email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">🎙️</div>
          <h1 className="login-title">AI Interview</h1>
          <p className="login-subtitle">Enter your credentials to begin</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">Access Code</label>
            <input
              type="text"
              required
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
              className="form-input"
              placeholder="e.g., ABC123"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
              placeholder="your.email@example.com"
            />
          </div>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary login-btn"
          >
            {loading ? 'Verifying...' : 'Continue'}
          </button>
        </form>

        <div className="login-footer">
          <p>Please ensure you're in a quiet environment with a working microphone.</p>
        </div>
      </div>
    </div>
  );
}
