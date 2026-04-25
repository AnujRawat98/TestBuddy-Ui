import React, { useEffect, useMemo, useState } from 'react';
import { Outlet, NavLink, Link, useLocation } from 'react-router-dom';
import {
  BriefcaseBusiness,
  Building2,
  ChevronDown,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  UsersRound,
  WalletCards,
  X,
} from 'lucide-react';
import './AdminLayout.css';
import { clearAuthSession, isSuperAdminSession } from '../utils/auth';
import MazeLogo from './MazeLogo';

type NavEntry = {
  label: string;
  to: string;
  icon: React.ElementType;
  end?: boolean;
};

type NavGroup = {
  label: string;
  icon: React.ElementType;
  isOpen: boolean;
  onToggle: () => void;
  isActive: boolean;
  children: NavEntry[];
};

const AdminLayout: React.FC = () => {
  const [isQuestionnaireOpen, setIsQuestionnaireOpen] = useState(false);
  const [isAssessmentOpen, setIsAssessmentOpen] = useState(false);
  const [isInterviewOpen, setIsInterviewOpen] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsSuperAdmin(isSuperAdminSession());
  }, []);

  useEffect(() => {
    if (
      location.pathname.includes('/topics') ||
      location.pathname.includes('/questions') ||
      location.pathname.includes('/ai-generator')
    ) {
      setIsQuestionnaireOpen(true);
    }
    if (location.pathname.includes('/assessments') || location.pathname.includes('/links')) {
      setIsAssessmentOpen(true);
    }
    if (location.pathname.includes('/interviews') || location.pathname.includes('/ijp')) {
      setIsInterviewOpen(true);
    }
    setMobileNavOpen(false);
  }, [location.pathname]);

  const navGroups = useMemo<NavGroup[]>(
    () => [
      {
        label: 'Question Bank',
        icon: FolderKanban,
        isOpen: isQuestionnaireOpen,
        onToggle: () => setIsQuestionnaireOpen((open) => !open),
        isActive:
          location.pathname.includes('/topics') ||
          location.pathname.includes('/questions') ||
          location.pathname.includes('/ai-generator'),
        children: [
          { label: 'Topics', to: '/topics', icon: BriefcaseBusiness },
          { label: 'Questions', to: '/questions/add', icon: FileText },
          { label: 'AI Generator', to: '/ai-generator', icon: Sparkles },
        ],
      },
      {
        label: 'Assessments',
        icon: LayoutDashboard,
        isOpen: isAssessmentOpen,
        onToggle: () => setIsAssessmentOpen((open) => !open),
        isActive: location.pathname.includes('/assessments') || location.pathname.includes('/links'),
        children: [
          { label: 'Assessment List', to: '/assessments', icon: LayoutDashboard, end: true },
          { label: 'Create Assessment', to: '/assessments/create', icon: Sparkles },
        ],
      },
      {
        label: 'AI Interviews',
        icon: UsersRound,
        isOpen: isInterviewOpen,
        onToggle: () => setIsInterviewOpen((open) => !open),
        isActive: location.pathname.includes('/interviews') || location.pathname.includes('/ijp'),
        children: [
          { label: 'Job Posting', to: '/ijp', icon: BriefcaseBusiness },
          { label: 'Interview Studio', to: '/interviews', icon: UsersRound },
        ],
      },
    ],
    [isAssessmentOpen, isInterviewOpen, isQuestionnaireOpen, location.pathname],
  );

  return (
    <div className="admin-shell">
      <div
        className={`admin-shell-backdrop ${mobileNavOpen ? 'open' : ''}`}
        onClick={() => setMobileNavOpen(false)}
      />

      <aside className={`sidebar ${mobileNavOpen ? 'open' : ''}`} id="sidebar">
        <div className="sidebar-top">
          <Link to={isSuperAdmin ? '/platform' : '/dashboard'} className="sidebar-logo">
            <span className="sidebar-logo-mark">
              <MazeLogo className="sidebar-logo-svg" />
            </span>
            <span className="sidebar-logo-text">
              Maze<span>AI</span>
            </span>
          </Link>

          <button
            type="button"
            className="sidebar-close-btn"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="sidebar-section">Workspace</div>

        {isSuperAdmin ? (
          <NavLink to="/platform" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <Building2 size={18} />
            </span>
            <span className="nav-label">Organisation Billing</span>
          </NavLink>
        ) : (
          <>
            <NavLink to="/dashboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <span className="nav-icon">
                <LayoutDashboard size={18} />
              </span>
              <span className="nav-label">Dashboard</span>
            </NavLink>

            {navGroups.map((group) => {
              const GroupIcon = group.icon;
              return (
                <div key={group.label} className="nav-group">
                  <button
                    type="button"
                    className={`nav-item nav-group-trigger ${group.isActive ? 'active' : ''}`}
                    onClick={group.onToggle}
                  >
                    <span className="nav-icon">
                      <GroupIcon size={18} />
                    </span>
                    <span className="nav-label">{group.label}</span>
                    <ChevronDown size={16} className={`nav-caret ${group.isOpen ? 'open' : ''}`} />
                  </button>

                  <div className={`nav-sub ${group.isOpen ? 'open' : ''}`}>
                    {group.children.map((entry) => {
                      const EntryIcon = entry.icon;
                      return (
                        <NavLink
                          key={entry.to}
                          to={entry.to}
                          end={entry.end}
                          className={({ isActive }) => `nav-sub-item ${isActive ? 'active' : ''}`}
                        >
                          <span className="nav-sub-icon">
                            <EntryIcon size={15} />
                          </span>
                          {entry.label}
                        </NavLink>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        )}

        <div className="sidebar-section">Billing</div>

        {!isSuperAdmin && (
          <NavLink to="/wallet" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <span className="nav-icon">
              <WalletCards size={18} />
            </span>
            <span className="nav-label">Wallet</span>
          </NavLink>
        )}

        <button type="button" className="nav-item nav-item-static">
          <span className="nav-icon">
            <Settings size={18} />
          </span>
          <span className="nav-label">Settings</span>
          <span className="nav-soon">Soon</span>
        </button>

        <Link className="nav-item nav-logout" to="/login" onClick={() => clearAuthSession()}>
          <span className="nav-icon">
            <LogOut size={18} />
          </span>
          <span className="nav-label">Logout</span>
        </Link>

        <div className="sidebar-footer">
          <div className="admin-card">
            <div className="admin-avatar">A</div>
            <div className="admin-meta">
              <div className="admin-name">Admin Workspace</div>
              <div className="admin-role">{isSuperAdmin ? 'Platform Superadmin' : 'Workspace Admin'}</div>
            </div>
            <span className="admin-status" />
          </div>
        </div>
      </aside>

      <div className="main">
        <main className="content">
          <div className="content-mobile-actions">
            <button
              type="button"
              className="mobile-menu-btn content-menu-btn"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={18} />
            </button>
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
