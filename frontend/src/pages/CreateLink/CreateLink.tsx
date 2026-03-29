import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import './CreateLink.css';
import { assessmentsApi, assessmentLinksApi } from '../../services/api';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const toInt = (v: string | number, fallback = 0): number => {
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    return isNaN(n) ? fallback : n;
};

// ═══════════════════════════════════════════════════════════════════════
// BULK UPLOAD MODAL
// ═══════════════════════════════════════════════════════════════════════

interface BulkUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (emails: string[]) => Promise<void>;
}

interface ValidationError {
    row: number;
    email: string;
    error: string;
}

const BulkUploadModal: React.FC<BulkUploadModalProps> = ({ isOpen, onClose, onUpload }) => {
    const [step, setStep] = useState<'initial' | 'preview' | 'uploading' | 'success'>('initial');
    const [emails, setEmails] = useState<string[]>([]);
    const [errors, setErrors] = useState<ValidationError[]>([]);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const validateEmail = (email: string): boolean =>
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            setErrors([{ row: 0, email: '', error: 'File size exceeds 5MB limit' }]);
            return;
        }
        setLoading(true);
        setErrors([]);
        try {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const arrayBuffer = event.target?.result as ArrayBuffer;
                    const workbook    = XLSX.read(arrayBuffer, { type: 'array' });
                    const worksheet   = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonData    = XLSX.utils.sheet_to_json(worksheet) as Array<Record<string, unknown>>;

                    if (jsonData.length === 0) {
                        setErrors([{ row: 0, email: '', error: 'No data found in spreadsheet' }]);
                        setLoading(false); return;
                    }
                    if (jsonData.length > 500) {
                        setErrors([{ row: 0, email: '', error: 'Maximum 500 candidates allowed per upload' }]);
                        setLoading(false); return;
                    }

                    const processedEmails: string[]          = [];
                    const validationErrors: ValidationError[] = [];
                    const emailSet = new Set<string>();

                    jsonData.forEach((row, index) => {
                        const rowNum     = index + 2;
                        const emailValue = row.Email || row.email || row.EMAIL || row['Email Address'] || row['email address'];
                        if (!emailValue) {
                            validationErrors.push({ row: rowNum, email: '', error: 'Email column not found' }); return;
                        }
                        const email = String(emailValue).trim().toLowerCase();
                        if (!validateEmail(email)) {
                            validationErrors.push({ row: rowNum, email, error: 'Invalid email format' }); return;
                        }
                        if (emailSet.has(email)) {
                            validationErrors.push({ row: rowNum, email, error: 'Duplicate email in file' }); return;
                        }
                        emailSet.add(email);
                        processedEmails.push(email);
                    });

                    setEmails(processedEmails);
                    setErrors(validationErrors);
                    setStep('preview');
                } catch (err: unknown) {
                    setErrors([{ row: 0, email: '', error: 'Error reading file: ' + (err instanceof Error ? err.message : 'Unknown error') }]);
                }
                setLoading(false);
            };
            reader.readAsArrayBuffer(file);
        } catch (err: unknown) {
            setErrors([{ row: 0, email: '', error: 'Error: ' + (err instanceof Error ? err.message : 'Unknown error') }]);
            setLoading(false);
        }
    };

    const handleUpload = async () => {
        if (emails.length === 0) return;
        setLoading(true);
        setStep('uploading');
        try {
            await onUpload(emails);
            setStep('success');
            setTimeout(() => { resetModal(); onClose(); }, 2000);
        } catch (err: unknown) {
            setErrors([{ row: 0, email: '', error: err instanceof Error ? err.message : 'Upload failed' }]);
            setStep('preview');
            setLoading(false);
        }
    };

    const handleDownloadSample = () => {
        const csv  = 'Email\nalice@example.com\nbob@example.com\ncarol@example.com\ndavid@example.com';
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'sample_candidates.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const resetModal = () => {
        setStep('initial'); setEmails([]); setErrors([]); setLoading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay open" onClick={(e) => {
            if (e.target === e.currentTarget && step === 'initial') { resetModal(); onClose(); }
        }}>
            <div className="modal" style={{ width: '600px', maxWidth: '90vw' }}>
                <div className="modal-header">
                    <h2 className="modal-title">
                        {step === 'success' ? '✓ Upload Successful' : 'Bulk Upload Candidates'}
                    </h2>
                    <button className="modal-close" onClick={() => { resetModal(); onClose(); }} disabled={step === 'uploading'}>✕</button>
                </div>

                <div className="modal-body" style={{ padding: '28px 24px' }}>

                    {step === 'initial' && (
                        <div style={{ textAlign: 'center' }}>
                            <div style={{ width: '80px', height: '80px', margin: '0 auto 20px', background: 'rgba(0,87,255,.1)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' }}>
                                📊
                            </div>
                            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Upload Candidate List</h3>
                            <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px', lineHeight: '1.6' }}>
                                Select an Excel or CSV file with candidate emails. Max 500 candidates per file.
                            </p>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#0057FF', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
                                onMouseEnter={e => (e.currentTarget.style.background = '#0040bb')}
                                onMouseLeave={e => (e.currentTarget.style.background = '#0057FF')}
                            >
                                📁 Choose File
                                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} disabled={loading} style={{ display: 'none' }} />
                            </label>

                            <div style={{ marginTop: '24px', padding: '16px', background: '#f5f5f5', borderRadius: '10px', fontSize: '12px', color: '#666', textAlign: 'left' }}>
                                <div style={{ marginBottom: '10px' }}>
                                    <strong>Format:</strong> Excel (.xlsx, .xls) or CSV with a single <code>Email</code> column
                                </div>
                                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden', marginBottom: '12px', fontFamily: 'monospace' }}>
                                    <div style={{ padding: '6px 12px', background: '#f0f4ff', borderBottom: '1px solid #e5e7eb', fontSize: '11px', fontWeight: 700, color: '#0040bb', letterSpacing: '0.5px' }}>Email</div>
                                    {['alice@example.com', 'bob@example.com', 'carol@example.com'].map((e, i) => (
                                        <div key={i} style={{ padding: '5px 12px', borderBottom: i < 2 ? '1px solid #f3f4f6' : 'none', fontSize: '11px', color: '#444' }}>{e}</div>
                                    ))}
                                </div>
                                <button onClick={handleDownloadSample}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: '#fff', border: '1.5px solid #d1d5db', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', color: '#333', transition: 'border-color .15s' }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = '#0057FF'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = '#d1d5db'}
                                >
                                    ⬇ Download Sample CSV
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 'preview' && (
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#f0f7ff', border: '1px solid rgba(0,87,255,.2)', borderRadius: '8px', marginBottom: '18px', fontSize: '13px', color: '#0040bb' }}>
                                ✓ {emails.length} valid email{emails.length !== 1 ? 's' : ''} found
                            </div>
                            {errors.length > 0 && (
                                <div style={{ padding: '12px', background: 'rgba(224,59,59,.08)', border: '1px solid rgba(224,59,59,.2)', borderRadius: '8px', marginBottom: '18px' }}>
                                    <div style={{ fontSize: '12px', fontWeight: '600', color: '#c0392b', marginBottom: '8px' }}>⚠ {errors.length} row{errors.length !== 1 ? 's' : ''} with errors:</div>
                                    <div style={{ maxHeight: '150px', overflowY: 'auto', fontSize: '12px', color: '#666' }}>
                                        {errors.map((err, idx) => (
                                            <div key={idx} style={{ marginBottom: '6px' }}>
                                                <div style={{ fontWeight: '500' }}>Row {err.row}: {err.email || '(empty)'}</div>
                                                <div style={{ fontSize: '11px', marginLeft: '8px' }}>• {err.error}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div style={{ marginBottom: '18px' }}>
                                <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '10px' }}>Preview ({Math.min(3, emails.length)} of {emails.length}):</div>
                                <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                                    {emails.slice(0, 3).map((email, idx) => (
                                        <div key={idx} style={{ padding: '10px 12px', borderBottom: idx < Math.min(3, emails.length) - 1 ? '1px solid #e5e7eb' : 'none', fontSize: '12px', fontFamily: 'monospace' }}>{email}</div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 'uploading' && (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ width: '60px', height: '60px', margin: '0 auto 20px', background: 'rgba(0,87,255,.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', animation: 'spin 1s linear infinite' }}>⏳</div>
                            <p style={{ fontSize: '14px', fontWeight: '500' }}>Adding {emails.length} candidate{emails.length !== 1 ? 's' : ''}...</p>
                        </div>
                    )}

                    {step === 'success' && (
                        <div style={{ textAlign: 'center', padding: '20px 0' }}>
                            <div style={{ width: '80px', height: '80px', margin: '0 auto 20px', background: 'rgba(0,194,113,.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '40px' }}>✓</div>
                            <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>Added to list!</h3>
                            <p style={{ fontSize: '13px', color: '#888' }}>{emails.length} candidate{emails.length !== 1 ? 's' : ''} added. They'll be sent when you generate the link.</p>
                        </div>
                    )}
                </div>

                {step === 'preview' && (
                    <div className="modal-footer" style={{ padding: '16px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '10px' }}>
                        <button onClick={() => fileInputRef.current?.click()} style={{ flex: 1, padding: '10px 16px', border: '1.5px solid #e5e7eb', borderRadius: '8px', background: '#fff', color: '#333', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                            Choose Different File
                        </button>
                        <button onClick={handleUpload} disabled={emails.length === 0 || loading} style={{ flex: 1, padding: '10px 16px', background: emails.length === 0 ? '#ccc' : '#0057FF', color: '#fff', border: 'none', borderRadius: '8px', cursor: emails.length === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '500' }}>
                            Add {emails.length} to List
                        </button>
                    </div>
                )}
                <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

const CreateLink: React.FC = () => {
    const location = useLocation();
    const prefill  = (location.state as any)?.prefill ?? null;

    const [toast,           setToast]           = useState({ show: false, msg: '', type: 'success' });
    const [modalQR,         setModalQR]         = useState(false);
    const [modalBulkUpload, setModalBulkUpload] = useState(false);
    const [loading,         setLoading]         = useState(false);
    const [realAssessments, setRealAssessments] = useState<any[]>([]);

    const showToast = (msg: string, tType: 'success' | 'info' | 'error' | 'delete' = 'success') => {
        setToast({ show: true, msg, type: tType });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
    const [linkName,   setLinkName]   = useState('');
    const [accessCode, setAccessCode] = useState('');
    const [startDate,  setStartDate]  = useState('');
    const [endDate,    setEndDate]    = useState('');
    const [attempts,   setAttempts]   = useState('1');
    const [cap,        setCap]        = useState('100');

    const [opts, setOpts] = useState({ credAccess: true, shuffleQs: true, sendInvitations: true });
    const toggleOpt = (k: keyof typeof opts) => setOpts(p => ({ ...p, [k]: !p[k] }));

    const [procWeb,        setProcWeb]        = useState<boolean>(false);
    const [procImage,      setProcImage]      = useState<boolean>(false);
    const [webWarnings,    setWebWarnings]    = useState<number>(3);
    const [imgCount,       setImgCount]       = useState<number>(5);
    const [warnAction,     setWarnAction]     = useState<'warn' | 'terminate'>('warn');
    const [procScreen,     setProcScreen]     = useState<boolean>(false);
    const [screenDuration, setScreenDuration] = useState<number>(60);
    const [screenQuality,  setScreenQuality]  = useState<'Low' | 'Medium' | 'High'>('Medium');
    const anyProctor = procWeb || procImage || procScreen;

    const [startupInst, setStartupInst] = useState('Please ensure you are in a quiet room with good lighting. Keep your camera on throughout the exam. Do not switch browser tabs — it will be flagged and reported.');
    const [compMsg,     setCompMsg]     = useState('Thank you for completing the assessment. Your responses have been recorded. Results will be reviewed and shared within 24 hours.');
    const [generatedLink, setGeneratedLink] = useState<string | null>(null);

    const [emailInput,    setEmailInput]    = useState('');
    const [pendingEmails, setPendingEmails] = useState<string[]>([]);
    const [addedEmails,   setAddedEmails]   = useState<string[]>([]);

    useEffect(() => {
        (async () => {
            try {
                const res  = await assessmentsApi.getAll();
                const list: any[] = Array.isArray(res.data)
                    ? res.data
                    : (res.data?.items ?? res.data?.data ?? res.data?.value ?? []);

                let finalList = list;
                if (prefill?.assessmentId) {
                    const exists = list.some(a => (a.id ?? a.Id) === prefill.assessmentId);
                    if (!exists) {
                        finalList = [{
                            id: prefill.assessmentId, title: prefill.assessmentTitle,
                            totalQuestions: prefill.totalQuestions, durationMinutes: prefill.durationMinutes,
                            marksPerQuestion: prefill.marksPerQuestion, negativeMarks: prefill.negativeMarks ?? 0,
                            isActive: prefill.isActive ?? true,
                        }, ...list];
                    }
                    setSelectedAssessmentId(prefill.assessmentId);
                } else if (list.length > 0) {
                    setSelectedAssessmentId(list[0].id ?? list[0].Id ?? '');
                }
                setRealAssessments(finalList);
            } catch {
                showToast('Failed to load assessments', 'error');
            }
        })();
        refreshCode();
        const now    = new Date();
        const future = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const fmt    = (d: Date) => d.toISOString().slice(0, 16);
        setStartDate(fmt(now));
        setEndDate(fmt(future));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const refreshCode = () => {
        let code = '';
        for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
        setAccessCode(code);
    };

    const toLocalISO = (dt: string): string => dt.length === 16 ? `${dt}:00` : dt;

    const buildPayload = () => ({
        name:                    linkName.trim(),
        assessmentId:            selectedAssessmentId,
        examStartDateTime:       toLocalISO(startDate),
        examEndDateTime:         toLocalISO(endDate),
        isCredentialBased:       opts.credAccess,
        accessCode:              accessCode.trim(),
        maxAttempts:             toInt(attempts, 1),
        // ── shuffleQuestions: when true, each candidate sees questions in a
        // different random order. All candidates get the same questions but
        // the sequence differs — prevents copying from neighbours.
        shuffleQuestions:        opts.shuffleQs,
        startupInstruction:      startupInst,
        completeInstruction:     compMsg,
        maxStudents:             opts.credAccess ? pendingEmails.length : (toInt(cap, 0) || null),
        isWebProctoring:         procWeb,
        webProctoringWarnings:   procWeb ? webWarnings : 0,
        isImageProctoring:       procImage,
        imageProctoringCount:    procImage ? imgCount : 0,
        isScreenRecording:       procScreen,
        screenRecordingDuration: procScreen ? screenDuration : null,
        screenRecordingQuality:  procScreen ? screenQuality : 'Medium',
        warningAction:           anyProctor ? warnAction : 'warn',
        credentialBasedUsers:    opts.credAccess ? pendingEmails : [],
        sendInvitations:         opts.sendInvitations,
    });

    const selectedInfo = realAssessments.find(a => (a.id ?? a.Id) === selectedAssessmentId) ?? null;
    const fmtDate = (r: string) => !r ? '—' : new Date(r).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

    const capLabel = opts.credAccess
        ? `${pendingEmails.length} candidates (auto)`
        : cap ? (cap !== '0' ? `${cap} candidates` : 'Unlimited') : 'Unlimited';

    const parseEmails = (raw: string): string[] =>
        raw.split(/[,;\n\s]+/).map(e => e.trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    const handleAddToList = (emailsToAdd: string[]) => {
        if (!emailsToAdd.length) { showToast('Enter at least one valid email.', 'error'); return; }
        const deduped = emailsToAdd.filter(e => !pendingEmails.includes(e) && !addedEmails.includes(e));
        if (!deduped.length) { showToast('All emails already in list.', 'info'); return; }
        setPendingEmails(prev => [...prev, ...deduped]);
        setEmailInput('');
        showToast(`${deduped.length} candidate${deduped.length !== 1 ? 's' : ''} added to list.`);
    };

    const handleBulkUpload = async (emails: string[]) => { handleAddToList(emails); };
    const handleManualAdd  = () => { handleAddToList(parseEmails(emailInput)); };
    const removeEmail      = (email: string) => setPendingEmails(prev => prev.filter(e => e !== email));

    const handleGenerate = async () => {
        if (!selectedAssessmentId) { showToast('Please select an assessment.',    'error'); return; }
        if (!linkName.trim())      { showToast('Please enter a link name.',       'error'); return; }
        if (!accessCode.trim())    { showToast('Please set an access code.',      'error'); return; }
        if (!startDate || !endDate){ showToast('Please set start and end dates.', 'error'); return; }

        setLoading(true);
        try {
            const res     = await assessmentLinksApi.create(buildPayload());
            const responseData = res.data;
            const linkId  = responseData?.linkId ?? responseData?.LinkId ?? responseData?.id ?? responseData?.Id;
            const fullUrl = `${window.location.origin}/exam-entry/${linkId}`;
            setGeneratedLink(fullUrl);
            setAddedEmails(opts.credAccess ? [...pendingEmails] : []);
            setPendingEmails([]);
            setEmailInput('');
            
            const emailCount = responseData?.createdUsers?.length ?? pendingEmails.length;
            if (opts.sendInvitations && emailCount > 0) {
                showToast(`Exam link generated! Invitation emails queued for ${emailCount} candidate${emailCount !== 1 ? 's' : ''}.`, 'success');
            } else {
                showToast('Exam link generated successfully!', 'success');
            }
        } catch (err: any) {
            showToast(err?.response?.data?.message ?? err?.response?.data?.title ?? JSON.stringify(err?.response?.data) ?? 'Failed to generate exam link.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-link-container">

            <div className="page-header">
                <div>
                    <div className="page-title">
                        Create {prefill?.assessmentTitle ?? selectedInfo?.title ?? selectedInfo?.Title ?? ''} Exam Link
                    </div>
                    <div className="page-sub">Generate a shareable link for candidates to access this assessment.</div>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => (window.location.href = '/assessments')}>← Back</button>
                    <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={loading}>
                        {loading ? '⏳ Generating…' : '🔗 Generate Link'}
                    </button>
                </div>
            </div>

            <div className="form-layout">
                <div>

                    {/* ══ Link Configuration ══ */}
                    <div className="section-card">
                        <div className="section-header">
                            <div className="section-title"><div className="section-title-icon si-blue">🔗</div>Link Configuration</div>
                        </div>
                        <div className="section-body">
                            <div className="form-row" style={{ marginBottom: '18px' }}>
                                <div className="form-group">
                                    <label className="form-label">Link Name <span className="req">*</span></label>
                                    <input type="text" value={linkName} onChange={e => setLinkName(e.target.value)} placeholder="e.g. Batch A — March 2025" />
                                    <div className="form-hint">Saved to DB column: <code>Name</code></div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Access Code <span className="req">*</span></label>
                                    <div className="code-field-wrap">
                                        <input type="text" value={accessCode} onChange={e => setAccessCode(e.target.value)} maxLength={10} />
                                        <div className="code-refresh" onClick={refreshCode} title="Regenerate">↻</div>
                                    </div>
                                    <div className="form-hint">
                                        {opts.credAccess
                                            ? '🔐 Credential-based: each candidate gets their own unique code.'
                                            : 'Shared access code for all candidates.'}
                                    </div>
                                </div>
                            </div>

                            <div className="form-row" style={{ marginBottom: '18px' }}>
                                <div className="form-group">
                                    <label className="form-label">Start Date &amp; Time <span className="req">*</span></label>
                                    <input type="datetime-local" value={startDate} onChange={e => setStartDate(e.target.value)} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">End Date &amp; Time <span className="req">*</span></label>
                                    <input type="datetime-local" value={endDate} onChange={e => setEndDate(e.target.value)} />
                                </div>
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Max Attempts Per Candidate</label>
                                    <select value={attempts} onChange={e => setAttempts(e.target.value)}>
                                        <option value="1">1 attempt only</option>
                                        <option value="2">2 attempts</option>
                                        <option value="3">3 attempts</option>
                                        <option value="0">Unlimited</option>
                                    </select>
                                    <div className="form-hint">Applies to both credential and direct access.</div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label" style={{ opacity: opts.credAccess ? 0.45 : 1 }}>Max Candidates (Cap)</label>
                                    <input
                                        type="number" min={1}
                                        value={opts.credAccess ? '' : cap}
                                        placeholder={opts.credAccess ? 'Auto — set by candidate list' : 'e.g. 100'}
                                        onChange={e => setCap(e.target.value)}
                                        disabled={opts.credAccess}
                                        style={{ opacity: opts.credAccess ? 0.45 : 1, cursor: opts.credAccess ? 'not-allowed' : 'text' }}
                                    />
                                    <div className="form-hint">
                                        {opts.credAccess ? '🔐 Credential-based: cap = number of listed candidates.' : 'Leave empty for no limit.'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ══ Exam Options ══ */}
                    <div className="section-card">
                        <div className="section-header">
                            <div className="section-title"><div className="section-title-icon si-green">⚙️</div>Exam Options</div>
                        </div>
                        <div className="section-body">
                            {[
                                { k: 'credAccess' as const, label: 'Credential-Based Access',    sub: 'Each candidate gets a unique personal access code.' },
                                { k: 'shuffleQs'  as const, label: 'Shuffle Questions Per Candidate', sub: 'All candidates get the same questions but in a different random order — prevents copying. Each candidate sees a unique sequence.' },
                                { k: 'sendInvitations' as const, label: 'Send Invitation Emails', sub: 'Automatically email candidates with their personal access codes via RabbitMQ queue.' },
                            ].map(s => (
                                <div className="toggle-row" key={s.k}>
                                    <div className="toggle-info">
                                        <div className="toggle-label">{s.label}</div>
                                        <div className="toggle-sub">{s.sub}</div>
                                    </div>
                                    <div className={`toggle blue ${opts[s.k] ? 'on' : ''}`} onClick={() => toggleOpt(s.k)} />
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ══ Proctoring ══ */}
                    <div className="section-card">
                        <div className="section-header">
                            <div className="section-title"><div className="section-title-icon si-red">🔒</div>Proctoring Settings</div>
                            {anyProctor
                                ? <span className="badge badge-active" style={{ fontSize: '11px' }}><span className="bdot" /> Active</span>
                                : <span style={{ fontSize: '12px', color: 'var(--muted)' }}>All off</span>}
                        </div>
                        <div className="section-body">
                            {anyProctor && (
                                <div className="proctor-detail-row" style={{ marginBottom: '8px' }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">On Violation — Warning Action</label>
                                        <select value={warnAction} onChange={e => setWarnAction(e.target.value as 'warn' | 'terminate')}>
                                            <option value="warn">Warn candidate only</option>
                                            <option value="terminate">Terminate exam immediately</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                            <div className="toggle-row">
                                <div className="toggle-info"><div className="toggle-label">Web / Tab Proctoring</div><div className="toggle-sub">Detects tab switches and window focus loss.</div></div>
                                <div className={`toggle blue ${procWeb ? 'on' : ''}`} onClick={() => setProcWeb(v => !v)} />
                            </div>
                            {procWeb && (
                                <div className="proctor-detail-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Allowed Warnings</label>
                                        <select value={webWarnings} onChange={e => setWebWarnings(toInt(e.target.value, 3))}>
                                            <option value={0}>0 — immediate action</option>
                                            <option value={1}>1 warning</option>
                                            <option value={2}>2 warnings</option>
                                            <option value={3}>3 warnings</option>
                                            <option value={5}>5 warnings</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                            <div className="toggle-row">
                                <div className="toggle-info"><div className="toggle-label">Image / Snapshot Proctoring</div><div className="toggle-sub">Captures webcam snapshots during exam.</div></div>
                                <div className={`toggle blue ${procImage ? 'on' : ''}`} onClick={() => setProcImage(v => !v)} />
                            </div>
                            {procImage && (
                                <div className="proctor-detail-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Snapshots</label>
                                        <select value={imgCount} onChange={e => setImgCount(toInt(e.target.value, 5))}>
                                            <option value={3}>3</option><option value={5}>5</option>
                                            <option value={10}>10</option><option value={20}>20</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                            <div className="toggle-row">
                                <div className="toggle-info"><div className="toggle-label">Screen Recording</div><div className="toggle-sub">Records entire screen during exam.</div></div>
                                <div className={`toggle blue ${procScreen ? 'on' : ''}`} onClick={() => setProcScreen(v => !v)} />
                            </div>
                            {procScreen && (
                                <div className="proctor-detail-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Duration</label>
                                        <select value={screenDuration} onChange={e => setScreenDuration(toInt(e.target.value, 60))}>
                                            <option value={15}>15 min</option><option value={30}>30 min</option><option value={60}>Full exam</option>
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Quality</label>
                                        <select value={screenQuality} onChange={e => setScreenQuality(e.target.value as any)}>
                                            <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                                        </select>
                                    </div>
                                </div>
                            )}
                            {!anyProctor && <div className="proctor-off-note">🔓 No proctoring enabled</div>}
                        </div>
                    </div>

                    {/* ══ Candidate Instructions ══ */}
                    <div className="section-card">
                        <div className="section-header">
                            <div className="section-title"><div className="section-title-icon si-yellow">📋</div>Candidate Instructions</div>
                        </div>
                        <div className="section-body">
                            <div className="form-row full" style={{ marginBottom: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">Startup Instructions</label>
                                    <textarea value={startupInst} onChange={e => setStartupInst(e.target.value)} />
                                    <div className="form-hint">Shown to candidates before the exam starts.</div>
                                </div>
                            </div>
                            <div className="form-row full">
                                <div className="form-group">
                                    <label className="form-label">Completion Message</label>
                                    <textarea value={compMsg} onChange={e => setCompMsg(e.target.value)} />
                                    <div className="form-hint">Shown to candidates after they submit.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ══ Candidate Management (Credential-Based only) ══ */}
                    {opts.credAccess && (
                        <div className="section-card">
                            <div className="section-header">
                                <div className="section-title"><div className="section-title-icon si-purple">👥</div>Candidate Management</div>
                                <span className="badge badge-active" style={{ fontSize: '11px' }}><span className="bdot" /> Credential-Based</span>
                            </div>
                            <div className="section-body">
                                <div className="user-mgmt-note">
                                    <span>🔐</span>
                                    <span>
                                        Since this link is <strong>Credential-Based</strong>, only listed candidates can attempt the exam.
                                        Each candidate will receive a <strong>unique personal access code</strong> saved to <code>AssessmentLinkUser</code>.
                                    </span>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '18px', marginBottom: '10px' }}>
                                    <label className="form-label" style={{ margin: 0 }}>Candidate Emails</label>
                                    <button
                                        onClick={() => setModalBulkUpload(true)}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '500', color: '#0057FF' }}
                                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,87,255,.08)'; }}
                                        onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
                                    >
                                        📊 Bulk Upload
                                    </button>
                                </div>

                                <textarea
                                    placeholder={"Enter emails separated by commas, semicolons, or new lines…\ne.g.\nalice@example.com\nbob@example.com, carol@example.com"}
                                    rows={4}
                                    value={emailInput}
                                    onChange={e => { setEmailInput(e.target.value); setPendingEmails(parseEmails(e.target.value)); }}
                                    style={{ fontFamily: 'monospace', fontSize: '13px', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: '9px', width: '100%', boxSizing: 'border-box' }}
                                />
                                <div className="form-hint" style={{ marginTop: '6px' }}>
                                    {pendingEmails.length > 0
                                        ? `${pendingEmails.length} valid email${pendingEmails.length !== 1 ? 's' : ''} detected`
                                        : 'Accepts comma, semicolon, or newline-separated emails'}
                                </div>

                                <button className="btn btn-primary btn-sm" style={{ marginTop: '8px', width: '100%' }} onClick={handleManualAdd} disabled={pendingEmails.length === 0}>
                                    {`+ Add ${pendingEmails.length > 0 ? pendingEmails.length + ' ' : ''}Candidate${pendingEmails.length !== 1 ? 's' : ''} to List`}
                                </button>

                                {!generatedLink && pendingEmails.length > 0 && (
                                    <div className="form-hint" style={{ marginTop: '6px', color: 'var(--accent2)' }}>
                                        ℹ️ {pendingEmails.length} candidate{pendingEmails.length !== 1 ? 's' : ''} will receive invitation emails {opts.sendInvitations ? 'on Generate (via RabbitMQ)' : 'only if sent manually later'}.
                                    </div>
                                )}
                                {generatedLink && addedEmails.length > 0 && (
                                    <div className="form-hint" style={{ marginTop: '6px', color: 'var(--green)' }}>
                                        ✅ {addedEmails.length} candidate{addedEmails.length !== 1 ? 's' : ''} sent with this link.
                                    </div>
                                )}

                                {(pendingEmails.length > 0 || addedEmails.length > 0) && (
                                    <div className="added-users-list">
                                        <div className="added-users-header">
                                            <span>{generatedLink ? `✅ Sent (${addedEmails.length})` : `📋 Pending (${pendingEmails.length})`}</span>
                                            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                                                {generatedLink ? 'Saved to AssessmentLinkUser' : 'Will be sent on Generate'}
                                            </span>
                                        </div>
                                        {(generatedLink ? addedEmails : pendingEmails).map(email => (
                                            <div key={email} className="added-user-row">
                                                <div className="added-user-avatar">{email[0].toUpperCase()}</div>
                                                <span className="added-user-email">{email}</span>
                                                {!generatedLink && (
                                                    <button className="added-user-remove" onClick={() => removeEmail(email)} title="Remove">✕</button>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>

                {/* ── RIGHT PANEL ── */}
                <div className="right-panel">
                    <div className="link-preview-card">
                        <div className="lp-label">Generated Link</div>
                        {generatedLink ? (
                            <>
                                <div className="lp-url">{generatedLink}</div>
                                <div className="lp-actions">
                                    <button className="lp-btn lp-btn-copy" onClick={() => { navigator.clipboard.writeText(generatedLink); showToast('Link copied!'); }}>📋 Copy</button>
                                    <button className="lp-btn lp-btn-qr" onClick={() => setModalQR(true)}>⬛ QR</button>
                                </div>
                            </>
                        ) : (
                            <div className="lp-url" style={{ opacity: 0.4 }}>Fill the form and click Generate</div>
                        )}
                        <div className="lp-divider" />
                        <div className="lp-stats">
                            <div className="lp-stat"><div className="lp-stat-num">{selectedInfo?.totalQuestions ?? selectedInfo?.TotalQuestions ?? 0}</div><div className="lp-stat-label">Questions</div></div>
                            <div className="lp-stat"><div className="lp-stat-num">{selectedInfo?.durationMinutes ?? selectedInfo?.DurationMinutes ?? 0}m</div><div className="lp-stat-label">Duration</div></div>
                            <div className="lp-stat">
                                <div className="lp-stat-num">{opts.credAccess ? pendingEmails.length : (cap || '∞')}</div>
                                <div className="lp-stat-label">Cap</div>
                            </div>
                        </div>
                    </div>

                    <div className="info-panel">
                        <div className="info-panel-header"><div className="info-panel-title">📋 Link Summary</div></div>
                        <div className="info-panel-body">
                            {[
                                { key: 'Assessment',      val: selectedInfo?.title ?? selectedInfo?.Title ?? 'None' },
                                { key: 'Name',            val: linkName || '—' },
                                { key: 'Access Code',     val: opts.credAccess ? 'Per-candidate (unique)' : (accessCode || 'XXXXXX') },
                                { key: 'Window Opens',    val: fmtDate(startDate) },
                                { key: 'Window Closes',   val: fmtDate(endDate) },
                                { key: 'Max Attempts',    val: attempts === '0' ? 'Unlimited' : `${attempts} attempt${attempts !== '1' ? 's' : ''}` },
                                { key: 'Candidate Cap',   val: capLabel },
                                { key: 'Shuffle Qs',      val: opts.shuffleQs ? '✓ On — unique order per candidate' : '✗ Off — same order for all' },
                                { key: 'Proctoring',      val: anyProctor ? [procWeb && 'Web', procImage && 'Image', procScreen && 'Screen'].filter(Boolean).join(', ') : 'None' },
                            ].map(r => (
                                <div className="summary-row" key={r.key}>
                                    <span className="summary-key">{r.key}</span>
                                    <span className="summary-val" style={
                                        r.key === 'Access Code' && !opts.credAccess ? { fontFamily: '"Syne",sans-serif', letterSpacing: '2px', color: 'var(--accent2)' } :
                                        r.key === 'Proctoring' && anyProctor ? { color: 'var(--green)' } :
                                        r.key === 'Shuffle Qs' && opts.shuffleQs ? { color: 'var(--green)' } : {}
                                    }>{r.val}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="info-panel">
                        <div className="info-panel-header"><div className="info-panel-title">✅ Ready to Generate?</div></div>
                        <div className="info-panel-body">
                            <div className="checklist">
                                {[
                                    { label: 'Assessment selected', done: !!selectedAssessmentId   },
                                    { label: 'Link name entered',   done: !!linkName.trim()        },
                                    { label: 'Access code set',     done: !!accessCode             },
                                    { label: 'Date window set',     done: !!(startDate && endDate) },
                                    { label: 'Link generated',      done: !!generatedLink          },
                                ].map((c, i) => (
                                    <div key={i} className={`check-item ${c.done ? 'done-item' : 'pending-item'}`}>
                                        <div className={`check-dot ${c.done ? 'done' : 'pending'}`}>{c.done ? '✓' : '○'}</div>
                                        <span>{c.label}</span>
                                    </div>
                                ))}
                            </div>
                            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '16px' }} onClick={handleGenerate} disabled={loading}>
                                {loading ? '⏳ Generating…' : '🔗 Generate Link'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <BulkUploadModal isOpen={modalBulkUpload} onClose={() => setModalBulkUpload(false)} onUpload={handleBulkUpload} />

            {/* QR Modal */}
            <div className={`modal-overlay ${modalQR ? 'open' : ''}`} onClick={e => { if (e.target === e.currentTarget) setModalQR(false); }}>
                <div className="modal">
                    <div className="modal-header"><div className="modal-title">QR Code</div><div className="modal-close" onClick={() => setModalQR(false)}>✕</div></div>
                    <div className="modal-body">
                        <div className="qr-box">⬛</div>
                        <div className="qr-url">{generatedLink}</div>
                        <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>Scan to open the exam entry page directly.</p>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { showToast('Downloading QR…', 'info'); setModalQR(false); }}>⬇ Download PNG</button>
                        <button className="btn btn-primary btn-sm"   style={{ flex: 1, justifyContent: 'center' }} onClick={() => { navigator.clipboard.writeText(generatedLink || ''); showToast('Link copied!'); setModalQR(false); }}>📋 Copy Link</button>
                    </div>
                </div>
            </div>

            <div className={`toast ${toast.show ? 'show' : ''}`} style={{ background: toast.type === 'error' ? '#c0392b' : toast.type === 'delete' ? '#444' : toast.type === 'info' ? '#1a2540' : '#0d1117' }}>
                <span>{toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : toast.type === 'delete' ? '🗑️' : '✅'}</span>
                <span>{toast.msg}</span>
            </div>

        </div>
    );
};

export default CreateLink;