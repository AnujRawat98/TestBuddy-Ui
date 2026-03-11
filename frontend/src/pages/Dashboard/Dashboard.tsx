import React, { useEffect, useState } from 'react';
import './Dashboard.css';

// Hook for count-up animation
const useCountUp = (end: number, duration: number = 1200) => {
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

const Dashboard: React.FC = () => {
    // Use count up effect
    const cntTopics = useCountUp(12);
    const cntQuestions = useCountUp(348, 1600);
    const cntAssessments = useCountUp(8, 900);
    const cntLinks = useCountUp(3, 600);

    return (
        <>
            {/* Page Header */}
            <div className="page-header" style={{ animationDelay: '.05s' }}>
                <div>
                    <div className="page-title">Dashboard</div>
                    <div className="page-sub">Here's what's happening with TestBuddy today.</div>
                </div>
                <div className="header-actions">
                    <button className="btn btn-secondary btn-sm">📥 Export Report</button>
                    <button className="btn btn-primary btn-sm">+ New Assessment</button>
                </div>
            </div>

            {/* STAT CARDS */}
            <div className="stats-grid">
                <div className="stat-card s1" data-bg="12">
                    <div className="stat-top">
                        <div className="stat-icon-wrap">🗂</div>
                        <div className="stat-trend trend-up">
                            ↑ 2 <span style={{ fontWeight: 400, color: 'inherit', opacity: 0.7 }}>this week</span>
                        </div>
                    </div>
                    <div className="stat-num">{cntTopics}</div>
                    <div className="stat-label">Total Topics</div>
                    <div className="stat-sub">📌 Latest: <strong>React</strong> added Feb 1</div>
                </div>

                <div className="stat-card s2" data-bg="348">
                    <div className="stat-top">
                        <div className="stat-icon-wrap">❓</div>
                        <div className="stat-trend trend-up">
                            ↑ 24 <span style={{ fontWeight: 400, opacity: 0.7 }}>this week</span>
                        </div>
                    </div>
                    <div className="stat-num">{cntQuestions}</div>
                    <div className="stat-label">Total Questions</div>
                    <div className="stat-sub">🤖 68 AI-generated this month</div>
                </div>

                <div className="stat-card s3" data-bg="8">
                    <div className="stat-top">
                        <div className="stat-icon-wrap">📝</div>
                        <div className="stat-trend trend-up">
                            ↑ 1 <span style={{ fontWeight: 400, opacity: 0.7 }}>this week</span>
                        </div>
                    </div>
                    <div className="stat-num">{cntAssessments}</div>
                    <div className="stat-label">Assessments</div>
                    <div className="stat-sub">✅ 5 active &nbsp;·&nbsp; 3 drafts</div>
                </div>

                <div className="stat-card s4" data-bg="3">
                    <div className="stat-top">
                        <div className="stat-icon-wrap">🔗</div>
                        <div className="stat-trend trend-flat">⚠️ 2 expiring</div>
                    </div>
                    <div className="stat-num">{cntLinks}</div>
                    <div className="stat-label">Active Exam Links</div>
                    <div className="stat-sub">👥 143 students attempted</div>
                </div>
            </div>

            {/* ROW 2: Assessments table + Quick Actions */}
            <div className="grid-3">
                {/* Recent Assessments */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">📋 Recent Assessments</div>
                        <button className="btn btn-secondary btn-sm">View All →</button>
                    </div>
                    <div className="card-body">
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
                                <tr>
                                    <td>
                                        <div className="assessment-name">Web Dev Fundamentals</div>
                                        <div className="assessment-meta">HTML · CSS · JavaScript</div>
                                    </td>
                                    <td>20</td>
                                    <td>30 min</td>
                                    <td>
                                        <span className="badge badge-active">
                                            <span className="badge-dot"></span>Active
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-btns">
                                            <div className="act-btn" title="View">👁</div>
                                            <div className="act-btn" title="Edit">✏️</div>
                                            <div className="act-btn" title="Link">🔗</div>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <div className="assessment-name">JavaScript Advanced</div>
                                        <div className="assessment-meta">JavaScript</div>
                                    </td>
                                    <td>15</td>
                                    <td>20 min</td>
                                    <td>
                                        <span className="badge badge-active">
                                            <span className="badge-dot"></span>Active
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-btns">
                                            <div className="act-btn">👁</div>
                                            <div className="act-btn">✏️</div>
                                            <div className="act-btn">🔗</div>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <div className="assessment-name">DBMS Final Exam</div>
                                        <div className="assessment-meta">DBMS</div>
                                    </td>
                                    <td>30</td>
                                    <td>45 min</td>
                                    <td>
                                        <span className="badge badge-draft">
                                            <span className="badge-dot"></span>Draft
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-btns">
                                            <div className="act-btn">👁</div>
                                            <div className="act-btn">✏️</div>
                                            <div className="act-btn">🔗</div>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <div className="assessment-name">CSS Fundamentals</div>
                                        <div className="assessment-meta">CSS</div>
                                    </td>
                                    <td>10</td>
                                    <td>15 min</td>
                                    <td>
                                        <span className="badge badge-expired">
                                            <span className="badge-dot"></span>Expired
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-btns">
                                            <div className="act-btn">👁</div>
                                            <div className="act-btn">✏️</div>
                                            <div className="act-btn">🔗</div>
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td>
                                        <div className="assessment-name">C# Basics</div>
                                        <div className="assessment-meta">C#</div>
                                    </td>
                                    <td>25</td>
                                    <td>35 min</td>
                                    <td>
                                        <span className="badge badge-draft">
                                            <span className="badge-dot"></span>Draft
                                        </span>
                                    </td>
                                    <td>
                                        <div className="action-btns">
                                            <div className="act-btn">👁</div>
                                            <div className="act-btn">✏️</div>
                                            <div className="act-btn">🔗</div>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
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
                            <div className="quick-btn">
                                <div className="quick-icon">➕</div>
                                <div className="quick-label">New Question</div>
                            </div>
                            <div className="quick-btn">
                                <div className="quick-icon">🤖</div>
                                <div className="quick-label">AI Generate</div>
                            </div>
                            <div className="quick-btn">
                                <div className="quick-icon">📝</div>
                                <div className="quick-label">New Assessment</div>
                            </div>
                            <div className="quick-btn">
                                <div className="quick-icon">🔗</div>
                                <div className="quick-label">Create Link</div>
                            </div>
                        </div>
                    </div>

                    {/* Upcoming Links */}
                    <div className="card" style={{ flex: 1 }}>
                        <div className="card-header">
                            <div className="card-title">🔗 Active Exam Links</div>
                            <button className="btn btn-secondary btn-sm">View All</button>
                        </div>
                        <div className="activity-list">
                            <div className="link-item">
                                <div className="link-icon" style={{ background: 'rgba(255,92,0,.1)' }}>
                                    📝
                                </div>
                                <div className="link-info">
                                    <div className="link-title">Web Dev Fundamentals</div>
                                    <div className="link-meta">Ends Mar 15 · 42 attempts</div>
                                </div>
                                <div className="link-time">Active</div>
                            </div>
                            <div className="link-item">
                                <div className="link-icon" style={{ background: 'rgba(0,87,255,.1)' }}>
                                    📝
                                </div>
                                <div className="link-info">
                                    <div className="link-title">JS Advanced Test</div>
                                    <div className="link-meta">Ends Mar 13 · 18 attempts</div>
                                </div>
                                <div className="link-time expiring">Expiring</div>
                            </div>
                            <div className="link-item">
                                <div className="link-icon" style={{ background: 'rgba(0,194,113,.1)' }}>
                                    📝
                                </div>
                                <div className="link-info">
                                    <div className="link-title">DBMS Midterm</div>
                                    <div className="link-meta">Ends Mar 20 · 83 attempts</div>
                                </div>
                                <div className="link-time">Active</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ROW 3: Topics distribution + Activity */}
            <div className="grid-2">
                {/* Questions by Topic */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">📚 Questions by Topic</div>
                        <button className="btn btn-secondary btn-sm">Manage Topics</button>
                    </div>
                    <div className="topic-list">
                        <div className="topic-row">
                            <div className="topic-icon" style={{ background: 'rgba(255,92,0,.1)' }}>🟠</div>
                            <div className="topic-name">JavaScript</div>
                            <div className="progress-wrap" style={{ flex: 1, maxWidth: '180px' }}>
                                <div className="progress-bar">
                                    <div className="progress-fill fill-orange" style={{ width: '82%' }}></div>
                                </div>
                            </div>
                            <div className="topic-num-text">98</div>
                        </div>
                        <div className="topic-row">
                            <div className="topic-icon" style={{ background: 'rgba(0,87,255,.1)' }}>🔵</div>
                            <div className="topic-name">HTML</div>
                            <div className="progress-wrap" style={{ flex: 1, maxWidth: '180px' }}>
                                <div className="progress-bar">
                                    <div className="progress-fill fill-blue" style={{ width: '60%' }}></div>
                                </div>
                            </div>
                            <div className="topic-num-text">72</div>
                        </div>
                        <div className="topic-row">
                            <div className="topic-icon" style={{ background: 'rgba(0,194,113,.1)' }}>🟢</div>
                            <div className="topic-name">CSS</div>
                            <div className="progress-wrap" style={{ flex: 1, maxWidth: '180px' }}>
                                <div className="progress-bar">
                                    <div className="progress-fill fill-green" style={{ width: '45%' }}></div>
                                </div>
                            </div>
                            <div className="topic-num-text">54</div>
                        </div>
                        <div className="topic-row">
                            <div className="topic-icon" style={{ background: 'rgba(245,166,35,.1)' }}>🟡</div>
                            <div className="topic-name">DBMS</div>
                            <div className="progress-wrap" style={{ flex: 1, maxWidth: '180px' }}>
                                <div className="progress-bar">
                                    <div className="progress-fill fill-yellow" style={{ width: '37%' }}></div>
                                </div>
                            </div>
                            <div className="topic-num-text">44</div>
                        </div>
                        <div className="topic-row">
                            <div className="topic-icon" style={{ background: 'rgba(139,92,246,.1)' }}>🟣</div>
                            <div className="topic-name">C#</div>
                            <div className="progress-wrap" style={{ flex: 1, maxWidth: '180px' }}>
                                <div className="progress-bar">
                                    <div className="progress-fill fill-purple" style={{ width: '32%' }}></div>
                                </div>
                            </div>
                            <div className="topic-num-text">38</div>
                        </div>
                        <div className="topic-row">
                            <div className="topic-icon" style={{ background: 'rgba(0,87,255,.08)' }}>📘</div>
                            <div className="topic-name">React</div>
                            <div className="progress-wrap" style={{ flex: 1, maxWidth: '180px' }}>
                                <div className="progress-bar">
                                    <div className="progress-fill fill-blue" style={{ width: '18%' }}></div>
                                </div>
                            </div>
                            <div className="topic-num-text">22</div>
                        </div>
                    </div>
                    <div className="card-footer">
                        <button className="btn btn-secondary btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                            + Add New Topic
                        </button>
                    </div>
                </div>

                {/* Recent Activity */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">🕐 Recent Activity</div>
                        <button className="btn btn-secondary btn-sm">Clear All</button>
                    </div>
                    <div className="activity-list">
                        <div className="activity-item">
                            <div className="activity-icon a-green">✅</div>
                            <div className="activity-content">
                                <div className="activity-text">
                                    <strong>Assessment submitted</strong> by student@test.com — Web Dev Fundamentals
                                </div>
                                <div className="activity-time">2 minutes ago</div>
                            </div>
                        </div>
                        <div className="activity-item">
                            <div className="activity-icon a-orange">🤖</div>
                            <div className="activity-content">
                                <div className="activity-text">
                                    <strong>10 AI questions generated</strong> for JavaScript – Medium difficulty
                                </div>
                                <div className="activity-time">18 minutes ago</div>
                            </div>
                        </div>
                        <div className="activity-item">
                            <div className="activity-icon a-blue">🔗</div>
                            <div className="activity-content">
                                <div className="activity-text">
                                    <strong>New exam link created</strong> for DBMS Midterm — expires Mar 20
                                </div>
                                <div className="activity-time">1 hour ago</div>
                            </div>
                        </div>
                        <div className="activity-item">
                            <div className="activity-icon a-yellow">📝</div>
                            <div className="activity-content">
                                <div className="activity-text">
                                    <strong>Assessment updated</strong> — JS Advanced Test, 15 questions, 20 min
                                </div>
                                <div className="activity-time">3 hours ago</div>
                            </div>
                        </div>
                        <div className="activity-item">
                            <div className="activity-icon a-purple">➕</div>
                            <div className="activity-content">
                                <div className="activity-text">
                                    <strong>24 new questions added</strong> to the question bank — HTML topic
                                </div>
                                <div className="activity-time">Yesterday, 4:30 PM</div>
                            </div>
                        </div>
                        <div className="activity-item">
                            <div className="activity-icon a-green">🗂</div>
                            <div className="activity-content">
                                <div className="activity-text">
                                    <strong>New topic created</strong> — React.js added to question bank
                                </div>
                                <div className="activity-time">Yesterday, 11:20 AM</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Dashboard;
