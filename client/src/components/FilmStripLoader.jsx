import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const STRIP_COUNT = 25;        // карточек в ленте
const CENTER_INTERVAL_MS = 180; // смена центрального постера (0.18 сек)
const ENOUGH_MATCHES = 8;      // порог: достаточно совпадений → заполняем ленту ими

// Вспомогательная функция: строим уникальный список совпадающих постеров
function buildMatchingMovies(pool, searchQuery, liveResults) {
    if (!searchQuery || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const localMatches = pool.filter(m =>
        (m.title && m.title.toLowerCase().includes(q)) ||
        (m.original_title && m.original_title.toLowerCase().includes(q))
    );
    const combined = [...localMatches, ...liveResults];
    const uniqueMap = new Map();
    combined.forEach(m => { if (m && m.poster_url) uniqueMap.set(m.poster_url, m); });
    return Array.from(uniqueMap.values());
}

const FilmStripLoader = ({ movies = [], searchQuery = '', liveResults = [] }) => {
    const [centerIdx, setCenterIdx] = useState(0);

    // Лента (25 карточек)
    const stripPosters = useMemo(() => {
        const pool = (movies && movies.length > 0) ? movies : liveResults;
        if (!pool || pool.length === 0) return [];

        const shuffledAll = [...pool].sort(() => 0.5 - Math.random());
        const matchingMovies = buildMatchingMovies(pool, searchQuery, liveResults);
        const shuffledMatching = [...matchingMovies].sort(() => 0.5 - Math.random());

        const selection = [];

        if (matchingMovies.length === 0) {
            // Нет совпадений — всё случайное
            while (selection.length < STRIP_COUNT) {
                selection.push(shuffledAll[selection.length % shuffledAll.length]?.poster_url);
            }
        } else if (matchingMovies.length >= ENOUGH_MATCHES) {
            // Много совпадений — 1 рандомный в начале, остальное совпадающие
            selection.push(shuffledAll[0]?.poster_url);
            let mi = 0;
            while (selection.length < STRIP_COUNT) {
                selection.push(shuffledMatching[mi % shuffledMatching.length]?.poster_url);
                mi++;
            }
        } else {
            // Мало совпадений — чередуем: каждый 3-й слот совпадающий, остальные случайные
            let mi = 0;
            let ri = 0;
            while (selection.length < STRIP_COUNT) {
                if ((selection.length + 1) % 3 === 0) {
                    // каждый 3-й — из совпадающих
                    selection.push(shuffledMatching[mi % shuffledMatching.length]?.poster_url);
                    mi++;
                } else {
                    // случайный из всего пула
                    selection.push(shuffledAll[ri % shuffledAll.length]?.poster_url);
                    ri++;
                }
            }
        }

        return selection.filter(Boolean);
    }, [movies, searchQuery, liveResults]);

    // Центральный проектор (40 кадров)
    const centerPosters = useMemo(() => {
        const pool = (movies && movies.length > 0) ? movies : liveResults;
        if (!pool || pool.length === 0) return [];

        const shuffledAll = [...pool].sort(() => 0.5 - Math.random());
        const matchingMovies = buildMatchingMovies(pool, searchQuery, liveResults);
        const shuffledMatching = [...matchingMovies].sort(() => 0.5 - Math.random());

        const selection = [];
        // 3 случайных кадра в начале для реалистичного «поиска»
        selection.push(shuffledAll[0]?.poster_url);
        selection.push(shuffledAll[1]?.poster_url);
        selection.push(shuffledAll[2]?.poster_url);

        if (matchingMovies.length > 0) {
            // Чередуем: совпадающий → случайный → совпадающий → случайный...
            let mi = 0;
            let ri = 3;
            while (selection.length < 40) {
                selection.push(shuffledMatching[mi % shuffledMatching.length]?.poster_url);
                mi++;
                if (selection.length < 40) {
                    selection.push(shuffledAll[ri % shuffledAll.length]?.poster_url);
                    ri++;
                }
            }
        } else {
            let ri = 3;
            while (selection.length < 40) {
                selection.push(shuffledAll[ri % shuffledAll.length]?.poster_url);
                ri++;
            }
        }

        return selection.filter(Boolean);
    }, [movies, searchQuery, liveResults]);

    // Быстрая смена центрального постера
    useEffect(() => {
        if (centerPosters.length === 0) return;
        const interval = setInterval(() => {
            setCenterIdx(prev => (prev + 1) % centerPosters.length);
        }, CENTER_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [centerPosters.length]);

    if (stripPosters.length === 0) {
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

    const currentCenterPoster = centerPosters[centerIdx];
    const CARD_W = 160;
    const GAP = 20;
    const totalWidth = STRIP_COUNT * (CARD_W + GAP);
    const stripDuration = totalWidth / 180; // ~180px/сек

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
        }}>
            {/* Плёнка */}
            <div style={{
                position: 'absolute',
                display: 'flex',
                alignItems: 'center',
                gap: `${GAP}px`,
                animation: `filmScroll ${stripDuration}s linear infinite`,
                filter: 'drop-shadow(0 0 20px rgba(0,0,0,0.8))',
                willChange: 'transform',
            }}>
                {[...stripPosters, ...stripPosters].map((url, idx) => (
                    <div key={idx} style={{
                        position: 'relative',
                        width: `${CARD_W}px`,
                        height: '240px',
                        flexShrink: 0,
                        background: '#111',
                        border: '8px solid #000',
                        borderTopWidth: '15px',
                        borderBottomWidth: '15px',
                        borderRadius: '4px',
                        overflow: 'hidden'
                    }}>
                        {/* Перфорация сверху */}
                        <div style={{
                            position: 'absolute', top: '-12px', left: 0, right: 0,
                            display: 'flex', justifyContent: 'space-around',
                        }}>
                            {[1,2,3,4,5].map(i => <div key={i} style={{ width: '8px', height: '8px', background: '#333', borderRadius: '1px' }}></div>)}
                        </div>
                        {/* Перфорация снизу */}
                        <div style={{
                            position: 'absolute', bottom: '-12px', left: 0, right: 0,
                            display: 'flex', justifyContent: 'space-around',
                        }}>
                            {[1,2,3,4,5].map(i => <div key={i} style={{ width: '8px', height: '8px', background: '#333', borderRadius: '1px' }}></div>)}
                        </div>
                        <img src={url} alt="" style={{
                            width: '100%', height: '100%', objectFit: 'cover',
                            opacity: 0.45,
                            filter: 'sepia(30%) contrast(1.15) brightness(0.9)'
                        }} />
                    </div>
                ))}
            </div>

            {/* Центральный кадр — проектор */}
            <div style={{
                position: 'relative',
                width: '180px',
                height: '270px',
                zIndex: 10,
                background: '#000',
                border: '10px solid #111',
                borderTopWidth: '18px',
                borderBottomWidth: '18px',
                borderRadius: '6px',
                boxShadow: '0 0 50px rgba(212, 175, 55, 0.5), 0 0 100px rgba(212, 175, 55, 0.15), inset 0 0 20px rgba(212, 175, 55, 0.15)',
                overflow: 'hidden',
                flexShrink: 0,
            }}>
                {/* Перфорация центра сверху */}
                <div style={{
                    position: 'absolute', top: '-14px', left: 0, right: 0, zIndex: 2,
                    display: 'flex', justifyContent: 'space-around',
                }}>
                    {[1,2,3,4,5].map(i => <div key={i} style={{ width: '10px', height: '10px', background: '#444', borderRadius: '2px', boxShadow: '0 0 5px rgba(212, 175, 55, 0.6)' }}></div>)}
                </div>
                {/* Перфорация центра снизу */}
                <div style={{
                    position: 'absolute', bottom: '-14px', left: 0, right: 0, zIndex: 2,
                    display: 'flex', justifyContent: 'space-around',
                }}>
                    {[1,2,3,4,5].map(i => <div key={i} style={{ width: '10px', height: '10px', background: '#444', borderRadius: '2px', boxShadow: '0 0 5px rgba(212, 175, 55, 0.6)' }}></div>)}
                </div>

                {/* Постер */}
                <img
                    key={centerIdx}
                    src={currentCenterPoster}
                    alt=""
                    style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'cover',
                        opacity: 0.9,
                    }}
                />

                {/* Мерцание проектора */}
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 3,
                    background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.03) 0px, rgba(0,0,0,0.03) 1px, transparent 1px, transparent 3px)',
                    pointerEvents: 'none',
                    animation: 'projectorFlicker 0.08s steps(1) infinite',
                }} />

                {/* Иконка поиска */}
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 4,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'rgba(0,0,0,0.3)',
                }}>
                    <motion.div
                        animate={{ scale: [0.9, 1.05, 0.9], opacity: [0.7, 1, 0.7] }}
                        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
                            stroke="var(--accent-gold)" strokeWidth="2.5"
                            strokeLinecap="round" strokeLinejoin="round"
                            style={{ filter: 'drop-shadow(0 0 10px rgba(212, 175, 55, 0.9))' }}>
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                    </motion.div>
                </div>
            </div>

            <style>{`
                @keyframes filmScroll {
                    from { transform: translateX(0); }
                    to   { transform: translateX(-${totalWidth + GAP}px); }
                }
                @keyframes projectorFlicker {
                    0%   { opacity: 0; }
                    50%  { opacity: 1; }
                    100% { opacity: 0; }
                }
            `}</style>
        </div>
    );
};

export default FilmStripLoader;
