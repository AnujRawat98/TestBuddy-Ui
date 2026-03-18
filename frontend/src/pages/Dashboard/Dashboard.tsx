import React, { useEffect, useState } from 'react';
import './Dashboard.css';
import { topicsApi, assessmentsApi, assessmentLinksApi, questionsApi } from '../../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Assessment {
    id: string; title?: string; Title?: string;
    totalQuestions?: number; TotalQuestions?: number;
    durationMinutes?: number; DurationMinutes?: number;
    isActive?: boolean; IsActive?: boolean;
    createdAt?: string; CreatedAt?: string;
    topics?: string[]; topicNames?: string[];
}

interface Topic {
    id: string; name?: string; Name?: string;
    questionCount?: number;
}

interface ExamLink {
    id: string; name?: string;
    examEndDateTime?: string; examStartDateTime?: string;
    isActive?: boolean; assessmentId?: string;
}

interface DashboardStats {
    totalTopics:       number;
    totalQuestions:    number;
    totalAssessments:  number;
    activeLinks:       number;
    activeAssessments: number;
    draftAssessments:  number;
}

// ── Count-up hook ─────────────────────────────────────────────────────────────
const useCountUp = (end: number, duration = 1200) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        let start = 0;
        const step = end / (duration / 16);
        const timer = setInterval(() => {
            start = Math.min(start + step, end);
            setCount(Math.floor(start));
            if (start >= end) clearInterval(timer);
        }, 16);
        return () => clearInterval(timer);
    }, [end, duration]);
    return count;
};

// ── Skeleton loader ───────────────────────────────────────────────────────────
const Skeleton: React.FC<{ w?: string; h?: string; r?: string }> = ({ w = '100%', h = '16px', r = '6px' }) => (
    <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg, var(--border) 25%, var(--surface) 50%, var(--border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
);

const fmtDate = (s?: string) => {
    if (!s) return '—';
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const Dashboard: React.FC = () => {
    const [stats,       setStats]       = useState<DashboardStats>({ totalTopics: 0, totalQuestions: 0, totalAssessments: 0, activeLinks: 0, activeAssessments: 0, draftAssessments: 0 });
    const [assessments, setAssessments] = useState<Assessment[]>([]);
    const [topics,      setTopics]      = useState<Topic[]>([]);
    const [allLinks,    setAllLinks]    = useState<ExamLink[]>([]);
    const [loading,     setLoading]     = useState(true);
    const [error,       setError]       = useState('');

    // Count-up targets from real data
    const cntTopics      = useCountUp(stats.totalTopics, 900);
    const cntQuestions   = useCountUp(stats.totalQuestions, 1600);
    const cntAssessments = useCountUp(stats.totalAssessments, 900);
    const cntLinks       = useCountUp(stats.activeLinks, 600);

    useEffect(() => {
        loadDashboard();
    }, []);

    const loadDashboard = async () => {
        setLoading(true);
        setError('');
        try {
            // 1. Load topics, assessments, and questions in parallel
            const [topicsRes, assessmentsRes, questionsRes] = await Promise.allSettled([
                topicsApi.getAll(),
                assessmentsApi.getAll(),
                questionsApi.search({ topics: [], levels: [], types: [], pageNumber: 1, pageSize: 1 }),
            ]);

            // ── Topics ────────────────────────────────────────────────────────
            const topicList: Topic[] = topicsRes.status === 'fulfilled'
                ? (Array.isArray(topicsRes.value.data)
                    ? topicsRes.value.data
                    : topicsRes.value.data?.items ?? topicsRes.value.data?.value ?? [])
                : [];

            setTopics(topicList);

            // ── Assessments ───────────────────────────────────────────────────
            const assessmentList: Assessment[] = assessmentsRes.status === 'fulfilled'
                ? (Array.isArray(assessmentsRes.value.data)
                    ? assessmentsRes.value.data
                    : assessmentsRes.value.data?.items ?? assessmentsRes.value.data?.value ?? [])
                : [];

            setAssessments(assessmentList);

            // ── Total questions ───────────────────────────────────────────────
            let totalQuestions = 0;
            if (questionsRes.status === 'fulfilled') {
                const qData = questionsRes.value.data;
                totalQuestions = qData?.totalCount ?? qData?.total ?? qData?.count
                    ?? (Array.isArray(qData) ? qData.length : 0);
            }

            // ── Links — fetch per assessment in parallel ──────────────────────
            const linkResults = await Promise.allSettled(
                assessmentList.map(a =>
                    assessmentLinksApi.getByAssessment(a.id ?? (a as any).Id)
                        .then(r => Array.isArray(r.data) ? r.data : r.data?.items ?? r.data?.value ?? [])
                        .catch(() => [])
                )
            );

            const links: ExamLink[] = linkResults.flatMap(r =>
                r.status === 'fulfilled' ? r.value : []
            );
            setAllLinks(links);

            const now = new Date();
            const activeLinks = links.filter(l =>
                l.isActive !== false && new Date(l.examEndDateTime ?? '') > now
            ).length;

            const activeAssessments = assessmentList.filter(a => a.isActive ?? a.IsActive).length;
            const draftAssessments  = assessmentList.filter(a => !(a.isActive ?? a.IsActive)).length;

            setStats({
                totalTopics:      topicList.length,
                totalQuestions,
                totalAssessments: assessmentList.length,
                activeLinks,
                activeAssessments,
                draftAssessments,
            });

        } catch (err: any) {
            setError('Failed to load dashboard data. Please refresh.');
        } finally {
            setLoading(false);
        }
    };

    // ── Derived data ──────────────────────────────────────────────────────────
    const recentAssessments = assessments.slice(0, 5);

    const now = new Date();
    const activeExamLinks = allLinks
        .filter(l => l.isActive !== false && new Date(l.examEndDateTime ?? '') > now)
        .slice(0, 5);

    const maxQuestionCount = Math.max(...topics.map(t => t.questionCount ?? 0), 1);

    return (
        <>
            <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>

            {/* Page Header */}
            <div className="page-header" style={{ animationDelay: '.05s' }}>
                <div>
                    <div className="page-title">Dashboard</div>
                    <div className="page-sub">Here's what's happening with TestBuddy today.</div>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary btn-sm" onClick={loadDashboard}>🔄 Refresh</button>
                    <button className="btn btn-primary btn-sm" onClick={() => window.location.href = '/assessments/create'}>+ New Assessment</button>
                </div>
            </div>

            {error && (
                <div style={{ padding: '12px 16px', background: 'rgba(224,59,59,.08)', border: '1px solid rgba(224,59,59,.2)', borderRadius: '10px', color: 'var(--red)', fontSize: '14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    ⚠️ {error}
                    <button onClick={loadDashboard} style={{ marginLeft: 'auto', padding: '4px 12px', background: 'none', border: '1px solid var(--red)', borderRadius: '6px', color: 'var(--red)', cursor: 'pointer', fontSize: '12px' }}>Retry</button>
                </div>
            )}

            {/* STAT CARDS */}
            <div className="stats-grid">
                <div className="stat-card s1" data-bg={stats.totalTopics}>
                    <div className="stat-top">
                        <div className="stat-icon-wrap">🗂</div>
                        <div className="stat-trend trend-up">
                            {loading ? <Skeleton w="60px" h="20px" r="100px" /> : `${stats.totalTopics} total`}
                        </div>
                    </div>
                    <div className="stat-num">{loading ? <Skeleton w="60px" h="36px" r="8px" /> : cntTopics}</div>
                    <div className="stat-label">Total Topics</div>
                    <div className="stat-sub">
                        {loading ? <Skeleton w="80%" h="12px" /> : `📌 ${topics[0]?.name ?? topics[0]?.Name ?? 'No topics yet'}`}
                    </div>
                </div>

                <div className="stat-card s2" data-bg={stats.totalQuestions}>
                    <div className="stat-top">
                        <div className="stat-icon-wrap">❓</div>
                        <div className="stat-trend trend-up">
                            {loading ? <Skeleton w="60px" h="20px" r="100px" /> : `${stats.totalQuestions} total`}
                        </div>
                    </div>
                    <div className="stat-num">{loading ? <Skeleton w="60px" h="36px" r="8px" /> : cntQuestions}</div>
                    <div className="stat-label">Total Questions</div>
                    <div className="stat-sub">
                        {loading ? <Skeleton w="80%" h="12px" /> : `📚 Across ${stats.totalTopics} topic${stats.totalTopics !== 1 ? 's' : ''}`}
                    </div>
                </div>

                <div className="stat-card s3" data-bg={stats.totalAssessments}>
                    <div className="stat-top">
                        <div className="stat-icon-wrap">📝</div>
                        <div className="stat-trend trend-up">
                            {loading ? <Skeleton w="60px" h="20px" r="100px" /> : `↑ ${stats.activeAssessments} active`}
                        </div>
                    </div>
                    <div className="stat-num">{loading ? <Skeleton w="60px" h="36px" r="8px" /> : cntAssessments}</div>
                    <div className="stat-label">Assessments</div>
                    <div className="stat-sub">
                        {loading ? <Skeleton w="80%" h="12px" /> : `✅ ${stats.activeAssessments} active · ${stats.draftAssessments} inactive`}
                    </div>
                </div>

                <div className="stat-card s4" data-bg={stats.activeLinks}>
                    <div className="stat-top">
                        <div className="stat-icon-wrap">🔗</div>
                        <div className="stat-trend trend-flat">
                            {loading ? <Skeleton w="60px" h="20px" r="100px" /> : `${stats.activeLinks} live`}
                        </div>
                    </div>
                    <div className="stat-num">{loading ? <Skeleton w="60px" h="36px" r="8px" /> : cntLinks}</div>
                    <div className="stat-label">Active Exam Links</div>
                    <div className="stat-sub">
                        {loading ? <Skeleton w="80%" h="12px" /> : `🔗 Out of ${allLinks.length} total links`}
                    </div>
                </div>
            </div>

            {/* ROW 2: Assessments table + Quick Actions */}
            <div className="grid-3">
                {/* Recent Assessments */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">📋 Recent Assessments</div>
                        <button className="btn btn-secondary btn-sm" onClick={() => window.location.href = '/assessments'}>View All →</button>
                    </div>
                    <div className="card-body">
                        {loading ? (
                            <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {[1,2,3,4,5].map(i => <Skeleton key={i} h="40px" r="8px" />)}
                            </div>
                        ) : recentAssessments.length === 0 ? (
                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '14px' }}>
                                No assessments yet. <a href="/assessments/create" style={{ color: 'var(--accent2)' }}>Create one →</a>
                            </div>
                        ) : (
                            <table>
                                <thead>
                                    <tr>
                                        <th>Assessment</th>
                                        <th>Questions</th>
                                        <th>Duration</th>
                                        <th>Status</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentAssessments.map(a => {
                                        const id      = a.id ?? (a as any).Id;
                                        const title   = a.title ?? a.Title ?? 'Untitled';
                                        const qs      = a.totalQuestions ?? a.TotalQuestions ?? 0;
                                        const dur     = a.durationMinutes ?? a.DurationMinutes ?? 0;
                                        const active  = a.isActive ?? a.IsActive ?? false;
                                        const topicNames = (a.topics ?? a.topicNames ?? []) as string[];
                                        return (
                                            <tr key={id}>
                                                <td>
                                                    <div className="assessment-name">{title}</div>
                                                    <div className="assessment-meta">{topicNames.join(' · ') || '—'}</div>
                                                </td>
                                                <td>{qs}</td>
                                                <td>{dur} min</td>
                                                <td>
                                                    <span className={`badge ${active ? 'badge-active' : 'badge-draft'}`}>
                                                        <span className="badge-dot" />
                                                        {active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="action-btns">
                                                        <div className="act-btn" title="View" onClick={() => window.location.href = `/assessments`}>👁</div>
                                                        <div className="act-btn" title="Create Link" onClick={() => window.location.href = `/create-link`}>🔗</div>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

                {/* Right column */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Quick Actions */}
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">⚡ Quick Actions</div>
                        </div>
                        <div className="quick-grid">
                            {[
                                { icon: '➕', label: 'New Question',    href: '/questions'           },
                                { icon: '🤖', label: 'AI Generate',     href: '/questions'           },
                                { icon: '📝', label: 'New Assessment',  href: '/assessments/create'  },
                                { icon: '🔗', label: 'Create Link',     href: '/create-link'         },
                            ].map(q => (
                                <div key={q.label} className="quick-btn" onClick={() => window.location.href = q.href}>
                                    <div className="quick-icon">{q.icon}</div>
                                    <div className="quick-label">{q.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Active Exam Links */}
                    <div className="card" style={{ flex: 1 }}>
                        <div className="card-header">
                            <div className="card-title">🔗 Active Exam Links</div>
                        </div>
                        <div className="activity-list">
                            {loading ? (
                                <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {[1,2,3].map(i => <Skeleton key={i} h="52px" r="8px" />)}
                                </div>
                            ) : activeExamLinks.length === 0 ? (
                                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                                    No active exam links.
                                </div>
                            ) : activeExamLinks.map((link, i) => {
                                const colors = ['rgba(255,92,0,.1)', 'rgba(0,87,255,.1)', 'rgba(0,194,113,.1)'];
                                const expires = new Date(link.examEndDateTime ?? '');
                                const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                const expiring = daysLeft <= 2;
                                return (
                                    <div key={link.id} className="link-item">
                                        <div className="link-icon" style={{ background: colors[i % colors.length] }}>📝</div>
                                        <div className="link-info">
                                            <div className="link-title">{link.name || 'Exam Link'}</div>
                                            <div className="link-meta">Ends {fmtDate(link.examEndDateTime)}</div>
                                        </div>
                                        <div className={`link-time ${expiring ? 'expiring' : ''}`}>
                                            {expiring ? '⚠ Expiring' : 'Active'}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ROW 3: Topics distribution + Assessments summary */}
            <div className="grid-2">
                {/* Questions by Topic */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">📚 Topics</div>
                        <button className="btn btn-secondary btn-sm" onClick={() => window.location.href = '/topics'}>Manage →</button>
                    </div>
                    <div className="topic-list">
                        {loading ? (
                            <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                {[1,2,3,4,5].map(i => <Skeleton key={i} h="34px" r="8px" />)}
                            </div>
                        ) : topics.length === 0 ? (
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                                No topics yet.
                            </div>
                        ) : topics.slice(0, 6).map((topic, i) => {
                            const name  = topic.name ?? topic.Name ?? 'Unknown';
                            const count = topic.questionCount ?? 0;
                            const pct   = maxQuestionCount > 0 ? Math.round((count / maxQuestionCount) * 100) : 0;
                            const colors = ['fill-orange','fill-blue','fill-green','fill-yellow','fill-purple','fill-blue'];
                            const bgColors = ['rgba(255,92,0,.1)','rgba(0,87,255,.1)','rgba(0,194,113,.1)','rgba(245,166,35,.1)','rgba(139,92,246,.1)','rgba(0,87,255,.08)'];
                            const emojis = ['🟠','🔵','🟢','🟡','🟣','📘'];
                            return (
                                <div key={topic.id} className="topic-row">
                                    <div className="topic-icon" style={{ background: bgColors[i % bgColors.length] }}>{emojis[i % emojis.length]}</div>
                                    <div className="topic-name">{name}</div>
                                    <div className="progress-wrap" style={{ flex: 1, maxWidth: '180px' }}>
                                        <div className="progress-bar">
                                            <div className={`progress-fill ${colors[i % colors.length]}`} style={{ width: `${pct}%`, transition: 'width 1s ease' }} />
                                        </div>
                                    </div>
                                    <div className="topic-num-text">{count}</div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="card-footer">
                        <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => window.location.href = '/topics'}>
                            + Add New Topic
                        </button>
                    </div>
                </div>

                {/* All Exam Links summary */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">🔗 All Exam Links</div>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{allLinks.length} total</span>
                    </div>
                    <div className="activity-list">
                        {loading ? (
                            <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {[1,2,3,4,5].map(i => <Skeleton key={i} h="52px" r="8px" />)}
                            </div>
                        ) : allLinks.length === 0 ? (
                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                                No exam links yet. <a href="/create-link" style={{ color: 'var(--accent2)' }}>Create one →</a>
                            </div>
                        ) : allLinks.slice(0, 6).map(link => {
                            const end        = new Date(link.examEndDateTime ?? '');
                            const expired    = end < now;
                            const daysLeft   = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                            const expiring   = !expired && daysLeft <= 2;
                            const statusText = expired ? 'Expired' : expiring ? '⚠ Expiring' : 'Active';
                            const statusCls  = expired ? 'badge-expired' : 'badge-active';
                            return (
                                <div key={link.id} className="link-item">
                                    <div className="link-icon" style={{ background: 'rgba(0,87,255,.08)' }}>🔗</div>
                                    <div className="link-info">
                                        <div className="link-title">{link.name || 'Exam Link'}</div>
                                        <div className="link-meta">
                                            {fmtDate(link.examStartDateTime)} → {fmtDate(link.examEndDateTime)}
                                        </div>
                                    </div>
                                    <span className={`badge ${statusCls}`} style={{ fontSize: '11px', padding: '3px 9px' }}>
                                        <span className="badge-dot" />{statusText}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Dashboard;
