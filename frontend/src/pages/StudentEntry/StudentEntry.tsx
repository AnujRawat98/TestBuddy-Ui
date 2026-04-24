import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import './StudentEntry.css';
import { assessmentLinksApi } from '../../services/api';

declare global {
    interface Window {
        __procCamStream?:    MediaStream | null;
        __procScreenStream?: MediaStream | null;
    }
}

interface LinkDetails {
    id: string; name: string; examStartDateTime: string; examEndDateTime: string;
    isCredentialBased: boolean; isActive: boolean; accessCode: string;
    startupInstruction?: string;
    isWebProctoring: boolean; isImageProctoring: boolean;
    isScreenRecording: boolean;
    webProctoringWarnings?: number; imageProctoringCount?: number;
    screenRecordingDuration?: number; screenRecordingQuality?: string;
    warningAction?: string;
}

export interface ProctoringConfig {
    assessmentLinkId:        string;
    webProctoringEnabled:    boolean;
    imageProctoringEnabled:  boolean;
    screenRecordingEnabled:  boolean;
    webProctoringWarnings:   number;
    imageProctoringCount:    number;
    screenRecordingDuration: number | null;
    screenRecordingQuality:  string;
    warningAction:           string;
}

type Stage      = 'loading' | 'link-error' | 'entry' | 'instructions' | 'starting';
type PermStatus = 'idle' | 'granted' | 'denied';

const StudentEntry: React.FC = () => {
    const { linkId } = useParams<{ linkId: string }>();

    const [link,          setLink]          = useState<LinkDetails | null>(null);
    const [stage,         setStage]         = useState<Stage>('loading');
    const [errorMsg,      setErrorMsg]      = useState('');
    const [email,         setEmail]         = useState('');
    const [code,          setCode]          = useState('');
    const [emailError,    setEmailError]    = useState(false);
    const [codeError,     setCodeError]     = useState(false);
    const [loading,       setLoading]       = useState(false);
    const [agreedGeneral, setAgreedGeneral] = useState(false);
    const [procAgreed,    setProcAgreed]    = useState<Record<string, boolean>>({});

    const [cameraStatus,   setCameraStatus]   = useState<PermStatus>('idle');
    const [screenStatus,   setScreenStatus]   = useState<PermStatus>('idle');
    const [cameraError,    setCameraError]    = useState('');
    const [screenError,    setScreenError]    = useState('');
    const [requestingPerm, setRequestingPerm] = useState<'camera' | 'screen' | null>(null);

    const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
    const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
        setToast({ show: true, msg, type });
        setTimeout(() => setToast(p => ({ ...p, show: false })), 3500);
    };

    // ── Fetch link ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!linkId) { setStage('link-error'); return; }
        (async () => {
            try {
                const res = await assessmentLinksApi.getById(linkId);
                const d   = res.data as LinkDetails;
                if (!d?.isActive) {
                    setErrorMsg('This exam link is inactive or does not exist.');
                    setStage('link-error'); return;
                }
                if (new Date() > new Date(d.examEndDateTime)) {
                    setErrorMsg(`This exam link expired on ${fmtDT(d.examEndDateTime)}.`);
                    setStage('link-error'); return;
                }
                setLink(d); setStage('entry');
            } catch {
                setErrorMsg('Exam link not found or has expired.');
                setStage('link-error');
            }
        })();
    }, [linkId]);

    const needsCamera = (l: LinkDetails) => l.isImageProctoring;
    const needsScreen = (l: LinkDetails) => l.isScreenRecording;

    // ── Verify credentials ────────────────────────────────────────────────────
    const handleVerify = async () => {
        if (!linkId || !link) return;
        setEmailError(false); setCodeError(false); setErrorMsg('');

        const et = email.trim().toLowerCase();
        const ct = code.trim().toUpperCase();

        if (!et || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(et)) {
            setEmailError(true);
            setErrorMsg('Please enter a valid email address.');
            return;
        }
        if (!ct) {
            setCodeError(true);
            setErrorMsg('Please enter the access code.');
            return;
        }
        if (new Date() < new Date(link.examStartDateTime)) {
            setErrorMsg(`Exam hasn't started yet. Opens at ${fmtDT(link.examStartDateTime)}.`);
            return;
        }

        // ── Direct-based: validate access code client-side ─────────────────
        // For direct-based the access code is shared for all — check it here
        if (!link.isCredentialBased) {
            if (ct !== link.accessCode?.toUpperCase()) {
                setCodeError(true);
                setErrorMsg('Invalid access code. Please check and try again.');
                return;
            }
        }

        // ── Credential-based: send code to backend for per-user validation ──
        // Backend checks: email in AssessmentLinkUsers AND AccessCodeHash matches
        setLoading(true);
        try {
            // FIX: pass accessCode to validate so backend can check per-user code
            await assessmentLinksApi.validate(linkId, et, ct);

            // Init proctoring checkboxes
            const keys: string[] = [];
            if (link.isWebProctoring)   keys.push('web');
            if (link.isImageProctoring) keys.push('image');
            if (link.isScreenRecording) keys.push('screen');
            const init: Record<string, boolean> = {};
            keys.forEach(k => { init[k] = false; });
            setProcAgreed(init);
            setAgreedGeneral(false);
            setCameraStatus('idle'); setScreenStatus('idle');
            setCameraError('');      setScreenError('');
            setStage('instructions');
        } catch (err: any) {
            const msg = err?.response?.data?.message
                ?? err?.response?.data?.title
                ?? 'Invalid credentials or access denied.';
            setErrorMsg(msg);
            setCodeError(true);
        } finally { setLoading(false); }
    };

    // ── Request camera permission ─────────────────────────────────────────────
    // FIX: was incorrectly setting __procScreenStream — now correctly sets __procCamStream
    const requestCamera = async () => {
        if (!link || cameraStatus === 'granted' || requestingPerm) return;
        setRequestingPerm('camera');
        setCameraError('');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            (window as any).__procCamStream = stream;   // ✅ FIXED (was __procScreenStream)
            setCameraStatus('granted');
            showToast('Camera access granted ✅', 'success');
        } catch (err: any) {
            setCameraStatus('denied');
            const isBlocked = err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError';
            setCameraError(isBlocked
                ? 'Camera was blocked. Click the 🔒 lock icon → Camera → Allow, then try again.'
                : `Camera error: ${err?.message ?? 'Make sure your camera is connected.'}`);
        } finally { setRequestingPerm(null); }
    };

    // ── Request screen share permission ───────────────────────────────────────
    const requestScreen = async () => {
        if (!link || screenStatus === 'granted' || requestingPerm) return;
        setRequestingPerm('screen');
        setScreenError('');
        try {
            const stream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true, audio: false });
            (window as any).__procScreenStream = stream;   // ✅ correct
            stream.getVideoTracks()[0].addEventListener('ended', () => {
                (window as any).__procScreenStream = null;
                setScreenStatus('idle');
                setScreenError('Screen sharing was stopped. Please allow it again.');
            });
            setScreenStatus('granted');
            showToast('Screen sharing access granted ✅', 'success');
        } catch (err: any) {
            setScreenStatus('denied');
            const isCancelled = err?.name === 'NotAllowedError' || err?.name === 'AbortError';
            setScreenError(isCancelled
                ? 'Screen sharing was cancelled. Please click Allow Screen and select your screen.'
                : `Screen share error: ${err?.message ?? 'Unknown error.'}`);
        } finally { setRequestingPerm(null); }
    };

    // ── canProceed ────────────────────────────────────────────────────────────
    const procKeys   = link ? [link.isWebProctoring && 'web', link.isImageProctoring && 'image', link.isScreenRecording && 'screen'].filter(Boolean) as string[] : [];
    const allAgreed  = procKeys.every(k => procAgreed[k] === true);
    const camOk      = !link || !needsCamera(link) || cameraStatus === 'granted';
    const screenOk   = !link || !needsScreen(link) || screenStatus === 'granted';
    const canProceed = agreedGeneral && allAgreed && camOk && screenOk;

    // ── Launch exam ───────────────────────────────────────────────────────────
    const handleProceed = async () => {
        if (!link || !canProceed) return;
        setStage('starting');
        try {
            const res       = await assessmentLinksApi.start(linkId!, email.trim().toLowerCase());
            const attemptId = res.data?.id ?? res.data?.attemptId ?? res.data;

            const procConfig: ProctoringConfig = {
                assessmentLinkId:        link.id,
                webProctoringEnabled:    link.isWebProctoring,
                imageProctoringEnabled:  link.isImageProctoring,
                screenRecordingEnabled:  link.isScreenRecording  ?? false,
                webProctoringWarnings:   link.webProctoringWarnings  ?? 3,
                imageProctoringCount:    link.imageProctoringCount   ?? 5,
                screenRecordingDuration: link.screenRecordingDuration ?? null,
                screenRecordingQuality:  link.screenRecordingQuality  ?? 'Medium',
                warningAction:           link.warningAction ?? 'warn',
            };
            localStorage.setItem(`proctoringConfig_${attemptId}`, JSON.stringify(procConfig));

            const sw       = screen.width, sh = screen.height;
            const features = [`width=${sw}`, `height=${sh}`, `top=0`, `left=0`, `toolbar=no`, `menubar=no`, `location=no`, `status=no`, `scrollbars=no`, `resizable=no`, `directories=no`].join(',');
            const popup    = window.open(`${window.location.origin}/exam/${attemptId}`, 'MazeAIExam', features);
            if (!popup || popup.closed) {
                showToast('Popup blocked! Allow popups for this site in browser settings.', 'error');
                setStage('instructions'); return;
            }
            try { popup.moveTo(0, 0); popup.resizeTo(sw, sh); } catch {}
        } catch (err: any) {
            const msg = err?.response?.data?.message ?? err?.response?.data?.title ?? err?.message ?? 'Failed to start exam.';
            showToast(msg, 'error'); setStage('instructions');
        }
    };

    const fmtDT    = (s: string) => !s ? '—' : new Date(s).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    const clearErr = () => { setErrorMsg(''); setEmailError(false); setCodeError(false); };
    const timeStatus = () => {
        if (!link) return null;
        const now = new Date(), start = new Date(link.examStartDateTime), end = new Date(link.examEndDateTime);
        if (now < start) return { label: `Opens ${fmtDT(link.examStartDateTime)}`, color: 'var(--yellow)' };
        if (now > end)   return { label: 'Expired',   color: 'var(--red)'   };
        return               { label: 'Active Now', color: 'var(--green)'  };
    };
    const ts         = timeStatus();
    const hasAnyProc = link && (link.isWebProctoring || link.isImageProctoring || link.isScreenRecording);

    // ── LOADING ───────────────────────────────────────────────────────────────
    if (stage === 'loading') return (
        <div className="student-entry-wrap"><div className="entry-card" style={{ textAlign: 'center' }}>
            <div className="logo">Test<span>Buddy</span></div>
            <div style={{ fontSize: '32px', margin: '32px 0 12px' }}>⏳</div>
            <div style={{ fontSize: '15px', color: 'var(--muted)' }}>Loading exam details…</div>
        </div></div>
    );

    // ── LINK ERROR ────────────────────────────────────────────────────────────
    if (stage === 'link-error') return (
        <div className="student-entry-wrap"><div className="entry-card" style={{ textAlign: 'center' }}>
            <div className="logo">Test<span>Buddy</span></div>
            <div style={{ fontSize: '48px', margin: '28px 0 14px' }}>🔒</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: '20px', fontWeight: 700, marginBottom: '10px' }}>Link Unavailable</div>
            <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.6 }}>{errorMsg || 'This exam link is invalid, inactive, or has expired.'}</div>
        </div></div>
    );

    // ── EXAM LAUNCHED ─────────────────────────────────────────────────────────
    if (stage === 'starting') return (
        <div className="student-entry-wrap"><div className="entry-card" style={{ textAlign: 'center', maxWidth: 420 }}>
            <div className="logo">Test<span>Buddy</span></div>
            <div style={{ fontSize: '60px', margin: '28px 0 14px' }}>🚀</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: '20px', fontWeight: 700, marginBottom: '10px', color: 'var(--green)' }}>Exam Window Opened!</div>
            <div style={{ fontSize: '14px', color: 'var(--muted)', lineHeight: 1.8 }}>
                Your exam is running in a separate window.<br />
                Please switch to that window to begin.<br />
                <span style={{ fontSize: '12px' }}>You may close this tab.</span>
            </div>
        </div></div>
    );

    // ── INSTRUCTIONS + PERMISSIONS ────────────────────────────────────────────
    if (stage === 'instructions') {
        const instructions = link?.startupInstruction
            ? link.startupInstruction.split(/\n|(?<=\.)\s+/).map(s => s.trim()).filter(Boolean)
            : ['Ensure you are in a quiet, well-lit room.', 'Do not switch browser tabs — violations will be recorded.', 'Once started, the timer cannot be paused.', 'Submit before the exam window closes.'];

        const procItems = [
            link?.isWebProctoring && { key: 'web',    icon: '🌐',  label: 'Tab & Window Monitoring',    detail: `Detects tab switches, DevTools, and copy attempts.${link.webProctoringWarnings ? ` Max ${link.webProctoringWarnings} violation(s) allowed.` : ''}`, permType: 'none'   as const },
            link?.isImageProctoring && { key: 'image', icon: '📸',  label: 'Webcam Snapshot Capture',    detail: 'Captures periodic webcam snapshots to verify your identity.',                                                                                       permType: 'camera' as const },
            link?.isScreenRecording && { key: 'screen',icon: '🖥️', label: 'Screen Recording',            detail: `Records your screen${link.screenRecordingDuration ? ` for up to ${link.screenRecordingDuration} min` : ' for the exam duration'}. Quality: ${link.screenRecordingQuality ?? 'Medium'}.`, permType: 'screen' as const },
        ].filter(Boolean) as { key: string; icon: string; label: string; detail: string; permType: 'none' | 'camera' | 'screen' }[];

        return (
            <div className="student-entry-wrap">
                <div className="entry-card" style={{ maxWidth: '600px' }}>
                    <div className="logo">Test<span>Buddy</span></div>
                    <div className="logo-sub">Online Assessment Platform</div>
                    <div className="divider" />
                    <div className="exam-title">{link?.name ?? 'Assessment'}</div>
                    <div className="meta-row">
                        <div className="meta-item"><div className="meta-icon-label"><span className="meta-icon">📅</span> Opens</div><div className="meta-sub">{fmtDT(link?.examStartDateTime ?? '')}</div></div>
                        <div className="meta-item"><div className="meta-icon-label"><span className="meta-icon">⏰</span> Closes</div><div className="meta-sub">{fmtDT(link?.examEndDateTime ?? '')}</div></div>
                        <div className="meta-item"><div className="meta-icon-label"><span className="meta-icon">👤</span> Student</div><div className="meta-sub" style={{ fontFamily: 'monospace', fontSize: '12px' }}>{email}</div></div>
                    </div>

                    <div className="instructions">
                        <div className="instructions-title">📋 Exam Instructions</div>
                        <ul className="instructions-list">{instructions.map((inst, i) => (<li key={i}><div className="bullet" /><span>{inst}</span></li>))}</ul>
                    </div>

                    {procItems.length > 0 && (
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '12px' }}>
                                🔒 Proctoring — Accept & Grant Permissions
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                                {procItems.map(perm => {
                                    const camGranted   = perm.permType === 'camera' && cameraStatus === 'granted';
                                    const scrGranted   = perm.permType === 'screen' && screenStatus === 'granted';
                                    const isGranted    = perm.permType === 'none' || camGranted || scrGranted;
                                    const isDenied     = (perm.permType === 'camera' && cameraStatus === 'denied') || (perm.permType === 'screen' && screenStatus === 'denied');
                                    const isRequesting = requestingPerm === perm.permType;
                                    const errMsg       = perm.permType === 'camera' ? cameraError : perm.permType === 'screen' ? screenError : '';
                                    return (
                                        <div key={perm.key} style={{ borderRadius: '12px', border: `1.5px solid ${isGranted ? 'var(--green)' : isDenied ? 'var(--red)' : 'rgba(224,59,59,.2)'}`, background: isGranted ? 'rgba(0,194,113,.04)' : isDenied ? 'rgba(224,59,59,.04)' : 'rgba(224,59,59,.02)', overflow: 'hidden', transition: 'border-color .2s' }}>
                                            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px', cursor: 'pointer' }}>
                                                <input type="checkbox" checked={procAgreed[perm.key] ?? false} onChange={e => setProcAgreed(prev => ({ ...prev, [perm.key]: e.target.checked }))} style={{ width: '16px', height: '16px', marginTop: '3px', accentColor: 'var(--accent2)', flexShrink: 0 }} />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '3px' }}>
                                                        {perm.icon} {perm.label}
                                                        {isGranted && perm.permType !== 'none' && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--green)', fontWeight: 500 }}>✅ Granted</span>}
                                                        {isDenied && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--red)', fontWeight: 500 }}>❌ Denied</span>}
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.5 }}>{perm.detail}</div>
                                                </div>
                                            </label>
                                            {perm.permType !== 'none' && !isGranted && (
                                                <div style={{ padding: '0 16px 14px' }}>
                                                    {errMsg && <div style={{ fontSize: '12px', color: 'var(--red)', background: 'rgba(224,59,59,.08)', padding: '8px 12px', borderRadius: '8px', marginBottom: '8px', lineHeight: 1.6 }}>⚠️ {errMsg}</div>}
                                                    <button
                                                        onClick={perm.permType === 'camera' ? requestCamera : requestScreen}
                                                        disabled={!!requestingPerm}
                                                        style={{ width: '100%', padding: '10px', border: 'none', borderRadius: '8px', fontWeight: 600, fontSize: '13px', cursor: requestingPerm ? 'not-allowed' : 'pointer', background: isDenied ? 'rgba(224,59,59,.15)' : 'rgba(0,87,255,.1)', color: isDenied ? 'var(--red)' : 'var(--accent2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                                        {isRequesting
                                                            ? <><div style={{ width: '14px', height: '14px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Waiting for browser permission…</>
                                                            : isDenied
                                                                ? `🔄 Retry ${perm.permType === 'camera' ? 'Camera' : 'Screen Share'}`
                                                                : `${perm.permType === 'camera' ? '📷 Allow Camera Access' : '🖥️ Allow Screen Share'}`
                                                        }
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {(!camOk || !screenOk) && (
                                <div style={{ fontSize: '12px', padding: '10px 14px', background: 'rgba(245,166,35,.08)', border: '1px solid rgba(245,166,35,.2)', borderRadius: '8px', color: 'var(--muted)', lineHeight: 1.8, marginBottom: '4px' }}>
                                    💡 <strong style={{ color: 'var(--ink)' }}>Grant all permissions above</strong> before proceeding.
                                </div>
                            )}
                        </div>
                    )}

                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', marginBottom: '24px', padding: '16px', background: 'var(--surface)', borderRadius: '12px', border: `2px solid ${agreedGeneral ? 'var(--accent2)' : 'var(--border)'}`, transition: 'border-color .2s' }}>
                        <input type="checkbox" checked={agreedGeneral} onChange={e => setAgreedGeneral(e.target.checked)} style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: 'var(--accent2)', flexShrink: 0 }} />
                        <span style={{ fontSize: '14px', lineHeight: 1.55 }}>
                            I have read and understood all instructions and agree to follow the exam rules.
                            {procItems.length > 0 && <span style={{ color: 'var(--muted)' }}> I consent to all proctoring methods listed above.</span>}
                        </span>
                    </label>

                    {!canProceed && (
                        <div style={{ fontSize: '12px', color: 'var(--yellow)', textAlign: 'center', marginBottom: '12px', padding: '8px 12px', background: 'rgba(245,166,35,.08)', borderRadius: '8px' }}>
                            {!allAgreed ? '☝️ Check all proctoring boxes above.' : (!camOk || !screenOk) ? '☝️ Grant all required permissions above.' : '☝️ Check the agreement above to proceed.'}
                        </div>
                    )}

                    <button className="start-btn" onClick={handleProceed} disabled={!canProceed}
                        style={{ background: canProceed ? 'var(--green)' : '#ccc', boxShadow: canProceed ? '0 4px 20px rgba(0,194,113,.45)' : 'none', cursor: canProceed ? 'pointer' : 'not-allowed', transition: 'background .3s, box-shadow .3s' }}>
                        {canProceed ? '🚀 Proceed to Exam' : ((!camOk || !screenOk) ? '🔒 Grant Permissions First' : '🚀 Proceed to Exam')}
                    </button>

                    <div style={{ textAlign: 'center', marginTop: '16px' }}>
                        <button onClick={() => {
                            window.__procCamStream?.getTracks().forEach(t => t.stop());    window.__procCamStream    = null;
                            window.__procScreenStream?.getTracks().forEach(t => t.stop()); window.__procScreenStream = null;
                            setStage('entry'); setAgreedGeneral(false); setProcAgreed({});
                            setCameraStatus('idle'); setScreenStatus('idle'); setCameraError(''); setScreenError('');
                        }} style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>← Back to entry</button>
                    </div>
                </div>
                <div className={`toast ${toast.show ? 'show' : ''}`} style={{ background: toast.type === 'error' ? '#c0392b' : toast.type === 'info' ? '#1a2540' : '#0d1117' }}>
                    <span>{toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : '✅'}</span><span>{toast.msg}</span>
                </div>
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        );
    }

    // ── ENTRY FORM ────────────────────────────────────────────────────────────
    return (
        <div className="student-entry-wrap">
            <div className="entry-card">
                <div className="logo">Test<span>Buddy</span></div>
                <div className="logo-sub">Online Assessment Platform</div>
                <div className="divider" />
                <div className="exam-title">{link?.name ?? 'Assessment Entry'}</div>
                {link && (
                    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '20px' }}>
                        {ts && <span style={{ fontSize: '12px', fontWeight: 600, padding: '4px 10px', borderRadius: '100px', background: `${ts.color}18`, color: ts.color, border: `1px solid ${ts.color}44` }}>● {ts.label}</span>}
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{fmtDT(link.examStartDateTime)} → {fmtDT(link.examEndDateTime)}</span>
                        <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '100px', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
                            {link.isCredentialBased ? '🔐 Credential-Based' : '🔓 Direct Access'}
                        </span>
                        {hasAnyProc && <span style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '100px', background: 'rgba(224,59,59,.08)', border: '1px solid rgba(224,59,59,.2)', color: 'var(--red)' }}>🔒 Proctored</span>}
                    </div>
                )}
                <div className={`err-msg ${errorMsg ? 'show' : ''}`}>⚠️ <span>{errorMsg}</span></div>
                <div className="form-group">
                    <label className="form-label">Your Email Address</label>
                    <input className={`form-input ${emailError ? 'error' : ''}`} type="email" placeholder="student@example.com"
                        value={email} onChange={e => { clearErr(); setEmail(e.target.value); }} disabled={loading}
                        onKeyDown={e => e.key === 'Enter' && handleVerify()} />
                </div>
                <div className="form-group">
                    <label className="form-label">
                        Access Code
                        <span style={{ marginLeft: '8px', fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--muted)', fontSize: '11px' }}>
                            {/* FIX 3: hint text differs per link type */}
                            {link?.isCredentialBased
                                ? '(your personal code — shared by admin)'
                                : '(shared with all participants)'}
                        </span>
                    </label>
                    <input className={`form-input ${codeError ? 'error' : ''}`} type="text"
                        placeholder={link?.isCredentialBased ? 'Enter your personal access code' : 'Enter access code'}
                        maxLength={10} value={code}
                        onChange={e => { clearErr(); setCode(e.target.value.toUpperCase()); }}
                        disabled={loading} onKeyDown={e => e.key === 'Enter' && handleVerify()}
                        style={{ letterSpacing: '3px', fontFamily: 'var(--font-display)', fontWeight: 700 }} />
                </div>
                <div className="instructions">
                    <div className="instructions-title">📋 Before you begin</div>
                    <ul className="instructions-list">
                        <li><div className="bullet" /><span>Ensure you are in a quiet room with good lighting</span></li>
                        <li><div className="bullet" /><span>Do not switch browser tabs — it will be flagged</span></li>
                        {link?.isImageProctoring && <li><div className="bullet" /><span>Camera access will be required</span></li>}
                        {link?.isScreenRecording && <li><div className="bullet" /><span>Screen sharing will be required</span></li>}
                        <li><div className="bullet" /><span>Once started, the timer cannot be paused</span></li>
                    </ul>
                </div>
                <button className="start-btn" onClick={handleVerify} disabled={loading}>
                    {loading ? '⏳ Verifying…' : 'Verify Access →'}
                </button>
            </div>
            <div className={`toast ${toast.show ? 'show' : ''}`} style={{ background: toast.type === 'error' ? '#c0392b' : toast.type === 'info' ? '#1a2540' : '#0d1117' }}>
                <span>{toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : '✅'}</span><span>{toast.msg}</span>
            </div>
        </div>
    );
};

export default StudentEntry;

