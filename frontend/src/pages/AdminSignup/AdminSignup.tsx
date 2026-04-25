import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../../services/api';
import GoogleAuthButton from '../../components/GoogleAuthButton';
import { saveAuthSession } from '../../utils/auth';
import MazeLogo from '../../components/MazeLogo';

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
        <div className="w-full min-h-screen grid grid-cols-1 lg:grid-cols-[1.2fr_0.88fr] bg-black text-white antialiased">
            {/* ═══ LEFT PANEL ═══════════════════════════════════════════ */}
            <div className="hidden lg:flex relative overflow-hidden flex-col justify-between p-12 lg:px-16 border-r border-white/5 bg-black sticky top-0 h-[100dvh]">
                {/* Glow & Grid */}
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[400px] h-[400px] rounded-full bg-sky-500/10 blur-[100px] pointer-events-none" />
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none opacity-50" />

                <div className="relative z-10 h-full flex flex-col justify-between space-y-12">
                    {/* Brand */}
                    <div className="flex items-center gap-3 text-[1.4rem] font-extrabold tracking-tight text-white">
                        <div className="w-10 h-10 rounded-[14px] flex items-center justify-center bg-white/10 border border-white/20">
                            <MazeLogo className="w-5 h-5 text-white" />
                        </div>
                        <div>Maze<span className="text-emerald-300">AI</span></div>
                    </div>

                    {/* Headline */}
                    <div>
                        <div className="text-[clamp(3rem,7vw,4.9rem)] font-extrabold tracking-tight leading-[0.96] mb-4 text-white">
                            Launch.<br />
                            Invite.<br />
                            <em className="not-italic text-emerald-300">Evaluate.</em>
                        </div>
                        <div className="text-emerald-100/80 text-base max-w-[500px] leading-[1.8]">
                            Spin up a secure company workspace with its own tenant schema, admin access,
                            and a ready-to-use assessment setup in a single step.
                        </div>
                    </div>

                    {/* Features */}
                    <div className="grid gap-[12px] -mt-[10px]">
                        <div className="flex items-start gap-[14px] p-4 rounded-[18px] bg-white/10 border border-white/10 backdrop-blur-[14px]">
                            <div className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center bg-emerald-900/50 text-emerald-300 font-bold shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] text-[1rem]">WS</div>
                            <div>
                                <div className="font-bold text-white mb-1">Private Company Workspace</div>
                                <div className="text-[0.88rem] text-emerald-100/70 leading-[1.6]">
                                    Every signup provisions a dedicated tenant schema for your organization.
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-[14px] p-4 rounded-[18px] bg-white/10 border border-white/10 backdrop-blur-[14px]">
                            <div className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center bg-emerald-900/50 text-emerald-300 font-bold shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] text-[1rem]">DB</div>
                            <div>
                                <div className="font-bold text-white mb-1">Scoped Database Permissions</div>
                                <div className="text-[0.88rem] text-emerald-100/70 leading-[1.6]">
                                    Tenant database access is isolated to your schema only.
                                </div>
                            </div>
                        </div>
                        <div className="flex items-start gap-[14px] p-4 rounded-[18px] bg-white/10 border border-white/10 backdrop-blur-[14px]">
                            <div className="w-[42px] h-[42px] rounded-[14px] flex items-center justify-center bg-emerald-900/50 text-emerald-300 font-bold shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] text-[1rem]">GO</div>
                            <div>
                                <div className="font-bold text-white mb-1">Starter Plan Included</div>
                                <div className="text-[0.88rem] text-emerald-100/70 leading-[1.6]">
                                    Begin with the default onboarding plan and start creating assessments immediately.
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Metrics row */}
                    <div className="flex gap-[14px]">
                        <div className="flex-1 bg-white/10 border border-white/10 backdrop-blur-[12px] p-4 rounded-[18px] flex flex-col justify-center">
                            <span className="text-white text-[1.6rem] font-extrabold tracking-[-0.04em] mb-0.5">1 min</span>
                            <span className="text-emerald-100/80 text-[0.8rem] font-bold uppercase tracking-[0.04em]">average setup</span>
                        </div>
                        <div className="flex-1 bg-white/10 border border-white/10 backdrop-blur-[12px] p-4 rounded-[18px] flex flex-col justify-center">
                            <span className="text-white text-[1.6rem] font-extrabold tracking-[-0.04em] mb-0.5">public + tenant</span>
                            <span className="text-emerald-100/80 text-[0.8rem] font-bold uppercase tracking-[0.04em]">schema model</span>
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
                            <div className="h-1 w-[42px] rounded-full bg-gradient-to-r from-emerald-500 to-sky-500" />
                        </div>
                        <Link to="/" className="inline-flex items-center gap-2 px-[12px] py-[6px] rounded-full border border-white/10 bg-white/5 text-[0.76rem] font-bold text-neutral-400 hover:text-white hover:bg-white/10 transition-colors">
                            &larr; Back to landing page
                        </Link>
                    </div>

                    <h2 className="text-[2rem] font-extrabold tracking-[-0.05em] text-white mb-2">Create your workspace</h2>
                    <p className="text-neutral-400 leading-[1.7] mb-[22px]">
                        Register your company, provision the tenant schema, and receive admin access instantly.
                    </p>

                    <div className="mb-[12px] p-3 lg:px-[14px] lg:py-[12px] rounded-2xl bg-white/5 border border-white/10 text-[0.86rem] text-neutral-400 shadow-sm leading-[1.6]">
                        Already have an account? <Link to="/login" className="font-bold text-sky-500 hover:text-sky-400">Sign in here</Link>
                    </div>

                    {errorMsg && (
                        <div className="mb-4 p-3 lg:px-[14px] lg:py-[12px] rounded-[14px] bg-red-500/10 border border-red-500/20 text-[0.88rem] font-semibold text-red-500 flex items-center gap-2">
                            <span>!</span> {errorMsg}
                        </div>
                    )}

                    <form onSubmit={handleSignup} className="space-y-[16px]">
                        {/* Company Name */}
                        <div>
                            <label className="block text-[0.82rem] font-bold text-white mb-2" htmlFor="companyName">Company Name</label>
                            <input
                                id="companyName"
                                type="text"
                                placeholder="ABC Company"
                                autoComplete="organization"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                className="w-full min-h-[48px] px-4 rounded-[14px] bg-neutral-900 border border-white/10 text-white placeholder-neutral-500 focus:border-emerald-500/40 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm"
                            />
                            <div className="mt-1.5 text-[0.76rem] text-neutral-500/80 leading-[1.4]">
                                Optional for Google signup. If left blank, we will create a workspace name from your Google account.
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-[0.82rem] font-bold text-white mb-2" htmlFor="email">Work Email</label>
                            <input
                                id="email"
                                type="email"
                                placeholder="admin@abccompany.com"
                                autoComplete="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full min-h-[48px] px-4 rounded-[14px] bg-neutral-900 border border-white/10 text-white placeholder-neutral-500 focus:border-emerald-500/40 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm"
                            />
                        </div>

                        {/* Password */}
                        <div>
                            <label className="block text-[0.82rem] font-bold text-white mb-2" htmlFor="password">Password</label>
                            <div className="relative flex items-center">
                                <input
                                    id="password"
                                    type={visible ? 'text' : 'password'}
                                    placeholder="Create a secure password"
                                    autoComplete="new-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full min-h-[48px] pl-4 pr-[46px] rounded-[14px] bg-neutral-900 border border-white/10 text-white placeholder-neutral-500 focus:border-emerald-500/40 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all shadow-sm"
                                />
                                <button
                                    type="button"
                                    className="absolute right-[14px] hover:text-white text-neutral-500 text-sm font-semibold p-1"
                                    onClick={() => setVisible(!visible)}
                                >
                                    {visible ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>

                        {/* Confirm Password */}
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
                                />
                                <button
                                    type="button"
                                    className="absolute right-[14px] hover:text-white text-neutral-500 text-sm font-semibold p-1"
                                    onClick={() => setConfirmVisible(!confirmVisible)}
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


                        {/* Terms checkbox */}
                        <div className="flex items-center justify-between mb-6">
                            <label className="inline-flex items-center gap-2 cursor-pointer text-[0.86rem] text-neutral-400 hover:text-neutral-300">
                                <input
                                    type="checkbox"
                                    checked={acceptedTerms}
                                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                                    className="w-4 h-4 accent-emerald-600 rounded border-white/10 bg-neutral-900"
                                />
                                I agree to the Terms and Privacy Policy
                            </label>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
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
                                <>Workspace ready</>
                            ) : status === 'loading' ? (
                                <>Creating workspace...</>
                            ) : (
                                <>Create Workspace <span className="transition-transform group-hover:translate-x-[3px]">&rarr;</span></>
                            )}
                        </button>
                    </form>

                    {/* Divider */}
                    <div className="flex items-center gap-[12px] my-[22px]">
                        <div className="flex-1 h-px bg-white/10" />
                        <div className="text-[0.82rem] font-bold text-neutral-500 uppercase tracking-[0.08em]">or</div>
                        <div className="flex-1 h-px bg-white/10" />
                    </div>

                    {/* Google SSO */}
                    <div className="mb-[18px] min-h-[44px] flex justify-center [&>div]:!w-full [&_iframe]:!w-full">
                        <GoogleAuthButton
                            text="signup_with"
                            onCredential={handleGoogleSignup}
                            disabled={status === 'loading'}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminSignup;
