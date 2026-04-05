import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as signalR from '@microsoft/signalr';
import api from '../../services/api';
import './Interviews.css';

export default function InterviewLive() {
  const { candidateId } = useParams<{ candidateId: string }>();
  const navigate = useNavigate();
  
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [interviewState, setInterviewState] = useState<'ready' | 'thinking' | 'listening' | 'speaking'>('ready');
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const muteGainRef = useRef<GainNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackContextRef = useRef<AudioContext | null>(null);
  const playbackTimeRef = useRef(0);
  const playbackFinishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const assistantPlaybackUntilRef = useRef(0);
  const currentGenerationRef = useRef(0);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const isMutedRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const candidateTurnActiveRef = useRef(false);
  const lastCandidateTurnEndedAtRef = useRef(0);
  const speechActivationStartedAtRef = useRef(0);
  const noiseFloorRef = useRef(0.008);
  const trailingSilenceUntilRef = useRef(0);
  const interviewStateRef = useRef<'ready' | 'thinking' | 'listening' | 'speaking'>('ready');
  const initStartedRef = useRef(false);
  const initAbortRef = useRef<AbortController | null>(null);
  const outgoingAudioChunkCountRef = useRef(0);
  const incomingAudioChunkCountRef = useRef(0);

  const debugLog = useCallback((message: string, data?: unknown) => {
    if (data === undefined) {
      console.log(`[InterviewLive] ${message}`);
      return;
    }

    console.log(`[InterviewLive] ${message}`, data);
  }, []);

  const invokeIfConnected = useCallback(
    (conn: signalR.HubConnection, methodName: string, ...args: unknown[]) => {
      if (!canInvoke(conn, sessionIdRef.current)) {
        return;
      }

      conn.invoke(methodName, ...args).catch((error) => {
        console.error(`[InterviewLive] Failed to invoke ${methodName}`, error);
      });
    },
    []
  );

  const stopMicrophone = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    processorRef.current?.disconnect();
    processorRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    muteGainRef.current?.disconnect();
    muteGainRef.current = null;

    if (audioContextRef.current) {
      void audioContextRef.current.close();
      audioContextRef.current = null;
    }

    isSpeakingRef.current = false;
    candidateTurnActiveRef.current = false;
    speechActivationStartedAtRef.current = 0;
    trailingSilenceUntilRef.current = 0;
    setIsSpeaking(false);
  };

  const stopPlayback = () => {
    if (playbackFinishTimeoutRef.current) {
      clearTimeout(playbackFinishTimeoutRef.current);
      playbackFinishTimeoutRef.current = null;
    }

    if (playbackContextRef.current) {
      void playbackContextRef.current.close();
      playbackContextRef.current = null;
    }
    playbackTimeRef.current = 0;
    assistantPlaybackUntilRef.current = 0;
  };

  const canInvoke = (conn: signalR.HubConnection, activeSessionId?: string | null) =>
    conn.state === signalR.HubConnectionState.Connected &&
    connectionRef.current === conn &&
    !!activeSessionId;

  const pcmToAudioBuffer = (bytes: Uint8Array, mimeType: string, audioContext: AudioContext) => {
    const rateMatch = mimeType.match(/rate=(\d+)/i);
    const sampleRate = rateMatch ? Number.parseInt(rateMatch[1], 10) : 24000;
    const sampleCount = Math.floor(bytes.byteLength / 2);
    const audioBuffer = audioContext.createBuffer(1, sampleCount, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    for (let i = 0; i < sampleCount; i++) {
      channelData[i] = view.getInt16(i * 2, true) / 0x8000;
    }

    return audioBuffer;
  };

  const downsampleBuffer = (buffer: Float32Array, inputSampleRate: number, outputSampleRate: number) => {
    if (outputSampleRate >= inputSampleRate) {
      return buffer;
    }

    const ratio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(buffer.length / ratio);
    const result = new Float32Array(newLength);
    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * ratio);
      let accum = 0;
      let count = 0;

      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }

      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }

    return result;
  };

  const floatTo16BitPCM = (buffer: Float32Array) => {
    const output = new ArrayBuffer(buffer.length * 2);
    const view = new DataView(output);

    for (let i = 0; i < buffer.length; i++) {
      const sample = Math.max(-1, Math.min(1, buffer[i]));
      view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }

    return output;
  };

  const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';

    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return btoa(binary);
  };

  const queueAssistantAudio = useCallback((base64Audio: string, mimeType: string) => {
    if (!mimeType.startsWith('audio/pcm')) {
      return;
    }

    const playbackContext = playbackContextRef.current ?? new AudioContext();
    playbackContextRef.current = playbackContext;
    if (playbackContext.state === 'suspended') {
      void playbackContext.resume();
    }

    const playbackLeadTime = 0.12;
    if (playbackTimeRef.current < playbackContext.currentTime + playbackLeadTime) {
      playbackTimeRef.current = playbackContext.currentTime + playbackLeadTime;
    }

    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const audioBuffer = pcmToAudioBuffer(bytes, mimeType, playbackContext);
    const source = playbackContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(playbackContext.destination);
    source.start(playbackTimeRef.current);
    playbackTimeRef.current += audioBuffer.duration;
    assistantPlaybackUntilRef.current = playbackTimeRef.current;
  }, []);

  const isAssistantPlaybackActive = useCallback(() => {
    const playbackContext = playbackContextRef.current;
    if (!playbackContext) {
      return false;
    }

    return playbackContext.currentTime < assistantPlaybackUntilRef.current;
  }, []);

  const resumeListeningAfterPlayback = useCallback(() => {
    if (playbackFinishTimeoutRef.current) {
      clearTimeout(playbackFinishTimeoutRef.current);
      playbackFinishTimeoutRef.current = null;
    }

    const playbackContext = playbackContextRef.current;
    const remainingMs = playbackContext
      ? Math.max(assistantPlaybackUntilRef.current - playbackContext.currentTime, 0) * 1000
      : 0;
    const cooldownMs = 90;
    const totalDelayMs = Math.ceil(remainingMs + cooldownMs);

    debugLog('Scheduling listening resume after assistant playback', {
      remainingMs: Math.round(remainingMs),
      cooldownMs,
      totalDelayMs,
      currentGeneration: currentGenerationRef.current,
    });

    playbackFinishTimeoutRef.current = setTimeout(() => {
      debugLog('Assistant playback drained, resuming candidate listening', {
        generation: currentGenerationRef.current,
      });
      playbackFinishTimeoutRef.current = null;
      assistantPlaybackUntilRef.current = 0;
      playbackTimeRef.current = 0;
      interviewStateRef.current = 'listening';
      setInterviewState('listening');
    }, totalDelayMs);
  }, [debugLog]);

  const getStatusText = () => {
    if (!isConnected) return 'Connecting to interview';
    if (error) return 'Connection issue detected';
    if (isMuted) return 'Microphone muted';
    if (interviewState === 'speaking') return 'AI is speaking';
    if (isSpeaking) return 'Listening to you';
    if (interviewState === 'thinking') return 'AI is thinking';
    return 'Speak when you are ready';
  };

  const formatStateLabel = () => {
    if (!isConnected) return 'Offline';
    if (interviewState === 'speaking') return 'AI Speaking';
    if (isSpeaking || interviewState === 'listening') return 'Listening';
    if (interviewState === 'thinking') return 'Thinking';
    return 'Ready';
  };

  const formatStateHint = () => {
    if (!isConnected) return 'Reconnecting to the live session';
    if (interviewState === 'speaking') return 'Please wait for the question to finish';
    if (isSpeaking || interviewState === 'listening') return 'Your microphone is active';
    if (interviewState === 'thinking') return 'Preparing the next response';
    return 'Natural voice interview in progress';
  };
  

  const initInterview = async (signal: AbortSignal) => {
    if (initStartedRef.current) {
      return;
    }

    initStartedRef.current = true;

    try {
      if (signal.aborted) {
        initStartedRef.current = false;
        return;
      }

      const candidateData = sessionStorage.getItem('interviewCandidate');
      if (!candidateData) {
        navigate('/');
        return;
      }

      const candidate = JSON.parse(candidateData);
      debugLog('Loaded interview candidate from sessionStorage', {
        routeCandidateId: candidateId,
        candidateId: candidate.candidateId,
        linkId: candidate.linkId || sessionStorage.getItem('interviewLinkId'),
        candidateName: candidate.candidateName,
        email: candidate.email,
        ijpId: candidate.ijpId,
      });
      
      const startRes = await api.post(`/interview-candidates/${candidateId}/start`);
      if (signal.aborted) {
        initStartedRef.current = false;
        return;
      }

      const { sessionId: newSessionId } = startRes.data;
      debugLog('Interview start API response received', startRes.data);
      setSessionId(newSessionId);
      sessionIdRef.current = newSessionId;
      sessionStorage.setItem('interviewSessionId', newSessionId);

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5022';
      
      const conn = new signalR.HubConnectionBuilder()
        .withUrl(`${API_BASE_URL}/hubs/interview`)
        .withAutomaticReconnect()
        .build();
      debugLog('Preparing SignalR connection', {
        hubUrl: `${API_BASE_URL}/hubs/interview`,
        sessionId: newSessionId,
      });

      conn.onclose((error) => {
        debugLog('Connection closed', error);
        setIsConnected(false);
        stopMicrophone();
      });

      conn.onreconnecting((error) => {
        debugLog('Reconnecting', error);
        setIsConnected(false);
        stopMicrophone();
      });

      conn.onreconnected((connectionId) => {
        debugLog('Reconnected', { connectionId });
        setIsConnected(true);
      });

      conn.on('error', (data: any) => {
        console.error('[InterviewLive] Error received:', data);
        setError(data.message);
      });

      conn.on('session_ready', () => {
        debugLog('session_ready received');
        setIsConnected(true);
      });

      conn.on('session_started', (data: any) => {
        debugLog('session_started received', data);
      });

      conn.on('state', (data: any) => {
        debugLog('state event received', data);
        const nextState = data.mode === 'thinking'
          ? 'thinking'
          : data.mode === 'listening'
          ? 'listening'
          : 'ready';
        interviewStateRef.current = nextState;
        setInterviewState(nextState);
      });

      conn.on('assistant_audio_start', (data: any) => {
        incomingAudioChunkCountRef.current = 0;
        debugLog('assistant_audio_start received', data);
        currentGenerationRef.current = data.generation;
        candidateTurnActiveRef.current = false;
        isSpeakingRef.current = false;
        speechActivationStartedAtRef.current = 0;
        trailingSilenceUntilRef.current = 0;
        setIsSpeaking(false);
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
        stopPlayback();
        interviewStateRef.current = 'speaking';
        setInterviewState('speaking');
      });

      conn.on('audio_chunk', (data: any) => {
        incomingAudioChunkCountRef.current += 1;
        if (incomingAudioChunkCountRef.current <= 3 || incomingAudioChunkCountRef.current % 20 === 0) {
          debugLog('audio_chunk received', {
            generation: data.generation,
            count: incomingAudioChunkCountRef.current,
            mimeType: data.mimeType,
            base64Length: data.base64Audio?.length,
          });
        }
        queueAssistantAudio(data.base64Audio, data.mimeType);
      });

      conn.on('assistant_audio_end', () => {
        debugLog('assistant_audio_end received', {
          generation: currentGenerationRef.current,
          totalChunks: incomingAudioChunkCountRef.current,
        });
        resumeListeningAfterPlayback();
      });

      conn.on('assistant_interrupted', () => {
        debugLog('assistant_interrupted received', {
          generation: currentGenerationRef.current,
          totalChunks: incomingAudioChunkCountRef.current,
        });
        stopPlayback();
        interviewStateRef.current = 'listening';
        setInterviewState('listening');
      });

      if (signal.aborted) {
        await conn.stop().catch(() => undefined);
        initStartedRef.current = false;
        return;
      }

      await conn.start();
      debugLog('SignalR connection started', { connectionId: conn.connectionId, sessionId: newSessionId });
      if (signal.aborted) {
        await conn.stop().catch(() => undefined);
        initStartedRef.current = false;
        return;
      }

      setConnection(conn);
      connectionRef.current = conn;

      await conn.invoke('JoinSession', newSessionId, candidateId);
      debugLog('JoinSession invoked', { sessionId: newSessionId, candidateId });
      if (signal.aborted) {
        await conn.stop().catch(() => undefined);
        initStartedRef.current = false;
        return;
      }

      await conn.invoke('StartSession', {
        sessionId: newSessionId,
        candidateInfo: {
          name: candidate.candidateName,
          email: candidate.email,
          position: '',
          ijpId: candidate.ijpId || '',
          candidateId: candidate.candidateId || candidateId,
          linkId: candidate.linkId || sessionStorage.getItem('interviewLinkId') || '',
        },
      });
      debugLog('StartSession invoked', {
        sessionId: newSessionId,
        candidateInfo: {
          name: candidate.candidateName,
          email: candidate.email,
          ijpId: candidate.ijpId || '',
          candidateId: candidate.candidateId || candidateId,
          linkId: candidate.linkId || sessionStorage.getItem('interviewLinkId') || '',
        },
      });
      if (signal.aborted) {
        await conn.stop().catch(() => undefined);
        initStartedRef.current = false;
        return;
      }
      
      setIsConnected(true);

      await initMicrophone(conn, newSessionId);

    } catch (err: any) {
      setError(err.message || 'Failed to initialize interview');
      initStartedRef.current = false;
    }
  };

  const initMicrophone = async (conn: signalR.HubConnection, activeSessionId: string) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      debugLog('Microphone access granted', {
        tracks: stream.getAudioTracks().map(t => ({
          label: t.label,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
        })),
      });
      micStreamRef.current = stream;
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 1024;
      analyserRef.current = analyser;

      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const muteGain = audioContext.createGain();
      muteGain.gain.value = 0;
      muteGainRef.current = muteGain;

      source.connect(analyser);
      source.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(audioContext.destination);

      const targetSampleRate = 16000;
      const baseSpeechStartThreshold = 0.028;
      const baseSpeechContinueThreshold = 0.016;
      const silenceDurationMs = 2200;
      const minSpeechActivationMs = 180;
      const rearmCooldownMs = 900;
      const trailingSilenceMs = 0;

      processor.onaudioprocess = (event) => {
        if (
          isMutedRef.current ||
          !canInvoke(conn, activeSessionId) ||
          interviewStateRef.current === 'speaking' ||
          isAssistantPlaybackActive()
        ) {
          return;
        }

        const inputData = event.inputBuffer.getChannelData(0);
        const rms = Math.sqrt(inputData.reduce((sum, value) => sum + value * value, 0) / inputData.length);
        const now = performance.now();

        if (!candidateTurnActiveRef.current) {
          noiseFloorRef.current = (noiseFloorRef.current * 0.92) + (rms * 0.08);
        }

        const dynamicSpeechStartThreshold = Math.max(baseSpeechStartThreshold, noiseFloorRef.current * 2.6);
        const dynamicSpeechContinueThreshold = Math.max(baseSpeechContinueThreshold, noiseFloorRef.current * 1.9);
        const rawSpeechDetected = candidateTurnActiveRef.current
          ? rms >= dynamicSpeechContinueThreshold
          : rms >= dynamicSpeechStartThreshold;

        const canRearm = now - lastCandidateTurnEndedAtRef.current >= rearmCooldownMs;

        if (rawSpeechDetected && canRearm) {
          if (!candidateTurnActiveRef.current) {
            if (!speechActivationStartedAtRef.current) {
              speechActivationStartedAtRef.current = now;
            }

            if (now - speechActivationStartedAtRef.current < minSpeechActivationMs) {
              return;
            }

            candidateTurnActiveRef.current = true;
            isSpeakingRef.current = true;
            setIsSpeaking(true);
            interviewStateRef.current = 'listening';
            setInterviewState('listening');
            debugLog('Candidate speech detected, starting turn', {
              rms: Number(rms.toFixed(4)),
              noiseFloor: Number(noiseFloorRef.current.toFixed(4)),
              threshold: Number(dynamicSpeechStartThreshold.toFixed(4)),
            });
            invokeIfConnected(conn, 'SendSpeechStart', activeSessionId, {
              confidence: Number(Math.min(rms * 10, 1).toFixed(3)),
            });
          }

          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else {
          speechActivationStartedAtRef.current = 0;
        }

        if (!rawSpeechDetected && candidateTurnActiveRef.current && !silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            silenceTimerRef.current = null;
            if (!candidateTurnActiveRef.current || !canInvoke(conn, activeSessionId) || isAssistantPlaybackActive()) {
              return;
            }

            candidateTurnActiveRef.current = false;
            isSpeakingRef.current = false;
            speechActivationStartedAtRef.current = 0;
            lastCandidateTurnEndedAtRef.current = performance.now();
            trailingSilenceUntilRef.current = trailingSilenceMs > 0 ? performance.now() + trailingSilenceMs : 0;
            setIsSpeaking(false);
            interviewStateRef.current = 'thinking';
            setInterviewState('thinking');
            debugLog('Candidate turn ended after silence', {
              silenceDurationMs,
              noiseFloor: Number(noiseFloorRef.current.toFixed(4)),
              trailingSilenceMs,
            });
            invokeIfConnected(conn, 'SendSpeechEnd', activeSessionId);
          }, silenceDurationMs);
        }

        const shouldSendTrailingSilence = !candidateTurnActiveRef.current && now < trailingSilenceUntilRef.current;
        if (!candidateTurnActiveRef.current && !shouldSendTrailingSilence) {
          return;
        }

        const downsampled = downsampleBuffer(inputData, audioContext.sampleRate, targetSampleRate);
        const pcmBuffer = shouldSendTrailingSilence
          ? new ArrayBuffer(downsampled.length * 2)
          : floatTo16BitPCM(downsampled);
        const base64Audio = arrayBufferToBase64(pcmBuffer);
        outgoingAudioChunkCountRef.current += 1;
        if (outgoingAudioChunkCountRef.current <= 3 || outgoingAudioChunkCountRef.current % 20 === 0) {
          debugLog('Sending PCM audio chunk', {
            count: outgoingAudioChunkCountRef.current,
            sampleRate: targetSampleRate,
            inputSampleRate: audioContext.sampleRate,
            pcmBytes: pcmBuffer.byteLength,
            rms: Number(rms.toFixed(4)),
            trailingSilence: shouldSendTrailingSilence,
          });
        }

        conn.invoke('SendAudioChunk', activeSessionId, {
          base64Audio,
          mimeType: `audio/pcm;rate=${targetSampleRate}`,
        }).catch(console.error);
      };

    } catch (err) {
      console.error('Failed to initialize microphone', err);
    }
  };

  const toggleMute = () => {
    const nextMuted = !isMuted;
    debugLog('Toggling microphone mute', { nextMuted });
    isMutedRef.current = nextMuted;
    setIsMuted(nextMuted);
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => {
        t.enabled = !nextMuted;
      });
    }
  };

  const handleEndInterview = async () => {
    if (connection && sessionId) {
      try {
        debugLog('Ending interview', { sessionId, candidateId });
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

  const getVisualStateClass = () => {
    if (!isConnected || error) return 'offline';
    if (isMuted) return 'muted';
    if (interviewState === 'speaking') return 'assistant';
    if (isSpeaking || interviewState === 'listening') return 'candidate';
    if (interviewState === 'thinking') return 'thinking';
    return 'idle';
  };

  useEffect(() => {
    const abortController = new AbortController();
    initAbortRef.current = abortController;
    debugLog('InterviewLive mounted, starting initialization', { candidateId });
    initInterview(abortController.signal);
    
    return () => {
      debugLog('InterviewLive cleanup', { candidateId });
      abortController.abort();
      initAbortRef.current = null;
      initStartedRef.current = false;
      stopMicrophone();
      stopPlayback();
      if (connectionRef.current) {
        connectionRef.current.stop();
        connectionRef.current = null;
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
      if (playbackFinishTimeoutRef.current) {
        clearTimeout(playbackFinishTimeoutRef.current);
        playbackFinishTimeoutRef.current = null;
      }
      isSpeakingRef.current = false;
      sessionIdRef.current = null;
    };
  }, [candidateId, navigate, isAssistantPlaybackActive, resumeListeningAfterPlayback]);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="live-interview-page">

      <main className="live-interview-main">
        <div className="live-controls-card">
          <div className="live-voice-headline">
            <p className="live-voice-eyebrow">AI Interviewer</p>
            <h1 className="live-voice-title">Voice Interview Session</h1>
            <p className="live-voice-subtitle">
              Smooth native-audio interview flow with a single live Gemini voice session.
            </p>
          </div>

          <div className="live-status-strip">
            <div className={`live-connection-dot ${isConnected ? 'connected' : 'disconnected'}`} />
            <span className="live-state-text">{formatStateLabel()}</span>
            <span className="live-status-separator" />
            <span className="live-interview-timer">{formatTime(elapsedTime)}</span>
          </div>

          <div className="live-ai-state-card">
            <div className={`live-ai-state-pill ${interviewState}`}>
              {formatStateLabel()}
            </div>
            <h2 className="live-ai-state-title">Interview In Progress</h2>
            <p className="live-ai-state-subtitle">{formatStateHint()}</p>
          </div>

          <div className="live-avatar-container">
            <div className={`live-glow live-glow-${getVisualStateClass()}`} />
            <div className={`live-avatar live-avatar-${getVisualStateClass()}`}>
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
              {isMuted ? 'Unmute Mic' : 'Mute Mic'}
            </button>
            <button
              onClick={handleEndInterview}
              className="live-btn live-btn-end"
            >
              End Interview
            </button>
          </div>

          <p className="live-status-text">
            {getStatusText()}
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
