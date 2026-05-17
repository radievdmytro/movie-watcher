import ReactDOM from 'react-dom';

function MovieDetailsModal({ movie, onClose, onUpdate, onDelete, isTrashMode, readOnly }) {
    if (!movie) return null;

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) onClose();
    };

    return ReactDOM.createPortal(
        <div
            onClick={handleBackdropClick}
            style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0, 0, 0, 0.85)',
                backdropFilter: 'blur(10px)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 11000, padding: '20px',
                animation: 'fadeIn 0.3s ease-out'
            }}
        >
            <div
                className="glass-panel"
                style={{
                    width: '100%', maxWidth: '900px', maxHeight: '90vh',
                    overflowY: 'auto', position: 'relative',
                    animation: 'scaleIn 0.35s cubic-bezier(0.165, 0.84, 0.44, 1)',
                    display: 'flex', flexDirection: 'column'
                }}
            >
                {/* Header / Close */}
                <button
                    onClick={onClose}
                    className="btn btn-ghost"
                    style={{
                        position: 'absolute', top: '15px', right: '15px',
                        fontSize: '1.5rem', zIndex: 10, padding: '5px'
                    }}
                >
                    &times;
                </button>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', padding: '40px' }}>
                    {/* Left: Poster */}
                    <div style={{ flex: '0 0 300px', maxWidth: '100%' }}>
                        <img
                            src={movie.poster_url}
                            alt={movie.title}
                            style={{
                                width: '100%', borderRadius: '12px',
                                boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                marginBottom: '20px'
                            }}
                        />

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', fontSize: '0.9rem' }}>
                            {movie.director && (
                                <div>
                                    <div style={{ color: '#666', marginBottom: '3px', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px' }}>Director</div>
                                    <div style={{ color: '#fff', lineHeight: '1.4' }}>{movie.director}</div>
                                </div>
                            )}
                            {movie.writers && (
                                <div>
                                    <div style={{ color: '#666', marginBottom: '3px', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px' }}>Writers</div>
                                    <div style={{ color: '#fff', lineHeight: '1.4' }}>{movie.writers}</div>
                                </div>
                            )}
                            {movie.actors && (
                                <div>
                                    <div style={{ color: '#666', marginBottom: '3px', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.5px' }}>Starring</div>
                                    <div style={{ color: '#fff', lineHeight: '1.4' }}>{movie.actors}</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Info */}
                    <div style={{ flex: '1', minWidth: '300px' }}>
                        <h2 style={{ fontSize: '2.4rem', margin: '0 0 5px 0', lineHeight: '1.1' }}>{movie.title}</h2>
                        {movie.original_title && (
                            <div style={{ fontSize: '1.1rem', color: '#888', marginBottom: '15px' }}>{movie.original_title}</div>
                        )}

                        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '25px', alignItems: 'center' }}>
                            <span style={{
                                background: 'var(--accent-gold)', color: '#000',
                                padding: '4px 12px', borderRadius: '4px', fontWeight: 'bold'
                            }}>
                                ★ {movie.rating || 'N/A'}
                            </span>
                            <span style={{ color: '#aaa' }}>{movie.year}</span>
                            <div style={{ width: '1px', height: '15px', background: '#444' }}></div>
                            <span style={{ color: 'var(--accent-gold)', fontSize: '0.9rem' }}>{movie.genres}</span>
                        </div>

                        <div style={{ marginBottom: '30px' }}>
                            <h4 style={{ color: '#fff', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.9rem' }}>Synopsis</h4>
                            <p style={{ color: '#ccc', lineHeight: '1.7', fontSize: '1.05rem' }}>{movie.description}</p>
                        </div>


                        {/* Actions */}
                        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginTop: 'auto' }}>
                            {readOnly ? (
                                <a
                                    href={movie.link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn"
                                    style={{
                                        background: 'var(--accent-gold)',
                                        color: '#000',
                                        padding: '12px 35px',
                                        fontSize: '1.05rem',
                                        fontWeight: 'bold',
                                        boxShadow: '0 4px 15px rgba(212, 175, 55, 0.3)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '8px'
                                    }}
                                >
                                    🎬 Watch on HDRezka
                                </a>
                            ) : !isTrashMode ? (
                                <>
                                    <button
                                        className="btn"
                                        style={{
                                            background: movie.status === 'watched' ? 'rgba(255,255,255,0.1)' : 'var(--accent-gold)',
                                            color: movie.status === 'watched' ? '#fff' : '#000',
                                            padding: '12px 25px'
                                        }}
                                        onClick={() => onUpdate(movie.id, { status: movie.status === 'want_to_watch' ? 'watched' : 'want_to_watch' })}
                                    >
                                        {movie.status === 'watched' ? 'Mark Unwatched' : 'Mark Watched'}
                                    </button>
                                    <a
                                        href={movie.link}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="btn btn-ghost"
                                        style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '12px 25px' }}
                                    >
                                        Watch on HDRezka
                                    </a>
                                    <button
                                        onClick={() => { onDelete(movie.id); onClose(); }}
                                        className="btn btn-ghost"
                                        style={{ color: 'var(--danger)', padding: '12px 25px' }}
                                    >
                                        Delete
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => { onDelete(movie.id); onClose(); }}
                                    className="btn btn-primary"
                                    style={{ background: 'var(--danger)', color: '#fff' }}
                                >
                                    Delete Permanently
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleIn { from { transform: scale(0.9) translateY(20px); opacity: 0; } to { transform: scale(1) translateY(0); opacity: 1; } }
            `}</style>
        </div>,
        document.body
    );
}

export default MovieDetailsModal;
