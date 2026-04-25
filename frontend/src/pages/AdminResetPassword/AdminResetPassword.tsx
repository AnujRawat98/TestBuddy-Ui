import React, { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/api';
import MazeLogo from '../../components/MazeLogo';

const AdminResetPassword = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [visible, setVisible] = useState(false);
    const [confirmVisible, setConfirmVisible] = useState(false);
    
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setErrorMessage('Invalid or missing password reset token.');
            setStatus('error');
        }
    }, [token]);

    const passwordChecks = [
        { label: 'At least 8 characters', valid: password.length >= 8 },
        { label: 'Contains a letter', valid: /[a-zA-Z]/.test(password) },
        { label: 'Contains a number', valid: /\d/.test(password) },
    ];
    const isPasswordValid = passwordChecks.every(check => check.valid) && password === confirmPassword;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!token) return;
        
        if (!isPasswordValid) {
            setErrorMessage('Please ensure your passwords match and meet the policy requirements.');
            setStatus('error');
            return;
        }

        try {
            setStatus('loading');
            setErrorMessage('');
            
            await adminApi.resetPassword(token, { newPassword: password });
            setStatus('success');
            
            // Redirect to login after 3 seconds
            setTimeout(() => {
                navigate('/login', { replace: true });
            }, 3000);
            
        } catch (err: any) {
            console.error(err);
            setErrorMessage(err.response?.data?.message || 'Link has expired or is invalid. Please request a new one.');
            setStatus('error');
        }
    };

    return (
        <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-[1.2fr_0.88fr] bg-black text-white antialiased">
            {/* ═══ LEFT PANEL ═══════════════════════════════════════════ */}
            <div className="hidden lg:flex relative overflow-hidden flex-col justify-between p-12 lg:px-16 border-r border-white/5 bg-black sticky top-0 h-[100dvh]">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-sky-500/10 blur-[100px] pointer-events-none" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-50" />

                <div className="relative z-10 h-full flex flex-col justify-between space-y-12">
                    <Link to="/" className="flex items-center gap-3 w-fit group">
                        <MazeLogo className="w-8 h-8 text-white transition-transform group-hover:scale-105" />
                        <span className="text-2xl font-extrabold tracking-[-0.04em]">
                            Maze<span className="text-sky-400">AI</span>
                        </span>
                    </Link>

                    <div className="flex-1 flex flex-col justify-center max-w-[520px]">
                        <h1 className="text-[4rem] font-extrabold leading-[1.05] tracking-[-0.04em] mb-6">
                            Secure.<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-sky-400">
                                Verify.<br />
                                Access.
                            </span>
                        </h1>
                        <p className="text-[1.05rem] text-neutral-400 leading-[1.6] mb-12">
                            Choose a strong, unique password to protect your organization's data and assessments.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-neutral-500 font-semibold tracking-wide uppercase">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">✓</span> Verified Token
                    </div>
                </div>
            </div>

            {/* ═══ RIGHT PANEL ══════════════════════════════════════════ */}
            <div className="flex flex-col justify-center px-[26px] lg:px-[56px] py-[76px] lg:py-[72px] bg-neutral-950 relative">
                <div className="max-w-[440px] w-full mx-auto mt-12 lg:mt-0">
                    <div className="flex justify-between items-center mb-[28px]">
                        <div className="flex gap-1.5">
                            <div className="h-1 w-[42px] rounded-full bg-gradient-to-r from-emerald-500 to-sky-500" />
                            <div className="h-1 w-[42px] rounded-full bg-gradient-to-r from-emerald-500 to-sky-500" />
                        </div>
                        <Link to="/login" className="inline-flex items-center gap-2 px-[12px] py-[6px] rounded-full border border-white/10 bg-white/5 text-[0.76rem] font-bold text-neutral-400 hover:text-white hover:bg-white/10 transition-colors">
                            &larr; Back to login
                        </Link>
                    </div>

                    <h2 className="text-[2rem] font-extrabold tracking-[-0.05em] text-white mb-2">Create new password</h2>
                    <p className="text-neutral-400 leading-[1.7] mb-[32px]">
                        Your password must be at least 8 characters and contain a letter and a number.
                    </p>

                    {status === 'success' ? (
                        <div className="p-4 rounded-[14px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm leading-[1.6] mb-6 font-medium text-center">
                            Your password has been reset successfully! Redirecting you to login...
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-5">
                            {status === 'error' && errorMessage && (
                                <div className="p-3.5 rounded-[12px] bg-red-500/10 border border-red-500/20 text-red-400 text-[0.86rem] leading-[1.5] font-semibold flex items-start gap-2.5">
                                    <span className="text-[1rem] leading-none shrink-0 mt-0.5">⚠️</span>
                                    <span>{errorMessage}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-[0.82rem] font-bold text-white mb-2" htmlFor="password">New Password</label>
                                <div className="relative flex items-center">
                                    <input
                                        id="password"
                                        type={visible ? 'text' : 'password'}
                                        placeholder="Create a secure password"
                                        autoComplete="new-password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full min-h-[48px] pl-4 pr-[46px] rounded-[14px] bg-neutral-900 border border-white/10 text-white placeholder-neutral-500 focus:border-emerald-500/40 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm"
                                        disabled={!token}
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-[14px] hover:text-white text-neutral-500 text-sm font-semibold p-1"
                                        onClick={() => setVisible(!visible)}
                                        disabled={!token}
                                    >
                                        {visible ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-[0.82rem] font-bold text-white mb-2" htmlFor="confirmPassword">Confirm Password</label>
                                <div className="relative flex items-center">
                                    <input
                                        id="confirmPassword"
                                        type={confirmVisible ? 'text' : 'password'}
                                        placeholder="Re-enter your password"
                                        autoComplete="new-password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        className="w-full min-h-[48px] pl-4 pr-[46px] rounded-[14px] bg-neutral-900 border border-white/10 text-white placeholder-neutral-500 focus:border-emerald-500/40 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm"
                                        disabled={!token}
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-[14px] hover:text-white text-neutral-500 text-sm font-semibold p-1"
                                        onClick={() => setConfirmVisible(!confirmVisible)}
                                        disabled={!token}
                                    >
                                        {confirmVisible ? 'Hide' : 'Show'}
                                    </button>
                                </div>
                            </div>

                            {/* Password Checks */}
                            <div className="bg-white/5 border border-white/10 rounded-[14px] p-3.5 grid gap-2">
                                {passwordChecks.map((check) => (
                                    <div key={check.label} className={`flex items-center gap-2.5 text-[0.82rem] font-semibold transition-colors ${check.valid ? 'text-emerald-500' : 'text-neutral-500'}`}>
                                        <span className={`inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border-[1.5px] text-[8px] font-bold ${check.valid ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-neutral-600 text-transparent'}`}>
                                            ✓
                                        </span>
                                        {check.label}
                                    </div>
                                ))}
                            </div>

                            <button
                                type="submit"
                                disabled={status === 'loading' || !isPasswordValid || !token}
                                className="w-full relative group overflow-hidden mt-2 min-h-[52px] rounded-[16px] bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-[0.95rem] tracking-wide transition-all shadow-[0_0_40px_-10px_rgba(16,185,129,0.5)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {status === 'loading' ? (
                                    <>Resetting...</>
                                ) : (
                                    <>Reset Password <span className="transition-transform group-hover:translate-x-[3px]">&rarr;</span></>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminResetPassword;
