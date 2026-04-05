import { useState, useEffect, useRef } from 'react';
import interviewAIService from '../../services/interviewAIService';
import './Interviews.css';

interface InterviewSession {
  sessionId: string;
  interviewId: string;
  candidateId: string;
  candidateName: string;
  candidateSummary: string;
  interviewName: string;
  welcomeMessage: string;
  welcomeAudioBase64?: string;
  questions: InterviewQuestion[];
  currentQuestionIndex: number;
  conversationHistory: ConversationTurn[];
  createdAt: string;
  expiresAt: string;
}

interface InterviewQuestion {
  questionNumber: number;
  text: string;
  audioBase64?: string;
  category: string;
  difficulty: string;
  isFollowUp: boolean;
  followUpReason?: string;
  isCompleted: boolean;
  askedAt: string;
}

interface ConversationTurn {
  role: 'interviewer' | 'candidate';
  content: string;
  audioBase64?: string;
  timestamp: string;
}

interface AIInterviewProps {
  sessionId: string;
  onComplete: () => void;
  onError: (error: string) => void;
}

export default function AIInterview({ sessionId, onComplete, onError }: AIInterviewProps) {
  const [session, setSession] = useState<InterviewSession | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<InterviewQuestion | null>(null);
  const [conversation, setConversation] = useState<ConversationTurn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [answer, setAnswer] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    try {
      setIsLoading(true);
      const sessionData = await interviewAIService.getSession(sessionId);
      setSession(sessionData);
      setConversation(sessionData.conversationHistory || []);
      
      // Get welcome message
      const welcome = await interviewAIService.getWelcomeMessage(sessionId);
      setCurrentQuestion(welcome);
      
      // Play welcome message audio
      if (welcome.audioBase64) {
        playAudio(welcome.audioBase64);
      }
    } catch (err: any) {
      onError(err.response?.data?.message || 'Failed to load interview session');
    } finally {
      setIsLoading(false);
    }
  };

  const playAudio = (base64Audio: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
    audioRef.current = audio;
    
    audio.onplay = () => setIsPlaying(true);
    audio.onended = () => {
      setIsPlaying(false);
      setIsRecording(true);
    };
    audio.onerror = () => {
      setIsPlaying(false);
      setShowTextInput(true);
    };
    
    audio.play().catch(() => {
      setShowTextInput(true);
    });
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(',')[1];
          await sendAnswer(base64);
        };
        reader.readAsDataURL(blob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setShowTextInput(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendAnswer = async (audioBase64?: string) => {
    try {
      setIsLoading(true);
      
      // Add candidate answer to conversation
      const candidateContent = showTextInput ? answer : '(Voice response recorded)';
      setConversation(prev => [...prev, {
        role: 'candidate',
        content: candidateContent,
        audioBase64: audioBase64,
        timestamp: new Date().toISOString()
      }]);
      
      setAnswer('');

      // Get next question
      const nextQuestion = await interviewAIService.getNextQuestion(sessionId, {
        lastAnswer: candidateContent,
        audioData: audioBase64
      });

      setCurrentQuestion(nextQuestion);
      
      // Add question to conversation
      setConversation(prev => [...prev, {
        role: 'interviewer',
        content: nextQuestion.text,
        audioBase64: nextQuestion.audioBase64,
        timestamp: new Date().toISOString()
      }]);

      if (nextQuestion.isCompleted) {
        onComplete();
        return;
      }

      // Play question audio
      if (nextQuestion.audioBase64) {
        playAudio(nextQuestion.audioBase64);
      } else {
        setShowTextInput(true);
        setIsRecording(false);
      }
    } catch (err: any) {
      onError(err.response?.data?.message || 'Failed to get next question');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answer.trim()) {
      sendAnswer();
    }
  };

  if (isLoading && !currentQuestion) {
    return (
      <div className="ai-interview-loading">
        <div className="loading-spinner"></div>
        <p>Loading interview session...</p>
      </div>
    );
  }

  return (
    <div className="ai-interview-container">
      <div className="ai-interview-header">
        <h2>AI Interview</h2>
        <span className="interview-name">{session?.interviewName}</span>
      </div>

      <div className="conversation-container">
        {conversation.map((turn, index) => (
          <div key={index} className={`conversation-turn ${turn.role}`}>
            <div className="turn-badge">
              {turn.role === 'interviewer' ? '🎙️ AI Interviewer' : '👤 You'}
            </div>
            <div className="turn-content">
              <p>{turn.content}</p>
              {turn.audioBase64 && (
                <button 
                  className="play-audio-btn"
                  onClick={() => playAudio(turn.audioBase64!)}
                >
                  🔊 Play Audio
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {currentQuestion && !currentQuestion.isCompleted && (
        <div className="current-question">
          <div className="question-label">
            Question #{currentQuestion.questionNumber}
            {currentQuestion.isFollowUp && <span className="follow-up-badge">Follow-up</span>}
          </div>
          <p className="question-text">{currentQuestion.text}</p>
        </div>
      )}

      <div className="input-section">
        {showTextInput ? (
          <form onSubmit={handleTextSubmit} className="text-input-form">
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here..."
              rows={3}
            />
            <div className="input-actions">
              <button 
                type="button" 
                className="btn btn-outline"
                onClick={() => {
                  setShowTextInput(false);
                  startRecording();
                }}
              >
                🎤 Use Voice
              </button>
              <button 
                type="submit" 
                className="btn btn-primary"
                disabled={!answer.trim() || isLoading}
              >
                {isLoading ? 'Sending...' : 'Submit Answer'}
              </button>
            </div>
          </form>
        ) : (
          <div className="voice-input">
            <button 
              className={`record-btn ${isRecording ? 'recording' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
            >
              {isRecording ? '⏹️ Stop' : '🎤 Start Recording'}
            </button>
            <button 
              className="btn btn-outline"
              onClick={() => setShowTextInput(true)}
            >
              ✏️ Type Instead
            </button>
          </div>
        )}
      </div>

      {isPlaying && (
        <div className="audio-playing-indicator">
          🔊 Playing response...
        </div>
      )}

      <audio ref={audioRef} />
    </div>
  );
}
