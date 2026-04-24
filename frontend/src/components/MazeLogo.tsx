import React from 'react';

type MazeLogoProps = {
  className?: string;
};

const MazeLogo: React.FC<MazeLogoProps> = ({ className }) => {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="maze-logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#059669" />
          <stop offset="100%" stopColor="#0EA5E9" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="16" height="16" rx="3" stroke="url(#maze-logo-grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="9" y="9" width="6" height="6" rx="1" fill="url(#maze-logo-grad)" />
      <path d="M9 1v3M15 1v3M9 20v3M15 20v3M20 9h3M20 14h3M1 9h3M1 14h3" stroke="url(#maze-logo-grad)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default MazeLogo;
