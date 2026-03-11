import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import './AdminLayout.css';

const AdminLayout: React.FC = () => {
    const [currentDate, setCurrentDate] = useState('');
    const [isQuestionnaireOpen, setIsQuestionnaireOpen] = useState(false);
    const location = useLocation();

    useEffect(() => {
        const now = new Date();
        setCurrentDate(
            now.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
            })
        );
    }, []);

    // Check if we are in questionnaire sub-routes to auto-open menu
    useEffect(() => {
        if (
            location.pathname.includes('/topics') ||
            location.pathname.includes('/questions') ||
            location.pathname.includes('/ai-generator')
        ) {
            setIsQuestionnaireOpen(true);
        }
    }, [location.pathname]);

    return (
        <>
            {/* ═══ SIDEBAR ══════════════════════════════════════════════ */}
            <aside className="sidebar" id="sidebar">
                <div className="sidebar-logo">
                    Test<span>Buddy</span>
                    <div className="logo-dot" title="System online"></div>
                </div>

                <div className="sidebar-section">Main Menu</div>

                <NavLink
                    to="/dashboard"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                    <span className="nav-icon">📊</span>
                    <span className="nav-label">Dashboard</span>
                </NavLink>

                <a
                    className={`nav-item ${isQuestionnaireOpen ? 'active' : ''}`}
                    href="#"
                    onClick={(e) => {
                        e.preventDefault();
                        setIsQuestionnaireOpen(!isQuestionnaireOpen);
                    }}
                >
                    <span className="nav-icon">📚</span>
                    <span className="nav-label">Questionnaire</span>
                    <span
                        style={{
                            marginLeft: 'auto',
                            fontSize: '11px',
                            color: 'rgba(255,255,255,.3)',
                            transform: isQuestionnaireOpen ? 'rotate(180deg)' : '',
                            transition: 'transform .2s',
                        }}
                    >
                        ▼
                    </span>
                </a>
                <div className={`nav-sub ${isQuestionnaireOpen ? 'open' : ''}`}>
                    <NavLink
                        to="/topics"
                        className={({ isActive }) => `nav-sub-item ${isActive ? 'active' : ''}`}
                    >
                        <div className="nav-sub-dot"></div>Topics
                    </NavLink>
                    <NavLink
                        to="/questions/add"
                        className={({ isActive }) => `nav-sub-item ${isActive ? 'active' : ''}`}
                    >
                        <div className="nav-sub-dot"></div>Questions
                    </NavLink>
                    <NavLink
                        to="/ai-generator"
                        className={({ isActive }) => `nav-sub-item ${isActive ? 'active' : ''}`}
                    >
                        <div className="nav-sub-dot"></div>AI Generator
                    </NavLink>
                </div>

                <NavLink
                    to="/assessments/create"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                    <span className="nav-icon">📝</span>
                    <span className="nav-label">Assessments</span>
                    <span className="nav-badge">8</span>
                </NavLink>

                <NavLink
                    to="/links/create"
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                >
                    <span className="nav-icon">🔗</span>
                    <span className="nav-label">Exam Links</span>
                    <span className="nav-badge green">3</span>
                </NavLink>

                <a className="nav-item" href="#">
                    <span className="nav-icon">👥</span>
                    <span className="nav-label">Attempts</span>
                </a>

                <div className="sidebar-section">System</div>

                <a className="nav-item" href="#">
                    <span className="nav-icon">⚙️</span>
                    <span className="nav-label">Settings</span>
                </a>

                <Link className="nav-item" to="/login">
                    <span className="nav-icon">🚪</span>
                    <span className="nav-label">Logout</span>
                </Link>

                <div className="sidebar-footer">
                    <div className="admin-card">
                        <div className="admin-avatar">A</div>
                        <div>
                            <div className="admin-name">Admin</div>
                            <div className="admin-role">Super Administrator</div>
                        </div>
                        <div className="admin-more">⋯</div>
                    </div>
                </div>
            </aside>

            {/* ═══ MAIN AREA ════════════════════════════════════════════ */}
            <div className="main">
                {/* TOPBAR */}
                <header className="topbar">
                    <div className="topbar-left">
                        <div className="topbar-greeting">Good morning, Admin 👋</div>
                        <div className="topbar-date">{currentDate}</div>
                    </div>
                    <div className="topbar-right">
                        <div className="topbar-search">
                            <span>🔍</span>
                            <input
                                type="text"
                                placeholder="Search anything…"
                                style={{ border: 'none', background: 'transparent', outline: 'none', color: 'var(--muted)', width: '100%', fontSize: '13px' }}
                            />
                        </div>
                        <div className="icon-btn" title="Notifications">
                            🔔
                            <div className="notif-dot"></div>
                        </div>
                        <div className="icon-btn" title="Help">
                            ❓
                        </div>
                        <div className="topbar-avatar" title="Profile">
                            A
                        </div>
                    </div>
                </header>

                {/* CONTENT */}
                <main className="content">
                    <Outlet />
                </main>
            </div>
        </>
    );
};

export default AdminLayout;
