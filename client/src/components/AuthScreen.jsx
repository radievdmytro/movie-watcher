import { useState } from 'react';

function AuthScreen({ onAuthSuccess }) {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

        try {
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Something went wrong');
            }

            // Save token and trigger success callback
            localStorage.setItem('token', data.token);
            onAuthSuccess(data.user);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card glass-panel animate-fade-in">
                <div className="auth-header" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <img 
                        src="favicon.png" 
                        alt="Radev Movie Selector Logo" 
                        style={{ width: '75px', height: '75px', borderRadius: '50%', border: '2px solid var(--accent-gold)', boxShadow: '0 0 20px rgba(212,175,55,0.25)' }} 
                    />
                    <h1 className="logo" style={{ margin: 0, fontSize: '2rem' }}>
                        Radev <span className="gold">Movie Selector</span>
                    </h1>
                    <p className="auth-subtitle" style={{ marginTop: '5px' }}>
                        {isLogin ? 'Log in to manage your private watchlists' : 'Register your free personal account'}
                    </p>
                </div>

                <div className="auth-tabs">
                    <button
                        onClick={() => { setIsLogin(true); setError(''); }}
                        className={`auth-tab ${isLogin ? 'active' : ''}`}
                    >
                        Log In
                    </button>
                    <button
                        onClick={() => { setIsLogin(false); setError(''); }}
                        className={`auth-tab ${!isLogin ? 'active' : ''}`}
                    >
                        Sign Up
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && (
                        <div className="auth-error animate-shake">
                            ⚠️ {error}
                        </div>
                    )}

                    <div className="input-group">
                        <label htmlFor="username">Username</label>
                        <input
                            type="text"
                            id="username"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
                            required
                            minLength={3}
                            disabled={loading}
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            required
                            minLength={6}
                            disabled={loading}
                        />
                    </div>

                    <button type="submit" className="btn btn-gold btn-block" disabled={loading} style={{ marginTop: '20px' }}>
                        {loading ? 'Processing...' : isLogin ? 'Sign In' : 'Create Account'}
                    </button>
                </form>

                <div className="auth-footer">
                    <p onClick={() => { setIsLogin(!isLogin); setError(''); }} style={{ cursor: 'pointer' }}>
                        {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
                    </p>
                </div>
            </div>

            <style>{`
                .auth-container {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: calc(80vh - 100px);
                    padding: 20px;
                }

                .auth-card {
                    width: 100%;
                    max-width: 420px;
                    padding: 40px 30px;
                    border-radius: 20px;
                    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
                }

                .auth-header {
                    text-align: center;
                    margin-bottom: 30px;
                }

                .auth-subtitle {
                    color: #888;
                    font-size: 0.9rem;
                    margin-top: 10px;
                }

                .auth-tabs {
                    display: flex;
                    border-bottom: 2px solid rgba(255, 255, 255, 0.05);
                    margin-bottom: 25px;
                }

                .auth-tab {
                    flex: 1;
                    background: none;
                    border: none;
                    color: #666;
                    font-size: 1rem;
                    font-weight: 600;
                    padding: 12px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    border-bottom: 2px solid transparent;
                    margin-bottom: -2px;
                }

                .auth-tab:hover {
                    color: #aaa;
                }

                .auth-tab.active {
                    color: var(--accent-gold);
                    border-bottom: 2px solid var(--accent-gold);
                }

                .auth-form {
                    display: flex;
                    flex-direction: column;
                    gap: 18px;
                }

                .auth-error {
                    background: rgba(239, 68, 68, 0.1);
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    color: #f87171;
                    padding: 12px;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    font-weight: 500;
                }

                .input-group {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                .input-group label {
                    font-size: 0.8rem;
                    color: #aaa;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .input-group input {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 8px;
                    color: #fff;
                    padding: 12px 14px;
                    font-size: 0.95rem;
                    outline: none;
                    transition: all 0.3s ease;
                }

                .input-group input:focus {
                    background: rgba(255, 255, 255, 0.06);
                    border-color: var(--accent-gold);
                    box-shadow: 0 0 10px rgba(212, 175, 55, 0.15);
                }

                .btn-block {
                    width: 100%;
                }

                .auth-footer {
                    text-align: center;
                    margin-top: 25px;
                    font-size: 0.85rem;
                    color: #666;
                    transition: color 0.3s ease;
                }

                .auth-footer:hover {
                    color: #aaa;
                }

                .animate-shake {
                    animation: shake 0.4s ease-in-out;
                }

                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    25% { transform: translateX(-6px); }
                    75% { transform: translateX(6px); }
                }
            `}</style>
        </div>
    );
}

export default AuthScreen;
