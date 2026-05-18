import React, { useState, useEffect } from 'react';

export default function MovieComparisonModal({ isOpen, onClose, movieLinks, onAddMovie, isOwned, getOwnedMovie, onOpenMovie }) {
    const [loading, setLoading] = useState(true);
    const [moviesData, setMoviesData] = useState([]);
    const [error, setError] = useState('');
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !movieLinks || movieLinks.length === 0) {
            setMoviesData([]);
            return;
        }

        const fetchDetails = async () => {
            setLoading(true);
            setError('');
            try {
                const token = localStorage.getItem('token');
                const promises = movieLinks.map(async (link) => {
                    const res = await fetch('/api/movies/search', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ query: link })
                    });
                    if (!res.ok) throw new Error('Failed to fetch details');
                    const json = await res.json();
                    return json.data;
                });
                const results = await Promise.all(promises);
                setMoviesData(results.filter(Boolean));
            } catch (err) {
                console.error(err);
                setError('Failed to load movie details for comparison');
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [isOpen, movieLinks]);

    if (!isOpen) return null;

    // Helper to get highest value to highlight
    const getHighestRatingIdx = () => {
        if (moviesData.length < 2) return -1;
        let max = -1;
        let maxIdx = -1;
        moviesData.forEach((m, idx) => {
            const r = parseFloat(m.rating) || 0;
            if (r > max) {
                max = r;
                maxIdx = idx;
            }
        });
        return maxIdx;
    };

    const highestRatingIdx = getHighestRatingIdx();
    const panelMaxWidth = movieLinks.length <= 2 ? '900px' : movieLinks.length === 3 ? '1300px' : '1600px';

    return (
        <div style={{
            position: 'fixed', 
            top: isMobile ? 'var(--header-h, 90px)' : 0, 
            left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 300000,
            display: 'flex', 
            alignItems: isMobile ? 'flex-start' : 'center', 
            justifyContent: 'center',
            padding: isMobile ? '12px' : '20px',
            animation: 'fadeIn 0.3s ease-out'
        }} onMouseDown={onClose}>
            <div
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                    position: 'relative',
                    width: isMobile ? '94%' : '100%',
                    maxWidth: panelMaxWidth,
                    maxHeight: isMobile ? 'calc(100vh - var(--header-h, 90px) - 24px)' : '92vh',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'scaleIn 0.35s cubic-bezier(0.165, 0.84, 0.44, 1)',
                }}
            >
                <div style={{
                    position: 'absolute',
                    top: isMobile ? '12px' : '15px',
                    right: isMobile ? '12px' : '15px',
                    zIndex: 100,
                }}>
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn btn-ghost"
                        style={{
                            fontSize: '1.2rem',
                            padding: 0,
                            width: isMobile ? '34px' : '38px',
                            height: isMobile ? '34px' : '38px',
                            borderRadius: '50%',
                            background: 'rgba(0, 0, 0, 0.65)',
                            border: '1px solid rgba(255, 255, 255, 0.25)',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                        title="Close"
                        onMouseEnter={(e) => {
                            e.currentTarget.style.border = '1px solid var(--accent-gold)';
                            e.currentTarget.style.color = 'var(--accent-gold)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.border = '1px solid rgba(255, 255, 255, 0.25)';
                            e.currentTarget.style.color = '#fff';
                        }}
                    >
                        ✕
                    </button>
                </div>

                <div
                    className="glass-panel"
                    style={{
                        width: '100%',
                        maxHeight: 'inherit',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        borderRadius: isMobile ? '20px' : '24px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                    }}
                >
                <div style={{
                    padding: isMobile ? '16px 52px 16px 18px' : '20px 56px 20px 24px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.02)',
                    flexShrink: 0,
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem' }}>⚖️</span>
                        <h3 style={{ margin: 0, fontSize: isMobile ? '1.05rem' : '1.25rem', fontWeight: 600, color: '#fff' }}>
                            Compare Movies ({movieLinks.length})
                        </h3>
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: isMobile ? '16px' : '24px' }}>
                    {loading ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', gap: '15px' }}>
                            <div style={{ width: '40px', height: '40px', border: '3px solid rgba(212,175,55,0.1)', borderTopColor: 'var(--accent-gold)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                            <div style={{ color: '#aaa', fontSize: '0.9rem' }}>Loading comparison details...</div>
                        </div>
                    ) : error ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#ff4d4d' }}>{error}</div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: isMobile ? `repeat(${moviesData.length}, 1fr)` : `130px repeat(${moviesData.length}, 1fr)`,
                            gap: isMobile ? '10px' : '16px',
                            alignItems: 'stretch'
                        }}>
                            {/* Posters and Actions Row */}
                            {!isMobile && <div style={{ color: '#888', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center' }}>Movie</div>}
                            {moviesData.map((movie, idx) => {
                                const libraryMovie = getOwnedMovie?.(movie.link) ?? null;
                                const owned = libraryMovie != null || (isOwned?.(movie.link) ?? false);
                                const canOpenDetails = owned && libraryMovie && onOpenMovie;
                                return (
                                    <div key={idx} style={{
                                        display: 'flex', flexDirection: 'column', gap: '12px',
                                        background: 'rgba(255,255,255,0.02)', padding: isMobile ? '10px' : '16px', borderRadius: '16px',
                                        border: '1px solid rgba(255,255,255,0.04)', position: 'relative'
                                    }}>
                                        <img src={movie.poster_url} alt={movie.title} style={{
                                            width: '100%', height: isMobile ? '150px' : '240px', objectFit: 'cover', borderRadius: '12px',
                                            boxShadow: '0 8px 20px rgba(0,0,0,0.4)'
                                        }} />
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{ margin: '8px 0 4px', fontSize: isMobile ? '0.9rem' : '1.05rem', fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{movie.title}</h4>
                                            {movie.original_title && movie.original_title !== movie.title && (
                                                <div style={{ fontSize: '0.75rem', color: '#777', fontStyle: 'italic' }}>{movie.original_title}</div>
                                            )}
                                        </div>
                                        <div>
                                            {canOpenDetails ? (
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenMovie(libraryMovie)}
                                                    style={{
                                                        width: '100%',
                                                        padding: isMobile ? '6px 10px' : '8px 16px',
                                                        background: 'rgba(212, 175, 55, 0.12)',
                                                        border: '1px solid rgba(212, 175, 55, 0.45)',
                                                        color: 'var(--accent-gold)',
                                                        borderRadius: '10px',
                                                        fontSize: isMobile ? '0.78rem' : '0.85rem',
                                                        fontWeight: 600,
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(212, 175, 55, 0.22)';
                                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'rgba(212, 175, 55, 0.12)';
                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                    }}
                                                >
                                                    {isMobile ? 'Подробнее' : 'Details →'}
                                                </button>
                                            ) : owned ? (
                                                <div style={{
                                                    background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)',
                                                    color: 'var(--accent-gold)', borderRadius: '10px', padding: '8px',
                                                    fontSize: isMobile ? '0.75rem' : '0.8rem', fontWeight: 600, textAlign: 'center'
                                                }}>
                                                    📍 In library
                                                </div>
                                            ) : (
                                                <button onClick={() => { onAddMovie?.(movie.link); }} style={{
                                                    width: '100%', padding: isMobile ? '6px 10px' : '8px 16px', background: 'var(--accent-gold)',
                                                    border: 'none', color: '#000', borderRadius: '10px', fontSize: isMobile ? '0.78rem' : '0.85rem',
                                                    fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(212,175,55,0.2)'
                                                }} onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.target.style.transform = 'translateY(0)'}>
                                                    ✚ Add
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Year Row */}
                            {!isMobile && <div style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>Year</div>}
                            {moviesData.map((movie, idx) => (
                                <div key={idx} style={{ color: '#eee', fontSize: isMobile ? '0.82rem' : '0.9rem', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0', fontWeight: 500 }}>
                                    📆 {movie.year}
                                </div>
                            ))}

                            {/* Rating Row */}
                            {!isMobile && <div style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>Rating</div>}
                            {moviesData.map((movie, idx) => {
                                const isHighest = idx === highestRatingIdx;
                                return (
                                    <div key={idx} style={{
                                        color: isHighest ? 'var(--accent-gold)' : '#eee',
                                        fontSize: isMobile ? '0.85rem' : '0.95rem', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0',
                                        fontWeight: isHighest ? '700' : '500', display: 'flex', alignItems: 'center', gap: '4px'
                                    }}>
                                        ★ {movie.rating || 'N/A'} {isHighest && !isMobile && <span style={{ fontSize: '0.75rem', background: 'rgba(212,175,55,0.15)', padding: '2px 6px', borderRadius: '4px' }}>Highest</span>}
                                    </div>
                                );
                            })}

                            {/* Country Row */}
                            {!isMobile && <div style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>Country</div>}
                            {moviesData.map((movie, idx) => (
                                <div key={idx} style={{ color: '#eee', fontSize: isMobile ? '0.78rem' : '0.85rem', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>
                                    🌍 {movie.country || 'N/A'}
                                </div>
                            ))}

                            {/* Genres Row */}
                            {!isMobile && <div style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>Genres</div>}
                            {moviesData.map((movie, idx) => (
                                <div key={idx} style={{ color: '#eee', fontSize: isMobile ? '0.78rem' : '0.85rem', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0', lineHeight: 1.4 }}>
                                    🎭 {movie.genres || movie.misc || 'N/A'}
                                </div>
                            ))}

                            {/* Director Row */}
                            {!isMobile && <div style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>Director</div>}
                            {moviesData.map((movie, idx) => (
                                <div key={idx} style={{ color: '#eee', fontSize: isMobile ? '0.78rem' : '0.85rem', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>
                                    🎬 {movie.director || 'N/A'}
                                </div>
                            ))}

                            {/* Duration Row */}
                            {!isMobile && <div style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>Duration</div>}
                            {moviesData.map((movie, idx) => (
                                <div key={idx} style={{ color: '#eee', fontSize: isMobile ? '0.78rem' : '0.85rem', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>
                                    ⏱️ {movie.duration || 'N/A'}
                                </div>
                            ))}

                            {/* Voice Acting Row */}
                            {!isMobile && <div style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>Voice / Translation</div>}
                            {moviesData.map((movie, idx) => (
                                <div key={idx} style={{ color: '#bbb', fontSize: isMobile ? '0.75rem' : '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0', lineHeight: 1.4 }}>
                                    🗣️ {movie.voice_acting || 'N/A'}
                                </div>
                            ))}

                            {/* Actors Row */}
                            {!isMobile && <div style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>Actors</div>}
                            {moviesData.map((movie, idx) => (
                                <div key={idx} style={{ color: '#ccc', fontSize: isMobile ? '0.75rem' : '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0', lineHeight: 1.4 }}>
                                    👥 {movie.actors || 'N/A'}
                                </div>
                            ))}

                            {/* Description Row */}
                            {!isMobile && <div style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'flex-start', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>Description</div>}
                            {moviesData.map((movie, idx) => (
                                <div key={idx} style={{
                                    color: '#aaa', fontSize: isMobile ? '0.75rem' : '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0',
                                    lineHeight: 1.5, maxHeight: isMobile ? '120px' : '160px', overflowY: 'auto', textAlign: 'justify'
                                }}>
                                    📖 {movie.description || 'No description available.'}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                </div>
            </div>
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleIn {
                    from { transform: scale(0.9) translateY(20px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}} />
        </div>
    );
}
