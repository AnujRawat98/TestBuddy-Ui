import React, { useState, useEffect } from 'react';
import './CreateLink.css';
import { assessmentsApi, assessmentLinksApi } from '../../services/api';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const CreateLink: React.FC = () => {
    const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
    const [modalQR, setModalQR] = useState(false);
    const [loading, setLoading] = useState(false);
    const [realAssessments, setRealAssessments] = useState<any[]>([]);

    const showToast = (msg: string, tType: 'success' | 'info' | 'error' | 'delete' = 'success') => {
        setToast({ show: true, msg, type: tType });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const [selectedAssessmentId, setSelectedAssessmentId] = useState('');
    const [linkName, setLinkName] = useState('Batch A — March 2025');
    const [accessCode, setAccessCode] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [attempts, setAttempts] = useState('1');
    const [cap, setCap] = useState('100');

    // Opts
    const [opts, setOpts] = useState<Record<string, boolean>>({
        credAccess: true,
        emailVerify: false,
        allowLate: false,
        shuffleQs: true,
        shuffleOpts: true,
        showResult: true,
        webProctor: true,
        imgProctor: true,
        vidProctor: false,
        fullScreen: true,
        faceDetect: false
    });
    const toggleOpt = (s: string) => setOpts(p => ({ ...p, [s]: !p[s] }));

    const [startupInst, setStartupInst] = useState('Please ensure you are in a quiet room with good lighting. Keep your camera on throughout the exam. Do not switch browser tabs — it will be flagged and reported.');
    const [compMsg, setCompMsg] = useState('Thank you for completing the assessment. Your responses have been recorded. Results will be reviewed and shared within 24 hours.');

    const [generatedLink, setGeneratedLink] = useState<string | null>(null);

    useEffect(() => {
        const fetchAssessments = async () => {
            try {
                const res = await assessmentsApi.getAll();
                setRealAssessments(res.data);
                if (res.data.length > 0) {
                    setSelectedAssessmentId(res.data[0].id);
                }
            } catch (err) {
                console.error('Failed to load assessments', err);
                // Fallback to empty or show error toast if needed
            }
        };
        fetchAssessments();
        refreshCode();

        // Default dates: now and +2 hours
        const now = new Date();
        const future = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const formatForInput = (d: Date) => d.toISOString().slice(0, 16);
        setStartDate(formatForInput(now));
        setEndDate(formatForInput(future));
    }, []);

    const refreshCode = () => {
        let code = '';
        for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
        setAccessCode(code);
    };

    const handleGenerate = async () => {
        if (!selectedAssessmentId) { showToast('Please select an assessment.', 'error'); return; }
        if (!linkName.trim()) { showToast('Please enter a link name / label.', 'error'); return; }
        if (!accessCode.trim()) { showToast('Please set an access code.', 'error'); return; }
        if (!startDate || !endDate) { showToast('Please set start and end dates.', 'error'); return; }

        setLoading(true);
        try {
            const payload = {
                assessmentId: selectedAssessmentId,
                examStartDateTime: new Date(startDate).toISOString(),
                examEndDateTime: new Date(endDate).toISOString(),
                isCredentialBased: opts.credAccess,
                accessCode: accessCode,
                maxAttempts: parseInt(attempts),
                shuffleQuestions: opts.shuffleQs,
                startupInstruction: startupInst,
                completeInstruction: compMsg
            };

            const res = await assessmentLinksApi.create(payload);
            // Assuming res.data contains the new link object with an ID or URL
            const linkId = res.data.id || res.data;
            const baseUrl = window.location.origin;
            setGeneratedLink(`${baseUrl}/exam-entry/${linkId}`);
            showToast('Exam link generated successfully! Ready to share.', 'success');
        } catch (err) {
            console.error(err);
            showToast('Failed to generate exam link.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const selectedInfo = realAssessments.find(a => a.id === selectedAssessmentId) || null;

    const formatRawDate = (r: string) => {
        if (!r) return '—';
        const d = new Date(r);
        return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    };

    const capLabel = cap ? (cap !== '0' ? cap + ' students' : 'unlimited') : 'unlimited';

    return (
        <div className="create-link-container">
            <div className="page-header">
                <div>
                    <div className="page-title">Create Exam Link</div>
                    <div className="page-sub">Generate a shareable link for students to access an assessment.</div>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => (window.location.href = '/dashboard')}>← Back to Dashboard</button>
                    <button className="btn btn-primary btn-sm" onClick={handleGenerate} disabled={loading}>
                        {loading ? 'Generating...' : '🔗 Generate Link'}
                    </button>
                </div>
            </div>

            <div className="form-layout">
                <div>
                    {/* SECTION 1 */}
                    <div className="section-card">
                        <div className="section-header">
                            <div className="section-title"><div className="section-title-icon si-orange">📝</div>Select Assessment</div>
                            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{realAssessments.length} available</span>
                        </div>
                        <div className="section-body">
                            {realAssessments.length === 0 ? (
                                <div className="no-data-msg">No assessments found. Please create one first.</div>
                            ) : (
                                realAssessments.map(asmt => (
                                    <div
                                        key={asmt.id}
                                        className={`assessment-select-card ${selectedAssessmentId === asmt.id ? 'selected' : ''}`}
                                        onClick={() => setSelectedAssessmentId(asmt.id)}
                                    >
                                        <div className="asc-inner">
                                            <div className="asc-radio"></div>
                                            <div className="asc-icon">📝</div>
                                            <div className="asc-body">
                                                <div className="asc-name">{asmt.title}</div>
                                                <div className="asc-meta">
                                                    <span>{asmt.totalQuestions} questions</span>
                                                    <span>{asmt.durationMinutes} min</span>
                                                    <span>{asmt.totalQuestions * (asmt.marksPerQuestion || 1)} marks</span>
                                                </div>
                                            </div>
                                            <div className="asc-badges">
                                                <span className="badge badge-active"><span className="bdot"></span>Active</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* SECTION 2 */}
                    <div className="section-card">
                        <div className="section-header">
                            <div className="section-title"><div className="section-title-icon si-blue">🔗</div>Link Configuration</div>
                        </div>
                        <div className="section-body">
                            <div className="form-row" style={{ marginBottom: '18px' }}>
                                <div className="form-group">
                                    <label className="form-label">Link Name / Label <span className="req">*</span></label>
                                    <input type="text" value={linkName} onChange={e => setLinkName(e.target.value)} placeholder="e.g. Batch A — March 2025" />
                                    <div className="form-hint">Internal label to identify this link.</div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Access Code <span className="req">*</span></label>
                                    <div className="code-field-wrap">
                                        <input type="text" value={accessCode} onChange={e => setAccessCode(e.target.value)} maxLength={10} />
                                        <div className="code-refresh" onClick={refreshCode} title="Generate random code">↻</div>
                                    </div>
                                    <div className="form-hint">Students enter this to unlock the exam.</div>
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
                                    <label className="form-label">Max Attempts Per Student</label>
                                    <select value={attempts} onChange={e => setAttempts(e.target.value)}>
                                        <option value="1">1 attempt only</option>
                                        <option value="2">2 attempts</option>
                                        <option value="3">3 attempts</option>
                                        <option value="0">Unlimited</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Max Students (Cap)</label>
                                    <input type="number" value={cap} min={1} placeholder="e.g. 100" onChange={e => setCap(e.target.value)} />
                                    <div className="form-hint">Leave empty for no limit.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3 */}
                    <div className="section-card">
                        <div className="section-header">
                            <div className="section-title"><div className="section-title-icon si-green">⚙️</div>Options</div>
                        </div>
                        <div className="section-body">
                            <div className="sec-divider"><div className="sec-divider-line"></div><div className="sec-divider-text">Access</div><div className="sec-divider-line"></div></div>
                            {[
                                { k: 'credAccess', label: 'Credential-Based Access', sub: 'Only students with registered emails and the access code can attempt.' },
                                { k: 'emailVerify', label: 'Require Email Verification', sub: 'Send a verification OTP before allowing access to the exam.' },
                                { k: 'allowLate', label: 'Allow Late Entry', sub: 'Students can join up to 15 minutes after the exam start time.' },
                            ].map(s => (
                                <div className="toggle-row" key={s.k}>
                                    <div className="toggle-info"><div className="toggle-label">{s.label}</div><div className="toggle-sub">{s.sub}</div></div>
                                    <div className={`toggle ${opts[s.k] ? 'on' : ''}`} onClick={() => toggleOpt(s.k)}></div>
                                </div>
                            ))}

                            <div className="sec-divider"><div className="sec-divider-line"></div><div className="sec-divider-text">Exam Behaviour</div><div className="sec-divider-line"></div></div>
                            {[
                                { k: 'shuffleQs', label: 'Shuffle Questions', sub: 'Randomise question order for each student to minimise cheating.' },
                                { k: 'shuffleOpts', label: 'Shuffle Answer Options', sub: 'Randomise MCQ answer order for each student.' },
                                { k: 'showResult', label: 'Show Result Immediately', sub: 'Students see their score and answers right after submitting.' },
                            ].map(s => (
                                <div className="toggle-row" key={s.k}>
                                    <div className="toggle-info"><div className="toggle-label">{s.label}</div><div className="toggle-sub">{s.sub}</div></div>
                                    <div className={`toggle ${opts[s.k] ? 'on' : ''}`} onClick={() => toggleOpt(s.k)}></div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* SECTION 4 Student Instructions */}
                    <div className="section-card">
                        <div className="section-header">
                            <div className="section-title"><div className="section-title-icon si-yellow">📋</div>Student Instructions</div>
                        </div>
                        <div className="section-body">
                            <div className="form-row full" style={{ marginBottom: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">Startup Instructions</label>
                                    <textarea value={startupInst} onChange={e => setStartupInst(e.target.value)} />
                                    <div className="form-hint">Shown to students on the entry screen before they begin.</div>
                                </div>
                            </div>
                            <div className="form-row full">
                                <div className="form-group">
                                    <label className="form-label">Completion Message</label>
                                    <textarea value={compMsg} onChange={e => setCompMsg(e.target.value)} />
                                    <div className="form-hint">Shown to students immediately after they submit the exam.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                </div>{/* /left */}

                <div className="right-panel">
                    <div className="link-preview-card">
                        <div className="lp-label">Generated Link Preview</div>
                        {generatedLink ? (
                            <>
                                <div className="lp-url">{generatedLink}</div>
                                <div className="lp-actions">
                                    <button className="lp-btn lp-btn-copy" onClick={() => { navigator.clipboard.writeText(generatedLink); showToast('Link copied to clipboard!'); }}>📋 Copy Link</button>
                                    <button className="lp-btn lp-btn-qr" onClick={() => setModalQR(true)}>⬛ QR Code</button>
                                </div>
                            </>
                        ) : (
                            <div className="lp-url" style={{ opacity: 0.5 }}>Click generate to create a link</div>
                        )}
                        <div className="lp-divider"></div>
                        <div className="lp-stats">
                            <div className="lp-stat"><div className="lp-stat-num">{selectedInfo?.totalQuestions || 0}</div><div className="lp-stat-label">Questions</div></div>
                            <div className="lp-stat"><div className="lp-stat-num">{selectedInfo?.durationMinutes || 0}m</div><div className="lp-stat-label">Duration</div></div>
                            <div className="lp-stat"><div className="lp-stat-num">{cap || '∞'}</div><div className="lp-stat-label">Cap</div></div>
                        </div>
                    </div>

                    <div className="info-panel">
                        <div className="info-panel-header"><div className="info-panel-title">📋 Link Summary</div></div>
                        <div className="info-panel-body">
                            <div className="summary-row"><span className="summary-key">Assessment</span><span className="summary-val">{selectedInfo?.title || 'None Selected'}</span></div>
                            <div className="summary-row"><span className="summary-key">Label</span><span className="summary-val">{linkName || '—'}</span></div>
                            <div className="summary-row"><span className="summary-key">Access Code</span><span className="summary-val" style={{ fontFamily: '"Syne",sans-serif', letterSpacing: '2px', color: 'var(--accent2)' }}>{accessCode || 'XXXXXX'}</span></div>
                            <div className="summary-row"><span className="summary-key">Window Opens</span><span className="summary-val">{formatRawDate(startDate)}</span></div>
                            <div className="summary-row"><span className="summary-key">Window Closes</span><span className="summary-val">{formatRawDate(endDate)}</span></div>
                            <div className="summary-row"><span className="summary-key">Max Attempts</span><span className="summary-val">{attempts === '0' ? 'Unlimited' : attempts === '1' ? '1 attempt only' : attempts + ' attempts'}</span></div>
                            <div className="summary-row"><span className="summary-key">Student Cap</span><span className="summary-val">{capLabel}</span></div>
                        </div>
                    </div>

                    <div className="info-panel">
                        <div className="info-panel-header"><div className="info-panel-title">✅ Ready to Generate?</div></div>
                        <div className="info-panel-body">
                            <div className="checklist">
                                <div className={`check-item ${selectedAssessmentId ? 'done-item' : 'pending-item'}`}><div className={`check-dot ${selectedAssessmentId ? 'done' : 'pending'}`}>{selectedAssessmentId ? '✓' : '○'}</div><span>Assessment selected</span></div>
                                <div className={`check-item ${linkName ? 'done-item' : 'pending-item'}`}><div className={`check-dot ${linkName ? 'done' : 'pending'}`}>{linkName ? '✓' : '○'}</div><span>Link name entered</span></div>
                                <div className={`check-item ${accessCode ? 'done-item' : 'pending-item'}`}><div className={`check-dot ${accessCode ? 'done' : 'pending'}`}>{accessCode ? '✓' : '○'}</div><span>Access code set</span></div>
                                <div className={`check-item ${(startDate && endDate) ? 'done-item' : 'pending-item'}`}><div className={`check-dot ${(startDate && endDate) ? 'done' : 'pending'}`}>{(startDate && endDate) ? '✓' : '○'}</div><span>Date window configured</span></div>
                                <div className={`check-item ${generatedLink ? 'done-item' : 'pending-item'}`}><div className={`check-dot ${generatedLink ? 'done' : 'pending'}`}>{generatedLink ? '✓' : '○'}</div><span>Link generated &amp; shared</span></div>
                            </div>
                            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '18px' }} onClick={handleGenerate} disabled={loading}>
                                {loading ? 'Generating...' : '🔗 Generate Link'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className={`modal-overlay ${modalQR ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setModalQR(false); }}>
                <div className="modal">
                    <div className="modal-header">
                        <div className="modal-title">QR Code</div>
                        <div className="modal-close" onClick={() => setModalQR(false)}>✕</div>
                    </div>
                    <div className="modal-body">
                        <div className="qr-box">⬛</div>
                        <div className="qr-url">{generatedLink}</div>
                        <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.6 }}>Scan this QR code with a mobile device to open the exam entry page directly. Share with students for quick in-person access.</p>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { showToast('Downloading QR…', 'info'); setModalQR(false); }}>⬇ Download PNG</button>
                        <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { navigator.clipboard.writeText(generatedLink || ''); showToast('Link copied!'); setModalQR(false); }}>📋 Copy Link</button>
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
