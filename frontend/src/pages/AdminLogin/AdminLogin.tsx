import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/api';
import GoogleAuthButton from '../../components/GoogleAuthButton';
import { saveAuthSession } from '../../utils/auth';

// ── SWAP THIS LINE TO CHANGE THEME ──────────────────────────────────────────
// Theme 1: Midnight Blue + Cyan    → './Theme1_MidnightCyan.css'
// Theme 2: Charcoal + Amber Gold   → './Theme2_CharcoalGold.css'
// Theme 3: Slate + Electric Violet → './Theme3_SlateViolet.css'
// Theme 4: Pure Black + Rose Red   → './Theme4_BlackRed.css'
import './AdminLogin.css';
// ────────────────────────────────────────────────────────────────────────────

const AdminLogin: React.FC = () => {
    const navigate = useNavigate();
    const [email,     setEmail]     = useState('');
    const [password,  setPassword]  = useState('');
    const [visible,   setVisible]   = useState(false);
    const [isShaking, setIsShaking] = useState(false);
    const [status,    setStatus]    = useState<'idle' | 'loading' | 'success'>('idle');
    const [errorMsg,  setErrorMsg]  = useState('');

    const handleLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setErrorMsg('');

        if (!email || !password) {
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 400);
            return;
        }

        setStatus('loading');

        try {
            const res = await adminApi.login({ email, password });
            if (res.data?.token) {
                saveAuthSession(res.data.token, Boolean(res.data.isSuperAdmin));
            }
            setStatus('success');
            setTimeout(() => navigate(res.data?.isSuperAdmin ? '/platform' : '/dashboard'), 900);
        } catch (err: any) {
            console.error(err);
            setStatus('idle');
            setIsShaking(true);
            setErrorMsg(err.response?.data?.message || 'Invalid email or password');
            setTimeout(() => setIsShaking(false), 400);
        }
    };

    const handleGoogleLogin = async (idToken: string) => {
        setErrorMsg('');
        setStatus('loading');

        try {
            const res = await adminApi.googleLogin({ idToken });
            if (res.data?.token) {
                saveAuthSession(res.data.token, Boolean(res.data.isSuperAdmin));
            }
            setStatus('success');
            setTimeout(() => navigate(res.data?.isSuperAdmin ? '/platform' : '/dashboard'), 900);
        } catch (err: any) {
            console.error(err);
            setStatus('idle');
            setIsShaking(true);
            setErrorMsg(err.response?.data?.message || 'Google sign-in failed.');
            setTimeout(() => setIsShaking(false), 400);
        }
    };

    return (
        <div className="login-container">

            {/* ═══ LEFT PANEL ═══════════════════════════════════════════ */}
            <div className="left">
                <div className="glow-orange" />
                <div className="glow-blue" />

                <div className="left-inner">

                    {/* Brand */}
                    <div className="brand">
                        <div className="brand-icon">✦</div>
                        Test<span>Buddy</span>
                    </div>

                    {/* Headline */}
                    <div>
                        <div className="left-headline">
                            Build.<br />
                            Distribute.<br />
                            <em>Evaluate.</em>
                        </div>
                        <div className="left-sub">
                            The complete platform for online assessments — AI-generated
                            questions, proctored exams, and instant analytics in one place.
                        </div>
                    </div>

                    {/* Features */}
                    <div className="features">
                        <div className="feature">
                            <div className="feature-icon">🤖</div>
                            <div>
                                <div className="feature-title">AI Question Generation</div>
                                <div className="feature-text">
                                    Generate high-quality questions by topic, difficulty &amp; type instantly
                                </div>
                            </div>
                        </div>
                        <div className="feature">
                            <div className="feature-icon">🔒</div>
                            <div>
                                <div className="feature-title">Smart Proctoring</div>
                                <div className="feature-text">
                                    Web, image &amp; screen recording to ensure full exam integrity
                                </div>
                            </div>
                        </div>
                        <div className="feature">
                            <div className="feature-icon">📊</div>
                            <div>
                                <div className="feature-title">Instant Analytics</div>
                                <div className="feature-text">
                                    Track performance across topics, difficulty &amp; question types
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Social proof */}
                    <div className="testimonial">
                        <div className="testimonial-avatars">
                            <div className="t-avatar">A</div>
                            <div className="t-avatar b">B</div>
                            <div className="t-avatar c">C</div>
                        </div>
                        <div className="testimonial-text">
                            <strong>500+ exams</strong> conducted this month
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ RIGHT PANEL ══════════════════════════════════════════ */}
            <div className="right">
                <Link to="/" className="back-home-link">
                    ← Back to landing page
                </Link>

                {/* Live badge */}
                <div className="security-badge">
                    <span className="security-badge-dot" />
                    Secure admin portal
                </div>

                {/* Steps */}
                <div className="step-indicator">
                    <div className="step done" />
                    <div className="step active" />
                    <div className="step" />
                </div>

                <div className="right-title">Welcome back 👋</div>
                <div className="right-sub">
                    Sign in to manage assessments, questions &amp; candidates.
                </div>

                <div className="auth-switch-banner">
                    New to TestBuddy? <Link to="/signup">Create your company workspace</Link>
                </div>
                <div className="auth-switch-banner">
                    Platform superadmins can sign in here and will be routed to the organisation billing console.
                </div>

                {/* Error */}
                {errorMsg && <div className="error-banner">⚠️ {errorMsg}</div>}

                {/* Email */}
                <div className="form-group">
                    <label htmlFor="email">Email Address</label>
                    <div className="input-wrapper">
                        <input
                            type="email"
                            id="email"
                            placeholder="admin@testbuddy.app"
                            autoComplete="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                        />
                    </div>
                </div>

                {/* Password */}
                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <div className="input-wrapper">
                        <input
                            type={visible ? 'text' : 'password'}
                            id="password"
                            placeholder="••••••••••••"
                            autoComplete="current-password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                        />
                        <span className="eye-toggle" onClick={() => setVisible(v => !v)} title={visible ? 'Hide' : 'Show'}>
                            {visible ? (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                                    <line x1="1" y1="1" x2="23" y2="23"/>
                                </svg>
                            ) : (
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                    <circle cx="12" cy="12" r="3"/>
                                </svg>
                            )}
                        </span>
                    </div>
                </div>

                {/* Options */}
                <div className="options-row">
                    <label className="remember">
                        <input type="checkbox" defaultChecked />
                        Remember me
                    </label>
                    <a className="forgot-link" href="#">Forgot password?</a>
                </div>

                {/* Submit */}
                <button
                    className={`btn-login${isShaking ? ' shake-animation' : ''}`}
                    onClick={() => handleLogin()}
                    disabled={status === 'loading'}
                    style={status === 'success' ? { background: '#16a34a', boxShadow: '0 4px 20px rgba(22,163,74,.4)' } : {}}
                >
                    {status === 'success' ? (
                        <>✓ Success — Redirecting</>
                    ) : status === 'loading' ? (
                        <>
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                                style={{ animation: 'spin .8s linear infinite' }}>
                                <path d="M21 12a9 9 0 1 1-6.22-8.56"/>
                            </svg>
                            Signing in…
                        </>
                    ) : (
                        <>Sign In <span className="btn-arrow">→</span></>
                    )}
                </button>

                {/* Divider */}
                <div className="divider">
                    <div className="divider-line" />
                    <div className="divider-text">or</div>
                    <div className="divider-line" />
                </div>

                {/* Google SSO */}
                <GoogleAuthButton
                    text="signin_with"
                    onCredential={handleGoogleLogin}
                    disabled={status === 'loading'}
                />

                {/* Footer */}
                <div className="right-footer">
                    Having trouble? <a href="#">Contact support</a><br />
                    <span style={{ marginTop: '5px', display: 'inline-block' }}>
                        By signing in you agree to our <a href="#">Terms</a> &amp; <a href="#">Privacy Policy</a>
                    </span>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;
