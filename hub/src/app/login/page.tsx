'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid credentials');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <div className="login-header">
          <h1>CHARIOT</h1>
          <p>SuperAdmin Command Center</p>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Imperial Email</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              placeholder="commander@chariot.hub"
              required 
            />
          </div>
          
          <div className="form-group">
            <label>Secret Passphrase</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••••"
              required 
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={isLoading}>
            {isLoading ? 'Decrypting Access...' : 'Authenticate'}
          </button>
        </form>

        <div className="divider">
          <span>OR CONTINUE WITH</span>
        </div>

        <div className="provider-buttons">
          <button 
            type="button" 
            className="provider-btn provider-btn--keycloak" 
            onClick={() => signIn('keycloak', { callbackUrl: '/' })}
          >
            🔐 Keycloak SSO
          </button>
        </div>

        <div className="login-footer">
          <p>By authenticating, you agree to the Imperial Data Concord.</p>
        </div>
      </div>

      <style jsx>{`
        .login-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100vh;
          width: 100vw;
          background-color: var(--bg-base);
          background-image: 
            radial-gradient(circle at 100% 100%, rgba(155, 17, 30, 0.05) 0%, transparent 50%),
            radial-gradient(circle at 0% 0%, var(--chariot-bronze-glow) 0%, transparent 40%);
          position: fixed;
          top: 0;
          left: 0;
          z-index: 1000;
        }

        .login-card {
          width: 420px;
          background: var(--bg-panel);
          border: 1px solid var(--accent-bronze);
          padding: 3rem;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8), inset 0 0 20px rgba(176, 141, 87, 0.05);
          position: relative;
        }

        .login-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 4px;
          background: linear-gradient(90deg, var(--accent-red), var(--accent-bronze));
        }

        .login-header {
          text-align: center;
          margin-bottom: 3rem;
        }

        .login-header h1 {
          font-family: 'Georgia', serif;
          font-weight: 400;
          font-size: 2.2rem;
          letter-spacing: 8px;
          margin-bottom: 0.5rem;
          color: var(--accent-bronze);
          text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
        }

        .login-header p {
          color: var(--text-muted);
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 3px;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.75rem;
          color: var(--accent-bronze);
          font-family: 'Georgia', serif;
          font-size: 0.7rem;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        input {
          width: 100%;
          background: var(--bg-input);
          border: 1px solid rgba(176, 141, 87, 0.2);
          padding: 0.75rem 1rem;
          color: var(--text-main);
          font-size: 0.9rem;
          transition: all 0.3s ease;
          outline: none;
        }

        input:focus {
          border-color: var(--accent-bronze);
          background: var(--bg-panel-hover);
        }

        button[type="submit"] {
          width: 100%;
          background-color: transparent;
          color: var(--accent-bronze);
          border: 1px solid var(--accent-bronze);
          padding: 0.85rem;
          font-weight: bold;
          font-family: 'Georgia', serif;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
          letter-spacing: 2px;
          margin-top: 1rem;
        }

        button[type="submit"]:hover:not(:disabled) {
          background-color: var(--accent-bronze);
          color: var(--bg-base);
        }

        button[type="submit"]:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .divider {
          text-align: center;
          margin: 2.5rem 0;
          position: relative;
        }

        .divider:before {
          content: "";
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: rgba(176, 141, 87, 0.1);
        }

        .divider span {
          background: var(--bg-panel);
          padding: 0 1.25rem;
          position: relative;
          color: var(--text-muted);
          font-size: 0.65rem;
          font-weight: 700;
          letter-spacing: 2px;
        }

        .provider-buttons {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }

        .provider-btn {
          background: transparent;
          border: 1px solid rgba(176, 141, 87, 0.3);
          color: var(--text-main);
          padding: 0.75rem;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.3s;
          letter-spacing: 1px;
        }

        .provider-btn:hover {
          border-color: var(--accent-bronze);
          background: rgba(176, 141, 87, 0.08);
          color: var(--accent-bronze);
        }

        .provider-btn--keycloak {
          border-color: rgba(176, 141, 87, 0.5);
          letter-spacing: 2px;
        }

        .error-message {
          color: var(--accent-red);
          font-size: 0.8rem;
          font-family: Georgia, serif;
          margin-top: 1rem;
          text-align: center;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .login-footer {
          margin-top: 2.5rem;
          text-align: center;
          color: var(--text-muted);
          font-size: 0.6rem;
          text-transform: uppercase;
          letter-spacing: 1px;
          line-height: 1.5;
        }
      `}</style>
    </div>
  );
}
