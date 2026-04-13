import { Link } from 'react-router-dom';
import './LandingPage.css';

const platformStats = [
  { value: 'AI', label: 'Question generation and interview orchestration' },
  { value: '360', label: 'Coverage across hiring, exams, reports, and review' },
  { value: 'Live', label: 'Voice interview flow with instant transcript capture' },
];

const capabilityCards = [
  {
    eyebrow: 'Assessments',
    title: 'Build structured exams in minutes',
    description:
      'Create topic-based assessments, generate questions with AI, publish secure links, and evaluate candidates with rich reporting.',
  },
  {
    eyebrow: 'AI Interviews',
    title: 'Run guided voice interviews that actually scale',
    description:
      'Launch interview links, manage candidates, capture live conversations, and turn every session into a report your team can act on.',
  },
  {
    eyebrow: 'Integrity',
    title: 'Protect evaluation quality from end to end',
    description:
      'Blend web proctoring, snapshots, screen recording, and interruption tracking so every result carries context.',
  },
];

const workflowSteps = [
  'Create an assessment or interview tailored to the role, topic, and difficulty.',
  'Share secure links with candidates and guide them through a smooth entry flow.',
  'Capture responses, transcripts, and session signals while the platform monitors quality.',
  'Review reports, scores, and AI insights in one admin workspace.',
];

const highlights = [
  'AI-generated questions by topic, level, and format',
  'Voice-first interview experience with live assistant playback',
  'Interview reports with summary, strengths, weaknesses, and recommendations',
  'Candidate link management for exams and interviews',
  'Proctoring signals and review workflows for stronger trust',
  'Unified admin dashboard for operations and analytics',
];

export default function LandingPage() {
  return (
    <div className="landing-page">
      <div className="landing-ambient landing-ambient-orange" />
      <div className="landing-ambient landing-ambient-blue" />

      <header className="landing-header">
        <Link to="/" className="landing-brand">
          <span className="landing-brand-mark">TB</span>
          <span className="landing-brand-text">
            Test<span>Buddy</span>
          </span>
        </Link>

        <nav className="landing-nav">
          <a href="#platform">Platform</a>
          <a href="#workflow">Workflow</a>
          <a href="#highlights">Highlights</a>
        </nav>

        <div className="landing-header-actions">
          <Link to="/login" className="landing-link-btn">
            Admin Login
          </Link>
        </div>
      </header>

      <main>
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <div className="landing-pill">
              Built for assessments, AI interviews, and hiring workflows
            </div>

            <h1 className="landing-title">
              One platform to test skills, interview candidates, and turn raw sessions into decisions.
            </h1>

            <p className="landing-subtitle">
              TestBuddy brings together question generation, secure assessments, voice-based interviews,
              transcript capture, proctoring, and reporting in a single admin experience.
            </p>

            <div className="landing-hero-actions">
              <Link to="/login" className="landing-primary-btn">
                Enter Admin Portal
              </Link>
              <a href="#platform" className="landing-secondary-btn">
                Explore Platform
              </a>
            </div>

            <div className="landing-stats">
              {platformStats.map((stat) => (
                <div key={stat.label} className="landing-stat-card">
                  <strong>{stat.value}</strong>
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="landing-hero-panel">
            <div className="landing-panel-shell">
              <div className="landing-panel-topbar">
                <span className="landing-dot dot-orange" />
                <span className="landing-dot dot-blue" />
                <span className="landing-dot dot-green" />
                <span className="landing-panel-label">Live Hiring Control Center</span>
              </div>

              <div className="landing-panel-grid">
                <article className="landing-metric-card accent-orange">
                  <span className="landing-metric-kicker">Today</span>
                  <strong>24 Active Sessions</strong>
                  <p>Interview rooms and exam links currently in motion.</p>
                </article>

                <article className="landing-metric-card accent-blue">
                  <span className="landing-metric-kicker">AI Reports</span>
                  <strong>Ready for review</strong>
                  <p>Summaries, strengths, weaknesses, and recommendations generated after completion.</p>
                </article>

                <article className="landing-transcript-card">
                  <div className="landing-transcript-head">
                    <span>Interview Timeline</span>
                    <span className="landing-live-badge">Live</span>
                  </div>

                  <div className="landing-transcript-line assistant">
                    AI interviewer asking a role-aware technical question
                  </div>
                  <div className="landing-transcript-line candidate">
                    Candidate response captured as transcript and attached to the session
                  </div>
                  <div className="landing-transcript-line system">
                    Report generated with evaluation insights after session close
                  </div>
                </article>

                <article className="landing-score-card">
                  <span className="landing-score-label">Evaluation Stack</span>
                  <div className="landing-score-bars">
                    <div>
                      <label>Assessments</label>
                      <span style={{ width: '88%' }} />
                    </div>
                    <div>
                      <label>AI Interviews</label>
                      <span style={{ width: '76%' }} />
                    </div>
                    <div>
                      <label>Integrity Signals</label>
                      <span style={{ width: '64%' }} />
                    </div>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </section>

        <section id="platform" className="landing-section">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">Platform</span>
            <h2>Designed around the real TestBuddy workflow</h2>
            <p>
              Everything on this page maps to the product you already have: topics, assessments,
              interview links, live sessions, reports, and admin operations.
            </p>
          </div>

          <div className="landing-capability-grid">
            {capabilityCards.map((card) => (
              <article key={card.title} className="landing-capability-card">
                <span className="landing-card-eyebrow">{card.eyebrow}</span>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="workflow" className="landing-section landing-workflow">
          <div className="landing-section-heading">
            <span className="landing-section-kicker">Workflow</span>
            <h2>From link creation to final recommendation</h2>
            <p>
              The experience should feel seamless for admins and structured for candidates, whether
              they are taking an exam or speaking with the AI interviewer.
            </p>
          </div>

          <div className="landing-workflow-grid">
            {workflowSteps.map((step, index) => (
              <article key={step} className="landing-workflow-step">
                <span>{`0${index + 1}`}</span>
                <p>{step}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="highlights" className="landing-section landing-highlight-panel">
          <div className="landing-highlight-copy">
            <span className="landing-section-kicker">Why Teams Use It</span>
            <h2>Operationally simple, visually sharp, and built for evaluation teams.</h2>
            <p>
              TestBuddy is not just a form builder or a chatbot wrapper. It is a hiring and assessment
              workspace that connects creation, delivery, integrity, and reporting.
            </p>
          </div>

          <div className="landing-highlight-list">
            {highlights.map((item) => (
              <div key={item} className="landing-highlight-item">
                <span className="landing-highlight-icon">+</span>
                <p>{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-cta">
          <div>
            <span className="landing-section-kicker">Get Started</span>
            <h2>Open the admin portal and start building your next evaluation flow.</h2>
          </div>
          <div className="landing-cta-actions">
            <Link to="/login" className="landing-primary-btn">
              Go to Login
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
