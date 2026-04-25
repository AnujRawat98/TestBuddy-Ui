import { useEffect, useRef, useState } from 'react';

type GoogleAuthButtonProps = {
  text: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  onCredential: (credential: string) => Promise<void> | void;
  disabled?: boolean;
};

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

function loadGoogleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (existingScript) {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }

      existingScript.addEventListener('load', () => resolve(), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google script.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google script.'));
    document.head.appendChild(script);
  });
}

export default function GoogleAuthButton({ text, onCredential, disabled = false }: GoogleAuthButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState('');
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    let cancelled = false;

    async function initGoogleButton() {
      if (!clientId || !containerRef.current || disabled) {
        return;
      }

      try {
        await loadGoogleScript();
        if (cancelled || !window.google?.accounts?.id || !containerRef.current) {
          return;
        }

        containerRef.current.innerHTML = '';
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            if (!response.credential) {
              setError('Google sign-in did not return a credential.');
              return;
            }

            setError('');
            await onCredential(response.credential);
          },
        });

        window.google.accounts.id.renderButton(containerRef.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'rectangular',
          text,
          width: '440',
          logo_alignment: 'left',
        });
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setError('Google sign-in is unavailable right now.');
        }
      }
    }

    initGoogleButton();

    return () => {
      cancelled = true;
    };
  }, [clientId, disabled, onCredential, text]);

  if (!clientId) {
    return <div className="google-auth-hint">Set `VITE_GOOGLE_CLIENT_ID` to enable Google sign-in.</div>;
  }

  return (
    <div className={`google-auth-block${disabled ? ' is-disabled' : ''}`}>
      <div ref={containerRef} className="google-auth-button-host" />
      {error && <div className="google-auth-hint google-auth-error">{error}</div>}
    </div>
  );
}
