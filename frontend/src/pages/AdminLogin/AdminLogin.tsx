import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/api';
import './AdminLogin.css';

const AdminLogin: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [visible, setVisible] = useState(false);
    const [isShaking, setIsShaking] = useState(false);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

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
            if (res.data && res.data.token) {
                localStorage.setItem('token', res.data.token);
            }

            setStatus('success');
            setTimeout(() => {
                navigate('/dashboard');
            }, 1000);
        } catch (err: any) {
            console.error(err);
            setStatus('idle');
            setIsShaking(true);
            setErrorMsg(err.response?.data?.message || 'Invalid email or password');
            setTimeout(() => setIsShaking(false), 400);
        }
    };

    return (
        <div className="login-container">

            {/* ═══ LEFT PANEL ═══════════════════════════════════════════ */}
            <div className="left">
                <div className="glow-orange"></div>
                <div className="glow-blue"></div>

                <div className="left-inner">

                    {/* Brand */}
                    <div className="brand">
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
                            The complete platform for online assessments — from AI-generated
                            questions to proctored exams, all in one place.
                        </div>
                    </div>

                    {/* Feature cards */}
                    <div className="features">
                        <div className="feature">
                            <div className="feature-icon">🤖</div>
                            <div>
                                <div className="feature-title">AI Question Generation</div>
                                <div className="feature-text">
                                    Generate high-quality questions by topic, level &amp; type instantly
                                </div>
                            </div>
                        </div>
                        <div className="feature">
                            <div className="feature-icon">🔒</div>
                            <div>
                                <div className="feature-title">Smart Proctoring</div>
                                <div className="feature-text">
                                    Web, image &amp; video proctoring to ensure exam integrity
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

                {/* Step dots */}
                <div className="step-indicator">
                    <div className="step done"></div>
                    <div className="step active"></div>
                    <div className="step"></div>
                </div>

                <div className="right-title">Welcome back 👋</div>
                <div className="right-sub">
                    Sign in to your admin account to manage assessments &amp; questions.
                </div>

                {/* Error banner */}
                {errorMsg && (
                    <div className="error-banner">
                        ⚠️ {errorMsg}
                    </div>
                )}

                {/* Email */}
                <div className="form-group">
                    <label>Email Address</label>
                    <div className="input-wrapper">
                        {/* <span className="input-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="2" y="4" width="20" height="16" rx="2" />
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                            </svg>
                        </span> */}
                        <input
                            type="email"
                            id="email"
                            placeholder="admin@testbuddy.app"
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                </div>

                {/* Password */}
                <div className="form-group">
                    <label>Password</label>
                    <div className="input-wrapper">
                        {/* <span className="input-icon">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                        </span> */}
                        <input
                            type={visible ? 'text' : 'password'}
                            id="password"
                            placeholder="Enter your password"
                            autoComplete="current-password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleLogin();
                            }}
                        />
                        <span
                            className="eye-toggle"
                            onClick={() => setVisible(!visible)}
                            title="Show / Hide"
                        >
                            {visible ? (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                                    <line x1="1" y1="1" x2="23" y2="23" />
                                </svg>
                            ) : (
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                    <circle cx="12" cy="12" r="3" />
                                </svg>
                            )}
                        </span>
                    </div>
                </div>

                {/* Options row */}
                <div className="options-row">
                    <label className="remember">
                        <input type="checkbox" defaultChecked />
                        Remember me
                    </label>
                    <a className="forgot-link" href="#">
                        Forgot password?
                    </a>
                </div>

                {/* Login button */}
                <button
                    className={`btn-login${isShaking ? ' shake-animation' : ''}`}
                    onClick={() => handleLogin()}
                    disabled={status === 'loading'}
                    style={
                        status === 'success'
                            ? { background: 'var(--green)' }
                            : status === 'loading'
                                ? { opacity: 0.8 }
                                : {}
                    }
                >
                    {status === 'success' ? (
                        '✅ Success! Redirecting…'
                    ) : status === 'loading' ? (
                        'Signing in…'
                    ) : (
                        <>Sign In <span className="btn-arrow">→</span></>
                    )}
                </button>

                {/* Divider */}
                <div className="divider">
                    <div className="divider-line"></div>
                    <div className="divider-text">or continue with</div>
                    <div className="divider-line"></div>
                </div>

                {/* SSO */}
                <button className="btn-sso">
                    <svg
                        className="sso-icon"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Continue with Google
                </button>

                {/* Footer */}
                <div className="right-footer">
                    Having trouble signing in?{' '}
                    <a href="#">Contact support</a>
                    <br />
                    <span style={{ marginTop: '6px', display: 'inline-block' }}>
                        By signing in, you agree to our <a href="#">Terms</a> &amp;{' '}
                        <a href="#">Privacy Policy</a>
                    </span>
                </div>

            </div>
        </div>
    );
};

export default AdminLogin;
