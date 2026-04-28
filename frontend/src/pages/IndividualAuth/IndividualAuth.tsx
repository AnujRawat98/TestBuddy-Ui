import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import GoogleAuthButton from '../../components/GoogleAuthButton';
import MazeLogo from '../../components/MazeLogo';
import { adminApi } from '../../services/api';
import { getPostAuthRoute, saveAuthSession } from '../../utils/auth';

type AuthTab = 'login' | 'signup';

const IndividualAuth: React.FC = () => {
    const navigate = useNavigate();
    const [tab, setTab] = useState<AuthTab>('login');
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [isShaking, setIsShaking] = useState(false);

    const passwordChecks = useMemo(() => [
        { label: 'At least 8 characters', valid: password.length >= 8 },
        { label: 'Contains a letter', valid: /[A-Za-z]/.test(password) },
        { label: 'Contains a number', valid: /\d/.test(password) },
    ], [password]);

    const triggerShake = () => {
        setIsShaking(true);
        window.setTimeout(() => setIsShaking(false), 400);
    };

    const completeAuth = (data: any) => {
        if (data?.token) {
            saveAuthSession(
                data.token,
                Boolean(data.isSuperAdmin),
                data.tenantType,
                data.role,
            );
        }

        setStatus('success');
        window.setTimeout(() => navigate(getPostAuthRoute(data)), 900);
    };

    const handleLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setErrorMsg('');

        if (!email.trim() || !password) {
            triggerShake();
            setErrorMsg('Please enter your email and password.');
            return;
        }

        setStatus('loading');

        try {
            const res = await adminApi.login({
                email: email.trim(),
                password,
            });

            completeAuth(res.data);
        } catch (err: any) {
            console.error(err);
            setStatus('idle');
            triggerShake();
            setErrorMsg(err.response?.data?.message || 'Unable to sign you in right now.');
        }
    };

    const handleSignup = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        setErrorMsg('');

        if (!displayName.trim() || !email.trim() || !password || !confirmPassword) {
            triggerShake();
            setErrorMsg('Please complete all required fields.');
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

        if (!acceptedTerms) {
            triggerShake();
            setErrorMsg('Please accept the Terms and Privacy Policy to continue.');
            return;
        }

        setStatus('loading');

        try {
            const res = await adminApi.individualSignup({
                displayName: displayName.trim(),
                email: email.trim(),
                password,
            });

            completeAuth(res.data);
        } catch (err: any) {
            console.error(err);
            setStatus('idle');
            triggerShake();
            setErrorMsg(err.response?.data?.message || 'We could not create your account right now.');
        }
    };

    const handleGoogle = async (idToken: string) => {
        setErrorMsg('');

        if (tab === 'signup' && !acceptedTerms) {
            triggerShake();
            setErrorMsg('Please accept the Terms and Privacy Policy to continue.');
            return;
        }

        setStatus('loading');

        try {
            const res = tab === 'login'
                ? await adminApi.googleLogin({ idToken })
                : await adminApi.individualGoogleSignup({ idToken });

            completeAuth(res.data);
        } catch (err: any) {
            console.error(err);
            setStatus('idle');
            triggerShake();
            setErrorMsg(
                err.response?.data?.message ||
                (tab === 'login' ? 'Google sign-in failed.' : 'Google signup failed.')
            );
        }
    };

    return (
        <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-[1.15fr_0.95fr] bg-black text-white antialiased">
            <div className="hidden lg:flex relative overflow-hidden flex-col justify-between p-12 lg:px-16 border-r border-white/5 bg-black sticky top-0 h-[100dvh]">
                <div className="absolute top-[-10%] left-[-10%] w-[520px] h-[520px] rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[420px] h-[420px] rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-50" />

                <div className="relative z-10 h-full flex flex-col justify-between space-y-10 py-4">
                    <div className="flex items-center gap-3 text-[1.4rem] font-extrabold tracking-tight text-white">
                        <div className="w-10 h-10 rounded-[14px] flex items-center justify-center bg-white/10 border border-white/20">
                            <MazeLogo className="w-5 h-5 text-white" />
                        </div>
                        <div>Maze<span className="text-cyan-300">AI</span></div>
                    </div>

                    <div>
                        <div className="text-[clamp(3rem,7vw,4.8rem)] font-extrabold tracking-tight leading-[0.96] mb-4 text-white">
                            Practice.<br />
                            Improve.<br />
                            <em className="not-italic text-cyan-300">Get ready.</em>
                        </div>
                        <div className="text-zinc-300/80 text-base max-w-[500px] leading-[1.8]">
                            Your individual MazeAI space gives you a dedicated tenant, personal workspace,
                            and direct access to AI guidance, notes, planning, and your own learning progress.
                        </div>
                    </div>

                    <div className="grid gap-3">
                        <div className="flex items-start gap-[14px] p-4 rounded-[18px] bg-white/5 border border-white/10 backdrop-blur-[14px]">
                            <div className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center bg-cyan-500/15 text-cyan-300 font-bold shrink-0">ME</div>
                            <div>
                                <div className="font-bold text-white mb-1">Personal Workspace</div>
                                <div className="text-[0.88rem] text-zinc-300/70 leading-[1.6]">
                                    Sign in with your own account and keep your progress in a separate individual tenant.
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-[14px] p-4 rounded-[18px] bg-white/5 border border-white/10 backdrop-blur-[14px]">
                            <div className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center bg-emerald-500/15 text-emerald-300 font-bold shrink-0">AI</div>
                            <div>
                                <div className="font-bold text-white mb-1">AI Teacher + Study Flow</div>
                                <div className="text-[0.88rem] text-zinc-300/70 leading-[1.6]">
                                    Use one account for guided explanation sessions, planning, and revision support.
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-[14px] p-4 rounded-[18px] bg-white/5 border border-white/10 backdrop-blur-[14px]">
                            <div className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center bg-violet-500/15 text-violet-300 font-bold shrink-0">GO</div>
                            <div>
                                <div className="font-bold text-white mb-1">Email or Google</div>
                                <div className="text-[0.88rem] text-zinc-300/70 leading-[1.6]">
                                    Use password login or continue with Google depending on how you created your account.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="inline-flex items-center gap-3 py-2.5 pl-3 pr-4 rounded-full bg-white/5 border border-white/10 w-fit">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
                        <div className="text-[0.86rem] text-zinc-300/90">
                            Individual access for self-serve practice and prep
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col justify-center px-[26px] lg:px-[56px] py-[76px] lg:py-[72px] bg-neutral-950 relative">
                <div className="max-w-[460px] w-full mx-auto mt-12 lg:mt-0">
                    <div className="flex justify-between items-center mb-[28px]">
                        <div className="flex gap-1.5">
                            <div className="h-1 w-6 rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500" />
                            <div className="h-1 w-[42px] rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500" />
                            <div className="h-1 w-6 rounded-full bg-white/10" />
                        </div>
                        <Link to="/" className="inline-flex items-center gap-2 px-[12px] py-[6px] rounded-full border border-white/10 bg-white/5 text-[0.76rem] font-bold text-neutral-400 hover:text-white hover:bg-white/10 transition-colors">
                            &larr; Back to landing page
                        </Link>
                    </div>

                    <h2 className="text-[2rem] font-extrabold tracking-[-0.05em] text-white mb-2">Individual access</h2>
                    <p className="text-neutral-400 leading-[1.7] mb-[22px]">
                        Sign in to your personal workspace or create a new individual account in one place.
                    </p>

                    <div className="mb-[18px] inline-flex w-full rounded-2xl border border-white/10 bg-white/5 p-1">
                        <button
                            type="button"
                            onClick={() => {
                                setTab('login');
                                setErrorMsg('');
                            }}
                            className={`flex-1 rounded-[14px] px-4 py-3 text-sm font-bold transition-colors ${
                                tab === 'login' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
                            }`}
                        >
                            Sign in
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setTab('signup');
                                setErrorMsg('');
                            }}
                            className={`flex-1 rounded-[14px] px-4 py-3 text-sm font-bold transition-colors ${
                                tab === 'signup' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'
                            }`}
                        >
                            Create account
                        </button>
                    </div>

                    <div className="mb-[18px] p-3 rounded-2xl bg-white/5 border border-white/10 text-[0.86rem] text-neutral-400 shadow-sm leading-[1.6]">
                        Looking for organisation access instead? <Link to={tab === 'login' ? '/login' : '/signup'} className="font-bold text-sky-500 hover:text-sky-400">
                            {tab === 'login' ? 'Go to workspace sign in' : 'Go to workspace signup'}
                        </Link>
                    </div>

                    {errorMsg && (
                        <div className="mb-4 p-3 lg:px-[14px] lg:py-[12px] rounded-[14px] bg-red-500/10 border border-red-500/20 text-[0.88rem] font-semibold text-red-500 flex items-center gap-2">
                            <span>!</span> {errorMsg}
                        </div>
                    )}

                    <form onSubmit={tab === 'login' ? handleLogin : handleSignup} className="space-y-[16px]">
                        {tab === 'signup' && (
                            <div>
                                <label className="block text-[0.82rem] font-bold text-white mb-2" htmlFor="displayName">Full Name</label>
                                <input
                                    id="displayName"
                                    type="text"
                                    placeholder="Aarav Sharma"
                                    autoComplete="name"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    className="w-full min-h-[48px] px-4 rounded-[14px] bg-neutral-900 border border-white/10 text-white placeholder-neutral-500 focus:border-cyan-500/40 focus:ring-4 focus:ring-cyan-500/10 outline-none transition-all shadow-sm"
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-[0.82rem] font-bold text-white mb-2" htmlFor="email">Email Address</label>
                            <input
                                id="email"
                                type="email"
                                placeholder={tab === 'login' ? 'you@example.com' : 'learner@example.com'}
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full min-h-[48px] px-4 rounded-[14px] bg-neutral-900 border border-white/10 text-white placeholder-neutral-500 focus:border-cyan-500/40 focus:ring-4 focus:ring-cyan-500/10 outline-none transition-all shadow-sm"
                            />
                        </div>

                        <div>
                            <label className="block text-[0.82rem] font-bold text-white mb-2" htmlFor="password">Password</label>
                            <div className="relative flex items-center">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder={tab === 'login' ? 'Enter your password' : 'Create a secure password'}
                                    autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full min-h-[48px] pl-4 pr-[46px] rounded-[14px] bg-neutral-900 border border-white/10 text-white placeholder-neutral-500 focus:border-cyan-500/40 focus:ring-4 focus:ring-cyan-500/10 outline-none transition-all shadow-sm"
                                />
                                <button
                                    type="button"
                                    className="absolute right-[14px] hover:text-white text-neutral-500 text-sm font-semibold p-1"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>

                        {tab === 'signup' && (
                            <>
                                <div>
                                    <label className="block text-[0.82rem] font-bold text-white mb-2" htmlFor="confirmPassword">Confirm Password</label>
                                    <div className="relative flex items-center">
                                        <input
                                            id="confirmPassword"
                                            type={showConfirmPassword ? 'text' : 'password'}
                                            placeholder="Re-enter your password"
                                            autoComplete="new-password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            className="w-full min-h-[48px] pl-4 pr-[46px] rounded-[14px] bg-neutral-900 border border-white/10 text-white placeholder-neutral-500 focus:border-cyan-500/40 focus:ring-4 focus:ring-cyan-500/10 outline-none transition-all shadow-sm"
                                        />
                                        <button
                                            type="button"
                                            className="absolute right-[14px] hover:text-white text-neutral-500 text-sm font-semibold p-1"
                                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        >
                                            {showConfirmPassword ? 'Hide' : 'Show'}
                                        </button>
                                    </div>
                                </div>

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

                                <label className="inline-flex items-center gap-2 cursor-pointer text-[0.86rem] text-neutral-400 hover:text-neutral-300">
                                    <input
                                        type="checkbox"
                                        checked={acceptedTerms}
                                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                                        className="w-4 h-4 accent-cyan-600 rounded border-white/10 bg-neutral-900"
                                    />
                                    I agree to the Terms and Privacy Policy
                                </label>
                            </>
                        )}

                        {tab === 'login' && (
                            <div className="flex items-center justify-end">
                                <Link to="/forgot-password" className="font-bold text-[0.86rem] text-sky-500 hover:text-sky-400">Forgot password?</Link>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className={`w-full min-h-[50px] rounded-[16px] border-0 flex justify-center items-center gap-2 text-[0.96rem] font-extrabold text-white transition-transform shadow-[0_20px_36px_rgba(14,165,233,0.2)] hover:-translate-y-px hover:shadow-[0_24px_40px_rgba(14,165,233,0.24)] disabled:opacity-70 disabled:cursor-not-allowed group
                                ${isShaking ? 'animate-[shake_0.4s_ease-in-out]' : ''}
                                ${status === 'success'
                                    ? 'bg-emerald-600 !shadow-[0_4px_20px_rgba(22,163,74,0.4)]'
                                    : 'bg-gradient-to-r from-cyan-500 to-emerald-500'
                                }
                            `}
                        >
                            {status === 'success' ? (
                                <>Success - Redirecting</>
                            ) : status === 'loading' ? (
                                <>{tab === 'login' ? 'Signing in...' : 'Creating account...'}</>
                            ) : (
                                <>{tab === 'login' ? 'Sign In' : 'Create Account'} <span className="transition-transform group-hover:translate-x-[3px]">&rarr;</span></>
                            )}
                        </button>
                    </form>

                    <div className="flex items-center gap-[12px] my-[22px]">
                        <div className="flex-1 h-px bg-white/10" />
                        <div className="text-[0.82rem] font-bold text-neutral-500 uppercase tracking-[0.08em]">or</div>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

                    <div className="mb-[18px] min-h-[44px] flex justify-center [&>div]:!w-full [&_iframe]:!w-full">
                        <GoogleAuthButton
                            text={tab === 'login' ? 'signin_with' : 'signup_with'}
                            onCredential={handleGoogle}
                            disabled={status === 'loading'}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IndividualAuth;
