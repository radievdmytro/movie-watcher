import React, { useState, useEffect } from 'react';
import MatrixRain from './MatrixRain';
import MatrixRain2D from './MatrixRain2D';
import { APP_SLOGAN } from '../config';
import TypewriterLoader from './TypewriterLoader';

let cachedSettingsPromise = null;
let cachedSettings = null;

// Start fetching immediately when the module loads
const prefetchSettings = () => {
    if (!cachedSettingsPromise) {
        cachedSettingsPromise = fetch(`/api/settings/public?t=${Date.now()}`)
            .then(res => res.json())
            .then(data => {
                cachedSettings = data;
                return data;
            })
            .catch(err => {
                console.error('Failed to load matrix phrases:', err);
                return null;
            });
    }
    return cachedSettingsPromise;
};

// Export it so App.jsx can trigger it safely
export { prefetchSettings };

window.addEventListener('matrixSettingsUpdated', () => {
    cachedSettingsPromise = null;
    prefetchSettings();
});

function TrailerModal({ searchQuery, preloadedTrailers, onClose }) {
    const [results, setResults] = useState(() => Array.isArray(preloadedTrailers) ? preloadedTrailers : []);
    const [loading, setLoading] = useState(() => preloadedTrailers === null);
    const [error, setError] = useState(() => preloadedTrailers instanceof Error ? preloadedTrailers.message : null);
    const [activeVideoId, setActiveVideoId] = useState(null);
    const [matrixPhrases, setMatrixPhrases] = useState(['searching trailers', 'preparing video', 'please wait']);
    const [useSloganInMatrix, setUseSloganInMatrix] = useState(true);
    const [matrixAnimationType, setMatrixAnimationType] = useState('3D');
    const [settingsLoaded, setSettingsLoaded] = useState(false);
    
    const [typewriterText, setTypewriterText] = useState(() => 
        (preloadedTrailers !== undefined && preloadedTrailers !== null && !(preloadedTrailers instanceof Error))
            ? "Trailers successfully found."
            : "Searching trailers..."
    );
    const [isTypewriterExiting, setIsTypewriterExiting] = useState(false);
    const [typewriterDone, setTypewriterDone] = useState(false);

    useEffect(() => {
        prefetchSettings().then(data => {
            if (data) {
                if (data.matrixPhrases) setMatrixPhrases(data.matrixPhrases);
                if (data.useSloganInMatrix !== undefined) setUseSloganInMatrix(data.useSloganInMatrix);
                if (data.matrixAnimationType) setMatrixAnimationType(data.matrixAnimationType);
            }
        }).finally(() => setSettingsLoaded(true));
    }, []);

    useEffect(() => {
        if (!loading && results.length > 0) {
            const cardDelayMs = 180;
            const animationDurationMs = 800;
            const totalAnimationTimeMs = (results.length - 1) * cardDelayMs + animationDurationMs;
            
            // 3 seconds after all cards have appeared → full disintegration (no erase step)
            const delayMs = totalAnimationTimeMs + 3000;
            
            const disintegrateTimer = setTimeout(() => {
                setIsTypewriterDisintegrating(true);
                // charDisintegrate max: 0.8s delay + 1.55s duration ≈ 2.4s
                // pixelScatter max:    0.8s delay + 2.2s duration  ≈ 3.0s
                const doneTimer = setTimeout(() => {
                    setTypewriterDone(true);
                }, 3200);
                return () => clearTimeout(doneTimer);
            }, delayMs);
            
            return () => clearTimeout(disintegrateTimer);
        }
    }, [loading, results]);

    // Block body scrolling
    useEffect(() => {
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, []);

    useEffect(() => {
        if (preloadedTrailers !== undefined && preloadedTrailers !== null) {
            if (preloadedTrailers instanceof Error) {
                setError(preloadedTrailers.message);
                setLoading(false);
            } else {
                setResults(preloadedTrailers);
                setLoading(false);
                setError(null);
                if (preloadedTrailers.length > 0) {
                    setTypewriterText("Trailers successfully found.");
                }
            }
            return;
        }

        if (!searchQuery) return;
        
        const fetchTrailers = async () => {
            setLoading(true);
            setError(null);
            try {
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery)}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (!res.ok) throw new Error('Failed to fetch trailers');
                
                const data = await res.json();
                setResults(data.results || []);
                if (data.results && data.results.length > 0) {
                    setTypewriterText("Trailers successfully found.");
                }
            } catch (err) {
                console.error(err);
                setError('Could not load trailers at this time.');
            } finally {
                setLoading(false);
            }
        };
        
        fetchTrailers();
    }, [searchQuery, preloadedTrailers]);

    return (
        <>
            <style>{`
                @keyframes trailerFlyIn3D {
                    0% { opacity: 0; transform: scale(0.6) translateZ(-100px) translateY(50px) rotateX(-15deg); }
                    100% { opacity: 1; transform: scale(1) translateZ(0) translateY(0) rotateX(0); }
                }
                @keyframes trailerDropIn2D {
                    0% { opacity: 0; transform: translateY(-40px); }
                    100% { opacity: 1; transform: translateY(0); }
                }
            `}</style>
            <div style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000000,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '20px',
            animation: 'fadeIn 0.2s ease-out'
        }} onClick={onClose}>
            <div style={{
                background: 'rgba(25, 25, 25, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '900px',
                height: '85vh',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                overflow: 'hidden',
                animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
            }} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div style={{
                    padding: '16px 24px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(0, 0, 0, 0.2)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        {activeVideoId && (
                            <button 
                                onClick={() => setActiveVideoId(null)}
                                style={{
                                    background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    color: '#fff',
                                    borderRadius: '50%',
                                    width: '32px', height: '32px',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                title="Back to results"
                            >
                                ←
                            </button>
                        )}
                        <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#fff', fontWeight: '600' }}>
                            {activeVideoId ? 'Playing Trailer' : `Trailers`}
                        </h2>
                    </div>
                    <button 
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#888',
                            fontSize: '1.5rem',
                            cursor: 'pointer',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'color 0.2s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                        onMouseLeave={e => e.currentTarget.style.color = '#888'}
                    >×</button>
                </div>

                {/* Content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: activeVideoId ? 0 : '24px', position: 'relative' }}>
                    {activeVideoId ? (
                        <div style={{ width: '100%', height: '100%', minHeight: '500px', backgroundColor: '#000' }}>
                            <iframe 
                                width="100%" 
                                height="100%" 
                                src={`https://www.youtube.com/embed/${activeVideoId}?autoplay=1`} 
                                title="YouTube video player" 
                                frameBorder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowFullScreen
                                style={{ display: 'block', border: 'none', minHeight: '500px' }}
                            ></iframe>
                        </div>
                    ) : (
                        <>
                            {settingsLoaded && (
                                <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }}>
                                    {matrixAnimationType === '3D' ? (
                                        <MatrixRain stopping={!loading} textSource={useSloganInMatrix ? APP_SLOGAN : ''} color="var(--accent-gold)" customPhrases={matrixPhrases} />
                                    ) : (
                                        <MatrixRain2D stopping={!loading} textSource={useSloganInMatrix ? APP_SLOGAN : ''} color="var(--accent-gold)" customPhrases={matrixPhrases} />
                                    )}
                                </div>
                            )}

                            <div style={{ position: 'relative', zIndex: 1, minHeight: '100%' }}>
                                { (loading || (!error && results.length > 0)) && (
                                    <div style={{ 
                                        position: 'sticky', 
                                        top: 0, 
                                        left: 0, right: 0, 
                                        display: 'flex', 
                                        justifyContent: 'center',
                                        pointerEvents: 'none',
                                        zIndex: 10,
                                        paddingTop: '10px',
                                        paddingBottom: '20px',
                                        marginBottom: '20px',
                                        // Keep in layout even after done — just invisible
                                        opacity: typewriterDone ? 0 : 1,
                                        visibility: typewriterDone ? 'hidden' : 'visible',
                                        transition: 'opacity 0.1s'
                                    }}>
                                        <div style={{ pointerEvents: 'none', padding: '10px 20px' }}>
                                            <TypewriterLoader text={typewriterText} isDisintegrating={isTypewriterDisintegrating} />
                                        </div>
                                    </div>
                                )}

                                {error && (
                                    <div style={{ color: 'var(--danger)', textAlign: 'center', padding: '40px' }}>
                                        ⚠️ {error}
                                    </div>
                                )}

                                {!loading && !error && results.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                                        No trailers found.
                                    </div>
                                )}

                                {!loading && !error && results.length > 0 && (
                                    <div key={matrixAnimationType} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' }}>
                                    {results.map((video, index) => {
                                        const animationName = matrixAnimationType === '3D' ? 'trailerFlyIn3D' : 'trailerDropIn2D';
                                        const delay = index * 0.18;
                                        return (
                                        <div
                                            key={video.id}
                                            style={{
                                                opacity: 0,
                                                animation: `${animationName} 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) forwards`,
                                                animationDelay: `${delay}s`,
                                                height: '100%'
                                            }}
                                        >
                                            <div 
                                                onClick={() => setActiveVideoId(video.id)}
                                                style={{
                                                    background: 'rgba(0,0,0,0.3)',
                                                    borderRadius: '12px',
                                                    overflow: 'hidden',
                                                    cursor: 'pointer',
                                                    border: '1px solid rgba(255,255,255,0.05)',
                                                    transition: 'transform 0.2s, border-color 0.2s, box-shadow 0.2s',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    height: '100%'
                                                }}
                                                onMouseEnter={e => {
                                                    e.currentTarget.style.transform = 'translateY(-4px)';
                                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                                                    e.currentTarget.style.boxShadow = '0 10px 20px rgba(0,0,0,0.4)';
                                                }}
                                                onMouseLeave={e => {
                                                    e.currentTarget.style.transform = 'none';
                                                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
                                                    e.currentTarget.style.boxShadow = 'none';
                                                }}
                                            >
                                            <div style={{ position: 'relative', paddingTop: '56.25%' }}>
                                                <img 
                                                    src={video.thumbnail} 
                                                    alt={video.title}
                                                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                                <div style={{
                                                    position: 'absolute', bottom: '8px', right: '8px',
                                                    background: 'rgba(0,0,0,0.8)', color: '#fff',
                                                    padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem',
                                                    fontWeight: 'bold'
                                                }}>
                                                    {video.duration}
                                                </div>
                                            </div>
                                            <div style={{ padding: '12px', flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                <h4 style={{ 
                                                    margin: 0, color: '#fff', fontSize: '0.9rem', lineHeight: '1.4',
                                                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                                                }}>
                                                    {video.title}
                                                </h4>
                                                <div style={{ color: '#888', fontSize: '0.8rem', marginTop: 'auto', display: 'flex', justifyContent: 'space-between' }}>
                                                    <span>{video.author}</span>
                                                    <span>{video.views > 1000 ? Math.floor(video.views / 1000) + 'k views' : video.views + ' views'}</span>
                                                </div>
                                            </div>
                                            </div>
                                        </div>
                                        );
                                    })}
                                </div>
                            )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
        </>
    );
}

export default TrailerModal;
