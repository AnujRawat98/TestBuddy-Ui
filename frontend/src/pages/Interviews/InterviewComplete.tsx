import { useEffect } from 'react';
import './Interviews.css';

export default function InterviewComplete() {

  useEffect(() => {
    sessionStorage.removeItem('interviewCandidate');
    sessionStorage.removeItem('interviewLinkId');
  }, []);

  return (
    <div className="complete-page">
      <div className="complete-card">
        <div className="complete-icon">✓</div>

        <h1 className="complete-title">Interview Completed</h1>
        
        <p className="complete-message">
          Thank you for completing the AI interview. Your responses have been recorded and will be evaluated.
        </p>

        <div className="complete-info">
          <h3 className="complete-info-title">What happens next?</h3>
          <ul>
            <li>Your interview will be analyzed by our AI system</li>
            <li>A detailed report will be generated</li>
            <li>The hiring team will review your performance</li>
            <li>You will be contacted for the next steps</li>
          </ul>
        </div>

        <p className="complete-note">
          You can close this window now.
        </p>
      </div>
    </div>
  );
}
