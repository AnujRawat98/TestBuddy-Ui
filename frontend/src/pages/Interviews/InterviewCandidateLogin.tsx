import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './Interviews.css';

export default function InterviewCandidateLogin() {
  const { linkId, token } = useParams<{ linkId: string; token: string }>();
  const navigate = useNavigate();
  const [mounted, setMounted] = useState(false);
  const [accessCode, setAccessCode] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoLoggingIn, setAutoLoggingIn] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    if (token) {
      loginWithToken(token);
    }
  }, [token]);

  const loginWithToken = async (candidateToken: string) => {
    setError('');
    setAutoLoggingIn(true);
    setLoading(true);

    try {
      const res = await api.post('/interview-candidates/login-by-token', {
        token: candidateToken,
      });
      
      sessionStorage.setItem('interviewCandidate', JSON.stringify(res.data));
      sessionStorage.setItem('interviewLinkId', res.data.linkId);
      
      navigate(`/interview-system-check/${res.data.candidateId}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid interview link');
      setAutoLoggingIn(false);
    } finally {
      setLoading(false);
    }
  };

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

  if (autoLoggingIn) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <div className="login-icon">🎙️</div>
            <h1 className="login-title">AI Interview</h1>
            <p className="login-subtitle">
              {loading ? 'Verifying your link...' : error || 'Please wait...'}
            </p>
          </div>
          
          {loading && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ 
                width: '40px', 
                height: '40px', 
                margin: '0 auto', 
                border: '3px solid #e0e0e0', 
                borderTop: '3px solid var(--accent)', 
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }} />
            </div>
          )}
          
          {error && (
            <div className="login-error" style={{ textAlign: 'center' }}>
              {error}
            </div>
          )}
        </div>
      </div>
    );
  }

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
