import React, { useEffect, useState } from 'react';
import './Dashboard.css';
import { topicsApi, assessmentsApi, assessmentLinksApi, questionsApi, interviewsApi, interviewLinksApi } from '../../services/api';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Assessment {
    id: string; title?: string; Title?: string;
    totalQuestions?: number; TotalQuestions?: number;
    durationMinutes?: number; DurationMinutes?: number;
    isActive?: boolean; IsActive?: boolean;
    createdAt?: string; CreatedAt?: string;
}

interface Interview {
    id: string; name?: string; difficulty?: string;
    totalQuestions?: number; durationMinutes?: number;
    instructions?: string; topics?: { id: string; name: string }[];
    createdAt?: string; UpdatedAt?: string;
}

interface Topic {
    id: string;
    name?: string; Name?: string;
    topicVersionId?: string; TopicVersionId?: string;
    questionCount?: number;
}

interface ExamLink {
    id: string; name?: string;
    examEndDateTime?: string; examStartDateTime?: string;
    isActive?: boolean; assessmentId?: string;
    isCredentialBased?: boolean;
}

interface InterviewLink {
    Id: string; InterviewId?: string; Name?: string;
    StartTime?: string; EndTime?: string;
    IsActive?: boolean;
    TotalCandidates?: number; CompletedCandidates?: number;
}

interface DashboardStats {
    totalTopics:       number;
    totalQuestions:    number;
    totalAssessments:  number;
    activeLinks:       number;
    activeAssessments: number;
    draftAssessments:  number;
    totalInterviews:   number;
    activeInterviewLinks: number;
}

// ── Count-up hook ─────────────────────────────────────────────────────────────
const useCountUp = (end: number, duration = 1000) => {
    const [count, setCount] = useState(0);
    useEffect(() => {
        if (end === 0) { setCount(0); return; }
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

// ── Skeleton ──────────────────────────────────────────────────────────────────
const Skeleton: React.FC<{ w?: string; h?: string; r?: string }> = ({ w = '100%', h = '16px', r = '6px' }) => (
    <div style={{ width: w, height: h, borderRadius: r, background: 'linear-gradient(90deg, var(--border) 25%, var(--surface) 50%, var(--border) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />
);

const fmtDate = (s?: string) => !s ? '—' : new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const Dashboard: React.FC = () => {
    const [stats,           setStats]           = useState<DashboardStats>({ totalTopics: 0, totalQuestions: 0, totalAssessments: 0, activeLinks: 0, activeAssessments: 0, draftAssessments: 0, totalInterviews: 0, activeInterviewLinks: 0 });
    const [assessments,     setAssessments]     = useState<Assessment[]>([]);
    const [interviews,      setInterviews]      = useState<Interview[]>([]);
    const [topics,          setTopics]          = useState<Topic[]>([]);
    const [allLinks,        setAllLinks]        = useState<ExamLink[]>([]);
    const [allInterviewLinks, setAllInterviewLinks] = useState<InterviewLink[]>([]);
    const [loading,         setLoading]         = useState(true);
    const [error,           setError]           = useState('');
    const [linksTab,        setLinksTab]        = useState<'exam' | 'interview'>('exam');

    const cntTopics        = useCountUp(stats.totalTopics,      900);
    const cntQuestions     = useCountUp(stats.totalQuestions,   1400);
    const cntAssessments   = useCountUp(stats.totalAssessments, 800);
    const cntLinks         = useCountUp(stats.activeLinks,      600);
    const cntInterviews    = useCountUp(stats.totalInterviews,  600);
    const cntInterviewLinks = useCountUp(stats.activeInterviewLinks, 600);

    useEffect(() => { loadDashboard(); }, []);

    const loadDashboard = async () => {
        setLoading(true);
        setError('');
        try {
            const [topicsRes, assessmentsRes, interviewsRes] = await Promise.allSettled([
                topicsApi.getAll(),
                assessmentsApi.getAll(),
                interviewsApi.getAll(),
            ]);

            // ── Topics ────────────────────────────────────────────────────────
            const rawTopicList: any[] = topicsRes.status === 'fulfilled'
                ? (Array.isArray(topicsRes.value.data) ? topicsRes.value.data : topicsRes.value.data?.items ?? topicsRes.value.data?.value ?? [])
                : [];

            const topicList: Topic[] = await Promise.all(
                rawTopicList.map(async (t: any) => {
                    const tvId: string = t.topicVersionId ?? t.TopicVersionId ?? '';
                    let questionCount  = 0;
                    if (tvId) {
                        try {
                            const qRes = await questionsApi.getAllByTopic(tvId);
                            const d    = qRes.data;
                            questionCount = Array.isArray(d)
                                ? d.length
                                : (d?.totalCount ?? d?.count ?? d?.items?.length ?? 0);
                        } catch { /* keep 0 */ }
                    }
                    return {
                        id:             t.topicId ?? t.TopicId ?? t.id,
                        name:           t.name    ?? t.Name    ?? '—',
                        topicVersionId: tvId,
                        questionCount,
                    };
                })
            );
            setTopics(topicList);
            const totalQuestions = topicList.reduce((sum, t) => sum + (t.questionCount ?? 0), 0);

            // ── Assessments ───────────────────────────────────────────────────
            const assessmentList: Assessment[] = assessmentsRes.status === 'fulfilled'
                ? (Array.isArray(assessmentsRes.value.data) ? assessmentsRes.value.data : assessmentsRes.value.data?.items ?? assessmentsRes.value.data?.value ?? [])
                : [];
            setAssessments(assessmentList);

            // ── Interviews ───────────────────────────────────────────────────
            const interviewList: Interview[] = interviewsRes.status === 'fulfilled'
                ? (Array.isArray(interviewsRes.value.data) ? interviewsRes.value.data : interviewsRes.value.data?.items ?? interviewsRes.value.data?.value ?? [])
                : [];
            setInterviews(interviewList);

            // ── Exam Links ────────────────────────────────────────────────────
            const batchSize = 5;
            const links: ExamLink[] = [];
            for (let i = 0; i < assessmentList.length; i += batchSize) {
                const batch   = assessmentList.slice(i, i + batchSize);
                const results = await Promise.allSettled(
                    batch.map(a =>
                        assessmentLinksApi.getByAssessment(a.id)
                            .then(r => {
                                const list = Array.isArray(r.data) ? r.data : r.data?.items ?? r.data?.value ?? [];
                                return list.map((l: ExamLink) => ({ ...l, assessmentId: a.id }));
                            })
                            .catch(() => [])
                    )
                );
                results.forEach(r => { if (r.status === 'fulfilled') links.push(...r.value); });
            }
            setAllLinks(links);

            // ── Interview Links ───────────────────────────────────────────────
            const interviewLinks: InterviewLink[] = [];
            for (let i = 0; i < interviewList.length; i += batchSize) {
                const batch   = interviewList.slice(i, i + batchSize);
                const results = await Promise.allSettled(
                    batch.map(interview =>
                        interviewLinksApi.getByInterview(interview.id)
                            .then(r => {
                                const list = Array.isArray(r.data) ? r.data : r.data?.items ?? r.data?.value ?? [];
                                return list.map((l: any) => ({ 
                                    Id: l.id ?? l.Id,
                                    InterviewId: l.interviewId ?? l.InterviewId ?? interview.id,
                                    Name: l.name ?? l.Name,
                                    StartTime: l.startTime ?? l.StartTime,
                                    EndTime: l.endTime ?? l.EndTime,
                                    IsActive: l.isActive ?? l.IsActive ?? true,
                                    TotalCandidates: l.totalCandidates ?? l.TotalCandidates ?? 0,
                                    CompletedCandidates: l.completedCandidates ?? l.CompletedCandidates ?? 0,
                                }));
                            })
                            .catch(() => [])
                    )
                );
                results.forEach(r => { if (r.status === 'fulfilled') interviewLinks.push(...r.value); });
            }
            setAllInterviewLinks(interviewLinks);

            const now          = new Date();
            const activeLinks  = links.filter(l => l.isActive !== false && new Date(l.examEndDateTime ?? '') > now).length;
            const activeAssess = assessmentList.filter(a => a.isActive ?? a.IsActive).length;
            const draftAssess  = assessmentList.filter(a => !(a.isActive ?? a.IsActive)).length;
            
            const activeInterviewLinks = interviewLinks.filter(l => {
                const end = new Date(l.EndTime ?? '');
                const start = new Date(l.StartTime ?? '');
                return l.IsActive !== false && start <= now && end > now;
            }).length;

            setStats({
                totalTopics:       rawTopicList.length,
                totalQuestions,
                totalAssessments:  assessmentList.length,
                activeLinks,
                activeAssessments: activeAssess,
                draftAssessments:  draftAssess,
                totalInterviews:   interviewList.length,
                activeInterviewLinks,
            });

        } catch {
            setError('Failed to load dashboard data. Please refresh.');
        } finally {
            setLoading(false);
        }
    };

    // ── Derived ───────────────────────────────────────────────────────────────
    const now              = new Date();
    const recentAssess     = [...assessments].slice(0, 5);
    const activeExamLinks   = allLinks.filter(l => l.isActive !== false && new Date(l.examEndDateTime ?? '') > now).slice(0, 5);
    const activeInterviewLinksList = allInterviewLinks.filter(l => {
        const end = new Date(l.EndTime ?? '');
        const start = new Date(l.StartTime ?? '');
        return l.IsActive !== false && start <= now && end > now;
    }).slice(0, 5);
    const maxQCount = Math.max(...topics.map(t => t.questionCount ?? 0), 1);

    const getAssessmentTitle = (id: string) =>
        assessments.find(a => a.id === id)?.title ?? assessments.find(a => a.id === id)?.Title ?? '—';
    
    const getInterviewName = (id: string) => {
        const found = interviews.find(i => i.id === id);
        return found?.name ?? '—';
    };

    return (
        <>
            <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>

            {/* ── Page Header ── */}
            <div className="page-header">
                <div>
                    <div className="page-title">Dashboard</div>
                    <div className="page-sub">Here's what's happening with TestBuddy today.</div>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary btn-sm" onClick={loadDashboard} disabled={loading}>
                        {loading ? '⏳' : '🔄'} Refresh
                    </button>
                    <button className="btn btn-primary btn-sm" onClick={() => window.location.href = '/assessments/create'}>
                        + New Assessment
                    </button>
                </div>
            </div>

            {error && (
                <div style={{ padding: '12px 16px', background: 'rgba(224,59,59,.08)', border: '1px solid rgba(224,59,59,.2)', borderRadius: '10px', color: 'var(--red)', fontSize: '14px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    ⚠️ {error}
                    <button onClick={loadDashboard} style={{ marginLeft: 'auto', padding: '4px 12px', background: 'none', border: '1px solid var(--red)', borderRadius: '6px', color: 'var(--red)', cursor: 'pointer', fontSize: '12px' }}>Retry</button>
                </div>
            )}

            {/* ── Stat Cards ── */}
            <div className="stats-grid">
                {[
                    { cls: 's1', icon: '🗂',  num: cntTopics,       label: 'Total Topics',       sub: `Across ${stats.totalTopics} version${stats.totalTopics !== 1 ? 's' : ''}`,     trend: `${stats.totalTopics} total`            },
                    { cls: 's2', icon: '❓',  num: cntQuestions,    label: 'Total Questions',    sub: `Across ${stats.totalTopics} topic${stats.totalTopics !== 1 ? 's' : ''}`,        trend: `${stats.totalQuestions} total`         },
                    { cls: 's3', icon: '📝',  num: cntAssessments,  label: 'Assessments',        sub: `${stats.activeAssessments} active · ${stats.draftAssessments} inactive`,        trend: `↑ ${stats.activeAssessments} active`   },
                    { cls: 's4', icon: '🔗',  num: cntLinks,        label: 'Active Exam Links',  sub: `Out of ${allLinks.length} total links`,                                         trend: `${stats.activeLinks} live`             },
                    { cls: 's5', icon: '🎙',  num: cntInterviews,   label: 'AI Interviews',      sub: `${stats.totalInterviews} total interviews`,                                     trend: `${stats.totalInterviews} total`        },
                    { cls: 's6', icon: '📡',  num: cntInterviewLinks, label: 'Active Interviews', sub: `Out of ${allInterviewLinks.length} total`,                                      trend: `${stats.activeInterviewLinks} live`     },
                ].map(s => (
                    <div key={s.label} className={`stat-card ${s.cls}`}>
                        <div className="stat-top">
                            <div className="stat-icon-wrap">{s.icon}</div>
                            <div className="stat-trend trend-up">
                                {loading ? <Skeleton w="60px" h="20px" r="100px" /> : s.trend}
                            </div>
                        </div>
                        <div className="stat-num">{loading ? <Skeleton w="60px" h="36px" r="8px" /> : s.num}</div>
                        <div className="stat-label">{s.label}</div>
                        <div className="stat-sub">{loading ? <Skeleton w="80%" h="12px" /> : s.sub}</div>
                    </div>
                ))}
            </div>

            {/* ── Row 2: Recent Assessments + Quick Actions + Recent Interviews ── */}
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
                        ) : recentAssess.length === 0 ? (
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentAssess.map(a => {
                                        const title  = a.title ?? a.Title ?? 'Untitled';
                                        const qs     = a.totalQuestions ?? a.TotalQuestions ?? 0;
                                        const dur    = a.durationMinutes ?? a.DurationMinutes ?? 0;
                                        const active = a.isActive ?? a.IsActive ?? false;
                                        return (
                                            <tr key={a.id}>
                                                <td>
                                                    <div className="assessment-name">{title}</div>
                                                    <div className="assessment-meta" style={{ fontFamily: 'monospace', fontSize: '11px' }}>{a.id?.slice(0, 8)}…</div>
                                                </td>
                                                <td>{qs}</td>
                                                <td>{dur} min</td>
                                                <td>
                                                    <span className={`badge ${active ? 'badge-active' : 'badge-draft'}`}>
                                                        <span className="badge-dot" />{active ? 'Active' : 'Draft'}
                                                    </span>
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
                        <div className="card-header"><div className="card-title">⚡ Quick Actions</div></div>
                        <div className="quick-grid">
                            {[
                                { icon: '➕', label: 'New Question',     href: '/questions/add'      },
                                { icon: '🤖', label: 'AI Generate',      href: '/ai-generator'       },
                                { icon: '📝', label: 'New Assessment',  href: '/assessments/create' },
                                { icon: '🎙', label: 'New Interview',   href: '/interviews'         },
                                { icon: '🔗', label: 'Exam Links',      href: '/assessments'        },
                                { icon: '📡', label: 'Interview Links',  href: '/interviews'         },
                            ].map(q => (
                                <div key={q.label} className="quick-btn" onClick={() => window.location.href = q.href}>
                                    <div className="quick-icon">{q.icon}</div>
                                    <div className="quick-label">{q.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Active Links (Exam + Interview tabs) */}
                    <div className="card" style={{ flex: 1 }}>
                        <div className="card-header">
                            <div className="card-title">🔗 Active Links</div>
                            <div style={{ display: 'flex', gap: '4px' }}>
                                <button 
                                    className={`btn btn-sm ${linksTab === 'exam' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setLinksTab('exam')}
                                    style={{ padding: '4px 10px', fontSize: '11px' }}
                                >
                                    📝 Exam
                                </button>
                                <button 
                                    className={`btn btn-sm ${linksTab === 'interview' ? 'btn-primary' : 'btn-secondary'}`}
                                    onClick={() => setLinksTab('interview')}
                                    style={{ padding: '4px 10px', fontSize: '11px' }}
                                >
                                    🎙 Interview
                                </button>
                            </div>
                        </div>
                        <div className="activity-list">
                            {loading ? (
                                <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {[1,2,3].map(i => <Skeleton key={i} h="52px" r="8px" />)}
                                </div>
                            ) : linksTab === 'exam' ? (
                                activeExamLinks.length === 0 ? (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>No active exam links right now.</div>
                                ) : activeExamLinks.map((link, i) => {
                                    const colors   = ['rgba(255,92,0,.1)', 'rgba(0,87,255,.1)', 'rgba(0,194,113,.1)'];
                                    const expires  = new Date(link.examEndDateTime ?? '');
                                    const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                    const expiring = daysLeft <= 2;
                                    return (
                                        <div key={link.id} className="link-item">
                                            <div className="link-icon" style={{ background: colors[i % colors.length] }}>📝</div>
                                            <div className="link-info">
                                                <div className="link-title">{link.name || 'Exam Link'}</div>
                                                <div className="link-meta">{getAssessmentTitle(link.assessmentId ?? '')} · Ends {fmtDate(link.examEndDateTime)}</div>
                                            </div>
                                            <div className={`link-time ${expiring ? 'expiring' : ''}`}>{expiring ? '⚠ Expiring' : 'Active'}</div>
                                        </div>
                                    );
                                })
                            ) : (
                                activeInterviewLinksList.length === 0 ? (
                                    <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>No active interview links right now.</div>
                                ) : activeInterviewLinksList.map((link, i) => {
                                    const colors   = ['rgba(139,92,246,.1)', 'rgba(245,166,35,.1)', 'rgba(0,194,113,.1)'];
                                    const expires  = new Date(link.EndTime ?? '');
                                    const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                    const expiring = daysLeft <= 2;
                                    return (
                                        <div key={link.Id} className="link-item">
                                            <div className="link-icon" style={{ background: colors[i % colors.length] }}>🎙</div>
                                            <div className="link-info">
                                                <div className="link-title">{link.Name || 'Interview Link'}</div>
                                                <div className="link-meta">{getInterviewName(link.InterviewId ?? '')} · Ends {fmtDate(link.EndTime)}</div>
                                            </div>
                                            <div className={`link-time ${expiring ? 'expiring' : ''}`}>{expiring ? '⚠ Expiring' : 'Active'}</div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Row 3: Topics + All Links (with tabs) ── */}
            <div className="grid-2">

                {/* Topics with question counts */}
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
                            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>No topics yet.</div>
                        ) : topics.slice(0, 6).map((topic, i) => {
                            const name   = topic.name ?? topic.Name ?? 'Unknown';
                            const count  = topic.questionCount ?? 0;
                            const pct    = maxQCount > 0 ? Math.round((count / maxQCount) * 100) : 0;
                            const colors = ['fill-orange','fill-blue','fill-green','fill-yellow','fill-purple','fill-blue'];
                            const bgs    = ['rgba(255,92,0,.1)','rgba(0,87,255,.1)','rgba(0,194,113,.1)','rgba(245,166,35,.1)','rgba(139,92,246,.1)','rgba(0,87,255,.08)'];
                            const emojis = ['🟠','🔵','🟢','🟡','🟣','📘'];
                            return (
                                <div key={topic.id} className="topic-row">
                                    <div className="topic-icon" style={{ background: bgs[i % bgs.length] }}>{emojis[i % emojis.length]}</div>
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
                        <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={() => window.location.href = '/topics'}>+ Add New Topic</button>
                    </div>
                </div>

                {/* All Links (Exam + Interview) */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">🔗 All Links</div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                            <button 
                                className={`btn btn-sm ${linksTab === 'exam' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setLinksTab('exam')}
                                style={{ padding: '4px 10px', fontSize: '11px' }}
                            >
                                📝 Exam ({allLinks.length})
                            </button>
                            <button 
                                className={`btn btn-sm ${linksTab === 'interview' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => setLinksTab('interview')}
                                style={{ padding: '4px 10px', fontSize: '11px' }}
                            >
                                🎙 Interview ({allInterviewLinks.length})
                            </button>
                        </div>
                    </div>
                    <div className="activity-list">
                        {loading ? (
                            <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {[1,2,3,4,5].map(i => <Skeleton key={i} h="52px" r="8px" />)}
                            </div>
                        ) : linksTab === 'exam' ? (
                            allLinks.length === 0 ? (
                                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                                    No exam links yet. <a href="/assessments" style={{ color: 'var(--accent2)' }}>Create one →</a>
                                </div>
                            ) : allLinks.slice(0, 6).map(link => {
                                const end        = new Date(link.examEndDateTime ?? '');
                                const expired    = end < now;
                                const daysLeft   = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                const expiring   = !expired && daysLeft <= 2;
                                const statusText = expired ? 'Expired' : expiring ? '⚠ Expiring' : 'Active';
                                const statusCls  = expired ? 'badge-draft' : 'badge-active';
                                return (
                                    <div key={link.id} className="link-item">
                                        <div className="link-icon" style={{ background: link.isCredentialBased ? 'rgba(139,92,246,.1)' : 'rgba(0,87,255,.08)' }}>
                                            {link.isCredentialBased ? '🔐' : '📝'}
                                        </div>
                                        <div className="link-info">
                                            <div className="link-title">{link.name || 'Exam Link'}</div>
                                            <div className="link-meta">{getAssessmentTitle(link.assessmentId ?? '')} · {fmtDate(link.examStartDateTime)} → {fmtDate(link.examEndDateTime)}</div>
                                        </div>
                                        <span className={`badge ${statusCls}`} style={{ fontSize: '11px', padding: '3px 9px' }}>
                                            <span className="badge-dot" />{statusText}
                                        </span>
                                    </div>
                                );
                            })
                        ) : (
                            allInterviewLinks.length === 0 ? (
                                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)', fontSize: '13px' }}>
                                    No interview links yet. <a href="/interviews" style={{ color: 'var(--accent2)' }}>Create one →</a>
                                </div>
                            ) : allInterviewLinks.slice(0, 6).map(link => {
                                const end        = new Date(link.EndTime ?? '');
                                const expired    = end < now;
                                const daysLeft   = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                const expiring   = !expired && daysLeft <= 2;
                                const statusText = expired ? 'Expired' : expiring ? '⚠ Expiring' : 'Active';
                                const statusCls  = expired ? 'badge-draft' : 'badge-active';
                                return (
                                    <div key={link.Id} className="link-item">
                                        <div className="link-icon" style={{ background: 'rgba(139,92,246,.1)' }}>🎙</div>
                                        <div className="link-info">
                                            <div className="link-title">{link.Name || 'Interview Link'}</div>
                                            <div className="link-meta">{getInterviewName(link.InterviewId ?? '')} · {fmtDate(link.StartTime)} → {fmtDate(link.EndTime)}</div>
                                        </div>
                                        <span className={`badge ${statusCls}`} style={{ fontSize: '11px', padding: '3px 9px' }}>
                                            <span className="badge-dot" />{statusText}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default Dashboard;