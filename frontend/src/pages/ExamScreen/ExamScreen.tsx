import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import './ExamScreen.css';
import { assessmentsApi, proctoringApi } from '../../services/api';
import type { ProctoringConfig } from '../StudentEntry/StudentEntry';

// Access streams kept alive by StudentEntry (parent window) via window.opener
declare global {
    interface Window {
        __procCamStream?:    MediaStream | null;
        __procScreenStream?: MediaStream | null;
    }
}

interface Option { id: string; text: string; imageUrl?: string; }
interface Question { id: string; content?: string; text?: string; questionText?: string; questionType: string; marks?: number; difficulty?: string; topicName?: string; options: Option[]; durationMinutes?: number; totalDuration?: number; }
type QStatus = 'unanswered' | 'answered' | 'marked' | 'skipped';
interface QState { status: QStatus; answer: string | string[] | null; }
interface ExamResult { score?: number; totalMarks?: number; correct?: number; wrong?: number; unattempted?: number; passed?: boolean; percentage?: number; }

const isMCQ   = (qt: string) => /mcq|single|single.correct/i.test(qt);
const isMulti = (qt: string) => /multi|multiple.correct/i.test(qt);
const isText  = (qt: string) => /open|text|descriptive/i.test(qt);
const isImage = (qt: string) => /image|picture/i.test(qt);
const qText   = (q: Question) => q.content ?? q.text ?? q.questionText ?? '';

const loadProctoringConfig = (attemptId: string): ProctoringConfig | null => {
    try {
        const raw = localStorage.getItem(`proctoringConfig_${attemptId}`);
        if (!raw) return null;
        return JSON.parse(raw) as ProctoringConfig;
    } catch { return null; }
};

const ExamScreen: React.FC = () => {
    const { attemptId } = useParams<{ attemptId: string }>();

    const [questions,  setQuestions]  = useState<Question[]>([]);
    const [qState,     setQState]     = useState<QState[]>([]);
    const [currentQ,   setCurrentQ]   = useState(0);
    const [timeLeft,   setTimeLeft]   = useState(0);
    const [totalTime,  setTotalTime]  = useState(0);
    const [examTitle,  setExamTitle]  = useState('Assessment');
    const [loading,    setLoading]    = useState(true);
    const [loadError,  setLoadError]  = useState('');
    const [flags,      setFlags]      = useState(0);
    const [tabWarning, setTabWarning] = useState(false);
    const [warningMsg, setWarningMsg] = useState('');
    const [submitModal, setSubmitModal] = useState(false);
    const [resultOpen,  setResultOpen]  = useState(false);
    const [result,      setResult]      = useState<ExamResult | null>(null);
    const [savingId,    setSavingId]    = useState<string | null>(null);
    // FIX: single state for screen recording banner/active — removed needsScreenGesture and screenRecActive
    const [screenRecBanner, setScreenRecBanner] = useState(false);
    const [screenRecording, setScreenRecording] = useState(false); // true once recording started

    const [toast, setToast] = useState({ show: false, msg: '', type: 'info' });
    const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
        setToast({ show: true, msg, type });
        setTimeout(() => setToast(p => ({ ...p, show: false })), 3200);
    };

    // Proctoring refs
    const procConfigRef       = useRef<ProctoringConfig | null>(null);
    const sessionIdRef        = useRef<string | null>(null);
    const snapshotSeqRef      = useRef(0);
    const snapshotIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const webcamVideoRef      = useRef<HTMLVideoElement | null>(null);
    const webcamStreamRef     = useRef<MediaStream | null>(null);
    const mediaRecorderRef    = useRef<MediaRecorder | null>(null);
    const recordingChunksRef  = useRef<Blob[]>([]);
    const timerRef            = useRef<ReturnType<typeof setInterval> | null>(null);
    const submitRef           = useRef(false);

    // ── Fetch questions ───────────────────────────────────────────────────────
    useEffect(() => {
        if (!attemptId) return;
        (async () => {
            try {
                const res  = await assessmentsApi.getAttemptQuestions(attemptId);
                const data = res.data;
                let qs: Question[] = [], dur = 30, title = 'Assessment';
                if (Array.isArray(data)) {
                    qs = data; dur = data[0]?.durationMinutes ?? data[0]?.totalDuration ?? 30;
                } else if (data && typeof data === 'object') {
                    qs = data.questions ?? data.items ?? data.value ?? [];
                    dur = data.durationMinutes ?? data.totalDuration ?? data.duration ?? 30;
                    title = data.examTitle ?? data.title ?? data.assessmentTitle ?? 'Assessment';
                }
                const normalised: Question[] = qs.map((q: any) => ({
                    ...q,
                    id:           q.id           ?? q.Id           ?? q.questionId ?? '',
                    questionType: q.questionType ?? q.QuestionType ?? q.type        ?? 'MCQ',
                    content:      q.content      ?? q.text         ?? q.questionText ?? q.Content ?? '',
                    marks:        q.marks        ?? q.Marks        ?? q.marksPerQuestion ?? 1,
                    difficulty:   q.difficulty   ?? q.Difficulty   ?? q.level ?? '',
                    topicName:    q.topicName    ?? q.TopicName    ?? q.topic ?? '',
                    options: (q.options ?? q.Options ?? []).map((o: any) => ({
                        id: o.id ?? o.Id ?? o.optionId ?? '', text: o.text ?? o.Text ?? o.optionText ?? '', imageUrl: o.imageUrl ?? o.ImageUrl ?? null,
                    })),
                }));
                if (normalised.length === 0) { setLoadError('No questions found for this exam attempt.'); return; }
                setQuestions(normalised); setExamTitle(title);
                setQState(normalised.map(() => ({ status: 'unanswered', answer: null })));
                setTimeLeft(dur * 60); setTotalTime(dur * 60);
            } catch (err: any) {
                setLoadError(err?.response?.data?.message ?? err?.response?.data?.title ?? (typeof err?.response?.data === 'string' ? err.response.data : null) ?? 'Failed to load exam questions.');
            } finally { setLoading(false); }
        })();
    }, [attemptId]);

    // ── Start proctoring after questions load ─────────────────────────────────
    useEffect(() => {
        if (loading || !attemptId || questions.length === 0) return;
        const config = loadProctoringConfig(attemptId);
        procConfigRef.current = config;
        if (config) localStorage.removeItem(`proctoringConfig_${attemptId}`);
        if (!config) return;

        (async () => {
            try {
                const res = await proctoringApi.startSession({
                    attemptId,
                    assessmentLinkId:        config.assessmentLinkId,
                    webProctoringEnabled:    config.webProctoringEnabled,
                    imageProctoringEnabled:  config.imageProctoringEnabled,
                    screenRecordingEnabled:  config.screenRecordingEnabled  ?? false,
                    screenRecordingDuration: config.screenRecordingDuration ?? undefined,
                    screenRecordingQuality:  config.screenRecordingQuality  ?? 'Medium',
                });
                sessionIdRef.current = res.data?.sessionId ?? null;
                console.log('[Proctoring] Session started. sessionId:', sessionIdRef.current, 'imageProctoringEnabled:', config.imageProctoringEnabled, 'screenRecordingEnabled:', config.screenRecordingEnabled);

                if (config.imageProctoringEnabled && sessionIdRef.current) {
                    await startWebcam();
                    startSnapshotInterval();
                } else {
                    console.log('[Proctoring] Image proctoring OFF or sessionId null — skipping webcam');
                }

                // Screen recording: try to use the stream kept alive from StudentEntry.
                // If that stream is available, start recording immediately without a banner.
                // If not available (e.g. direct navigation), show the banner for user gesture.
                if (config.screenRecordingEnabled) {
                    const openerStream = window.opener?.__procScreenStream;
                    if (openerStream && openerStream.active && openerStream.getVideoTracks().length > 0) {
                        await startScreenRecording(); // uses opener stream, no gesture needed
                    } else {
                        setScreenRecBanner(true); // fallback: show banner for gesture
                    }
                }
            } catch (err) { console.warn('[Proctoring] session start failed:', err); }
        })();

        return () => { stopWebcam(); stopScreenRecording(); if (snapshotIntervalRef.current) clearInterval(snapshotIntervalRef.current); };
    }, [loading, questions.length, attemptId]);

    // ── Webcam ────────────────────────────────────────────────────────────────
    const startWebcam = async () => {
        try {
            const openerStream = window.opener?.__procCamStream;
            console.log('[Proctoring] opener cam stream:', openerStream, 'active:', openerStream?.active, 'tracks:', openerStream?.getVideoTracks().length);
            let stream: MediaStream;

            if (openerStream && openerStream.active && openerStream.getVideoTracks().length > 0) {
                stream = openerStream;
                if (window.opener) window.opener.__procCamStream = null;
                console.log('[Proctoring] ✓ Reusing camera stream from StudentEntry');
            } else {
                console.log('[Proctoring] Opener stream not available, requesting fresh getUserMedia...');
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                console.log('[Proctoring] ✓ Fresh camera stream opened');
            }

            webcamStreamRef.current = stream;
            console.log('[Proctoring] webcamStreamRef set, tracks:', stream.getVideoTracks().length);

            if (webcamVideoRef.current) {
                webcamVideoRef.current.srcObject = stream;
                await new Promise<void>(resolve => {
                    const v = webcamVideoRef.current!;
                    if (v.readyState >= 2) { resolve(); return; }
                    v.onloadeddata = () => resolve();
                    setTimeout(resolve, 3000);
                });
                console.log('[Proctoring] ✓ Webcam video element ready, readyState:', webcamVideoRef.current?.readyState);
            }
        } catch (err) { console.error('[Proctoring] ✗ webcam failed:', err); }
    };
    const stopWebcam = () => { webcamStreamRef.current?.getTracks().forEach(t => t.stop()); webcamStreamRef.current = null; };

    // ── Snapshots ─────────────────────────────────────────────────────────────
    const startSnapshotInterval = () => { captureSnapshot(); snapshotIntervalRef.current = setInterval(captureSnapshot, 45_000); };
    const captureSnapshot = async () => {
        console.log('[Snapshot] Attempting capture. sessionId:', !!sessionIdRef.current, 'attemptId:', !!attemptId, 'webcamStream:', !!webcamStreamRef.current);
        if (!sessionIdRef.current || !attemptId || !webcamStreamRef.current) {
            console.warn('[Snapshot] Skipped — missing:', !sessionIdRef.current ? 'sessionId' : !attemptId ? 'attemptId' : 'webcamStream');
            return;
        }
        try {
            const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 240;
            const video = webcamVideoRef.current;
            if (!video || video.readyState < 2) return;
            canvas.getContext('2d')?.drawImage(video, 0, 0, 320, 240);
            snapshotSeqRef.current += 1;
            await proctoringApi.uploadSnapshot({ sessionId: sessionIdRef.current, attemptId, imageBase64: canvas.toDataURL('image/jpeg', 0.6), capturedAt: new Date().toISOString(), sequenceNumber: snapshotSeqRef.current });
        } catch (err) { console.warn('[Proctoring] snapshot failed:', err); }
    };

    // ── Screen recording ──────────────────────────────────────────────────────
    const startScreenRecording = async () => {
        try {
            const quality = procConfigRef.current?.screenRecordingQuality ?? 'Medium';
            const fps = quality === 'High' ? 15 : quality === 'Low' ? 3 : 5;

            let stream: MediaStream;

            // FIX: use __procScreenStream (matches what StudentEntry sets)
            const openerStream = window.opener?.__procScreenStream;
            if (openerStream && openerStream.active && openerStream.getVideoTracks().length > 0) {
                stream = openerStream;
                if (window.opener) window.opener.__procScreenStream = null;
                console.log('[Proctoring] Reusing screen stream from StudentEntry');
            } else {
                console.warn('[Proctoring] No opener screen stream — requesting fresh getDisplayMedia');
                stream = await (navigator.mediaDevices as any).getDisplayMedia({
                    video: { frameRate: fps } as MediaTrackConstraints,
                    audio: false,
                });
            }

            stream.getVideoTracks()[0].addEventListener('ended', () => {
                logViolation('SCREEN_SHARE_STOP', 'Screen sharing stopped by candidate');
                setScreenRecording(false);
            });

            const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
                ? 'video/webm;codecs=vp8' : 'video/webm';
            const recorder = new MediaRecorder(stream, { mimeType });
            recorder.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
            recorder.start(10_000);
            mediaRecorderRef.current = recorder;

            setScreenRecBanner(false);   // hide banner
            setScreenRecording(true);    // show recording indicator
            console.log('[Proctoring] Screen recording started');
        } catch (err) {
            console.warn('[Proctoring] screen recording failed:', err);
            setScreenRecBanner(true); // keep banner visible if it failed
        }
    };
    const stopScreenRecording = () => { if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop(); };
    const uploadRecording = async () => {
        console.log('[Recording] Upload attempt. sessionId:', !!sessionIdRef.current, 'chunks:', recordingChunksRef.current.length);
        if (!sessionIdRef.current || !attemptId || recordingChunksRef.current.length === 0) {
            console.warn('[Recording] Skipped — missing:', !sessionIdRef.current ? 'sessionId' : recordingChunksRef.current.length === 0 ? 'no chunks' : 'attemptId');
            return;
        }
        try {
            stopScreenRecording();
            await new Promise(res => setTimeout(res, 800));
            const blob = new Blob(recordingChunksRef.current, { type: 'video/webm' });
            const fd = new FormData();
            fd.append('sessionId', sessionIdRef.current); fd.append('attemptId', attemptId);
            fd.append('recording', blob, `recording_${attemptId}.webm`);
            await proctoringApi.uploadRecording(fd);
        } catch (err) { console.warn('[Proctoring] upload recording failed:', err); }
    };

    // ── Log violation ─────────────────────────────────────────────────────────
    const logViolation = async (violationType: string, description?: string) => {
        if (!sessionIdRef.current || !attemptId) return;
        try {
            await proctoringApi.logViolation({ sessionId: sessionIdRef.current, attemptId, violationType, description, occurredAt: new Date().toISOString(), userAgent: navigator.userAgent });
        } catch (err) { console.warn('[Proctoring] logViolation failed:', err); }
    };

    // ── Enforce warning action ────────────────────────────────────────────────
    const enforceWarningAction = (newFlagCount: number): boolean => {
        const config = procConfigRef.current;
        if (!config?.webProctoringEnabled) return false;
        const maxAllowed = config.webProctoringWarnings ?? 3;
        const action     = (config.warningAction ?? '').toLowerCase();
        const shouldTerminate = action.includes('terminate');
        if (newFlagCount > maxAllowed && shouldTerminate) {
            setWarningMsg(''); setTabWarning(false);
            showToast(`Exam terminated! You exceeded ${maxAllowed} allowed violation(s).`, 'error');
            setTimeout(() => { finalSubmit(); }, 1800);
            return true;
        }
        if (!shouldTerminate && newFlagCount <= maxAllowed) {
            const remaining = maxAllowed - newFlagCount;
            setWarningMsg(remaining === 0
                ? `⚠️ Final warning! This is violation #${newFlagCount}. Next violation will have consequences.`
                : `Tab switch detected! Violation #${newFlagCount} of ${maxAllowed} allowed. ${remaining} warning(s) remaining.`
            );
        }
        return false;
    };

    // ── Timer ─────────────────────────────────────────────────────────────────
    // FIX: removed needsScreenGesture from dependency — use screenRecBanner instead
    useEffect(() => {
        if (loading || resultOpen || questions.length === 0 || screenRecBanner) return;
        timerRef.current = setInterval(() => { setTimeLeft(prev => { if (prev <= 1) { clearInterval(timerRef.current!); return 0; } return prev - 1; }); }, 1000);
        return () => clearInterval(timerRef.current!);
    }, [loading, resultOpen, questions.length, screenRecBanner]);

    useEffect(() => {
        if (timeLeft === 0 && questions.length > 0 && !resultOpen && !submitRef.current) { showToast('Time up! Submitting your exam…', 'error'); finalSubmit(); }
    }, [timeLeft]);

    // ── Proctoring event listeners ────────────────────────────────────────────
    const handleVisibility = useCallback(() => {
        if (document.hidden && !resultOpen && !submitRef.current) {
            setFlags(prev => {
                const next = prev + 1;
                logViolation('TAB_SWITCH', `Tab switch #${next}`);
                const terminated = enforceWarningAction(next);
                if (!terminated) setTabWarning(true);
                return next;
            });
        }
    }, [resultOpen]);

    useEffect(() => { document.addEventListener('visibilitychange', handleVisibility); return () => document.removeEventListener('visibilitychange', handleVisibility); }, [handleVisibility]);

    useEffect(() => {
        if (loading || questions.length === 0 || !procConfigRef.current?.webProctoringEnabled) return;
        document.documentElement.requestFullscreen?.().catch(() => {});
        const onFsChange = () => {
            if (!document.fullscreenElement && !resultOpen && !submitRef.current) {
                setFlags(prev => {
                    const next = prev + 1;
                    logViolation('FULLSCREEN_EXIT', `Fullscreen exit #${next}`);
                    const terminated = enforceWarningAction(next);
                    if (!terminated) { setTabWarning(true); document.documentElement.requestFullscreen?.().catch(() => {}); }
                    return next;
                });
            }
        };
        document.addEventListener('fullscreenchange', onFsChange);
        return () => document.removeEventListener('fullscreenchange', onFsChange);
    }, [loading, questions.length, resultOpen]);

    useEffect(() => {
        if (loading || questions.length === 0 || !procConfigRef.current?.webProctoringEnabled) return;
        const blockKeys = (e: KeyboardEvent) => {
            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) || (e.ctrlKey && e.key === 'u')) {
                e.preventDefault();
                if (!submitRef.current) {
                    setFlags(prev => {
                        const next = prev + 1;
                        logViolation('DEVTOOLS_OPEN', `DevTools #${next}`);
                        const terminated = enforceWarningAction(next);
                        if (!terminated) setTabWarning(true);
                        return next;
                    });
                }
            }
        };
        const blockCtx  = (e: MouseEvent) => e.preventDefault();
        const blockCopy = (e: ClipboardEvent) => { e.preventDefault(); logViolation('COPY_ATTEMPT', 'Copy attempted'); };
        document.addEventListener('keydown', blockKeys); document.addEventListener('contextmenu', blockCtx); document.addEventListener('copy', blockCopy);
        return () => { document.removeEventListener('keydown', blockKeys); document.removeEventListener('contextmenu', blockCtx); document.removeEventListener('copy', blockCopy); };
    }, [loading, questions.length]);

    // ── Answer selection ──────────────────────────────────────────────────────
    const saveAnswer = async (questionId: string, answer: string) => {
        if (!attemptId) return; setSavingId(questionId);
        try { await assessmentsApi.saveAnswer({ attemptQuestionId: questionId, answer }); } catch {} finally { setSavingId(null); }
    };
    const selectSingle = (optId: string) => { const q = questions[currentQ]; setQState(prev => { const ns = [...prev]; ns[currentQ] = { status: 'answered', answer: optId }; return ns; }); saveAnswer(q.id, optId); };
    const toggleMulti  = (optId: string) => {
        const q = questions[currentQ];
        setQState(prev => {
            const ns = [...prev]; const cur = Array.isArray(ns[currentQ].answer) ? [...ns[currentQ].answer as string[]] : []; const idx = cur.indexOf(optId);
            if (idx === -1) cur.push(optId); else cur.splice(idx, 1);
            ns[currentQ] = { status: cur.length > 0 ? 'answered' : 'unanswered', answer: cur.length > 0 ? cur : null };
            if (cur.length > 0) saveAnswer(q.id, cur.join(',')); return ns;
        });
    };
    const setTextAnswer  = (text: string) => { setQState(prev => { const ns = [...prev]; ns[currentQ] = { status: text.trim() ? 'answered' : 'unanswered', answer: text }; return ns; }); };
    const saveTextOnBlur = () => { const q = questions[currentQ]; const ans = qState[currentQ]?.answer; if (typeof ans === 'string' && ans.trim()) saveAnswer(q.id, ans.trim()); };

    // ── Navigation ────────────────────────────────────────────────────────────
    const goTo = (idx: number) => setCurrentQ(idx);
    const prevQ = () => { if (currentQ > 0) setCurrentQ(p => p - 1); };
    const nextQ = () => { if (currentQ < questions.length - 1) { setQState(prev => { const ns = [...prev]; if (ns[currentQ].status === 'unanswered') ns[currentQ].status = 'skipped'; return ns; }); setCurrentQ(p => p + 1); } };
    const skipQ = () => { setQState(prev => { const ns = [...prev]; ns[currentQ].status = 'skipped'; return ns; }); if (currentQ < questions.length - 1) setCurrentQ(p => p + 1); };
    const markForReview = () => { setQState(prev => { const ns = [...prev]; const cur = ns[currentQ]; cur.status = cur.status === 'marked' ? (cur.answer ? 'answered' : 'unanswered') : 'marked'; return ns; }); };

    // ── Submit ────────────────────────────────────────────────────────────────
    const finalSubmit = async () => {
        if (!attemptId || submitRef.current) return;
        submitRef.current = true;
        clearInterval(timerRef.current!);
        clearInterval(snapshotIntervalRef.current!);
        setLoading(true); setSubmitModal(false);
        try {
            if (procConfigRef.current?.screenRecordingEnabled) await uploadRecording();
            const res = await assessmentsApi.submitAttempt(attemptId);
            setResult(res.data ?? {});
            if (sessionIdRef.current) await proctoringApi.endSession({ sessionId: sessionIdRef.current, attemptId }).catch(() => {});
            stopWebcam();
            setResultOpen(true);
        } catch (err: any) {
            showToast(err?.response?.data?.message ?? 'Submission failed. Please try again.', 'error');
            submitRef.current = false;
        } finally { setLoading(false); }
    };

    // ── Stats / timer ─────────────────────────────────────────────────────────
    const stats = qState.reduce((acc, s) => { if (s.status === 'answered') acc.ans++; else if (s.status === 'marked') acc.mrk++; else if (s.status === 'skipped') acc.skp++; else acc.rem++; return acc; }, { ans: 0, mrk: 0, skp: 0, rem: 0 });
    const fmtTime = (secs: number) => { const m = Math.floor(secs / 60); const s = secs % 60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; };
    const timerClass = timeLeft <= 60 ? 'danger' : timeLeft <= 300 ? 'warning' : '';
    const ringCircumference = 138;
    const ringProgress = totalTime > 0 ? (timeLeft / totalTime) * ringCircumference : ringCircumference;
    const ringColor = timeLeft <= 60 ? 'var(--red)' : timeLeft <= 300 ? 'var(--yellow)' : 'var(--accent)';
    const dismissWarning = () => setTabWarning(false);

    if (loading && questions.length === 0) return (
        <div className="exam-screen-wrap" style={{ alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
            <div style={{ textAlign: 'center', color: 'var(--muted)' }}><div style={{ fontSize: '32px', marginBottom: '12px' }}>⏳</div><div style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 600 }}>Loading Exam…</div></div>
        </div>
    );
    if (loadError) return (
        <div className="exam-screen-wrap" style={{ alignItems: 'center', justifyContent: 'center', display: 'flex' }}>
            <div style={{ textAlign: 'center', color: 'var(--muted)', maxWidth: 400 }}><div style={{ fontSize: '40px', marginBottom: '12px' }}>⚠️</div><div style={{ fontFamily: "'Syne',sans-serif", fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: 'var(--ink)' }}>Failed to Load Exam</div><div style={{ fontSize: '14px' }}>{loadError}</div></div>
        </div>
    );

    const q = questions[currentQ], qs = qState[currentQ], qt = q?.questionType ?? '', KEYS = ['A','B','C','D','E','F'];
    const qtLabel = (() => {
        if (isMulti(qt)) return { text: 'Multiple Correct — select all that apply', color: 'var(--purple)',  bg: 'rgba(139,92,246,.1)', icon: '☑️' };
        if (isText(qt))  return { text: 'Open Text — type your answer below',        color: 'var(--accent2)', bg: 'rgba(0,87,255,.08)',   icon: '📝' };
        if (isImage(qt)) return { text: 'Image Select — click the correct image',    color: 'var(--green)',   bg: 'rgba(0,194,113,.1)',   icon: '🖼️' };
        return               { text: 'Single Correct — select one answer',           color: 'var(--accent)',  bg: 'rgba(255,92,0,.08)',   icon: '🔘' };
    })();

    const renderQuestion = () => {
        if (!q) return null;
        return (
            <>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '6px 14px', borderRadius: '100px', background: qtLabel.bg, border: `1px solid ${qtLabel.color}33`, fontSize: '12px', fontWeight: 600, color: qtLabel.color, marginBottom: '18px' }}>
                    <span>{qtLabel.icon}</span><span>{qtLabel.text}</span>
                </div>
                {(isMCQ(qt) || (!isMulti(qt) && !isText(qt) && !isImage(qt) && q.options?.length > 0)) && (
                    <div className="options-list">{q.options.map((opt, i) => { const sel = qs.answer === opt.id; return (<div key={opt.id} className={`option ${sel ? 'selected' : ''}`} onClick={() => selectSingle(opt.id)}><div className="option-key">{KEYS[i] ?? i+1}</div><span>{opt.text}</span></div>); })}</div>
                )}
                {isMulti(qt) && (() => { const sel = Array.isArray(qs.answer) ? qs.answer as string[] : []; return (<div className="options-list">{q.options.map((opt, i) => { const selected = sel.includes(opt.id); return (<div key={opt.id} className={`multi-option ${selected ? 'selected' : ''}`} onClick={() => toggleMulti(opt.id)}><div className="multi-checkbox">{selected ? '✓' : ''}</div><div className="option-key">{KEYS[i] ?? i+1}</div><span>{opt.text}</span></div>); })}</div>); })()}
                {isImage(qt) && (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
        {q.options.map((opt, i) => {
            const sel = qs.answer === opt.id;
            return (
                <div key={opt.id} onClick={() => selectSingle(opt.id)} style={{
                    border: `2.5px solid ${sel ? 'var(--accent2)' : 'var(--border)'}`,
                    borderRadius: '12px', cursor: 'pointer', overflow: 'hidden',
                    background: sel ? 'rgba(0,87,255,.06)' : 'var(--card)',
                    transition: 'all .18s',
                    boxShadow: sel ? '0 0 0 3px rgba(0,87,255,.15)' : 'none',
                    display: 'flex', flexDirection: 'column',
                }}>
                    {/* Image area — fixed height, contain so nothing is cropped */}
                    <div style={{
                        width: '100%', height: '160px',
                        background: 'var(--surface)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', flexShrink: 0,
                    }}>
                        {opt.imageUrl
                            ? <img
                                src={opt.imageUrl}
                                alt={`Option ${KEYS[i]}`}
                                style={{
                                    maxWidth: '100%', maxHeight: '100%',
                                    width: 'auto', height: 'auto',
                                    objectFit: 'contain',   // FULL image, no cropping
                                    display: 'block',
                                    padding: '6px',
                                }}
                              />
                            : <div style={{ fontSize: '36px', color: 'var(--border)' }}>🖼️</div>
                        }
                    </div>
                    {/* Label bar */}
                    <div style={{
                        padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px',
                        background: sel ? 'rgba(0,87,255,.06)' : 'var(--card)',
                        borderTop: `1px solid ${sel ? 'rgba(0,87,255,.2)' : 'var(--border)'}`,
                        flexShrink: 0,
                    }}>
                        <div className="option-key" style={{
                            width: 24, height: 24, fontSize: '11px', flexShrink: 0,
                            background: sel ? 'var(--accent2)' : 'var(--surface)',
                            color: sel ? '#fff' : 'var(--ink)',
                            border: `1.5px solid ${sel ? 'var(--accent2)' : 'var(--border)'}`,
                        }}>{KEYS[i]}</div>
                        <span style={{ fontSize: '12px', fontWeight: sel ? 600 : 400, flex: 1 }}>
                            {opt.text || `Option ${KEYS[i]}`}
                        </span>
                        {sel && <span style={{ color: 'var(--accent2)', fontWeight: 700, fontSize: '14px' }}>✓</span>}
                    </div>
                </div>
            );
        })}
    </div>
)}
                {isText(qt) && (() => { const tv = typeof qs.answer === 'string' ? qs.answer : ''; return (<div className="text-answer-wrap"><div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '8px' }}>Write your answer in detail. Your response will be reviewed by the examiner.</div><textarea placeholder="Type your answer here…" value={tv} onChange={e => setTextAnswer(e.target.value)} onBlur={saveTextOnBlur} rows={7} style={{ resize: 'vertical' }} /><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}><div className="text-char-count">{tv.length} characters</div>{tv.trim() && <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 600 }}>✓ Answer saved on navigation</div>}</div></div>); })()}
                {!isMCQ(qt) && !isMulti(qt) && !isText(qt) && !isImage(qt) && q.options?.length === 0 && (<div style={{ color: 'var(--muted)', fontSize: '14px', padding: '16px', background: 'var(--surface)', borderRadius: '10px' }}>Unknown question type: {qt}</div>)}
            </>
        );
    };

    return (
        <div className="exam-screen-wrap">
            {/* Hidden webcam video for snapshot capture */}
            <video ref={webcamVideoRef} autoPlay muted playsInline style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />

            {/* Screen recording banner — shown if opener stream wasn't available */}
            {screenRecBanner && !resultOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999, background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', borderBottom: '3px solid var(--accent2)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', boxShadow: '0 4px 20px rgba(0,0,0,.5)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ fontSize: '28px' }}>🖥️</div>
                        <div>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px', marginBottom: '3px' }}>Screen Recording Required</div>
                            <div style={{ color: 'rgba(255,255,255,.65)', fontSize: '12px' }}>
                                Click the button → select <strong style={{ color: '#fff' }}>Entire Screen</strong> → click <strong style={{ color: 'var(--green)' }}>Share</strong>. Timer is paused until recording starts.
                            </div>
                        </div>
                    </div>
                    <button onClick={startScreenRecording} style={{ padding: '12px 24px', background: 'var(--accent2)', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: 700, fontSize: '14px', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0, boxShadow: '0 3px 12px rgba(0,87,255,.4)' }}>
                        🖥️ Start Screen Share
                    </button>
                </div>
            )}

            {/* Recording active indicator */}
            {screenRecording && !resultOpen && (
                <div style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 999, background: 'rgba(0,0,0,.75)', borderRadius: '100px', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#fff', backdropFilter: 'blur(6px)' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--red)', animation: 'pulse 1.5s infinite' }} />
                    Recording
                </div>
            )}

            <div className={`tab-warning ${tabWarning ? 'show' : ''}`}>
                <div className="tw-icon">⚠️</div><div className="tw-title">Violation Detected!</div>
                <div className="tw-sub">{warningMsg}</div>
                <button className="tw-btn" onClick={dismissWarning}>Continue Exam</button>
            </div>

            <div className="topbar">
                <div className="tb-left"><div className="tb-logo">Test<span>Buddy</span></div><div className="tb-exam-name">{examTitle}</div></div>
                <div className="tb-right">
                    {flags > 0 && <div className="flag-counter">🚩 {flags} violation{flags !== 1 ? 's' : ''}</div>}
                    <div className="proctor-badge"><div className="proctor-dot" /> Live Proctored</div>
                </div>
            </div>

            <div className="exam-body">
                <aside className="exam-sidebar">
                    <div className="timer-block">
                        <div className="timer-ring">
                            <svg viewBox="0 0 50 50" width="50" height="50">
                                <circle className="timer-ring-bg" cx="25" cy="25" r="22" />
                                <circle className="timer-ring-fill" cx="25" cy="25" r="22" style={{ strokeDashoffset: ringCircumference - ringProgress, stroke: ringColor }} />
                            </svg>
                        </div>
                        <div className="timer-label">Time Remaining</div>
                        <div className={`timer-value ${timerClass}`}>{fmtTime(timeLeft)}</div>
                    </div>
                    <div className="score-mini">
                        <div className="sm-card"><div className="sm-num sm-green">{stats.ans}</div><div className="sm-label">Answered</div></div>
                        <div className="sm-card"><div className="sm-num sm-yellow">{stats.mrk}</div><div className="sm-label">Marked</div></div>
                        <div className="sm-card"><div className="sm-num sm-red">{stats.skp}</div><div className="sm-label">Skipped</div></div>
                        <div className="sm-card"><div className="sm-num sm-blue">{stats.rem}</div><div className="sm-label">Remaining</div></div>
                    </div>
                    <div className="palette-header"><span>Question Palette</span><span style={{ color: 'var(--muted)' }}>{currentQ + 1}/{questions.length}</span></div>
                    <div className="palette-grid">{questions.map((_, i) => (<div key={i} className={`pal-btn ${qState[i]?.status ?? 'unanswered'} ${i === currentQ ? 'current' : ''}`} onClick={() => goTo(i)}>{i + 1}</div>))}</div>
                    <div className="palette-legend">{[{ label: 'Answered', color: 'var(--green)' }, { label: 'Marked', color: 'var(--yellow)' }, { label: 'Skipped', color: 'var(--red)' }, { label: 'Current', color: 'var(--accent2)' }].map(l => (<div key={l.label} className="legend-item"><div className="legend-dot" style={{ background: l.color }} /><span>{l.label}</span></div>))}</div>
                </aside>

                <main className="exam-main" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                    <div className="progress-strip">
                        <span className="progress-text">Question {currentQ + 1} of {questions.length}</span>
                        <div className="progress-bar-wrap"><div className="progress-bar-fill" style={{ width: `${((currentQ + 1) / questions.length) * 100}%` }} /></div>
                        <span className="progress-pct">{Math.round(((stats.ans + stats.mrk) / questions.length) * 100)}% done</span>
                    </div>
                    <div className="q-card" key={currentQ} style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                        <div className="q-card-top">
                            <div className="q-meta-row">
                                <span className="q-num-badge">Q{currentQ + 1}</span>
                                {q?.topicName && <span className="q-tag q-tag-topic">{q.topicName}</span>}
                                {q?.difficulty && <span className={`q-tag q-tag-${(q.difficulty ?? '').toLowerCase()}`}>{q.difficulty}</span>}
                                {q?.marks && <span className="q-tag q-tag-marks">{q.marks} Marks</span>}
                                {savingId === q?.id && <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '4px' }}>💾 saving…</span>}
                            </div>
                        </div>
                        <div className="q-text" dangerouslySetInnerHTML={{ __html: qText(q) }} />
                        {renderQuestion()}
                    </div>
                    <div className="nav-bar">
                        <button className="btn btn-secondary" onClick={prevQ} disabled={currentQ === 0}>← Prev</button>
                        <button className={`btn btn-mark ${qs?.status === 'marked' ? 'active' : ''}`} onClick={markForReview}>🔖 {qs?.status === 'marked' ? 'Unmark' : 'Mark'}</button>
                        <button className="btn btn-skip" onClick={skipQ} disabled={currentQ === questions.length - 1}>⏭ Skip</button>
                        <div style={{ flex: 1 }} />
                        {currentQ < questions.length - 1 ? (<button className="btn btn-primary" onClick={nextQ}>Next →</button>) : (<button className="btn btn-primary" style={{ background: 'var(--green)', boxShadow: '0 3px 10px rgba(0,194,113,.3)' }} onClick={() => setSubmitModal(true)}>✅ Finish Exam</button>)}
                    </div>
                </main>
            </div>

            <div className={`modal-overlay ${submitModal ? 'open' : ''}`}>
                <div className="modal">
                    <div className="modal-header"><div className="modal-title">Submit Exam?</div><button className="modal-close" onClick={() => setSubmitModal(false)}>✕</button></div>
                    <div className="modal-body">
                        <div className="submit-grid">
                            <div className="sg-item"><div className="sg-num sg-green">{stats.ans}</div><div className="sg-label">Answered</div></div>
                            <div className="sg-item"><div className="sg-num sg-yellow">{stats.mrk}</div><div className="sg-label">Marked</div></div>
                            <div className="sg-item"><div className="sg-num sg-red">{stats.skp}</div><div className="sg-label">Skipped</div></div>
                            <div className="sg-item"><div className="sg-num" style={{ color: 'var(--muted)' }}>{stats.rem}</div><div className="sg-label">Remaining</div></div>
                        </div>
                        {(stats.rem + stats.skp) > 0 && (<div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--yellow)', marginTop: '12px', padding: '10px', background: 'rgba(245,166,35,.08)', borderRadius: '8px' }}>⚠ You have {stats.rem + stats.skp} unanswered question{stats.rem + stats.skp !== 1 ? 's' : ''}. You cannot go back after submitting.</div>)}
                    </div>
                    <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setSubmitModal(false)}>Back to Exam</button><button className="btn btn-primary" style={{ background: 'var(--green)' }} onClick={finalSubmit}>Submit Now</button></div>
                </div>
            </div>

            <div className={`result-screen ${resultOpen ? 'open' : ''}`}>
                <div className="result-card">
                    <div className="result-top">
                        <div className="result-badge">✓ Submitted</div>
                        <div className="result-score-big">{result?.score ?? 0}{result?.totalMarks && <span className="result-score-total"> / {result.totalMarks}</span>}</div>
                        <div className="result-score-sub">{result?.percentage != null ? `${result.percentage}%` : ''}</div>
                        <div className="result-pass-badge">{result?.passed ? '✅ PASSED' : '📋 COMPLETED'}</div>
                    </div>
                    <div className="result-body">
                        <div className="result-stats">
                            <div className="rs-item"><div className="rs-num rs-green">{result?.correct ?? stats.ans}</div><div className="rs-label">Correct</div></div>
                            <div className="rs-item"><div className="rs-num rs-red">{result?.wrong ?? 0}</div><div className="rs-label">Wrong</div></div>
                            <div className="rs-item"><div className="rs-num rs-yellow">{result?.unattempted ?? (stats.skp + stats.rem)}</div><div className="rs-label">Unattempted</div></div>
                            <div className="rs-item"><div className="rs-num rs-blue">{questions.length}</div><div className="rs-label">Total Qs</div></div>
                        </div>
                        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '14px', marginBottom: '28px', lineHeight: 1.6 }}>Your attempt has been submitted successfully.<br />Results will be reviewed and shared within 24 hours.</p>
                        <button className="ra-btn ra-primary" style={{ width: '100%' }} onClick={() => window.close()}>Close Exam Window</button>
                    </div>
                </div>
            </div>

            <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.3; } }`}</style>
            <div className={`toast ${toast.show ? 'show' : ''}`} style={{ background: toast.type === 'error' ? '#c0392b' : toast.type === 'success' ? '#0d1117' : '#1a2540' }}>
                <span>{toast.type === 'error' ? '❌' : toast.type === 'success' ? '✅' : 'ℹ️'}</span>
                <span>{toast.msg}</span>
            </div>
        </div>
    );
};

export default ExamScreen;
