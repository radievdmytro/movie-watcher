import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

const FilmStripLoader = ({ movies = [] }) => {
    // Select 5 random posters from movies to show around the center.
    // If we don't have enough movies, just repeat.
    const posters = useMemo(() => {
        if (!movies || movies.length === 0) return [];
        const randomMovies = [...movies].sort(() => 0.5 - Math.random());
        // We need around 7 posters to make the strip look continuous
        const selection = [];
        for (let i = 0; i < 7; i++) {
            selection.push(randomMovies[i % randomMovies.length].poster_url);
        }
        return selection;
    }, [movies]);

    if (posters.length === 0) {
        // Fallback skeleton if no library movies at all
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                <div style={{
                    width: '50px', height: '50px',
                    border: '3px solid rgba(212, 175, 55, 0.3)',
                    borderTopColor: 'var(--accent-gold)',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }}></div>
            </div>
        );
    }

    // Always put a random library poster in the center position (index 3)
    const centerPoster = posters[3];

    return (
        <div style={{
            position: 'relative',
            width: '100%',
            height: '350px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            marginTop: '20px',
            marginBottom: '20px',
            background: 'transparent'
        }}>
            {/* The film strip container sliding left */}
            <motion.div
                initial={{ x: '15%' }}
                animate={{ x: '-15%' }}
                transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    repeatType: 'loop',
                    ease: 'linear'
                }}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    position: 'absolute',
                    filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.8))'
                }}
            >
                {posters.map((url, idx) => (
                    <div key={idx} style={{
                        position: 'relative',
                        width: '160px',
                        height: '240px',
                        flexShrink: 0,
                        background: '#111',
                        border: '8px solid #000',
                        borderTopWidth: '15px',
                        borderBottomWidth: '15px',
                        borderRadius: '4px',
                        overflow: 'hidden'
                    }}>
                        {/* Film strip perforation holes (top and bottom) */}
                        <div style={{
                            position: 'absolute', top: '-12px', left: 0, right: 0,
                            display: 'flex', justifyContent: 'space-around',
                            animation: 'flicker 0.2s infinite alternate'
                        }}>
                            {[1,2,3,4,5].map(i => <div key={i} style={{ width: '8px', height: '8px', background: '#222', borderRadius: '1px' }}></div>)}
                        </div>
                        <div style={{
                            position: 'absolute', bottom: '-12px', left: 0, right: 0,
                            display: 'flex', justifyContent: 'space-around',
                            animation: 'flicker 0.2s infinite alternate-reverse'
                        }}>
                            {[1,2,3,4,5].map(i => <div key={i} style={{ width: '8px', height: '8px', background: '#222', borderRadius: '1px' }}></div>)}
                        </div>

                        <img src={url} alt="film frame" style={{
                            width: '100%', height: '100%', objectFit: 'cover',
                            opacity: 0.5,
                            filter: 'sepia(40%) contrast(1.2)'
                        }} />
                    </div>
                ))}
            </motion.div>

            {/* Static center frame (glowing, representing the search focus) */}
            <div style={{
                position: 'relative',
                width: '180px',
                height: '270px',
                zIndex: 10,
                background: '#000',
                border: '10px solid #000',
                borderTopWidth: '18px',
                borderBottomWidth: '18px',
                borderRadius: '6px',
                boxShadow: '0 0 40px rgba(212, 175, 55, 0.4), inset 0 0 20px rgba(212, 175, 55, 0.2)',
                overflow: 'hidden'
            }}>
                <div style={{
                    position: 'absolute', top: '-14px', left: 0, right: 0,
                    display: 'flex', justifyContent: 'space-around',
                    animation: 'flicker 0.15s infinite alternate'
                }}>
                    {[1,2,3,4,5].map(i => <div key={i} style={{ width: '10px', height: '10px', background: '#333', borderRadius: '2px', boxShadow: '0 0 5px rgba(212, 175, 55, 0.5)' }}></div>)}
                </div>
                <div style={{
                    position: 'absolute', bottom: '-14px', left: 0, right: 0,
                    display: 'flex', justifyContent: 'space-around',
                    animation: 'flicker 0.15s infinite alternate-reverse'
                }}>
                    {[1,2,3,4,5].map(i => <div key={i} style={{ width: '10px', height: '10px', background: '#333', borderRadius: '2px', boxShadow: '0 0 5px rgba(212, 175, 55, 0.5)' }}></div>)}
                </div>

                <img src={centerPoster} alt="center frame" style={{
                    width: '100%', height: '100%', objectFit: 'cover',
                    opacity: 0.8,
                    filter: 'contrast(1.1)'
                }} />

                {/* Glowing Search Icon Overlay */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.4)',
                }}>
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0.5 }}
                        animate={{ scale: 1.1, opacity: 1 }}
                        transition={{ duration: 0.8, repeat: Infinity, repeatType: 'reverse' }}
                    >
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--accent-gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 8px rgba(212, 175, 55, 0.8))' }}>
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </motion.div>
                </div>
            </div>

            <style>{`
                @keyframes flicker {
                    0% { opacity: 0.8; }
                    100% { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
};

export default FilmStripLoader;
