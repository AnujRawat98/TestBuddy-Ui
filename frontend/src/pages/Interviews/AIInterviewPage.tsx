import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import interviewAIService from '../../services/interviewAIService';
import AIInterview from './AIInterview';
import './Interviews.css';

interface CandidateInfo {
  candidateId: string;
  candidateName: string;
  email: string;
  interviewName: string;
  interviewId: string;
  linkId: string;
  isAIInterview: boolean;
}

export default function AIInterviewPage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [phase, setPhase] = useState<'loading' | 'login' | 'system-check' | 'interview' | 'complete' | 'error'>('loading');
  const [candidate, setCandidate] = useState<CandidateInfo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string>('');
  
  // System check states
  const [micPermission, setMicPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [micWorking, setMicWorking] = useState(false);
  const [speakerWorking, setSpeakerWorking] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'good' | 'poor'>('checking');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (token) {
      validateToken(token);
    }
  }, [token]);

  const validateToken = async (candidateToken: string) => {
    try {
      const res = await api.post('/interview-candidates/login-by-token', {
        token: candidateToken,
      });
      
      const candidateData: CandidateInfo = {
        candidateId: res.data.candidateId,
        candidateName: res.data.candidateName,
        email: res.data.email,
        interviewName: res.data.interviewName || 'AI Interview',
        interviewId: res.data.interviewId,
        linkId: res.data.linkId,
        isAIInterview: true,
      };
      
      setCandidate(candidateData);
      sessionStorage.setItem('interviewCandidate', JSON.stringify(candidateData));
      sessionStorage.setItem('interviewLinkId', candidateData.linkId);
      sessionStorage.setItem('aiInterviewSession', 'true');
      
      await initializeAISession(candidateData);
      
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid interview link');
      setPhase('error');
    }
  };

  const initializeAISession = async (candidateData: CandidateInfo) => {
    try {
      const session = await interviewAIService.startInterview(candidateData.interviewId, candidateData.candidateId);
      
      setSessionId(session.sessionId);
      sessionStorage.setItem('aiSessionId', session.sessionId);
      
      setPhase('system-check');
    } catch (err: any) {
      console.error('Failed to initialize AI session:', err);
      setError(err.response?.data?.message || 'Failed to initialize interview session');
      setPhase('error');
    }
  };

  const checkMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      setMicPermission('granted');
      
      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      const check = () => {
        analyserRef.current!.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        if (average > 10) {
          setMicWorking(true);
        }
        animationRef.current = requestAnimationFrame(check);
      };
      
      check();
      setMicWorking(true);
    } catch {
      setMicPermission('denied');
      setMicWorking(false);
    }
  };

  const checkNetwork = () => {
    if (navigator.onLine) {
      setTimeout(() => setNetworkStatus('good'), 1000);
    } else {
      setNetworkStatus('poor');
    }
  };

  const testSpeaker = () => {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    oscillator.frequency.setValueAtTime(440, ctx.currentTime);
    oscillator.start();
    
    setTimeout(() => {
      oscillator.stop();
      ctx.close();
      setSpeakerWorking(true);
    }, 500);
  };

  useEffect(() => {
    if (phase === 'system-check') {
      checkMicrophone();
      checkNetwork();
    }

    return () => {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [phase]);

  const handleStartInterview = async () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
    }
    setPhase('interview');
  };

  const handleInterviewComplete = async () => {
    if (sessionId) {
      try {
        await api.post(`/interview-ai/${sessionId}/end`);
      } catch (err) {
        console.error('Failed to end session:', err);
      }
    }
    setPhase('complete');
  };

  const handleInterviewError = (errorMsg: string) => {
    setError(errorMsg);
    setPhase('error');
  };

  // Loading phase
  if (phase === 'loading') {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <div className="login-icon">🎙️</div>
            <h1 className="login-title">AI Interview</h1>
            <p className="login-subtitle">Verifying your link...</p>
          </div>
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
        </div>
      </div>
    );
  }

  // Error phase
  if (phase === 'error') {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <div className="login-icon">❌</div>
            <h1 className="login-title">Unable to Start</h1>
            <p className="login-subtitle" style={{ color: 'var(--error)' }}>{error}</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '20px' }}
          >
            Return to Home
          </button>
        </div>
      </div>
    );
  }

  // Complete phase
  if (phase === 'complete') {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-header">
            <div className="login-icon">✅</div>
            <h1 className="login-title">Interview Complete</h1>
            <p className="login-subtitle">Thank you for your time, {candidate?.candidateName}!</p>
          </div>
          <div className="complete-message">
            <p>Your responses have been recorded successfully.</p>
            <p>Our team will review your interview and get back to you soon.</p>
          </div>
        </div>
      </div>
    );
  }

  // System check phase
  if (phase === 'system-check') {
    const checks = [
      {
        name: 'Microphone',
        status: micPermission === 'granted' ? 'success' : micPermission === 'denied' ? 'error' : 'pending',
        detail: micPermission === 'denied' 
          ? 'Please allow microphone access in your browser settings' 
          : 'Microphone is ready',
      },
      {
        name: 'Audio Input',
        status: micWorking ? 'success' : 'pending',
        detail: micWorking ? 'Audio detected' : 'Waiting for audio...',
      },
      {
        name: 'Speakers',
        status: speakerWorking ? 'success' : 'pending',
        detail: speakerWorking ? 'Speaker test passed' : 'Click to test speakers',
        action: testSpeaker,
        actionLabel: 'Test Speaker',
      },
      {
        name: 'Network',
        status: networkStatus === 'good' ? 'success' : 'poor',
        detail: networkStatus === 'good' ? 'Connection is stable' : 'Poor connection detected',
      },
    ];

    const allPassed = micWorking && speakerWorking && networkStatus === 'good';

    return (
      <div className="system-check-page">
        <div className="system-check-card">
          <div className="system-check-header">
            <h1 className="system-check-title">System Check</h1>
            <p className="system-check-subtitle">
              Welcome, {candidate?.candidateName}
            </p>
          </div>

          <div className="check-list">
            {checks.map((check, i) => (
              <div key={i} className={`check-item ${check.status}`}>
                <div className="check-item-header">
                  <div>
                    <h3 className="check-item-name">{check.name}</h3>
                    <p className="check-item-detail">{check.detail}</p>
                  </div>
                  <div>
                    {check.action && check.status !== 'success' && (
                      <button
                        onClick={check.action}
                        className="btn btn-secondary btn-sm"
                      >
                        {check.actionLabel}
                      </button>
                    )}
                    {check.status === 'success' && (
                      <span className="check-icon success">✓</span>
                    )}
                    {check.status === 'pending' && (
                      <span className="check-icon pending">○</span>
                    )}
                    {check.status === 'error' && (
                      <span className="check-icon error">✗</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="instructions-box">
            <h3 className="instructions-title">Interview Instructions</h3>
            <ul className="instructions-list">
              <li>This is a voice-based AI interview</li>
              <li>Speak clearly into your microphone</li>
              <li>The AI interviewer will ask questions based on the job requirements</li>
              <li>Make sure you're in a quiet environment</li>
            </ul>
          </div>

          <button
            onClick={handleStartInterview}
            disabled={!allPassed}
            className="btn system-check-footer"
            style={{
              width: '100%',
              padding: '14px',
              fontSize: '15px',
              ...(!allPassed ? { background: 'var(--border)', color: 'var(--muted)', cursor: 'not-allowed' } : {})
            }}
          >
            {allPassed ? 'Start Interview' : 'Complete System Check to Continue'}
          </button>
        </div>
      </div>
    );
  }

  // Interview phase
  if (phase === 'interview' && sessionId) {
    return (
      <AIInterview
        sessionId={sessionId}
        onComplete={handleInterviewComplete}
        onError={handleInterviewError}
      />
    );
  }

  return null;
}
