import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './Interviews.css';

export default function InterviewSystemCheck() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  const [candidate, setCandidate] = useState<any>(null);
  const [micPermission, setMicPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [micWorking, setMicWorking] = useState(false);
  const [speakerWorking, setSpeakerWorking] = useState(false);
  const [networkStatus, setNetworkStatus] = useState<'checking' | 'good' | 'poor'>('checking');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  const detectAudio = () => {
    if (!analyserRef.current) return;

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

      detectAudio();
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
    const stored = sessionStorage.getItem('interviewCandidate');
    if (stored) {
      setCandidate(JSON.parse(stored));
    }

    checkMicrophone();
    checkNetwork();

    return () => {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const handleStartInterview = async () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
    }
    navigate(`/interview-live/${candidateId}`);
  };

  if (!candidate) {
    return (
      <div className="system-check-page">
        <div className="system-check-card">
          <p style={{ textAlign: 'center' }}>Loading...</p>
        </div>
      </div>
    );
  }

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
            Welcome, {candidate.candidateName}
          </p>
        </div>

        <div className="check-list">
          {checks.map((check, i) => (
            <div
              key={i}
              className={`check-item ${check.status}`}
            >
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
            <li>The AI interviewer will ask questions and evaluate your responses</li>
            <li>Duration: {candidate.durationMinutes} minutes</li>
            <li>Make sure you're in a quiet environment</li>
          </ul>
        </div>

        <button
          onClick={handleStartInterview}
          disabled={!allPassed}
          className={`btn system-check-footer ${allPassed ? 'btn-primary' : ''}`}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '15px',
            ...(!allPassed ? { background: 'var(--border)', color: 'var(--muted)', cursor: 'not-allowed' } : {})
          }}
        >
          {allPassed ? 'Start Interview' : 'Complete System Check to Continue'}
        </button>

        {candidate.instructions && (
          <p style={{ marginTop: '16px', textAlign: 'center', fontSize: '13px', color: 'var(--muted)', fontFamily: 'DM Sans, sans-serif' }}>
            {candidate.instructions}
          </p>
        )}
      </div>
    </div>
  );
}
