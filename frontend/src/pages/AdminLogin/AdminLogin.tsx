import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/api';
import GoogleAuthButton from '../../components/GoogleAuthButton';
import { saveAuthSession } from '../../utils/auth';
import MazeLogo from '../../components/MazeLogo';

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
        <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-[1.2fr_0.88fr] bg-black text-white antialiased">
            {/* ═══ LEFT PANEL ═══════════════════════════════════════════ */}
            <div className="hidden lg:flex relative overflow-hidden flex-col justify-between p-12 lg:px-16 border-r border-white/5 bg-black sticky top-0 h-[100dvh]">
                {/* Glow & Grid */}
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-sky-500/10 blur-[100px] pointer-events-none" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-50" />

                <div className="relative z-10 h-full flex flex-col justify-between space-y-8 py-4">
                    {/* Brand */}
                    <div className="flex items-center gap-3 text-[1.4rem] font-extrabold tracking-tight">
                        <div className="w-10 h-10 rounded-[14px] flex items-center justify-center bg-white/5 border border-white/10">
                            <MazeLogo className="w-5 h-5" />
                        </div>
                        <div>Maze<span className="text-sky-400">AI</span></div>
                    </div>

                    {/* Headline */}
                    <div>
                        <div className="text-[clamp(3rem,7vw,4.9rem)] font-extrabold tracking-tight leading-[0.96] mb-4">
                            Build.<br />
                            Distribute.<br />
                            <em className="not-italic text-cyan-400">Evaluate.</em>
                        </div>
                        <div className="text-slate-300/80 text-base max-w-[500px] leading-[1.8]">
                            The complete platform for online assessments — AI-generated
                            questions, proctored exams, and instant analytics in one place.
                        </div>
                    </div>

                    {/* Features */}
                    <div className="grid gap-3">
                        <div className="flex items-start gap-[14px] p-4 rounded-[18px] bg-white/5 border border-white/10 backdrop-blur-[14px]">
                            <div className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-sky-500/20 text-white shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">🤖</div>
                            <div>
                                <div className="font-bold text-white mb-1">AI Question Generation</div>
                                <div className="text-[0.88rem] text-slate-300/70 leading-[1.6]">
                                    Generate high-quality questions by topic, difficulty &amp; type instantly
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-[14px] p-4 rounded-[18px] bg-white/5 border border-white/10 backdrop-blur-[14px]">
                            <div className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-sky-500/20 text-white shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">🔒</div>
                            <div>
                                <div className="font-bold text-white mb-1">Smart Proctoring</div>
                                <div className="text-[0.88rem] text-slate-300/70 leading-[1.6]">
                                    Web, image &amp; screen recording to ensure full exam integrity
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-[14px] p-4 rounded-[18px] bg-white/5 border border-white/10 backdrop-blur-[14px]">
                            <div className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-sky-500/20 text-white shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">📊</div>
                            <div>
                                <div className="font-bold text-white mb-1">Instant Analytics</div>
                                <div className="text-[0.88rem] text-slate-300/70 leading-[1.6]">
                                    Track performance across topics, difficulty &amp; question types
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Social proof */}
                    <div className="inline-flex items-center gap-3 py-2.5 pl-3 pr-4 rounded-full bg-white/5 border border-white/10 w-fit">
                        <div className="flex -space-x-2">
                            <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[0.72rem] font-extrabold border-2 border-slate-900 bg-emerald-400 text-slate-900 z-30">A</div>
                            <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[0.72rem] font-extrabold border-2 border-slate-900 bg-sky-400 text-slate-900 z-20">B</div>
                            <div className="w-[30px] h-[30px] rounded-full flex items-center justify-center text-[0.72rem] font-extrabold border-2 border-slate-900 bg-slate-50 text-slate-900 z-10">C</div>
                        </div>
                        <div className="text-[0.86rem] text-slate-300/90">
                            <strong className="text-white">500+ exams</strong> conducted this month
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ RIGHT PANEL ══════════════════════════════════════════ */}
            <div className="flex flex-col justify-center px-[26px] lg:px-[56px] py-[76px] lg:py-[72px] bg-neutral-950 relative">
                <div className="max-w-[440px] w-full mx-auto mt-12 lg:mt-0">


                    <div className="flex justify-between items-center mb-[28px]">
                        <div className="flex gap-1.5">
                            <div className="h-1 w-6 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500" />
                            <div className="h-1 w-[42px] rounded-full bg-gradient-to-r from-emerald-500 to-sky-500" />
                            <div className="h-1 w-6 rounded-full bg-white/10" />
                        </div>
                        <Link to="/" className="inline-flex items-center gap-2 px-[12px] py-[6px] rounded-full border border-white/10 bg-white/5 text-[0.76rem] font-bold text-neutral-400 hover:text-white hover:bg-white/10 transition-colors">
                            &larr; Back to landing page
                        </Link>
                    </div>

                    <h2 className="text-[2rem] font-extrabold tracking-[-0.05em] text-white mb-2">Welcome back 👋</h2>
                    <p className="text-neutral-400 leading-[1.7] mb-[22px]">
                        Sign in to manage assessments, questions &amp; candidates.
                    </p>

                    <div className="mb-3 p-3 lg:px-[14px] lg:py-[12px] rounded-2xl bg-white/5 border border-white/10 text-[0.86rem] text-neutral-400 shadow-sm leading-[1.6]">
                        New to MazeAI? <Link to="/signup" className="font-bold text-sky-500 hover:text-sky-400">Create your company workspace</Link>
                    </div>
                    <div className="mb-[24px] p-3 lg:px-[14px] lg:py-[12px] rounded-2xl bg-white/5 border border-white/10 text-[0.86rem] text-neutral-400 shadow-sm leading-[1.6]">
                        Platform superadmins can sign in here and will be routed to the organisation billing console.
                    </div>

                    {/* Error */}
                    {errorMsg && (
                        <div className="mb-4 p-3 lg:px-[14px] lg:py-[12px] rounded-[14px] bg-red-500/10 border border-red-500/20 text-[0.88rem] font-semibold text-red-500 flex items-center gap-2">
                            <span>⚠️</span> {errorMsg}
                        </div>
                    )}

                    {/* Email */}
                    <div className="mb-4">
                        <label className="block text-[0.82rem] font-bold text-white mb-2" htmlFor="email">Email Address</label>
                        <div className="relative">
                            <input
                                type="email"
                                id="email"
                                placeholder="admin@mazeai.app"
                                autoComplete="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                                className="w-full min-h-[48px] px-4 rounded-[14px] bg-neutral-900 border border-white/10 text-white placeholder-neutral-500 focus:border-sky-500/40 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all shadow-sm"
                            />
                        </div>
                    </div>

                    {/* Password */}
                    <div className="mb-[20px]">
                        <label className="block text-[0.82rem] font-bold text-white mb-2" htmlFor="password">Password</label>
                        <div className="relative flex items-center">
                            <input
                                type={visible ? 'text' : 'password'}
                                id="password"
                                placeholder="••••••••••••"
                                autoComplete="current-password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                                className="w-full min-h-[48px] pl-4 pr-[46px] rounded-[14px] bg-neutral-900 border border-white/10 text-white placeholder-neutral-500 focus:border-sky-500/40 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all shadow-sm"
                            />
                            <button
                                type="button"
                                className="absolute right-[14px] p-1 text-neutral-500 hover:text-neutral-300 inline-flex"
                                onClick={() => setVisible(!visible)}
                                title={visible ? 'Hide' : 'Show'}
                            >
                                {visible ? (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
                                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                                        <line x1="1" y1="1" x2="23" y2="23"/>
                                    </svg>
                                ) : (
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                        <circle cx="12" cy="12" r="3"/>
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>

                    {/* Options */}
                    <div className="flex items-center justify-between gap-3 mb-[20px]">
                        <label className="inline-flex items-center gap-2 cursor-pointer text-[0.86rem] text-neutral-400 hover:text-neutral-300">
                            <input type="checkbox" defaultChecked className="w-4 h-4 accent-emerald-600 rounded border-white/10 bg-neutral-900" />
                            Remember me
                        </label>
                        <a href="#" className="font-bold text-[0.86rem] text-sky-500 hover:text-sky-400">Forgot password?</a>
                    </div>

                    {/* Submit */}
                    <button
                        onClick={() => handleLogin()}
                        disabled={status === 'loading'}
                        className={`w-full min-h-[50px] rounded-[16px] border-0 flex justify-center items-center gap-2 text-[0.96rem] font-extrabold text-white transition-transform shadow-[0_20px_36px_rgba(14,165,233,0.2)] hover:-translate-y-px hover:shadow-[0_24px_40px_rgba(14,165,233,0.24)] disabled:opacity-70 disabled:cursor-not-allowed group
                            ${isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''}
                            ${status === 'success' 
                                ? 'bg-emerald-600 !shadow-[0_4px_20px_rgba(22,163,74,0.4)]' 
                                : 'bg-gradient-to-r from-emerald-500 to-sky-500'
                            }
                        `}
                    >
                        {status === 'success' ? (
                            <>✓ Success — Redirecting</>
                        ) : status === 'loading' ? (
                            <>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="animate-spin">
                                    <path d="M21 12a9 9 0 1 1-6.22-8.56"/>
                                </svg>
                                Signing in...
                            </>
                        ) : (
                            <>Sign In <span className="transition-transform group-hover:translate-x-[3px]">&rarr;</span></>
                        )}
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-[12px] my-[22px]">
                        <div className="flex-1 h-px bg-slate-200/90 dark:bg-white/10" />
                        <div className="text-[0.82rem] font-bold text-neutral-500 uppercase tracking-[0.08em]">or</div>
                        <div className="flex-1 h-px bg-slate-200/90 dark:bg-white/10" />
                    </div>

                    {/* Google SSO */}
                    <div className="mb-[18px] min-h-[44px] flex justify-center [&>div]:!w-full [&_iframe]:!w-full">
                        <GoogleAuthButton
                            text="signin_with"
                            onCredential={handleGoogleLogin}
                            disabled={status === 'loading'}
                        />
                    </div>

                    {/* Footer */}
                    <div className="text-center text-[0.82rem] text-neutral-500 leading-[1.8] mt-[18px]">
                        Having trouble? <a href="#" className="text-sky-500 hover:text-sky-400 font-bold">Contact support</a><br />
                        <span className="inline-block mt-[5px]">
                            By signing in you agree to our <a href="#" className="font-bold text-sky-500 hover:text-sky-400">Terms</a> &amp; <a href="#" className="font-bold text-sky-500 hover:text-sky-400">Privacy Policy</a>
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;
