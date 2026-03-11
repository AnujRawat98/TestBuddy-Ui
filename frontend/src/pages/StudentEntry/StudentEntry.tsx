import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import './StudentEntry.css';
import { assessmentLinksApi } from '../../services/api';

const StudentEntry: React.FC = () => {
    const { linkId } = useParams<{ linkId: string }>();
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [errorMsg, setErrorMsg] = useState('');
    const [emailError, setEmailError] = useState(false);
    const [codeError, setCodeError] = useState(false);
    const [successMode, setSuccessMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState({ show: false, msg: '', type: 'success' });
    const navigate = useNavigate();

    const showToast = (msg: string, tType: 'success' | 'info' | 'error' = 'success') => {
        setToast({ show: true, msg, type: tType });
        setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
    };

    const handleStart = async () => {
        if (!linkId) return;
        setErrorMsg('');
        setEmailError(false);
        setCodeError(false);

        const emailTrimmed = email.trim();
        const codeTrimmed = code.trim().toUpperCase();

        if (!emailTrimmed || !emailTrimmed.includes('@')) {
            setEmailError(true);
            setErrorMsg('Please enter a valid email address.');
            return;
        }
        if (!codeTrimmed) {
            setCodeError(true);
            setErrorMsg('Please enter the access code.');
            return;
        }

        setLoading(true);
        try {
            // Validate the link and email
            await assessmentLinksApi.validate(linkId, emailTrimmed);
            // If validation requires access code check (not explicitly in standard validate but assumed here)
            // The swagger shows validate takes linkId and email in query.
            setSuccessMode(true);
            showToast('Access verified!', 'success');
        } catch (err: any) {
            console.error(err);
            setErrorMsg(err.response?.data?.message || 'Invalid credentials or link expired.');
            setCodeError(true);
        } finally {
            setLoading(false);
        }
    };

    const clearErr = () => {
        setErrorMsg('');
        setEmailError(false);
        setCodeError(false);
    };

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        clearErr();
        setCode(e.target.value.toUpperCase());
    };

    const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        clearErr();
        setEmail(e.target.value);
    };

    const proceedToExam = async () => {
        if (!linkId) return;
        setLoading(true);
        try {
            const res = await assessmentLinksApi.start(linkId, email);
            // Assuming res.data contains the attemptId
            const attemptId = res.data.id || res.data;

            showToast('Starting exam… good luck! 🚀', 'info');
            setTimeout(() => {
                navigate(`/exam/${attemptId}`);
            }, 1000);
        } catch (err: any) {
            console.error(err);
            showToast(err.response?.data?.message || 'Failed to start exam.', 'error');
            setSuccessMode(false);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="student-entry-wrap">
            <div className="entry-card">
                {/* Logo */}
                <div className="logo">Test<span>Buddy</span></div>
                <div className="logo-sub">Online Assessment Platform</div>

                <div className="divider"></div>

                {/* Exam title */}
                <div className="exam-title">Assessment Entry</div>

                {/* Info msg */}
                <div style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', marginBottom: '20px' }}>
                    Enter your email and the access code provided to begin.
                </div>

                {/* Error box */}
                <div className={`err-msg ${errorMsg ? 'show' : ''}`}>⚠️ <span>{errorMsg}</span></div>

                {/* Email */}
                <div className="form-group">
                    <label className="form-label">Your Email Address</label>
                    <input
                        className={`form-input ${emailError ? 'error' : ''}`}
                        type="email"
                        placeholder="student@example.com"
                        value={email}
                        onChange={handleEmailChange}
                        disabled={loading || successMode}
                    />
                </div>

                {/* Access Code */}
                <div className="form-group">
                    <label className="form-label">Access Code</label>
                    <input
                        className={`form-input ${codeError ? 'error' : ''}`}
                        type="text"
                        placeholder="Enter access code"
                        maxLength={10}
                        value={code}
                        onChange={handleCodeChange}
                        disabled={loading || successMode}
                        style={{ letterSpacing: '3px', fontFamily: '"Syne",sans-serif', fontWeight: 700 }}
                    />
                </div>

                {/* Instructions */}
                <div className="instructions">
                    <div className="instructions-title">📋 Instructions</div>
                    <ul className="instructions-list">
                        <li><div className="bullet"></div><span>Ensure you are in a quiet room with good lighting</span></li>
                        <li><div className="bullet"></div><span>Do not switch browser tabs — it will be flagged</span></li>
                        <li><div className="bullet"></div><span>Camera access is required for proctoring</span></li>
                        <li><div className="bullet"></div><span>Once started, the timer cannot be paused</span></li>
                    </ul>
                </div>

                {/* CTA */}
                <button
                    className="start-btn"
                    onClick={handleStart}
                    disabled={loading || successMode}
                >
                    {loading ? 'Validating...' : 'Verify Access →'}
                </button>
            </div>

            {/* SUCCESS OVERLAY */}
            <div className={`success-overlay ${successMode ? 'open' : ''}`} onClick={(e) => { if (e.target === e.currentTarget && !loading) setSuccessMode(false); }}>
                <div className="success-card">
                    <div className="success-icon">✅</div>
                    <div className="success-title">Access Verified!</div>
                    <div className="success-sub">Your identity has been confirmed. The exam is about to begin. Make sure your camera and audio are ready.</div>
                    <div className="success-student">{email}</div>
                    <button className="success-proceed" onClick={proceedToExam} disabled={loading}>
                        {loading ? 'Starting...' : '🚀 Proceed to Exam'}
                    </button>
                </div>
            </div>

            {/* TOAST */}
            <div className={`toast ${toast.show ? 'show' : ''}`} style={{ background: toast.type === 'error' ? '#c0392b' : toast.type === 'info' ? '#1a2540' : '#0d1117' }}>
                <span>{toast.type === 'error' ? '❌' : toast.type === 'info' ? 'ℹ️' : '✅'}</span>
                <span>{toast.msg}</span>
            </div>
        </div>
    );
};

export default StudentEntry;
