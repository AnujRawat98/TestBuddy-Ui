import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  FileStack,
  Link2,
  MessageSquareText,
  Plus,
  Sparkles,
  Target,
  UsersRound,
} from 'lucide-react';
import './Dashboard.css';
import {
  topicsApi,
  assessmentsApi,
  assessmentLinksApi,
  questionsApi,
  interviewsApi,
  interviewLinksApi,
} from '../../services/api';

interface Assessment {
  id: string;
  title?: string;
  Title?: string;
  totalQuestions?: number;
  TotalQuestions?: number;
  durationMinutes?: number;
  DurationMinutes?: number;
  isActive?: boolean;
  IsActive?: boolean;
}

interface Interview {
  id: string;
  name?: string;
}

interface Topic {
  id: string;
  name?: string;
  Name?: string;
  topicVersionId?: string;
  TopicVersionId?: string;
  questionCount?: number;
}

interface ExamLink {
  id: string;
  name?: string;
  examEndDateTime?: string;
  examStartDateTime?: string;
  isActive?: boolean;
  assessmentId?: string;
}

interface InterviewLink {
  Id: string;
  InterviewId?: string;
  Name?: string;
  StartTime?: string;
  EndTime?: string;
  IsActive?: boolean;
}

interface DashboardStats {
  totalTopics: number;
  totalQuestions: number;
  totalAssessments: number;
  activeLinks: number;
  activeAssessments: number;
  draftAssessments: number;
  totalInterviews: number;
  activeInterviewLinks: number;
}

const useCountUp = (end: number, duration = 1000) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (end === 0) {
      setCount(0);
      return;
    }

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

const Skeleton: React.FC<{ w?: string; h?: string; r?: string }> = ({ w = '100%', h = '16px', r = '6px' }) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: r,
      background:
        'linear-gradient(90deg, rgba(226,232,240,.65) 25%, rgba(255,255,255,.95) 50%, rgba(226,232,240,.65) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }}
  />
);

const fmtDate = (s?: string) =>
  !s ? '—' : new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalTopics: 0,
    totalQuestions: 0,
    totalAssessments: 0,
    activeLinks: 0,
    activeAssessments: 0,
    draftAssessments: 0,
    totalInterviews: 0,
    activeInterviewLinks: 0,
  });
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [allLinks, setAllLinks] = useState<ExamLink[]>([]);
  const [allInterviewLinks, setAllInterviewLinks] = useState<InterviewLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [linksTab, setLinksTab] = useState<'exam' | 'interview'>('exam');

  const cntTopics = useCountUp(stats.totalTopics, 900);
  const cntQuestions = useCountUp(stats.totalQuestions, 1400);
  const cntAssessments = useCountUp(stats.totalAssessments, 800);
  const cntLinks = useCountUp(stats.activeLinks, 600);
  const cntInterviews = useCountUp(stats.totalInterviews, 600);
  const cntInterviewLinks = useCountUp(stats.activeInterviewLinks, 600);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');

    try {
      const [topicsRes, assessmentsRes, interviewsRes] = await Promise.allSettled([
        topicsApi.getAll(),
        assessmentsApi.getAll(),
        interviewsApi.getAll(),
      ]);

      const rawTopicList: any[] =
        topicsRes.status === 'fulfilled'
          ? Array.isArray(topicsRes.value.data)
            ? topicsRes.value.data
            : topicsRes.value.data?.items ?? topicsRes.value.data?.value ?? []
          : [];

      const topicList: Topic[] = await Promise.all(
        rawTopicList.map(async (t: any) => {
          const tvId: string = t.topicVersionId ?? t.TopicVersionId ?? '';
          let questionCount = 0;
          if (tvId) {
            try {
              const qRes = await questionsApi.getAllByTopic(tvId);
              const data = qRes.data;
              questionCount = Array.isArray(data) ? data.length : data?.totalCount ?? data?.count ?? data?.items?.length ?? 0;
            } catch {
              questionCount = 0;
            }
          }
          return {
            id: t.topicId ?? t.TopicId ?? t.id,
            name: t.name ?? t.Name ?? '—',
            topicVersionId: tvId,
            questionCount,
          };
        }),
      );

      setTopics(topicList);
      const totalQuestions = topicList.reduce((sum, topic) => sum + (topic.questionCount ?? 0), 0);

      const assessmentList: Assessment[] =
        assessmentsRes.status === 'fulfilled'
          ? Array.isArray(assessmentsRes.value.data)
            ? assessmentsRes.value.data
            : assessmentsRes.value.data?.items ?? assessmentsRes.value.data?.value ?? []
          : [];
      setAssessments(assessmentList);

      const interviewList: Interview[] =
        interviewsRes.status === 'fulfilled'
          ? Array.isArray(interviewsRes.value.data)
            ? interviewsRes.value.data
            : interviewsRes.value.data?.items ?? interviewsRes.value.data?.value ?? []
          : [];
      setInterviews(interviewList);

      const batchSize = 5;
      const links: ExamLink[] = [];
      for (let i = 0; i < assessmentList.length; i += batchSize) {
        const batch = assessmentList.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((assessment) =>
            assessmentLinksApi
              .getByAssessment(assessment.id)
              .then((res) => {
                const list = Array.isArray(res.data) ? res.data : res.data?.items ?? res.data?.value ?? [];
                return list.map((link: ExamLink) => ({ ...link, assessmentId: assessment.id }));
              })
              .catch(() => []),
          ),
        );
        results.forEach((result) => {
          if (result.status === 'fulfilled') links.push(...result.value);
        });
      }
      setAllLinks(links);

      const interviewLinks: InterviewLink[] = [];
      for (let i = 0; i < interviewList.length; i += batchSize) {
        const batch = interviewList.slice(i, i + batchSize);
        const results = await Promise.allSettled(
          batch.map((interview) =>
            interviewLinksApi
              .getByInterview(interview.id)
              .then((res) => {
                const list = Array.isArray(res.data) ? res.data : res.data?.items ?? res.data?.value ?? [];
                return list.map((link: any) => ({
                  Id: link.id ?? link.Id,
                  InterviewId: link.interviewId ?? link.InterviewId ?? interview.id,
                  Name: link.name ?? link.Name,
                  StartTime: link.startTime ?? link.StartTime,
                  EndTime: link.endTime ?? link.EndTime,
                  IsActive: link.isActive ?? link.IsActive ?? true,
                }));
              })
              .catch(() => []),
          ),
        );
        results.forEach((result) => {
          if (result.status === 'fulfilled') interviewLinks.push(...result.value);
        });
      }
      setAllInterviewLinks(interviewLinks);

      const now = new Date();
      const activeLinks = links.filter((link) => link.isActive !== false && new Date(link.examEndDateTime ?? '') > now).length;
      const activeAssessments = assessmentList.filter((assessment) => assessment.isActive ?? assessment.IsActive).length;
      const draftAssessments = assessmentList.filter((assessment) => !(assessment.isActive ?? assessment.IsActive)).length;
      const activeInterviewLinks = interviewLinks.filter((link) => {
        const end = new Date(link.EndTime ?? '');
        const start = new Date(link.StartTime ?? '');
        return link.IsActive !== false && start <= now && end > now;
      }).length;

      setStats({
        totalTopics: rawTopicList.length,
        totalQuestions,
        totalAssessments: assessmentList.length,
        activeLinks,
        activeAssessments,
        draftAssessments,
        totalInterviews: interviewList.length,
        activeInterviewLinks,
      });
    } catch {
      setError('Failed to load dashboard data. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  const now = new Date();
  const recentAssess = [...assessments].slice(0, 5);
  const activeExamLinks = allLinks
    .filter((link) => link.isActive !== false && new Date(link.examEndDateTime ?? '') > now)
    .slice(0, 5);
  const activeInterviewLinksList = allInterviewLinks
    .filter((link) => {
      const end = new Date(link.EndTime ?? '');
      const start = new Date(link.StartTime ?? '');
      return link.IsActive !== false && start <= now && end > now;
    })
    .slice(0, 5);
  const maxQCount = Math.max(...topics.map((topic) => topic.questionCount ?? 0), 1);

  const getAssessmentTitle = (id: string) =>
    assessments.find((assessment) => assessment.id === id)?.title ??
    assessments.find((assessment) => assessment.id === id)?.Title ??
    '—';

  const getInterviewName = (id: string) => interviews.find((interview) => interview.id === id)?.name ?? '—';

  const statCards = [
    { label: 'Topics', value: cntTopics, sub: `${stats.totalTopics} topic clusters`, trend: `${stats.totalQuestions} linked questions`, icon: FileStack },
    { label: 'Question Bank', value: cntQuestions, sub: `Across ${stats.totalTopics} active topics`, trend: 'Content ready for generation', icon: Sparkles },
    { label: 'Assessments', value: cntAssessments, sub: `${stats.activeAssessments} active · ${stats.draftAssessments} inactive`, trend: 'Delivery pipeline', icon: Target },
    { label: 'Live Exam Links', value: cntLinks, sub: `Out of ${allLinks.length} total links`, trend: 'Candidate access open', icon: Link2 },
    { label: 'AI Interviews', value: cntInterviews, sub: `${stats.totalInterviews} interview flows`, trend: 'Hiring workspace', icon: UsersRound },
    { label: 'Active Interview Links', value: cntInterviewLinks, sub: `Out of ${allInterviewLinks.length} scheduled links`, trend: 'Candidates in motion', icon: MessageSquareText },
  ];

  const quickActions = [
    { label: 'New Question', href: '/questions/add', icon: FileStack },
    { label: 'AI Generate', href: '/ai-generator', icon: Sparkles },
    { label: 'New Assessment', href: '/assessments/create', icon: Target },
    { label: 'Interview Studio', href: '/interviews', icon: UsersRound },
    { label: 'Assessment Links', href: '/assessments', icon: Link2 },
    { label: 'Job Posting', href: '/ijp', icon: BriefcaseBusiness },
  ];

  return (
    <>
      <style>{`@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div className="page-header">
        <div>
          <div className="page-title">Dashboard</div>
          <div className="page-sub">Operate assessments, interviews, and candidate delivery from one MazeAI command center.</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" onClick={loadDashboard} disabled={loading}>
            <Activity size={16} />
            {loading ? 'Refreshing' : 'Refresh'}
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => (window.location.href = '/assessments/create')}>
            <Plus size={16} />
            New Assessment
          </button>
        </div>
      </div>

      {error && (
        <div className="dashboard-alert">
          <span>{error}</span>
          <button className="btn btn-secondary btn-sm" onClick={loadDashboard}>Retry</button>
        </div>
      )}

      <div className="stats-grid">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="stat-card">
              <div className="stat-top">
                <span className="stat-icon-wrap"><Icon size={18} /></span>
                <span className="stat-trend">{loading ? <Skeleton w="84px" h="20px" r="999px" /> : card.trend}</span>
              </div>
              <div className="stat-num">{loading ? <Skeleton w="72px" h="38px" r="10px" /> : card.value}</div>
              <div className="stat-label">{card.label}</div>
              <div className="stat-sub">{loading ? <Skeleton w="88%" h="12px" /> : card.sub}</div>
            </article>
          );
        })}
      </div>

      <div className="dashboard-grid dashboard-grid-primary">
        <section className="card dashboard-table-card">
          <div className="card-header">
            <div className="card-title"><BarChart3 size={16} />Recent Assessments</div>
            <button className="btn btn-secondary btn-sm" onClick={() => (window.location.href = '/assessments')}>
              View all
              <ArrowRight size={15} />
            </button>
          </div>
          <div className="card-body">
            {loading ? (
              <div className="dashboard-skeleton-list">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} h="44px" r="10px" />)}</div>
            ) : recentAssess.length === 0 ? (
              <div className="dashboard-empty">No assessments yet. <a href="/assessments/create">Create your first one</a>.</div>
            ) : (
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>Assessment</th>
                    <th>Questions</th>
                    <th>Duration</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAssess.map((assessment) => {
                    const title = assessment.title ?? assessment.Title ?? 'Untitled';
                    const questions = assessment.totalQuestions ?? assessment.TotalQuestions ?? 0;
                    const duration = assessment.durationMinutes ?? assessment.DurationMinutes ?? 0;
                    const active = assessment.isActive ?? assessment.IsActive ?? false;
                    return (
                      <tr key={assessment.id}>
                        <td>
                          <div className="assessment-name">{title}</div>
                          <div className="assessment-meta">{assessment.id?.slice(0, 8)}...</div>
                        </td>
                        <td>{questions}</td>
                        <td>{duration} min</td>
                        <td><span className={`badge ${active ? 'badge-active' : 'badge-draft'}`}><span className="badge-dot" />{active ? 'Active' : 'Inactive'}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <div className="dashboard-side-stack">
          <section className="card">
            <div className="card-header">
              <div className="card-title"><Sparkles size={16} />Quick Actions</div>
            </div>
            <div className="quick-grid">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button key={action.label} className="quick-btn" onClick={() => (window.location.href = action.href)}>
                    <span className="quick-icon"><Icon size={18} /></span>
                    <span className="quick-label">{action.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card">
            <div className="card-header">
              <div className="card-title"><Link2 size={16} />Live Links</div>
              <div className="dashboard-segmented">
                <button className={`segment-btn ${linksTab === 'exam' ? 'active' : ''}`} onClick={() => setLinksTab('exam')}>Exams</button>
                <button className={`segment-btn ${linksTab === 'interview' ? 'active' : ''}`} onClick={() => setLinksTab('interview')}>Interviews</button>
              </div>
            </div>
            <div className="activity-list">
              {loading ? (
                <div className="dashboard-skeleton-list">{[1, 2, 3].map((i) => <Skeleton key={i} h="56px" r="12px" />)}</div>
              ) : linksTab === 'exam' ? (
                activeExamLinks.length === 0 ? <div className="dashboard-empty">No active exam links right now.</div> : activeExamLinks.map((link) => {
                  const expires = new Date(link.examEndDateTime ?? '');
                  const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                  return (
                    <div key={link.id} className="link-item">
                      <span className="link-icon"><Target size={17} /></span>
                      <div className="link-info">
                        <div className="link-title">{link.name || 'Exam Link'}</div>
                        <div className="link-meta">{getAssessmentTitle(link.assessmentId ?? '')} · Ends {fmtDate(link.examEndDateTime)}</div>
                      </div>
                      <span className={`link-time ${daysLeft <= 2 ? 'expiring' : ''}`}>{daysLeft <= 2 ? 'Expiring' : 'Active'}</span>
                    </div>
                  );
                })
              ) : activeInterviewLinksList.length === 0 ? (
                <div className="dashboard-empty">No active interview links right now.</div>
              ) : activeInterviewLinksList.map((link) => {
                const expires = new Date(link.EndTime ?? '');
                const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <div key={link.Id} className="link-item">
                    <span className="link-icon"><UsersRound size={17} /></span>
                    <div className="link-info">
                      <div className="link-title">{link.Name || 'Interview Link'}</div>
                      <div className="link-meta">{getInterviewName(link.InterviewId ?? '')} · Ends {fmtDate(link.EndTime)}</div>
                    </div>
                    <span className={`link-time ${daysLeft <= 2 ? 'expiring' : ''}`}>{daysLeft <= 2 ? 'Expiring' : 'Active'}</span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <div className="dashboard-grid dashboard-grid-secondary">
        <section className="card">
          <div className="card-header">
            <div className="card-title"><FileStack size={16} />Topic Coverage</div>
            <button className="btn btn-secondary btn-sm" onClick={() => (window.location.href = '/topics')}>Manage</button>
          </div>
          <div className="topic-list">
            {loading ? (
              <div className="dashboard-skeleton-list">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} h="38px" r="10px" />)}</div>
            ) : topics.length === 0 ? (
              <div className="dashboard-empty">No topics yet.</div>
            ) : (
              topics.slice(0, 6).map((topic) => {
                const count = topic.questionCount ?? 0;
                const pct = maxQCount > 0 ? Math.round((count / maxQCount) * 100) : 0;
                return (
                  <div key={topic.id} className="topic-row">
                    <span className="topic-icon"><FileStack size={16} /></span>
                    <div className="topic-name">{topic.name ?? topic.Name ?? 'Unknown'}</div>
                    <div className="progress-wrap"><div className="progress-bar"><div className="progress-fill" style={{ width: `${pct}%` }} /></div></div>
                    <div className="topic-num-text">{count}</div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="card">
          <div className="card-header">
            <div className="card-title"><MessageSquareText size={16} />Link Inventory</div>
            <div className="dashboard-segmented">
              <button className={`segment-btn ${linksTab === 'exam' ? 'active' : ''}`} onClick={() => setLinksTab('exam')}>Exams ({allLinks.length})</button>
              <button className={`segment-btn ${linksTab === 'interview' ? 'active' : ''}`} onClick={() => setLinksTab('interview')}>Interviews ({allInterviewLinks.length})</button>
            </div>
          </div>
          <div className="activity-list">
            {loading ? (
              <div className="dashboard-skeleton-list">{[1, 2, 3, 4].map((i) => <Skeleton key={i} h="56px" r="12px" />)}</div>
            ) : linksTab === 'exam' ? (
              allLinks.length === 0 ? <div className="dashboard-empty">No exam links yet. <a href="/assessments">Create one</a>.</div> : allLinks.slice(0, 6).map((link) => {
                const end = new Date(link.examEndDateTime ?? '');
                const expired = end < now;
                const expiring = !expired && Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 2;
                return (
                  <div key={link.id} className="link-item">
                    <span className="link-icon"><Link2 size={16} /></span>
                    <div className="link-info">
                      <div className="link-title">{link.name || 'Exam Link'}</div>
                      <div className="link-meta">{getAssessmentTitle(link.assessmentId ?? '')} · {fmtDate(link.examStartDateTime)} to {fmtDate(link.examEndDateTime)}</div>
                    </div>
                    <span className={`badge ${expired ? 'badge-draft' : expiring ? 'badge-expired' : 'badge-active'}`}><span className="badge-dot" />{expired ? 'Expired' : expiring ? 'Expiring' : 'Active'}</span>
                  </div>
                );
              })
            ) : allInterviewLinks.length === 0 ? (
              <div className="dashboard-empty">No interview links yet. <a href="/interviews">Create one</a>.</div>
            ) : allInterviewLinks.slice(0, 6).map((link) => {
              const end = new Date(link.EndTime ?? '');
              const expired = end < now;
              const expiring = !expired && Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) <= 2;
              return (
                <div key={link.Id} className="link-item">
                  <span className="link-icon"><UsersRound size={16} /></span>
                  <div className="link-info">
                    <div className="link-title">{link.Name || 'Interview Link'}</div>
                    <div className="link-meta">{getInterviewName(link.InterviewId ?? '')} · {fmtDate(link.StartTime)} to {fmtDate(link.EndTime)}</div>
                  </div>
                  <span className={`badge ${expired ? 'badge-draft' : expiring ? 'badge-expired' : 'badge-active'}`}><span className="badge-dot" />{expired ? 'Expired' : expiring ? 'Expiring' : 'Active'}</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </>
  );
};

export default Dashboard;
