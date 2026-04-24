import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/api';
import GoogleAuthButton from '../../components/GoogleAuthButton';
import { saveAuthSession } from '../../utils/auth';
import MazeLogo from '../../components/MazeLogo';
import '../AdminLogin/AdminLogin.css';
import './AdminSignup.css';

const AdminSignup: React.FC = () => {
    const navigate = useNavigate();
    const [companyName, setCompanyName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [visible, setVisible] = useState(false);
    const [confirmVisible, setConfirmVisible] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [isShaking, setIsShaking] = useState(false);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const passwordChecks = useMemo(() => [
        { label: 'At least 8 characters', valid: password.length >= 8 },
        { label: 'Contains a letter', valid: /[A-Za-z]/.test(password) },
        { label: 'Contains a number', valid: /\d/.test(password) },
    ], [password]);

    const triggerShake = () => {
        setIsShaking(true);
        window.setTimeout(() => setIsShaking(false), 400);
    };

    const handleSignup = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setErrorMsg('');

        if (!companyName.trim() || !email.trim() || !password || !confirmPassword || !acceptedTerms) {
            triggerShake();
            setErrorMsg('Please complete all required fields to create your workspace.');
            return;
        }

        if (password !== confirmPassword) {
            triggerShake();
            setErrorMsg('Password and confirm password must match.');
            return;
        }

        if (passwordChecks.some((check) => !check.valid)) {
            triggerShake();
            setErrorMsg('Please choose a stronger password before continuing.');
            return;
        }

        setStatus('loading');

        try {
            const res = await adminApi.signup({
                companyName: companyName.trim(),
                email: email.trim(),
                password,
            });

            if (res.data?.token) {
                saveAuthSession(res.data.token, Boolean(res.data.isSuperAdmin));
            }

            setStatus('success');
            window.setTimeout(() => navigate('/dashboard'), 900);
        } catch (err: any) {
            console.error(err);
            setStatus('idle');
            triggerShake();
            setErrorMsg(err.response?.data?.message || 'We could not create your workspace right now.');
        }
    };

    const handleGoogleSignup = async (idToken: string) => {
        setErrorMsg('');

        if (!companyName.trim()) {
            triggerShake();
            setErrorMsg('Enter your company name first so we can create the tenant workspace.');
            return;
        }

        if (!acceptedTerms) {
            triggerShake();
            setErrorMsg('Please accept the Terms and Privacy Policy to continue.');
            return;
        }

        setStatus('loading');

        try {
            const res = await adminApi.googleSignup({
                companyName: companyName.trim(),
                idToken,
            });

            if (res.data?.token) {
                saveAuthSession(res.data.token, Boolean(res.data.isSuperAdmin));
            }

            setStatus('success');
            window.setTimeout(() => navigate('/dashboard'), 900);
        } catch (err: any) {
            console.error(err);
            setStatus('idle');
            triggerShake();
            setErrorMsg(err.response?.data?.message || 'Google signup failed.');
        }
    };

    return (
        <div className="login-container signup-page-shell">
            <div className="left signup-left">
                <div className="glow-orange" />
                <div className="glow-blue" />

                <div className="left-inner">
                    <div className="brand">
                        <div className="brand-icon"><MazeLogo className="brand-logo-svg" /></div>
                        Maze<span>AI</span>
                    </div>

                    <div>
                        <div className="left-headline">
                            Launch.<br />
                            Invite.<br />
                            <em>Evaluate.</em>
                        </div>
                        <div className="left-sub">
                            Spin up a secure company workspace with its own tenant schema, admin access,
                            and a ready-to-use assessment setup in a single step.
                        </div>
                    </div>

                    <div className="signup-highlights">
                        <div className="feature">
                            <div className="feature-icon">WS</div>
                            <div>
                                <div className="feature-title">Private Company Workspace</div>
                                <div className="feature-text">
                                    Every signup provisions a dedicated tenant schema for your organization.
                                </div>
                            </div>
                        </div>
                        <div className="feature">
                            <div className="feature-icon">DB</div>
                            <div>
                                <div className="feature-title">Scoped Database Permissions</div>
                                <div className="feature-text">
                                    Tenant database access is isolated to your schema only.
                                </div>
                            </div>
                        </div>
                        <div className="feature">
                            <div className="feature-icon">GO</div>
                            <div>
                                <div className="feature-title">Starter Plan Included</div>
                                <div className="feature-text">
                                    Begin with the default onboarding plan and start creating assessments immediately.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="signup-metric-row">
                        <div className="signup-metric-card">
                            <span className="signup-metric-value">1 min</span>
                            <span className="signup-metric-label">average setup</span>
                        </div>
                        <div className="signup-metric-card">
                            <span className="signup-metric-value">public + tenant</span>
                            <span className="signup-metric-label">schema model</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="right signup-right">
                <Link to="/" className="back-home-link">
                    &larr; Back to landing page
                </Link>

                <div className="security-badge">
                    <span className="security-badge-dot" />
                    Self-serve onboarding
                </div>

                <div className="step-indicator">
                    <div className="step done" />
                    <div className="step active" />
                    <div className="step active" />
                </div>

                <div className="right-title">Create your workspace</div>
                <div className="right-sub">
                    Register your company, provision the tenant schema, and receive admin access instantly.
                </div>

                <div className="auth-switch-banner">
                    Already have an account? <Link to="/login">Sign in here</Link>
                </div>

                {errorMsg && <div className="error-banner">! {errorMsg}</div>}

                <form onSubmit={handleSignup}>
                    <div className="form-group">
                        <label htmlFor="companyName">Company Name</label>
                        <div className="input-wrapper">
                            <input
                                id="companyName"
                                type="text"
                                placeholder="ABC Company"
                                autoComplete="organization"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Work Email</label>
                        <div className="input-wrapper">
                            <input
                                id="email"
                                type="email"
                                placeholder="admin@abccompany.com"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <div className="input-wrapper">
                            <input
                                id="password"
                                type={visible ? 'text' : 'password'}
                                placeholder="Create a secure password"
                                autoComplete="new-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <span className="eye-toggle" onClick={() => setVisible((v) => !v)} title={visible ? 'Hide' : 'Show'}>
                                {visible ? 'Hide' : 'Show'}
                            </span>
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <div className="input-wrapper">
                            <input
                                id="confirmPassword"
                                type={confirmVisible ? 'text' : 'password'}
                                placeholder="Re-enter your password"
                                autoComplete="new-password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            <span className="eye-toggle" onClick={() => setConfirmVisible((v) => !v)} title={confirmVisible ? 'Hide' : 'Show'}>
                                {confirmVisible ? 'Hide' : 'Show'}
                            </span>
                        </div>
                    </div>

                    <div className="signup-password-panel">
                        {passwordChecks.map((check) => (
                            <div key={check.label} className={`signup-password-check ${check.valid ? 'valid' : ''}`}>
                                <span>{check.valid ? 'OK' : 'o'}</span>
                                {check.label}
                            </div>
                        ))}
                    </div>

                    <div className="signup-plan-card">
                        <div>
                            <div className="signup-plan-label">Default plan</div>
                            <div className="signup-plan-name">Starter</div>
                        </div>
                        <div className="signup-plan-note">Tenant schema + admin provisioning included</div>
                    </div>

                    <div className="options-row signup-options-row">
                        <label className="remember">
                            <input
                                type="checkbox"
                                checked={acceptedTerms}
                                onChange={(e) => setAcceptedTerms(e.target.checked)}
                            />
                            I agree to the Terms and Privacy Policy
                        </label>
                    </div>

                    <button
                        type="submit"
                        className={`btn-login${isShaking ? ' shake-animation' : ''}`}
                        disabled={status === 'loading'}
                        style={status === 'success' ? { background: '#16a34a', boxShadow: '0 4px 20px rgba(22,163,74,.4)' } : {}}
                    >
                        {status === 'success' ? (
                            <>Workspace ready</>
                        ) : status === 'loading' ? (
                            <>Creating workspace...</>
                        ) : (
                            <>Create Workspace <span className="btn-arrow">&rarr;</span></>
                        )}
                    </button>
                </form>

                <div className="divider">
                    <div className="divider-line" />
                    <div className="divider-text">or onboard faster</div>
                    <div className="divider-line" />
                </div>

                <GoogleAuthButton
                    text="signup_with"
                    onCredential={handleGoogleSignup}
                    disabled={status === 'loading'}
                />

                <div className="right-footer">
                    Your signup creates the tenant schema and admin account automatically.<br />
                    Need enterprise onboarding? <a href="#">Talk to sales</a>
                </div>
            </div>
        </div>
    );
};

export default AdminSignup;
