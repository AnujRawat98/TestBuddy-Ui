import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../services/api';
import MazeLogo from '../../components/MazeLogo';

const AdminForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!email) {
            setErrorMessage('Please enter your email address.');
            setStatus('error');
            return;
        }

        try {
            setStatus('loading');
            setErrorMessage('');
            
            await adminApi.forgotPassword({ email });
            setStatus('success');
            
        } catch (err: any) {
            console.error(err);
            // Always show success or handle error generic to prevent email enumeration
            setErrorMessage(err.response?.data?.message || 'Something went wrong. Please try again.');
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
                            Reset.<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-sky-400">
                                Recover.<br />
                                Resume.
                            </span>
                        </h1>
                        <p className="text-[1.05rem] text-neutral-400 leading-[1.6] mb-12">
                            A secure link will be sent to your inbox to regain access to your workspace.
                        </p>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-neutral-500 font-semibold tracking-wide uppercase">
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px]">✓</span> Secure standard procedure
                    </div>
                </div>
            </div>

            {/* ═══ RIGHT PANEL ══════════════════════════════════════════ */}
            <div className="flex flex-col justify-center px-[26px] lg:px-[56px] py-[76px] lg:py-[72px] bg-neutral-950 relative">
                <div className="max-w-[440px] w-full mx-auto mt-12 lg:mt-0">
                    <div className="flex justify-between items-center mb-[28px]">
                        <div className="flex gap-1.5">
                            <div className="h-1 w-[42px] rounded-full bg-gradient-to-r from-emerald-500 to-sky-500" />
                            <div className="h-1 w-[42px] rounded-full bg-white/10" />
                        </div>
                        <Link to="/login" className="inline-flex items-center gap-2 px-[12px] py-[6px] rounded-full border border-white/10 bg-white/5 text-[0.76rem] font-bold text-neutral-400 hover:text-white hover:bg-white/10 transition-colors">
                            &larr; Back to login
                        </Link>
                    </div>

                    <h2 className="text-[2rem] font-extrabold tracking-[-0.05em] text-white mb-2">Forgot Password</h2>
                    <p className="text-neutral-400 leading-[1.7] mb-[32px]">
                        Enter your email address and we'll send you a link to reset your password.
                    </p>

                    {status === 'success' ? (
                        <div className="p-4 rounded-[14px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm leading-[1.6] mb-6 font-medium">
                            If an account exists for that email, a password reset link has been sent. Please check your inbox.
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
                                <label className="block text-[0.82rem] font-bold text-white mb-2" htmlFor="email">Email Address</label>
                                <input
                                    id="email"
                                    type="email"
                                    placeholder="admin@mazeai.app"
                                    autoComplete="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full min-h-[48px] px-4 rounded-[14px] bg-neutral-900 border border-white/10 text-white placeholder-neutral-500 focus:border-sky-500/40 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all shadow-sm"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={status === 'loading'}
                                className="w-full relative group overflow-hidden mt-6 min-h-[52px] rounded-[16px] bg-sky-500 hover:bg-sky-400 text-white font-extrabold text-[0.95rem] tracking-wide transition-all shadow-[0_0_40px_-10px_rgba(14,165,233,0.5)] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {status === 'loading' ? (
                                    <>Sending...</>
                                ) : (
                                    <>Send Reset Link <span className="transition-transform group-hover:translate-x-[3px]">&rarr;</span></>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminForgotPassword;
