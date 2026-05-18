import React, { useState, useEffect } from 'react';

export default function MovieComparisonModal({ isOpen, onClose, movieLinks, onAddMovie, isOwned }) {
    const [loading, setLoading] = useState(true);
    const [moviesData, setMoviesData] = useState([]);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
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

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(12px)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', animation: 'fadeIn 0.25s ease'
        }} onMouseDown={onClose}>
            <div style={{
                background: 'rgba(20, 20, 20, 0.95)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '24px',
                width: '100%',
                maxWidth: moviesData.length <= 2 ? '900px' : '1300px',
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
                overflow: 'hidden',
                animation: 'scaleUp 0.3s cubic-bezier(0.165,0.84,0.44,1)'
            }} onMouseDown={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(255,255,255,0.02)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '1.4rem' }}>⚖️</span>
                        <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: '#fff' }}>
                            Compare Movies ({movieLinks.length})
                        </h3>
                    </div>
                    <button onClick={onClose} style={{
                        background: 'transparent', border: 'none', color: '#888',
                        fontSize: '1.5rem', cursor: 'pointer', transition: 'color 0.2s'
                    }} onMouseEnter={e => e.target.style.color = '#fff'} onMouseLeave={e => e.target.style.color = '#888'}>
                        &times;
                    </button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
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
                            gridTemplateColumns: `130px repeat(${moviesData.length}, 1fr)`,
                            gap: '16px',
                            alignItems: 'stretch'
                        }}>
                            {/* Posters and Actions Row */}
                            <div style={{ color: '#888', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center' }}>Movie</div>
                            {moviesData.map((movie, idx) => {
                                const owned = isOwned(movie.link);
                                return (
                                    <div key={idx} style={{
                                        display: 'flex', flexDirection: 'column', gap: '12px',
                                        background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '16px',
                                        border: '1px solid rgba(255,255,255,0.04)', position: 'relative'
                                    }}>
                                        <img src={movie.poster_url} alt={movie.title} style={{
                                            width: '100%', height: '240px', objectFit: 'cover', borderRadius: '12px',
                                            boxShadow: '0 8px 20px rgba(0,0,0,0.4)'
                                        }} />
                                        <div style={{ flex: 1 }}>
                                            <h4 style={{ margin: '8px 0 4px', fontSize: '1.05rem', fontWeight: 600, color: '#fff', lineHeight: 1.3 }}>{movie.title}</h4>
                                            {movie.original_title && movie.original_title !== movie.title && (
                                                <div style={{ fontSize: '0.8rem', color: '#777', fontStyle: 'italic' }}>{movie.original_title}</div>
                                            )}
                                        </div>
                                        <div>
                                            {owned ? (
                                                <div style={{
                                                    background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)',
                                                    color: 'var(--accent-gold)', borderRadius: '10px', padding: '8px',
                                                    fontSize: '0.8rem', fontWeight: 600, textAlign: 'center'
                                                }}>
                                                    📍 Already in Library
                                                </div>
                                            ) : (
                                                <button onClick={() => { onAddMovie(movie.link); }} style={{
                                                    width: '100%', padding: '8px 16px', background: 'var(--accent-gold)',
                                                    border: 'none', color: '#000', borderRadius: '10px', fontSize: '0.85rem',
                                                    fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(212,175,55,0.2)'
                                                }} onMouseEnter={e => e.target.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.target.style.transform = 'translateY(0)'}>
                                                    ✚ Add to Library
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Year Row */}
                            <div style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>Year</div>
                            {moviesData.map((movie, idx) => (
                                <div key={idx} style={{ color: '#eee', fontSize: '0.9rem', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0', fontWeight: 500 }}>
                                    📆 {movie.year}
                                </div>
                            ))}

                            {/* Rating Row */}
                            <div style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>Rating</div>
                            {moviesData.map((movie, idx) => {
                                const isHighest = idx === highestRatingIdx;
                                return (
                                    <div key={idx} style={{
                                        color: isHighest ? 'var(--accent-gold)' : '#eee',
                                        fontSize: '0.95rem', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0',
                                        fontWeight: isHighest ? '700' : '500', display: 'flex', alignItems: 'center', gap: '4px'
                                    }}>
                                        ★ {movie.rating || 'N/A'} {isHighest && <span style={{ fontSize: '0.75rem', background: 'rgba(212,175,55,0.15)', padding: '2px 6px', borderRadius: '4px' }}>Highest</span>}
                                    </div>
                                );
                            })}

                            {/* Country Row */}
                            <div style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>Country</div>
                            {moviesData.map((movie, idx) => (
                                <div key={idx} style={{ color: '#eee', fontSize: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>
                                    🌍 {movie.country || 'N/A'}
                                </div>
                            ))}

                            {/* Genres Row */}
                            <div style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>Genres</div>
                            {moviesData.map((movie, idx) => (
                                <div key={idx} style={{ color: '#eee', fontSize: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0', lineHeight: 1.4 }}>
                                    🎭 {movie.genres || movie.misc || 'N/A'}
                                </div>
                            ))}

                            {/* Director Row */}
                            <div style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>Director</div>
                            {moviesData.map((movie, idx) => (
                                <div key={idx} style={{ color: '#eee', fontSize: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>
                                    🎬 {movie.director || 'N/A'}
                                </div>
                            ))}

                            {/* Duration Row */}
                            <div style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>Duration</div>
                            {moviesData.map((movie, idx) => (
                                <div key={idx} style={{ color: '#eee', fontSize: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>
                                    ⏱️ {movie.duration || 'N/A'}
                                </div>
                            ))}

                            {/* Voice Acting Row */}
                            <div style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>Voice / Translation</div>
                            {moviesData.map((movie, idx) => (
                                <div key={idx} style={{ color: '#bbb', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0', lineHeight: 1.4 }}>
                                    🗣️ {movie.voice_acting || 'N/A'}
                                </div>
                            ))}

                            {/* Actors Row */}
                            <div style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>Actors</div>
                            {moviesData.map((movie, idx) => (
                                <div key={idx} style={{ color: '#ccc', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0', lineHeight: 1.4 }}>
                                    👥 {movie.actors || 'N/A'}
                                </div>
                            ))}

                            {/* Description Row */}
                            <div style={{ color: '#888', fontSize: '0.85rem', display: 'flex', alignItems: 'flex-start', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0' }}>Description</div>
                            {moviesData.map((movie, idx) => (
                                <div key={idx} style={{
                                    color: '#aaa', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.05)', padding: '12px 0',
                                    lineHeight: 1.5, maxHeight: '160px', overflowY: 'auto', textAlign: 'justify'
                                }}>
                                    📖 {movie.description || 'No description available.'}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <style dangerouslySetInnerHTML={{__html: `
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleUp {
                    from { transform: scale(0.95); opacity: 0; }
                    to { transform: scale(1); opacity: 1; }
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}} />
        </div>
    );
}
