import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import api from '../../services/api';
import './Interviews.css';

interface TranscriptEntry {
  speaker: 'assistant' | 'candidate';
  text: string;
  timestamp: Date;
}

export default function InterviewLive() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interviewState, setInterviewState] = useState<'ready' | 'thinking' | 'listening' | 'speaking'>('ready');
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioQueueRef = useRef<{ data: string; mimeType: string }[]>([]);
  const isPlayingRef = useRef(false);
  const currentGenerationRef = useRef(0);

  useEffect(() => {
    initInterview();
    
    return () => {
      if (connection) {
        connection.stop();
      }
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(t => t.stop());
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const playNextAudioChunk = useCallback(() => {
    if (audioQueueRef.current.length === 0 || isPlayingRef.current) {
      isPlayingRef.current = false;
      return;
    }

    isPlayingRef.current = true;
    const chunk = audioQueueRef.current.shift()!;
    
    const binaryString = atob(chunk.data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: chunk.mimeType });
    const url = URL.createObjectURL(blob);
    
    const audio = new Audio(url);
    audio.onended = () => {
      URL.revokeObjectURL(url);
      isPlayingRef.current = false;
      playNextAudioChunk();
    };
    audio.play().catch(console.error);
  }, []);

  const initInterview = async () => {
    try {
      const candidateData = sessionStorage.getItem('interviewCandidate');
      if (!candidateData) {
        navigate('/');
        return;
      }

      const candidate = JSON.parse(candidateData);
      
      const startRes = await api.post(`/interview-candidates/${candidateId}/start`);
      const { sessionId: newSessionId } = startRes.data;
      setSessionId(newSessionId);

      const conn = new signalR.HubConnectionBuilder()
        .withUrl('/hubs/interview')
        .withAutomaticReconnect()
        .build();

      conn.on('session_ready', () => {
        setIsConnected(true);
        conn.invoke('StartSession', {
          sessionId: newSessionId,
          candidateInfo: {
            name: candidate.candidateName,
            email: candidate.email,
            position: '',
          },
        });
      });

      conn.on('session_started', (data: any) => {
        addTranscript('assistant', data.message || 'Interview session started. Let\'s begin!');
      });

      conn.on('transcript', (data: any) => {
        addTranscript(data.speaker, data.text);
      });

      conn.on('state', (data: any) => {
        setInterviewState(data.mode === 'thinking' ? 'thinking' : 
                        data.mode === 'listening' ? 'listening' : 'ready');
      });

      conn.on('assistant_audio_start', (data: any) => {
        currentGenerationRef.current = data.generation;
        setInterviewState('speaking');
      });

      conn.on('audio_chunk', (data: any) => {
        audioQueueRef.current.push({
          data: data.base64Audio,
          mimeType: data.mimeType,
        });
        playNextAudioChunk();
      });

      conn.on('assistant_audio_end', () => {
        setInterviewState('listening');
        resetSilenceTimer();
      });

      conn.on('assistant_interrupted', () => {
        setInterviewState('listening');
      });

      conn.on('error', (data: any) => {
        setError(data.message);
      });

      await conn.start();
      setConnection(conn);

      conn.invoke('JoinSession', newSessionId, candidateId);

      await initMicrophone();

    } catch (err: any) {
      setError(err.message || 'Failed to initialize interview');
    }
  };

  const addTranscript = (speaker: 'assistant' | 'candidate', text: string) => {
    setTranscripts(prev => [...prev, {
      speaker,
      text,
      timestamp: new Date(),
    }]);
  };

  const initMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      mediaRecorder.ondataavailable = async (e) => {
        if (e.data.size > 0) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            if (connection && sessionId && !isMuted) {
              connection.invoke('SendAudioChunk', sessionId, {
                base64Audio: base64,
                mimeType: 'audio/webm;codecs=opus',
              }).catch(console.error);
            }
          };
          reader.readAsDataURL(e.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000);

      setupVoiceDetection(stream);

    } catch (err) {
      console.error('Failed to initialize microphone', err);
    }
  };

  const setupVoiceDetection = (stream: MediaStream) => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const detect = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      
      const wasSpeaking = isSpeaking;
      const nowSpeaking = average > 30 && !isMuted;
      
      if (nowSpeaking && !wasSpeaking && connection && sessionId) {
        setIsSpeaking(true);
        setInterviewState('listening');
        connection.invoke('SendSpeechStart', sessionId, { confidence: average / 255 }).catch(console.error);
        clearTimeout(silenceTimerRef.current!);
      } else if (!nowSpeaking && wasSpeaking && connection && sessionId) {
        setIsSpeaking(false);
        setInterviewState('ready');
        connection.invoke('SendSpeechEnd', sessionId).catch(console.error);
        resetSilenceTimer();
      }
      
      requestAnimationFrame(detect);
    };
    
    detect();
  };

  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
    
    silenceTimerRef.current = setTimeout(() => {
      if (connection && sessionId) {
        connection.invoke('SendSilenceTimeout', sessionId).catch(console.error);
      }
    }, 30000);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => {
        t.enabled = isMuted;
      });
    }
  };

  const handleEndInterview = async () => {
    if (connection && sessionId) {
      try {
        await connection.invoke('EndSession', sessionId);
        await api.post(`/interview-candidates/${candidateId}/end`, {}, {
          params: { sessionId },
        });
      } catch (err) {
        console.error('Error ending interview', err);
      }
      
      await connection.stop();
      navigate('/interview-complete');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="live-interview-page">
      <header className="live-interview-header">
        <div>
          <h1 className="live-interview-title">AI Interview</h1>
          <p className="live-interview-subtitle">Live Session</p>
        </div>
        <div className="live-interview-status">
          <span className="live-interview-timer">{formatTime(elapsedTime)}</span>
          <div className={`live-connection-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <span className="live-connection-text">{isConnected ? 'Connected' : 'Connecting...'}</span>
        </div>
      </header>

      <main className="live-interview-main">
        <div className="live-transcript-card">
          <h2 className="live-transcript-title">Conversation</h2>
          <div className="live-transcript-list">
            {transcripts.map((t, i) => (
              <div
                key={i}
                className={`live-transcript-entry ${t.speaker === 'assistant' ? 'assistant' : 'candidate'}`}
              >
                <div className="live-transcript-bubble">
                  <div className="live-transcript-speaker">
                    {t.speaker === 'assistant' ? 'AI Interviewer' : 'You'}
                  </div>
                  <p>{t.text}</p>
                </div>
              </div>
            ))}
            {transcripts.length === 0 && (
              <p className="live-transcript-empty">Interview is starting...</p>
            )}
          </div>
        </div>

        <div className="live-controls-card">
          <div className="live-avatar-container">
            <div className={`live-avatar ${isSpeaking ? 'speaking' : isMuted ? 'muted' : interviewState === 'speaking' ? 'ai-speaking' : 'idle'}`}>
              {isMuted ? (
                <span className="live-avatar-icon">🔇</span>
              ) : isSpeaking ? (
                <span className="live-avatar-icon">🎙️</span>
              ) : (
                <span className="live-avatar-icon">🟢</span>
              )}
            </div>
          </div>

          <div className="live-buttons">
            <button
              onClick={toggleMute}
              className={`live-btn ${isMuted ? 'live-btn-muted' : 'live-btn-mic'}`}
            >
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
            <button
              onClick={handleEndInterview}
              className="live-btn live-btn-end"
            >
              End Interview
            </button>
          </div>

          <p className="live-status-text">
            {isMuted
              ? 'Microphone is muted'
              : isSpeaking
              ? 'Listening...'
              : 'Speak when ready'}
          </p>
        </div>
      </main>

      {error && (
        <div className="live-error-overlay">
          <div className="live-error-card">
            <h3 className="live-error-title">Error</h3>
            <p className="live-error-message">{error}</p>
            <button
              onClick={() => setError(null)}
              className="live-btn live-btn-mic"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
