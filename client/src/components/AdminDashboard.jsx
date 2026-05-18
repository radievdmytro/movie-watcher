import { useState, useEffect } from 'react';
import MovieDetailsModal from './MovieDetailsModal';

function AdminDashboard({ onBack }) {
    const [stats, setStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null); // The user object being inspected
    const [userData, setUserData] = useState({ movies: [], collections: [] });
    const [userLoading, setUserLoading] = useState(false);
    const [activeSubTab, setActiveSubTab] = useState('movies'); // 'movies' | 'collections'
    const [selectedMovie, setSelectedMovie] = useState(null);
    const [expandedCollectionId, setExpandedCollectionId] = useState(null);
    const [expandedCollection, setExpandedCollection] = useState(null);
    const [syncStatus, setSyncStatus] = useState(null);
    const [error, setError] = useState(null);

    // Inline Admin Operations State (No native popups!)
    const [confirmDeleteUserId, setConfirmDeleteUserId] = useState(null);
    const [resetPasswordUserId, setResetPasswordUserId] = useState(null);
    const [newPasswordVal, setNewPasswordVal] = useState('');
    const [adminFeedback, setAdminFeedback] = useState({ id: null, type: '', message: '' });

    const fetchAdminData = async () => {
        setLoading(true);
        setError(null);
        try {
            const [statsRes, usersRes, syncRes] = await Promise.all([
                fetch('/api/admin/stats'),
                fetch('/api/admin/users'),
                fetch('/api/admin/sync-status')
            ]);
            
            if (!statsRes.ok) {
                const errData = await statsRes.json().catch(() => ({}));
                throw new Error(errData.error || `Failed to fetch global stats (HTTP ${statsRes.status})`);
            }
            if (!usersRes.ok) {
                const errData = await usersRes.json().catch(() => ({}));
                throw new Error(errData.error || `Failed to fetch registered users list (HTTP ${usersRes.status})`);
            }
            
            setStats(await statsRes.json());
            setUsers(await usersRes.json());
            
            if (syncRes.ok) {
                setSyncStatus(await syncRes.json());
            }
        } catch (err) {
            console.error('Failed to fetch admin stats:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAdminData();
    }, []);

    const handleInspectUser = async (user) => {
        setSelectedUser(user);
        setUserLoading(true);
        setActiveSubTab('movies');
        setExpandedCollectionId(null);
        try {
            const res = await fetch(`/api/admin/users/${user.id}/data`);
            if (res.ok) {
                setUserData(await res.json());
            }
        } catch (err) {
            console.error('Failed to fetch user library data:', err);
        } finally {
            setUserLoading(false);
        }
    };

    const handleBackToUsers = () => {
        setSelectedUser(null);
        setUserData({ movies: [], collections: [] });
    };

    const handleResetPassword = async (user) => {
        const passToUse = newPasswordVal.trim() || 'Reset123!';
        try {
            const res = await fetch(`/api/admin/users/${user.id}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword: passToUse })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to reset password');
            
            setAdminFeedback({
                id: user.id,
                type: 'success',
                message: `✔ Password reset to: "${data.newPassword}"`
            });
            setResetPasswordUserId(null);
            setNewPasswordVal('');
            setTimeout(() => setAdminFeedback({ id: null, type: '', message: '' }), 6000);
        } catch (err) {
            setAdminFeedback({ id: user.id, type: 'error', message: `Error: ${err.message}` });
            setTimeout(() => setAdminFeedback({ id: null, type: '', message: '' }), 4000);
        }
    };

    const handleDeleteUser = async (user) => {
        try {
            const res = await fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to delete user');
            
            setAdminFeedback({
                id: user.id,
                type: 'success',
                message: `✔ User @${user.username} deleted.`
            });
            setConfirmDeleteUserId(null);
            fetchAdminData();
            setTimeout(() => setAdminFeedback({ id: null, type: '', message: '' }), 4000);
        } catch (err) {
            setAdminFeedback({ id: user.id, type: 'error', message: `Error: ${err.message}` });
            setTimeout(() => setAdminFeedback({ id: null, type: '', message: '' }), 4000);
        }
    };

    return (
        <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {selectedMovie && (
                <MovieDetailsModal
                    movie={selectedMovie}
                    onClose={() => setSelectedMovie(null)}
                    onUpdate={() => {}} // Read-only admin view
                    onDelete={() => {}}
                    isTrashMode={false}
                    readOnly={true}
                />
            )}

            {/* Header section */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button
                        onClick={selectedUser ? handleBackToUsers : onBack}
                        className="btn btn-ghost"
                        style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '8px 15px', borderRadius: '8px' }}
                    >
                        {selectedUser ? '← Back to User List' : '← Back to Library'}
                    </button>
                    <h2 style={{ margin: 0, fontSize: '2rem', color: '#fff' }}>
                        👑 {selectedUser ? `Inspect @${selectedUser.username}` : 'Admin Dashboard'}
                    </h2>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>
                    <div style={{
                        display: 'inline-block',
                        width: '30px',
                        height: '30px',
                        border: '3px solid rgba(255,255,255,0.1)',
                        borderTopColor: 'var(--accent-gold)',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        marginBottom: '15px'
                    }}></div>
                    <div style={{ fontSize: '0.95rem' }}>Loading Admin Panel...</div>
                    <style>{`
                        @keyframes spin {
                            to { transform: rotate(360deg); }
                        }
                    `}</style>
                </div>
            ) : error ? (
                <div className="glass-panel animate-fade-in" style={{
                    padding: '40px 30px',
                    borderRadius: '15px',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    background: 'rgba(239, 68, 68, 0.05)',
                    textAlign: 'center',
                    maxWidth: '500px',
                    margin: '40px auto',
                    color: '#f87171'
                }}>
                    <div style={{ fontSize: '3rem', marginBottom: '15px' }}>⚠️</div>
                    <h3 style={{ margin: '0 0 10px 0', color: '#fff', fontSize: '1.3rem' }}>Connection or Access Error</h3>
                    <p style={{ color: '#aaa', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '25px' }}>
                        {error}
                    </p>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        <button onClick={fetchAdminData} className="btn btn-gold" style={{ padding: '10px 20px' }}>
                            🔄 Retry Loading
                        </button>
                        <button onClick={onBack} className="btn" style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.05)', color: '#fff' }}>
                            Go Back
                        </button>
                    </div>
                </div>
            ) : !selectedUser ? (
                // VIEW 1: Main Stats and Users List
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    {/* Supabase Sync Status / Warnings */}
                    {syncStatus && syncStatus.supabaseConfigured && syncStatus.status === 'Failed' && (
                        <div className="glass-panel animate-fade-in" style={{
                            padding: '20px',
                            borderRadius: '12px',
                            border: '1px solid rgba(239, 68, 68, 0.2)',
                            background: 'rgba(239, 68, 68, 0.05)',
                            color: '#f87171',
                            fontSize: '0.9rem',
                            lineHeight: '1.6'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold', marginBottom: '8px', fontSize: '1.05rem' }}>
                                ⚠️ Cloud Database Sync is Failing!
                            </div>
                            <div style={{ color: '#ccc', marginBottom: '10px' }}>
                                Your SQLite database backup is currently failing to upload to Supabase because the provided API key <strong>is invalid or has expired permissions</strong> (error: <code>{syncStatus.error}</code>).
                            </div>
                            <div style={{ borderLeft: '3px solid var(--accent-gold)', paddingLeft: '12px', fontSize: '0.85rem', color: '#aaa' }}>
                                💡 <strong>To fix this and prevent account resets when Render sleeps:</strong> Please replace your Supabase anon/service-role API key (starts with <code>eyJ...</code>) in your environment variables. Do not use local bootstrap keys starting with <code>sb_publishable_...</code>.
                            </div>
                        </div>
                    )}

                    {syncStatus && syncStatus.supabaseConfigured && syncStatus.status === 'Success' && (
                        <div className="glass-panel animate-fade-in" style={{
                            padding: '12px 20px',
                            borderRadius: '12px',
                            border: '1px solid rgba(3, 218, 198, 0.2)',
                            background: 'rgba(3, 218, 198, 0.03)',
                            color: '#03dac6',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px'
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                🟢 Cloud database backup is fully active and synced with Supabase.
                            </span>
                            <span style={{ color: '#888', fontSize: '0.8rem' }}>
                                Last Sync: {syncStatus.time ? new Date(syncStatus.time).toLocaleTimeString() : 'N/A'}
                            </span>
                        </div>
                    )}

                    {syncStatus && !syncStatus.supabaseConfigured && (
                        <div className="glass-panel animate-fade-in" style={{
                            padding: '12px 20px',
                            borderRadius: '12px',
                            border: '1px solid rgba(255,255,255,0.06)',
                            background: 'rgba(255,255,255,0.01)',
                            color: '#aaa',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px'
                        }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                ☁️ Cloud Backup is not configured. Running in local-only mode.
                            </span>
                            <span style={{ color: '#666', fontSize: '0.8rem' }}>
                                (Set SUPABASE_URL and SUPABASE_KEY to enable cloud backups)
                            </span>
                        </div>
                    )}

                    {/* Stats Grid */}
                    {stats && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                            <div className="glass-panel" style={{ padding: '25px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', color: 'var(--accent-gold)', fontWeight: 'bold', marginBottom: '5px' }}>
                                    {stats.totalUsers}
                                </div>
                                <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Total Users
                                </div>
                            </div>
                            <div className="glass-panel" style={{ padding: '25px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', color: '#03dac6', fontWeight: 'bold', marginBottom: '5px' }}>
                                    {stats.totalMovies}
                                </div>
                                <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Total Library Movies
                                </div>
                            </div>
                            <div className="glass-panel" style={{ padding: '25px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', color: '#ff6b6b', fontWeight: 'bold', marginBottom: '5px' }}>
                                    {stats.totalCollections}
                                </div>
                                <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Total Collections
                                </div>
                            </div>
                            <div className="glass-panel" style={{ padding: '25px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', color: '#e5c158', fontWeight: 'bold', marginBottom: '5px' }}>
                                    {stats.totalCached || 0}
                                </div>
                                <div style={{ color: '#888', fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                    Global Cached (Rezka)
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Users list */}
                    <div className="glass-panel animate-fade-in" style={{ borderRadius: '15px', overflow: 'hidden', padding: '20px' }}>
                        <h3 style={{ margin: '0 0 20px 0', color: '#fff', fontSize: '1.2rem' }}>Registered Users</h3>
                        
                        <div className="admin-users-table-view" style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#888', fontSize: '0.85rem' }}>
                                        <th style={{ padding: '12px 15px' }}>Username</th>
                                        <th style={{ padding: '12px 15px' }}>Registration Date</th>
                                        <th style={{ padding: '12px 15px', textAlign: 'center' }}>Movies</th>
                                        <th style={{ padding: '12px 15px', textAlign: 'center' }}>Collections</th>
                                        <th style={{ padding: '12px 15px', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u.id} className="admin-user-row" style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                                            <td style={{ padding: '15px', color: '#fff', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(212,175,55,0.1)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '0.9rem' }}>
                                                    {u.username[0].toUpperCase()}
                                                </div>
                                                @{u.username}
                                            </td>
                                            <td style={{ padding: '15px', color: '#aaa', fontSize: '0.9rem' }}>
                                                {new Date(u.created_at).toLocaleDateString()} {new Date(u.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td style={{ padding: '15px', color: '#fff', textAlign: 'center', fontWeight: 600 }}>
                                                {u.movie_count}
                                            </td>
                                            <td style={{ padding: '15px', color: '#fff', textAlign: 'center', fontWeight: 600 }}>
                                                {u.collection_count}
                                            </td>
                                            <td style={{ padding: '15px', textAlign: 'right' }}>
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                                    <button
                                                        onClick={() => handleInspectUser(u)}
                                                        className="btn btn-ghost"
                                                        style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '8px' }}
                                                    >
                                                        🔍 Inspect
                                                    </button>
                                                    {adminFeedback.id === u.id && adminFeedback.message && (
                                                        <span style={{
                                                            fontSize: '0.8rem',
                                                            color: adminFeedback.type === 'success' ? '#03dac6' : 'var(--danger)',
                                                            fontWeight: 'bold',
                                                            marginRight: '8px'
                                                        }}>
                                                            {adminFeedback.message}
                                                        </span>
                                                    )}
                                                    {u.username.toLowerCase() !== 'radev' && (
                                                        <>
                                                            {resetPasswordUserId === u.id ? (
                                                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center', background: 'rgba(212,175,55,0.05)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.2)' }}>
                                                                    <input
                                                                        type="text"
                                                                        placeholder="New password (blank for Reset123!)"
                                                                        value={newPasswordVal}
                                                                        onChange={e => setNewPasswordVal(e.target.value)}
                                                                        style={{
                                                                            background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                                                                            color: '#fff', borderRadius: '4px', padding: '4px 8px', fontSize: '0.78rem',
                                                                            width: '180px', outline: 'none'
                                                                        }}
                                                                    />
                                                                    <button
                                                                        onClick={() => handleResetPassword(u)}
                                                                        style={{ background: 'var(--accent-gold)', color: '#000', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                                                                    >Save</button>
                                                                    <button
                                                                        onClick={() => { setResetPasswordUserId(null); setNewPasswordVal(''); }}
                                                                        style={{ background: 'rgba(255,255,255,0.08)', color: '#aaa', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}
                                                                    >Cancel</button>
                                                                </div>
                                                            ) : confirmDeleteUserId === u.id ? (
                                                                <span style={{ display: 'flex', gap: '5px', alignItems: 'center', background: 'rgba(239,68,68,0.08)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                                                    <span style={{ fontSize: '0.78rem', color: '#ff6b6b', fontWeight: 'bold' }}>Delete user?</span>
                                                                    <button
                                                                        onClick={() => handleDeleteUser(u)}
                                                                        style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold' }}
                                                                    >Yes</button>
                                                                    <button
                                                                        onClick={() => setConfirmDeleteUserId(null)}
                                                                        style={{ background: 'rgba(255,255,255,0.08)', color: '#aaa', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '0.75rem', cursor: 'pointer' }}
                                                                    >No</button>
                                                                </span>
                                                            ) : (
                                                                <>
                                                                    <button
                                                                        onClick={() => setResetPasswordUserId(u.id)}
                                                                        className="btn"
                                                                        style={{
                                                                            background: 'rgba(212, 175, 55, 0.1)',
                                                                            color: 'var(--accent-gold)',
                                                                            border: '1px solid rgba(212, 175, 55, 0.2)',
                                                                            padding: '6px 12px',
                                                                            fontSize: '0.85rem',
                                                                            borderRadius: '8px',
                                                                            fontWeight: 500
                                                                        }}
                                                                    >
                                                                        🔑 Reset
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setConfirmDeleteUserId(u.id)}
                                                                        className="btn btn-ghost"
                                                                        style={{
                                                                            color: 'var(--danger)',
                                                                            border: '1px solid rgba(239, 68, 68, 0.1)',
                                                                            padding: '6px 10px',
                                                                            fontSize: '0.85rem',
                                                                            borderRadius: '8px'
                                                                        }}
                                                                        title="Delete User"
                                                                    >
                                                                        🗑
                                                                    </button>
                                                                </>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards View */}
                        <div className="admin-users-cards-view" style={{ display: 'none', flexDirection: 'column', gap: '15px' }}>
                            {users.map(u => (
                                <div key={u.id} className="glass-panel animate-fade-in" style={{ padding: '15px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(212,175,55,0.1)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                                {u.username[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <div style={{ color: '#fff', fontWeight: 600 }}>@{u.username}</div>
                                                <div style={{ color: '#666', fontSize: '0.75rem' }}>Joined: {new Date(u.created_at).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '15px', fontSize: '0.8rem' }}>
                                            <div>🎬 <span style={{ color: '#fff', fontWeight: 600 }}>{u.movie_count}</span></div>
                                            <div>📁 <span style={{ color: '#fff', fontWeight: 600 }}>{u.collection_count}</span></div>
                                        </div>
                                    </div>
                                    {adminFeedback.id === u.id && adminFeedback.message && (
                                        <div style={{
                                            fontSize: '0.8rem',
                                            color: adminFeedback.type === 'success' ? '#03dac6' : 'var(--danger)',
                                            fontWeight: 'bold',
                                            textAlign: 'center',
                                            background: 'rgba(255,255,255,0.02)',
                                            padding: '6px',
                                            borderRadius: '6px'
                                        }}>
                                            {adminFeedback.message}
                                        </div>
                                    )}
                                    <div style={{ display: 'flex', gap: '8px', width: '100%', flexDirection: 'column' }}>
                                        <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                                            <button
                                                onClick={() => handleInspectUser(u)}
                                                className="btn btn-ghost"
                                                style={{ flex: 1, border: '1px solid rgba(255,255,255,0.1)', padding: '8px', fontSize: '0.8rem', borderRadius: '8px' }}
                                            >
                                                🔍 Inspect
                                            </button>
                                            {u.username.toLowerCase() !== 'radev' && resetPasswordUserId !== u.id && confirmDeleteUserId !== u.id && (
                                                <>
                                                    <button
                                                        onClick={() => setResetPasswordUserId(u.id)}
                                                        className="btn"
                                                        style={{ flex: 1, background: 'rgba(212, 175, 55, 0.1)', color: 'var(--accent-gold)', border: '1px solid rgba(212, 175, 55, 0.2)', padding: '8px', fontSize: '0.8rem', borderRadius: '8px', fontWeight: 500 }}
                                                    >
                                                        🔑 Reset
                                                    </button>
                                                    <button
                                                        onClick={() => setConfirmDeleteUserId(u.id)}
                                                        className="btn btn-ghost"
                                                        style={{ color: 'var(--danger)', border: '1px solid rgba(239, 68, 68, 0.1)', padding: '8px 12px', fontSize: '0.8rem', borderRadius: '8px' }}
                                                    >
                                                        🗑
                                                    </button>
                                                </>
                                            )}
                                        </div>

                                        {u.username.toLowerCase() !== 'radev' && resetPasswordUserId === u.id && (
                                            <div style={{ display: 'flex', gap: '5px', flexDirection: 'column', background: 'rgba(212,175,55,0.05)', padding: '8px', borderRadius: '8px', border: '1px solid rgba(212,175,55,0.2)' }}>
                                                <input
                                                    type="text"
                                                    placeholder="New password (blank for Reset123!)"
                                                    value={newPasswordVal}
                                                    onChange={e => setNewPasswordVal(e.target.value)}
                                                    style={{
                                                        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
                                                        color: '#fff', borderRadius: '4px', padding: '6px 8px', fontSize: '0.8rem',
                                                        width: '100%', boxSizing: 'border-box', outline: 'none'
                                                    }}
                                                />
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                                                    <button
                                                        onClick={() => { setResetPasswordUserId(null); setNewPasswordVal(''); }}
                                                        style={{ background: 'rgba(255,255,255,0.08)', color: '#aaa', border: 'none', borderRadius: '4px', padding: '4px 12px', fontSize: '0.78rem', cursor: 'pointer' }}
                                                    >Cancel</button>
                                                    <button
                                                        onClick={() => handleResetPassword(u)}
                                                        style={{ background: 'var(--accent-gold)', color: '#000', border: 'none', borderRadius: '4px', padding: '4px 15px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 'bold' }}
                                                    >Save</button>
                                                </div>
                                            </div>
                                        )}

                                        {u.username.toLowerCase() !== 'radev' && confirmDeleteUserId === u.id && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(239,68,68,0.08)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.2)' }}>
                                                <span style={{ fontSize: '0.8rem', color: '#ff6b6b', fontWeight: 'bold' }}>Delete user?</span>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        onClick={() => setConfirmDeleteUserId(null)}
                                                        style={{ background: 'rgba(255,255,255,0.08)', color: '#aaa', border: 'none', borderRadius: '4px', padding: '4px 12px', fontSize: '0.78rem', cursor: 'pointer' }}
                                                    >No</button>
                                                    <button
                                                        onClick={() => handleDeleteUser(u)}
                                                        style={{ background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 15px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 'bold' }}
                                                    >Yes</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            ) : (
                // VIEW 2: Inspecting Specific User Data
                <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                    {/* User profile overview */}
                    <div className="glass-panel" style={{ padding: '20px 25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                            <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(212,175,55,0.1)', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.4rem' }}>
                                {selectedUser.username[0].toUpperCase()}
                            </div>
                            <div>
                                <h3 style={{ margin: 0, color: '#fff', fontSize: '1.2rem' }}>@{selectedUser.username}</h3>
                                <p style={{ margin: '3px 0 0 0', color: '#888', fontSize: '0.85rem' }}>
                                    Joined: {new Date(selectedUser.created_at).toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        {/* Subtabs toggle */}
                        <div className="glass-panel" style={{ display: 'inline-flex', padding: '4px', borderRadius: '10px', gap: '4px' }}>
                            <button
                                onClick={() => { setActiveSubTab('movies'); setExpandedCollectionId(null); }}
                                className="btn"
                                style={{
                                    background: activeSubTab === 'movies' ? 'var(--accent-gold)' : 'transparent',
                                    color: activeSubTab === 'movies' ? '#000' : '#888',
                                    borderRadius: '8px',
                                    padding: '8px 16px',
                                    fontWeight: 600,
                                    fontSize: '0.9rem'
                                }}
                            >
                                Movies ({userData.movies.length})
                            </button>
                            <button
                                onClick={() => { setActiveSubTab('collections'); setExpandedCollectionId(null); }}
                                className="btn"
                                style={{
                                    background: activeSubTab === 'collections' ? 'var(--accent-gold)' : 'transparent',
                                    color: activeSubTab === 'collections' ? '#000' : '#888',
                                    borderRadius: '8px',
                                    padding: '8px 16px',
                                    fontWeight: 600,
                                    fontSize: '0.9rem'
                                }}
                            >
                                Collections ({userData.collections.length})
                            </button>
                        </div>
                    </div>

                    {userLoading ? (
                        <div style={{ textAlign: 'center', padding: '50px', color: '#888' }}>Loading library contents...</div>
                    ) : activeSubTab === 'movies' ? (
                        // User's Movies Grid
                        userData.movies.length === 0 ? (
                            <div className="glass-panel" style={{ textAlign: 'center', padding: '50px', color: '#888' }}>
                                This user's library is empty.
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '20px' }}>
                                {userData.movies.map(movie => (
                                    <div
                                        key={movie.id}
                                        className="glass-panel movie-card animate-fade-in"
                                        onClick={() => setSelectedMovie(movie)}
                                        style={{
                                            position: 'relative', cursor: 'pointer', borderRadius: '12px',
                                            overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)',
                                            aspectRatio: '2/3', transition: 'transform 0.2s'
                                        }}
                                    >
                                        <img
                                            src={movie.poster_url}
                                            alt={movie.title}
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        />
                                        <div style={{
                                            position: 'absolute', bottom: 0, left: 0, width: '100%',
                                            padding: '20px 10px 10px', zIndex: 2,
                                            background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)'
                                        }}>
                                            <h4 style={{
                                                fontSize: '0.9rem', color: '#fff', margin: '0 0 4px 0',
                                                textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'
                                            }}>
                                                {movie.title}
                                            </h4>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: '#aaa' }}>
                                                <span>{movie.year}</span>
                                                <span style={{ color: 'var(--accent-gold)' }}>★ {movie.rating || '-'}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )
                    ) : (
                        // User's Collections List
                        userData.collections.length === 0 ? (
                            <div className="glass-panel" style={{ textAlign: 'center', padding: '50px', color: '#888' }}>
                                This user hasn't created any collections.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {userData.collections.map(c => {
                                    const isExpanded = expandedCollectionId === c.id;
                                    return (
                                        <div
                                            key={c.id}
                                            className="glass-panel animate-fade-in"
                                            style={{
                                                border: isExpanded ? '1px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.05)',
                                                borderRadius: '12px', overflow: 'hidden',
                                                transition: 'all 0.3s ease'
                                            }}
                                        >
                                            <div
                                                onClick={async () => {
                                                    if (isExpanded) {
                                                        setExpandedCollectionId(null);
                                                    } else {
                                                        setExpandedCollectionId(c.id);
                                                        // Fetch expanded collection's movies
                                                        try {
                                                            const res = await fetch(`/api/collections/${c.id}`);
                                                            if (res.ok) {
                                                                const data = await res.json();
                                                                setExpandedCollection(data);
                                                            }
                                                        } catch (err) {
                                                            console.error(err);
                                                        }
                                                    }
                                                }}
                                                style={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    padding: '20px 25px', cursor: 'pointer', background: 'rgba(255,255,255,0.01)',
                                                    flexWrap: 'wrap', gap: '15px'
                                                }}
                                                onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                                                onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'}
                                            >
                                                <div>
                                                    <h3 style={{ margin: '0 0 5px 0', fontSize: '1.2rem', color: 'var(--accent-gold)' }}>
                                                        {c.title}
                                                    </h3>
                                                    <p style={{ margin: 0, color: '#aaa', fontSize: '0.85rem' }}>
                                                        {c.description || 'No description provided.'}
                                                    </p>
                                                </div>
                                                <span style={{
                                                    background: 'rgba(212, 175, 55, 0.1)', color: 'var(--accent-gold)',
                                                    padding: '4px 10px', borderRadius: '15px', fontSize: '0.8rem', fontWeight: 'bold'
                                                }}>
                                                    {c.movie_count} Movie(s)
                                                </span>
                                            </div>

                                            {isExpanded && (
                                                <div style={{ padding: '25px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }}>
                                                    {!expandedCollection || expandedCollection.id !== c.id ? (
                                                        <div style={{ textAlign: 'center', color: '#555' }}>Loading movies...</div>
                                                    ) : expandedCollection.movies.length === 0 ? (
                                                        <div style={{ textAlign: 'center', color: '#555', fontStyle: 'italic' }}>
                                                            This collection has no movies.
                                                        </div>
                                                    ) : (
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '20px' }}>
                                                            {expandedCollection.movies.map(movie => (
                                                                <div
                                                                    key={movie.id}
                                                                    className="glass-panel movie-card"
                                                                    onClick={() => setSelectedMovie(movie)}
                                                                    style={{
                                                                        position: 'relative', cursor: 'pointer', borderRadius: '8px',
                                                                        overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)',
                                                                        aspectRatio: '2/3', transition: 'transform 0.2s'
                                                                    }}
                                                                >
                                                                    <img
                                                                        src={movie.poster_url}
                                                                        alt={movie.title}
                                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                                    />
                                                                    <div style={{
                                                                        position: 'absolute', bottom: 0, left: 0, width: '100%',
                                                                        padding: '20px 10px 10px', zIndex: 2,
                                                                        background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)'
                                                                    }}>
                                                                        <h4 style={{
                                                                            fontSize: '0.8rem', color: '#fff', margin: '0 0 2px 0',
                                                                            textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap'
                                                                        }}>
                                                                            {movie.title}
                                                                        </h4>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: '#aaa' }}>
                                                                            <span>{movie.year}</span>
                                                                            <span style={{ color: 'var(--accent-gold)' }}>★ {movie.rating || '-'}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )
                    )}
                </div>
            )}

            <style>{`
                .admin-user-row {
                    transition: background 0.2s ease;
                }
                .admin-user-row:hover {
                    background: rgba(255, 255, 255, 0.015);
                }
            `}</style>
        </div>
    );
}

export default AdminDashboard;
