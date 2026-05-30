import { useState, useEffect, useMemo, useRef, useDeferredValue, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import MovieDetailsModal from './MovieDetailsModal';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { motion, AnimatePresence } from 'framer-motion';
import DigitalDisintegration from './DigitalDisintegration';

const Checkbox = ({ checked, onChange, style }) => (
    <label className="custom-checkbox" style={style} onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={checked} onChange={onChange} />
        <span className="checkmark"></span>
    </label>
);

const Histogram = ({ data, currentRange, min, max, height = 30 }) => {
    const maxCount = Math.max(...data, 1);
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', height: `${height}px`, width: '100%', gap: '1px', marginBottom: '2px', opacity: 0.6 }}>
            {data.map((count, i) => {
                const binStart = min + (i * (max - min) / data.length);
                const binEnd = min + ((i + 1) * (max - min) / data.length);
                const inRange = binEnd >= currentRange[0] && binStart <= currentRange[1];

                return (
                    <div
                        key={i}
                        style={{
                            flex: 1,
                            height: `${Math.max((count / maxCount) * 100, 5)}%`,
                            background: inRange ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)',
                            borderRadius: '1px 1px 0 0',
                            transition: 'all 0.2s'
                        }}
                    />
                );
            })}
        </div>
    );
};

const MultiSelectAutocomplete = ({ label, placeholder, options = [], selected = [], onChange, accentColor = 'var(--accent-gold)' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [dropdownRect, setDropdownRect] = useState(null);
    const containerRef = useRef(null);

    const openDropdown = () => {
        if (containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            setDropdownRect({
                top: rect.bottom,
                left: rect.left,
                width: rect.width
            });
        }
        setIsOpen(true);
    };

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setIsOpen(false);
            }
        };
        const handleScroll = () => {
            setIsOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('scroll', handleScroll, true);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('scroll', handleScroll, true);
        };
    }, []);

    const filteredOptions = (options || []).filter(opt => {
        const name = typeof opt === 'string' ? opt : opt?.name;
        return name && name.toLowerCase().includes(inputValue.toLowerCase());
    });

    const handleSelect = (opt) => {
        const name = typeof opt === 'string' ? opt : opt?.name;
        if (name) {
            if (selected.includes(name)) {
                onChange(selected.filter(item => item !== name));
            } else {
                onChange([...selected, name]);
            }
            setInputValue('');
        }
    };

    const handleRemove = (opt) => {
        onChange(selected.filter(item => item !== opt));
    };

    return (
        <div ref={containerRef} style={{ position: 'relative', width: '100%', boxSizing: 'border-box', zIndex: isOpen ? 9999 : 1 }}>
            <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{label}</span>
                {selected.length > 0 && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onChange([]); }}
                        style={{ background: 'none', border: 'none', color: accentColor, fontSize: '0.75rem', cursor: 'pointer', padding: 0 }}
                    >
                        Clear All ({selected.length})
                    </button>
                )}
            </div>

            <div
                onClick={() => openDropdown()}
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    width: '100%',
                    background: 'rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '8px 10px',
                    minHeight: '40px',
                    cursor: 'text',
                    alignItems: 'center',
                    boxSizing: 'border-box'
                }}
            >
                {/* On desktop, show selected items inside input container */}
                <div className="desktop-genres-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {selected.map(item => (
                        <span
                            key={item}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: accentColor,
                                color: '#000',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.8rem',
                                fontWeight: '500',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {item}
                            <button
                                onClick={(e) => { e.stopPropagation(); handleRemove(item); }}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    color: '#000',
                                    cursor: 'pointer',
                                    padding: '0 2px',
                                    fontSize: '0.85rem',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}
                            >&times;</button>
                        </span>
                    ))}
                </div>

                {/* On mobile, show only a count badge inside input container */}
                {selected.length > 0 && (
                    <span className="mobile-genres-row" style={{
                        display: 'none',
                        background: accentColor,
                        color: '#000',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '0.8rem',
                        fontWeight: '500',
                        marginRight: '6px',
                        whiteSpace: 'nowrap'
                    }}>
                        {selected.length} selected
                    </span>
                )}

                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        openDropdown();
                    }}
                    onFocus={() => openDropdown()}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (inputValue.trim()) {
                                handleSelect(inputValue.trim());
                            }
                        }
                    }}
                    placeholder={selected.length === 0 ? placeholder : ''}
                    style={{
                        flex: '1',
                        minWidth: '60px',
                        background: 'none',
                        border: 'none',
                        color: '#fff',
                        outline: 'none',
                        fontSize: '0.85rem',
                        padding: '2px 0'
                    }}
                />
            </div>

            {/* Mobile Chips List below the box */}
            {selected.length > 0 && (
                <div className="mobile-genres-row" style={{ display: 'none', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                    {selected.map(item => (
                        <span
                            key={item}
                            onClick={() => handleRemove(item)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                color: accentColor,
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                            }}
                        >
                            {item} &times;
                        </span>
                    ))}
                </div>
            )}

            {isOpen && dropdownRect && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        top: `${dropdownRect.top + 6}px`,
                        left: `${dropdownRect.left}px`,
                        width: `${dropdownRect.width}px`,
                        background: '#151515',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '10px',
                        maxHeight: '220px',
                        overflowY: 'auto',
                        zIndex: 999999,
                        boxShadow: '0 15px 40px rgba(0,0,0,0.7)',
                        padding: '4px 0'
                    }}
                >
                    {inputValue.trim() && (
                        <div
                            onClick={() => handleSelect(inputValue.trim())}
                            style={{
                                padding: '8px 12px',
                                color: accentColor,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontWeight: '500'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                e.currentTarget.style.color = '#fff';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = accentColor;
                            }}
                        >
                            <span>🔍</span>
                            <span>Filter by custom: <strong>"{inputValue.trim()}"</strong></span>
                        </div>
                    )}
                    {options.length === 0 ? (
                        <div style={{ padding: '12px 15px', color: '#666', fontSize: '0.8rem', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>{label === 'Directors' ? '🎬' : '🎭'}</span>
                            <span>No {label.toLowerCase()} in your library yet. Type manually to filter!</span>
                        </div>
                    ) : filteredOptions.length > 0 ? (
                        filteredOptions.slice(0, 50).map(opt => {
                            const name = typeof opt === 'string' ? opt : opt?.name;
                            const count = typeof opt === 'string' ? null : opt?.count;
                            const isSelected = selected.includes(name);
                            return (
                                <div
                                    key={name}
                                    onClick={() => handleSelect(opt)}
                                    style={{
                                        padding: '8px 12px',
                                        color: isSelected ? 'var(--accent-gold)' : '#ccc',
                                        background: isSelected ? 'rgba(212, 175, 55, 0.08)' : 'transparent',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        fontWeight: isSelected ? '500' : 'normal'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = isSelected ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255,255,255,0.05)';
                                        e.currentTarget.style.color = '#fff';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = isSelected ? 'rgba(212, 175, 55, 0.08)' : 'transparent';
                                        e.currentTarget.style.color = isSelected ? 'var(--accent-gold)' : '#ccc';
                                    }}
                                >
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{
                                            width: '14px',
                                            height: '14px',
                                            border: '1px solid rgba(255, 255, 255, 0.3)',
                                            borderRadius: '3px',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: '0.65rem',
                                            color: '#000',
                                            background: isSelected ? 'var(--accent-gold)' : 'transparent',
                                            borderColor: isSelected ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.3)'
                                        }}>
                                            {isSelected && '✓'}
                                        </span>
                                        {name}
                                    </span>
                                    {count !== null && (
                                        <span style={{ fontSize: '0.75rem', color: accentColor, opacity: 0.8 }}>
                                            {count} {count === 1 ? 'movie' : 'movies'}
                                        </span>
                                    )}
                                </div>
                            );
                        })
                    ) : !inputValue.trim() ? (
                        <div style={{ padding: '12px 15px', color: '#666', fontSize: '0.8rem', fontStyle: 'italic', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>No matches found.</span>
                        </div>
                    ) : null}
                </div>,
                document.body
            )}
        </div>
    );
};

const cleanLinkPath = (url) => {
    if (!url) return '';
    return url.toLowerCase()
        .replace(/^https?:\/\/[^\/]+/, '')
        .replace(/^\/+|\/+$/g, '')
        .split('?')[0]
        .split('#')[0];
};

const CardRatingButton = ({ movie, onUpdateRating, posterSize = 220 }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [hoverRating, setHoverRating] = useState(0);
    const currentRating = movie.user_rating;

    return (
        <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                setHoverRating(0);
            }}
            onClick={(e) => e.stopPropagation()}
            style={{
                position: 'relative',
                width: '100%',
                zIndex: 10
            }}
        >
            {isHovered && hoverRating > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '-28px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: '#1a1a1a',
                    color: '#ffd700',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    fontWeight: 'bold',
                    pointerEvents: 'none',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.6)',
                    border: '1px solid rgba(212,175,55,0.4)',
                    zIndex: 20,
                    whiteSpace: 'nowrap'
                }}>
                    {hoverRating}/10
                </div>
            )}
            <button
                className="btn"
                style={{
                    width: '100%',
                    padding: '5px 8px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    border: '1px solid',
                    background: currentRating 
                        ? 'linear-gradient(135deg, rgba(255, 223, 115, 0.3) 0%, rgba(212, 175, 55, 0.2) 100%)' 
                        : 'linear-gradient(135deg, rgba(255, 223, 115, 0.08) 0%, rgba(212, 175, 55, 0.08) 100%)',
                    borderColor: currentRating ? '#d4af37' : 'rgba(212, 175, 55, 0.35)',
                    color: currentRating ? '#ffd700' : '#ffdf73',
                    transition: 'all 0.2s ease',
                    textAlign: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '4px',
                    minHeight: '28px',
                    boxShadow: currentRating ? '0 0 10px rgba(212, 175, 55, 0.2)' : 'none'
                }}
            >
                {isHovered ? (
                    <div 
                        style={{ 
                            display: 'flex', 
                            gap: posterSize < 180 ? '1px' : '3px', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            width: '100%',
                            height: '18px'
                        }}
                    >
                        {[...Array(10)].map((_, i) => {
                            const starValue = i + 1;
                            const isLit = hoverRating ? starValue <= hoverRating : starValue <= (currentRating || 0);
                            return (
                                <span
                                    key={starValue}
                                    onMouseEnter={(e) => {
                                        e.stopPropagation();
                                        setHoverRating(starValue);
                                    }}
                                    onClick={async (e) => {
                                        e.stopPropagation();
                                        await onUpdateRating(starValue, e);
                                    }}
                                    style={{
                                        cursor: 'pointer',
                                        fontSize: posterSize < 180 ? '0.75rem' : '0.95rem',
                                        color: isLit ? '#ffd700' : 'rgba(255,255,255,0.2)',
                                        textShadow: isLit ? '0 0 6px rgba(212,175,55,0.6)' : 'none',
                                        transition: 'transform 0.1s ease',
                                        transform: hoverRating === starValue ? 'scale(1.25)' : 'scale(1)'
                                    }}
                                >
                                    ★
                                </span>
                            );
                        })}
                    </div>
                ) : (
                    <>
                        <span style={{ fontSize: '0.85rem' }}>★</span>
                        <span>{currentRating ? `Оценено: ${currentRating}/10` : 'Оценить фильм'}</span>
                    </>
                )}
            </button>
        </div>
    );
};


const GlobalHideButton = ({ link, onHide, offsetRight = 10, onHoverEnter, onHoverLeave }) => (
    <button
        type="button"
        onClick={(e) => {
            e.stopPropagation();
            onHide(link);
        }}
        title="Hide from global recommendations and search"
        style={{
            position: 'absolute',
            top: '10px',
            right: `${offsetRight}px`,
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            border: '1px solid rgba(239, 68, 68, 0.45)',
            background: 'rgba(0, 0, 0, 0.72)',
            color: '#ff6b6b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            zIndex: 18,
            fontSize: '0.95rem',
            lineHeight: 1,
            boxShadow: '0 6px 18px rgba(0, 0, 0, 0.35)',
            transition: 'transform 0.15s ease, background 0.15s ease, border-color 0.15s ease'
        }}
        onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.08)';
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.22)';
            e.currentTarget.style.borderColor = '#ef4444';
            if (onHoverEnter) onHoverEnter();
        }}
        onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.background = 'rgba(0, 0, 0, 0.72)';
            e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.45)';
            if (onHoverLeave) onHoverLeave();
        }}
    >
        🚫
    </button>
);

const posterVariants = {
    initial: i => ({ 
        x: -50 * i, 
        opacity: 1, 
        rotate: 0,
        y: 0
    }),
    animate: i => ({ 
        x: 0, 
        opacity: 1, 
        rotate: 0, 
        y: 0,
        transition: { 
            duration: 0.4,
            ease: "easeOut",
            delay: i * 0.08
        }
    })
};

const FolderCard = ({ groupName, movies, onClick }) => {
    const previews = movies.slice(0, 5);
    return (
        <motion.div 
            className="watched-folder-card" 
            onClick={onClick}
            initial="initial"
            animate="animate"
        >
            <div className="folder-header">
                <div className="folder-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                    {groupName}
                </div>
                <div className="folder-count">{movies.length}</div>
            </div>
            <div className="folder-previews">
                {previews.map((m, i) => (
                    <motion.img 
                        key={m.id || m.link || i} 
                        custom={i}
                        variants={posterVariants}
                        src={m.poster_url || 'https://via.placeholder.com/300x450?text=No+Poster'} 
                        alt="preview"
                        className="folder-preview-poster" 
                        style={{
                            marginLeft: i > 0 ? '-35px' : '0',
                            zIndex: 10 - i,
                            transition: 'none' // Prevent CSS transform transition from fighting with Framer Motion
                        }} 
                    />
                ))}
            </div>
        </motion.div>
    );
};


function MovieGrid({ movies, allMovies = movies, historyList = [], onFetchHistory, onUpdate, onDelete, selectedIds, onSelect, onSelectAll, setSelectionAnchor, deletingIds = [], trashButtonRef, isTrashMode, isWatchedView, guestLimitReached, isGuest, onRegisterClick, highlightedLink, onGuestActivity, onAddToCollectionClick, onNavigate, globalSearchQuery = '', setGlobalSearchQuery, globalSearchFields = {}, includeGlobalDb = false }) {
    const [gridRef] = useAutoAnimate({ duration: 350, easing: 'ease-out' });
    const [listRef] = useAutoAnimate({ duration: 350, easing: 'ease-out' });
    const [sortField, setSortField] = useState(() => localStorage.getItem('movieGrid_sortField') || 'created_at');
    const [sortDir, setSortDir] = useState(() => localStorage.getItem('movieGrid_sortDir') || 'desc');
    const [localRatings, setLocalRatings] = useState({});
    const [ripples, setRipples] = useState([]);

    const addRipple = (identifier, x, y, actionType = 'watched', customOpacity = null, customDuration = null) => {
        const id1 = Date.now() + Math.random();
        
        // Handle legacy boolean calls
        if (actionType === true) actionType = 'watched';
        if (actionType === false) actionType = 'unwatched';
        
        let color = '0, 255, 200'; // Vibrant Mint
        if (actionType === 'unwatched') color = '255, 120, 0';
        else if (actionType === 'add_to_library') color = '168, 85, 247'; // Purple
        else if (actionType === 'remove_from_library') color = '239, 68, 68'; // Red
        else if (actionType === 'rate') color = '255, 193, 7'; // Yellow

        const duration = customDuration || 3200;

        setRipples(prev => [...prev, { id: id1, identifier, x, y, color, delay: 0, actionType, customOpacity, customDuration: duration }]);
        setTimeout(() => {
            setRipples(prev => prev.filter(r => r.id !== id1));
        }, duration);
    };
    const [hideWatched, setHideWatched] = useState(() => {
        const stored = localStorage.getItem('movieGrid_hideWatched');
        return stored !== null ? JSON.parse(stored) : false;
    });

    const handleRatingAnimation = (e, ratingVal, movieLink, movieId) => {
        let opacity = 0.50;
        if (ratingVal === 6) opacity = 0.55;
        else if (ratingVal === 7) opacity = 0.60;
        else if (ratingVal === 8) opacity = 0.65;
        else if (ratingVal >= 9) opacity = 0.70;

        let durationOut = 1.1; // 1-5
        if (ratingVal === 6) durationOut = 1.2;
        else if (ratingVal === 7) durationOut = 1.3;
        else if (ratingVal === 8) durationOut = 1.4;
        else if (ratingVal === 9) durationOut = 1.5;
        else if (ratingVal === 10) durationOut = 1.6;

        const totalDurationMs = (0.2 + durationOut) * 1000;

        if (e && e.currentTarget) {
            const rect = e.currentTarget.getBoundingClientRect();
            const cardEl = e.currentTarget.closest('.movie-card');
            if (cardEl) {
                const cardRect = cardEl.getBoundingClientRect();
                const x = rect.left + rect.width / 2 - cardRect.left;
                const y = rect.top + rect.height / 2 - cardRect.top;
                addRipple(movieId || movieLink, x, y, 'rate', opacity, totalDurationMs * 2);
            }
        }

        setTintRatingInfo({ link: movieLink, opacity, durationOut, stage: 'in' });
        setTimeout(() => {
            setTintRatingInfo(prev => prev && prev.link === movieLink ? { ...prev, stage: 'out' } : prev);
        }, 200);
        setTimeout(() => {
            setTintRatingInfo(prev => prev && prev.link === movieLink && prev.stage === 'out' ? null : prev);
        }, totalDurationMs);
    };
    const [hideWatchedInGlobal, setHideWatchedInGlobal] = useState(() => {
        const stored = localStorage.getItem('movieGrid_hideWatchedInGlobal');
        return stored !== null ? JSON.parse(stored) : false;
    });
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    const [viewMode, setViewMode] = useState(() => localStorage.getItem('movieGrid_viewMode') || 'grid'); // 'grid' | 'table'
    const [watchedViewMode, setWatchedViewMode] = useState(() => localStorage.getItem('movieGrid_watchedViewMode') || 'folders'); // 'folders' | 'grid'
    const [activeFolder, setActiveFolder] = useState(null);

    useEffect(() => {
        if (isWatchedView && sortField === 'status') {
            setSortField('created_at');
        }
    }, [isWatchedView, sortField]);

    useEffect(() => {
        localStorage.setItem('movieGrid_sortField', sortField);
        localStorage.setItem('movieGrid_sortDir', sortDir);
        localStorage.setItem('movieGrid_hideWatched', JSON.stringify(hideWatched));
        localStorage.setItem('movieGrid_hideWatchedInGlobal', JSON.stringify(hideWatchedInGlobal));
        localStorage.setItem('movieGrid_viewMode', viewMode);
        localStorage.setItem('movieGrid_watchedViewMode', watchedViewMode);
    }, [sortField, sortDir, hideWatched, hideWatchedInGlobal, viewMode, watchedViewMode]);

    const [posterSize, setPosterSize] = useState(() => {
        return parseInt(localStorage.getItem('posterSize')) || 220;
    });
    const [selectedMovie, setSelectedMovie] = useState(null);
    const [openWithWatchedPrompt, setOpenWithWatchedPrompt] = useState(false);
    const [hoveredDescId, setHoveredDescId] = useState(null);
    const [hoveredCardLink, setHoveredCardLink] = useState(null);
    const [hoveredHideGlobalLink, setHoveredHideGlobalLink] = useState(null);
    const [hoveredButtonLink, setHoveredButtonLink] = useState(null);
    const [hoveredCheckmarkLink, setHoveredCheckmarkLink] = useState(null);
    const [clickedCheckmarkLink, setClickedCheckmarkLink] = useState(null);
    const [updatingCheckmarkLink, setUpdatingCheckmarkLink] = useState(null);
    const [justWatchedLink, setJustWatchedLink] = useState(null);
    const [justUnwatchedLink, setJustUnwatchedLink] = useState(null);
    const [tintWatchedLink, setTintWatchedLink] = useState(null);
    const [tintUnwatchedLink, setTintUnwatchedLink] = useState(null);
    const [tintRatingInfo, setTintRatingInfo] = useState(null);
    const [justAddedLink, setJustAddedLink] = useState(null);
    const [justRemovedLink, setJustRemovedLink] = useState(null);
    const [hoveredDeleteLink, setHoveredDeleteLink] = useState(null);
    const [hoveredCollectionLink, setHoveredCollectionLink] = useState(null);

    // Animation state
    const [animationPhase, setAnimationPhase] = useState(null); // 'grayscale' | 'stacking' | 'flying' | null
    const [trashButtonPos, setTrashButtonPos] = useState(null);
    const [stackPosition, setStackPosition] = useState(null);

    const filterQuery = globalSearchQuery;
    const deferredFilterQuery = useDeferredValue(filterQuery);
    const setFilterQuery = setGlobalSearchQuery || (() => {});
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [showMobileSearchSettings, setShowMobileSearchSettings] = useState(false);
    const [filterGenres, setFilterGenres] = useState(() => {
        try { const s = localStorage.getItem('mg_filterGenres'); if(s) return JSON.parse(s); } catch(e){}
        return [];
    });
    const [filterRating, setFilterRating] = useState(() => {
        try { const s = localStorage.getItem('mg_filterRating'); if(s) return JSON.parse(s); } catch(e){}
        return [0, 10];
    });
    const [filterYear, setFilterYear] = useState(() => {
        try { const s = localStorage.getItem('mg_filterYear'); if(s) return JSON.parse(s); } catch(e){}
        return [1900, new Date().getFullYear() + 2];
    });
    const [filterType, setFilterType] = useState(() => localStorage.getItem('mg_filterType') || 'all');
    const [filterUserRatingStatus, setFilterUserRatingStatus] = useState(() => localStorage.getItem('mg_filterUserRatingStatus') || 'all');
    const searchFields = globalSearchFields;

    const [isCreatingCollection, setIsCreatingCollection] = useState(false);
    const [collectionToast, setCollectionToast] = useState(null);
    
    const handleCreateCollectionFromFolder = async () => {
        if (!activeFolder || !finalDisplayMovies.length) return;
        setIsCreatingCollection(true);
        try {
            const token = localStorage.getItem('token');
            const movieIds = [];
            
            // First, ensure all movies in the folder exist in the local library
            for (const m of finalDisplayMovies) {
                if (m.id) {
                    movieIds.push(m.id);
                } else if (m.movie_link || m.link) {
                    // Movie is from history/global, we need to import it first
                    try {
                        const importRes = await fetch('/api/movies/import', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({ url: m.movie_link || m.link, hidden_from_library: true })
                        });
                        const importData = await importRes.json();
                        if (importRes.ok && importData.id) {
                            movieIds.push(importData.id);
                        } else if (importRes.status === 409) {
                            const localMovie = allMovies.find(local => local.link === (m.movie_link || m.link) || local.movie_link === (m.movie_link || m.link));
                            if (localMovie && localMovie.id) {
                                movieIds.push(localMovie.id);
                            }
                        }
                    } catch (err) {
                        console.error('Failed to import movie for collection:', err);
                    }
                }
            }

            if (movieIds.length === 0) {
                alert('Не удалось найти фильмы для добавления в подборку.');
                setIsCreatingCollection(false);
                return;
            }

            const res = await fetch('/api/collections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ 
                    title: activeFolder, 
                    description: `Фильмы, просмотренные за ${activeFolder}`,
                    movieIds
                })
            });
            if (res.ok) {
                const data = await res.json();
                if (onUpdate) onUpdate(null);
                const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
                const shareLink = `${baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl}/share/collection/${data.share_token}`;
                try {
                    await navigator.clipboard.writeText(shareLink);
                } catch(e) {
                    console.error('Failed to copy to clipboard', e);
                }
                
                setCollectionToast({
                    message: `Подборка успешно создана. Ссылка скопирована в буфер обмена!`,
                    linkText: "Перейти в подборки",
                    collectionId: data.id
                });
                
                // Auto close after 6 seconds
                setTimeout(() => setCollectionToast(null), 6000);
            } else {
                const data = await res.json().catch(() => ({}));
                alert(`Ошибка при создании подборки: ${data.error || 'Неизвестная ошибка'}`);
            }
        } catch (e) {
            console.error('Failed to create collection:', e);
            alert('Ошибка сети.');
        } finally {
            setIsCreatingCollection(false);
        }
    };

    const [showFilters, setShowFilters] = useState(false);
    const [filterRipple, setFilterRipple] = useState(null);
    const filterPanelRef = useRef(null);
    const [showAllGenres, setShowAllGenres] = useState(false);
    const [visibleCount, setVisibleCount] = useState(30);
    const sentinelRef = useRef(null);
    
    const [filterGenreMode, setFilterGenreMode] = useState(() => localStorage.getItem('mg_filterGenreMode') || 'include');
    const [availableGenres, setAvailableGenres] = useState([]);
    const [filterDirectors, setFilterDirectors] = useState(() => {
        try { const s = localStorage.getItem('mg_filterDirectors'); if(s) return JSON.parse(s); } catch(e){}
        return [];
    });
    const [filterActors, setFilterActors] = useState(() => {
        try { const s = localStorage.getItem('mg_filterActors'); if(s) return JSON.parse(s); } catch(e){}
        return [];
    });
    
    useEffect(() => {
        localStorage.setItem('mg_filterGenres', JSON.stringify(filterGenres));
        localStorage.setItem('mg_filterRating', JSON.stringify(filterRating));
        localStorage.setItem('mg_filterYear', JSON.stringify(filterYear));
        localStorage.setItem('mg_filterType', filterType);
        localStorage.setItem('mg_filterGenreMode', filterGenreMode);
        localStorage.setItem('mg_filterDirectors', JSON.stringify(filterDirectors));
        localStorage.setItem('mg_filterActors', JSON.stringify(filterActors));
        localStorage.setItem('mg_filterUserRatingStatus', filterUserRatingStatus);
    }, [filterGenres, filterRating, filterYear, filterType, filterGenreMode, filterDirectors, filterActors, filterUserRatingStatus]);

    const [availableDirectors, setAvailableDirectors] = useState([]);
    const [availableActors, setAvailableActors] = useState([]);

    // Sort state specifically for global DB browsing (separate from library sort)
    const [globalSortField, setGlobalSortField] = useState(() => localStorage.getItem('mg_globalSortField') || 'random');
    const [globalSortDir, setGlobalSortDir] = useState(() => localStorage.getItem('mg_globalSortDir') || 'desc');

    useEffect(() => { localStorage.setItem('mg_globalSortField', globalSortField); }, [globalSortField]);
    useEffect(() => { localStorage.setItem('mg_globalSortDir', globalSortDir); }, [globalSortDir]);

    // Genres list from global cache (for filter UI when browsing global DB)
    const [globalCacheGenres, setGlobalCacheGenres] = useState([]);

    const searchDb = includeGlobalDb ? 'cache' : 'library'; // 'library' or 'cache'
    const autoSwitchToCache = includeGlobalDb;
    const [cacheMoviesResults, setCacheMoviesResults] = useState([]);
    const [isCacheLoading, setIsCacheLoading] = useState(false);
    const [backgroundCacheResults, setBackgroundCacheResults] = useState([]);
    const [backgroundSearchStats, setBackgroundSearchStats] = useState(null);
    const [isBgCacheSearching, setIsBgCacheSearching] = useState(false);
    const [bgCacheOffset, setBgCacheOffset] = useState(0);
    const [hasMoreBgCache, setHasMoreBgCache] = useState(false);
    const [hasFiredLiveSearch, setHasFiredLiveSearch] = useState(false);
    const [isLiveSearching, setIsLiveSearching] = useState(false);
    const [showAutoSwitchToast, setShowAutoSwitchToast] = useState(false);
    const [globalHideError, setGlobalHideError] = useState('');
    // Track which global movie links are currently being enriched
    const [enrichingLinks, setEnrichingLinks] = useState(new Set());

    // Custom Onboarding / Cache Directory for sparse libraries
    const [onboardingCacheMovies, setOnboardingCacheMovies] = useState([]);
    const [onboardingTotal, setOnboardingTotal] = useState(null);
    const [onboardingSeed] = useState(() => Math.random().toString(36).substring(2, 15));
    const [onboardingCacheStats, setOnboardingCacheStats] = useState({ totalCached: 0 });
    const [onboardingOffset, setOnboardingOffset] = useState(0);
    const [isOnboardingLoading, setIsOnboardingLoading] = useState(false);
    const [hasMoreOnboarding, setHasMoreOnboarding] = useState(true);
    const onboardingSentinelRef = useRef(null);


    const uniqueBackgroundCacheResults = useMemo(() => {
        if (!backgroundCacheResults.length) return [];
        return backgroundCacheResults.map(m => ({ ...m, isFromCache: true }));
    }, [backgroundCacheResults]);
    const [localDeletedLinks, setLocalDeletedLinks] = useState(new Set());
    const [localHiddenGlobalLinks, setLocalHiddenGlobalLinks] = useState(new Set());
    const libraryLinks = useMemo(() => {
        return new Set(allMovies.filter(m => m.id !== null && !localDeletedLinks.has(cleanLinkPath(m.link))).map(m => cleanLinkPath(m.link)));
    }, [allMovies, localDeletedLinks]);
    const [addingLinks, setAddingLinks] = useState(new Set());
    const [addedLinks, setAddedLinks] = useState(new Set());
    const [localWatchedLinks, setLocalWatchedLinks] = useState(new Set());
    const [localUnwatchedLinks, setLocalUnwatchedLinks] = useState(new Set());

    const handleGridDelete = (id, link, forceNoConfirm = false, permanent = true, promptIfNoCollections = true) => {
        if (link) {
            setAddedLinks(prev => {
                const next = new Set(prev);
                next.delete(link);
                return next;
            });
            setLocalDeletedLinks(prev => new Set([...prev, cleanLinkPath(link)]));
        }
        if (onDelete) {
            onDelete(id, forceNoConfirm, permanent, promptIfNoCollections);
        }
    };

    const handleAddMovieFromCache = async (link, status = null) => {
        setAddingLinks(prev => new Set([...prev, link]));
        try {
            const res = await fetch('/api/movies/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: link, status })
            });
            if (res.ok || res.status === 409) {
                setAddedLinks(prev => new Set([...prev, link]));
                if (onUpdate) {
                    onUpdate(null);
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setAddingLinks(prev => {
                const next = new Set(prev);
                next.delete(link);
                return next;
            });
        }
    };

    const handleAddToCollectionGlobal = async (link) => {
        setAddingLinks(prev => new Set([...prev, link]));
        try {
            const res = await fetch('/api/movies/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: link, hidden_from_library: true })
            });
            const data = await res.json();
            if (res.ok) {
                if (onUpdate) onUpdate(null);
                if (onAddToCollectionClick) onAddToCollectionClick(data);
            } else if (res.status === 409) {
                const localMovie = allMovies.find(m => m.link === link || m.movie_link === link);
                if (localMovie && onAddToCollectionClick) onAddToCollectionClick(localMovie);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setAddingLinks(prev => {
                const next = new Set(prev);
                next.delete(link);
                return next;
            });
        }
    };

    const [hidingGlobalMovies, setHidingGlobalMovies] = useState(new Set());

    const initiateHideGlobalMovie = (link) => {
        setHidingGlobalMovies(prev => new Set([...prev, link]));
        // The actual handleHideGlobalMovie will be called by DigitalDisintegration onAnimationComplete
    };

    const handleHideGlobalMovie = async (link) => {
        const normalizedLink = cleanLinkPath(link);
        if (!normalizedLink) return;

        const prevCacheMoviesResults = cacheMoviesResults;
        const prevBackgroundCacheResults = backgroundCacheResults;
        const prevOnboardingCacheMovies = onboardingCacheMovies;

        setGlobalHideError('');
        setLocalHiddenGlobalLinks(prev => new Set([...prev, normalizedLink]));
        setCacheMoviesResults(prev => prev.filter(movie => cleanLinkPath(movie.link) !== normalizedLink));
        setBackgroundCacheResults(prev => prev.filter(movie => cleanLinkPath(movie.link) !== normalizedLink));
        setOnboardingCacheMovies(prev => prev.filter(movie => cleanLinkPath(movie.link) !== normalizedLink));

        try {
            const res = await fetch('/api/hidden-global-movies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ link })
            });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || `Hide failed with HTTP ${res.status}`);
            }
        } catch (err) {
            console.error('Failed to hide global movie:', err);
            setGlobalHideError('Could not save hidden movie. The card was restored.');
            setTimeout(() => setGlobalHideError(''), 4500);
            setLocalHiddenGlobalLinks(prev => {
                const next = new Set(prev);
                next.delete(normalizedLink);
                return next;
            });
            setCacheMoviesResults(prevCacheMoviesResults);
            setBackgroundCacheResults(prevBackgroundCacheResults);
            setOnboardingCacheMovies(prevOnboardingCacheMovies);
        }
    };

    const handleToggleAutoSwitch = (checked) => {
        // No-op since we moved this to the top bar
    };

    useEffect(() => {
        if (selectedMovie) {
            const updated = allMovies.find(m => cleanLinkPath(m.link) === cleanLinkPath(selectedMovie.link));
            if (updated && updated.id !== selectedMovie.id) {
                setSelectedMovie(updated);
            }
        }
    }, [allMovies, selectedMovie]);

    useEffect(() => {
        if (searchDb !== 'cache') {
            setCacheMoviesResults([]);
            return;
        }

        if (!deferredFilterQuery.trim()) {
            setCacheMoviesResults([]);
            return;
        }

        setIsCacheLoading(true);
        const queryParams = new URLSearchParams();
        queryParams.append('query', deferredFilterQuery);
        queryParams.append('fields', JSON.stringify(searchFields));
        const controller = new AbortController();

        const delayDebounceFn = setTimeout(() => {
            fetch(`/api/cache/search?${queryParams.toString()}`, { signal: controller.signal })
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error('Failed to fetch from global cache');
                })
                .then(data => {
                    setCacheMoviesResults(data.results || data || []);
                })
                .catch(err => {
                    if (err.name === 'AbortError') return;
                    console.error(err);
                    setCacheMoviesResults([]);
                })
                .finally(() => {
                    setIsCacheLoading(false);
                });
        }, 50); // 50ms ultra-fast debounce

        return () => {
            clearTimeout(delayDebounceFn);
            controller.abort();
        };
    }, [deferredFilterQuery, searchDb, searchFields]);

    const filteredAndSortedMovies = useMemo(() => {
        if (searchDb === 'cache') {
            return cacheMoviesResults.filter(movie => !localHiddenGlobalLinks.has(cleanLinkPath(movie.link)));
        }

        let scored = movies.map(movie => {
            let score = 0;
            if (deferredFilterQuery) {
                const q = deferredFilterQuery.toLowerCase().replace(/ё/g, 'е').trim();
                
                const matchField = (fieldValue, searchStr) => {
                    if (!fieldValue) return false;
                    const normalized = fieldValue.toString().toLowerCase().replace(/ё/g, 'е');
                    return normalized.includes(searchStr);
                };

                // Importance priority matching weights:
                // 1. Title match (most important)
                if (searchFields.title && matchField(movie.title, q)) score += 1000;
                if (searchFields.title && matchField(movie.original_title, q)) score += 800;

                // 2. Year match
                if (searchFields.year && movie.year && movie.year.toString() === q) score += 600;
                else if (searchFields.year && matchField(movie.year, q)) score += 300;

                // 4. Director match
                if (searchFields.director && matchField(movie.director, q)) score += 200;

                // 5. Actor match
                if (searchFields.actor && matchField(movie.actors, q)) score += 100;

                // 6. Description match
                if (searchFields.description && matchField(movie.description, q)) score += 50;

                // Word-by-word matches (for multi-word search queries)
                const words = q.split(/\s+/).filter(w => w.length > 1);
                if (words.length > 1) {
                    words.forEach(word => {
                        if (searchFields.title && matchField(movie.title, word)) score += 100;
                        if (searchFields.title && matchField(movie.original_title, word)) score += 80;
                        if (searchFields.year && matchField(movie.year, word)) score += 60;
                        if (searchFields.director && matchField(movie.director, word)) score += 20;
                        if (searchFields.actor && matchField(movie.actors, word)) score += 10;
                        if (searchFields.description && matchField(movie.description, word)) score += 5;
                    });
                }

                // Link/ID match
                if (movie.link) {
                    const cleanUrl = (url) => {
                        if (!url) return '';
                        return url
                            .toLowerCase()
                            .replace(/^https?:\/\/[^\/]+/, '')
                            .replace(/^\/+|\/+$/g, '')
                            .split('?')[0]
                            .split('#')[0];
                    };
                    const cleanQ = cleanUrl(q);
                    const cleanM = cleanUrl(movie.link);
                    if (cleanQ && cleanM && (cleanM.includes(cleanQ) || cleanQ.includes(cleanM))) {
                        score += 50;
                    }
                    const queryId = q.match(/\b\d{4,9}\b/)?.[0] || q.match(/(?:film|series|movie)\/(\d+)/)?.[1];
                    const movieLinkId = movie.link.toLowerCase().match(/\b\d{4,9}\b/)?.[0] || movie.link.toLowerCase().match(/(?:film|series|movie)\/(\d+)/)?.[1];
                    if (queryId && movieLinkId && queryId === movieLinkId) {
                        score += 1500;
                    }
                }
            } else {
                score = 1; // Neutral score when not searching
            }
            return { movie, score };
        });

        return scored
            .filter(item => {
                const { movie, score } = item;

                // If filterQuery is active, we only keep items that have a match score > 0
                if (deferredFilterQuery && score === 0) return false;

                // Genre Filter
                if (filterGenres.length > 0) {
                    const movieGenres = (movie.genres || '').split(',').map(g => g.trim());
                    if (filterGenreMode === 'include') {
                        if (!filterGenres.every(fg => movieGenres.includes(fg))) return false;
                    } else {
                        if (filterGenres.some(fg => movieGenres.includes(fg))) return false;
                    }
                }

                // Director Filter
                if (filterDirectors.length > 0) {
                    const movieDirectors = (movie.director || '').split(',').map(d => d.trim().toLowerCase());
                    if (!filterDirectors.some(fd => movieDirectors.includes(fd.toLowerCase()))) return false;
                }

                // Actor Filter
                if (filterActors.length > 0) {
                    const movieActors = (movie.actors || '').split(',').map(a => a.trim().toLowerCase());
                    if (!filterActors.some(fa => movieActors.includes(fa.toLowerCase()))) return false;
                }

                // Rating Filter
                const rating = parseFloat(movie.rating) || 0;
                if (rating !== 0 && (rating < filterRating[0] || rating > filterRating[1])) return false;

                // Year Filter
                if (movie.year < filterYear[0] || movie.year > filterYear[1]) return false;

                // Type Filter
                if (filterType !== 'all') {
                    const isCartoon = movie.genres?.toLowerCase().includes('мульт') ||
                        movie.genres?.toLowerCase().includes('анимац') ||
                        movie.misc?.toLowerCase().includes('мульт') ||
                        movie.misc?.toLowerCase().includes('анимац') ||
                        movie.link?.includes('/cartoons/');
                        
                    const isAnime = movie.genres?.toLowerCase().includes('аниме') ||
                        movie.misc?.toLowerCase().includes('аниме') ||
                        movie.link?.includes('/animation/');
                        
                    if (filterType === 'cartoon') {
                        if (!isCartoon) return false;
                    } else if (filterType === 'anime') {
                        if (!isAnime) return false;
                    } else if (filterType === 'movie') {
                        if (movie.type !== 'movie' || isCartoon || isAnime) return false;
                    } else if (filterType === 'series') {
                        if (movie.type !== 'series' || isCartoon || isAnime) return false;
                    }
                }

                // Status Filter
                const isMovieWatched = movie.status === 'watched' || localWatchedLinks.has(movie.link);
                if (!isWatchedView && hideWatched && isMovieWatched) return false;

                // User Rating Status Filter
                if (filterUserRatingStatus !== 'all') {
                    if (filterUserRatingStatus === 'rated' && !movie.user_rating) return false;
                    if (filterUserRatingStatus === 'unrated' && movie.user_rating) return false;
                }

                // Immediately hide from Watched View if marked unwatched locally
                if (isWatchedView && localUnwatchedLinks.has(movie.link)) return false;

                return true;
            })
            .sort((a, b) => {
                // If filterQuery is active, sort by relevance score DESC first
                if (deferredFilterQuery && b.score !== a.score) {
                    return b.score - a.score;
                }

                let valA = a.movie[sortField];
                let valB = b.movie[sortField];

                if (valA === null || valA === undefined) valA = '';
                if (valB === null || valB === undefined) valB = '';

                if (valA < valB) return sortDir === 'asc' ? -1 : 1;
                if (valA > valB) return sortDir === 'asc' ? 1 : -1;
                return 0;
            })
            .map(item => item.movie);
    }, [movies, sortField, sortDir, deferredFilterQuery, filterGenres, filterDirectors, filterActors, filterRating, filterYear, filterType, filterUserRatingStatus, filterGenreMode, hideWatched, searchDb, cacheMoviesResults, searchFields, localHiddenGlobalLinks, localUnwatchedLinks]);

    const filteredOnboardingCacheMovies = useMemo(() => {
        if (guestLimitReached) return [];

        let base = onboardingCacheMovies;
        
        if (uniqueBackgroundCacheResults.length > 0) {
            const merged = [...uniqueBackgroundCacheResults];
            const existingLinks = new Set(merged.map(m => m.link));
            base.forEach(m => {
                if (!existingLinks.has(m.link)) {
                    merged.push(m);
                    existingLinks.add(m.link);
                }
            });
            base = merged;
        }


        return base.filter(movie => {
            if (localHiddenGlobalLinks.has(cleanLinkPath(movie.link))) return false;

            // Hide Watched in Global Filter
            if (hideWatchedInGlobal) {
                const isWatched = localWatchedLinks.has(movie.link) || 
                                  allMovies.some(m => cleanLinkPath(m.link) === cleanLinkPath(movie.link) && m.status === 'watched') ||
                                  historyList.some(h => cleanLinkPath(h.movie_link) === cleanLinkPath(movie.link) && h.is_watched === 1);
                if (isWatched) return false;
            }

            // Genre Filter
            if (filterGenres.length > 0) {
                const movieGenres = (movie.genres || movie.misc || '').split(',').map(g => g.trim());
                if (filterGenreMode === 'include') {
                    if (!filterGenres.every(fg => movieGenres.includes(fg))) return false;
                } else {
                    if (filterGenres.some(fg => movieGenres.includes(fg))) return false;
                }
            }

            // Director Filter
            if (filterDirectors.length > 0) {
                const movieDirectors = (movie.director || '').split(',').map(d => d.trim().toLowerCase());
                if (!filterDirectors.some(fd => movieDirectors.includes(fd.toLowerCase()))) return false;
            }

            // Actor Filter
            if (filterActors.length > 0) {
                const movieActors = (movie.actors || '').split(',').map(a => a.trim().toLowerCase());
                if (!filterActors.some(fa => movieActors.includes(fa.toLowerCase()))) return false;
            }

            // Rating Filter
            const rating = parseFloat(movie.rating) || 0;
            if (rating !== 0 && (rating < filterRating[0] || rating > filterRating[1])) return false;

            // Year Filter
            if (movie.year < filterYear[0] || movie.year > filterYear[1]) return false;

            // Type Filter
            if (filterType !== 'all') {
                const isCartoon = movie.genres?.toLowerCase().includes('мульт') ||
                    movie.genres?.toLowerCase().includes('анимац') ||
                    movie.misc?.toLowerCase().includes('мульт') ||
                    movie.misc?.toLowerCase().includes('анимац') ||
                    movie.link?.includes('/cartoons/');
                    
                const isAnime = movie.genres?.toLowerCase().includes('аниме') ||
                    movie.misc?.toLowerCase().includes('аниме') ||
                    movie.link?.includes('/animation/');
                    
                if (filterType === 'cartoon') {
                    if (!isCartoon) return false;
                } else if (filterType === 'anime') {
                    if (!isAnime) return false;
                } else if (filterType === 'movie') {
                    if (movie.type !== 'movie' || isCartoon || isAnime) return false;
                } else if (filterType === 'series') {
                    if (movie.type !== 'series' || isCartoon || isAnime) return false;
                }
            }

            // Search query filter (if active)
            if (deferredFilterQuery && searchDb !== 'cache') {
                const q = deferredFilterQuery.toLowerCase().replace(/ё/g, 'е').trim();
                
                const matchField = (fieldValue, searchStr) => {
                    if (!fieldValue) return false;
                    const normalized = fieldValue.toString().toLowerCase().replace(/ё/g, 'е');
                    return normalized.includes(searchStr);
                };

                const titleMatch = searchFields.title && (matchField(movie.title, q) || matchField(movie.original_title, q));
                const yearMatch = searchFields.year && movie.year && movie.year.toString() === q;
                const directorMatch = searchFields.director && matchField(movie.director, q);
                const actorMatch = searchFields.actor && matchField(movie.actors, q);
                const descMatch = searchFields.description && matchField(movie.misc, q);

                let wordMatch = false;
                const words = q.split(/\s+/).filter(w => w.length > 1);
                if (words.length > 1) {
                    wordMatch = words.some(word => {
                        return (searchFields.title && (matchField(movie.title, word) || matchField(movie.original_title, word))) ||
                               (searchFields.year && matchField(movie.year, word)) ||
                               (searchFields.director && matchField(movie.director, word)) ||
                               (searchFields.actor && matchField(movie.actors, word)) ||
                               (searchFields.description && matchField(movie.misc, word));
                    });
                }

                if (!titleMatch && !yearMatch && !directorMatch && !actorMatch && !descMatch && !wordMatch && !movie.isLiveResult) {
                    return false;
                }
                
                movie._isExactMatch = titleMatch || yearMatch || directorMatch || actorMatch || descMatch || wordMatch;
            } else {
                movie._isExactMatch = true;
            }

            return true;
        });

        if (deferredFilterQuery && searchDb !== 'cache') {
            const exactMatches = [];
            const partialMatches = [];
            filtered.forEach(m => {
                if (m._isExactMatch !== false) exactMatches.push(m);
                else partialMatches.push(m);
            });
            return [...exactMatches, ...partialMatches];
        }

        return filtered;
    }, [onboardingCacheMovies, deferredFilterQuery, filterGenres, filterGenreMode, filterDirectors, filterActors, filterRating, filterYear, filterType, searchFields, uniqueBackgroundCacheResults, localHiddenGlobalLinks, hideWatchedInGlobal]);

    const folderGroups = useMemo(() => {
        if (!isWatchedView || watchedViewMode !== 'folders') return null;

        const groups = {};
        const monthNames = [
            "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
            "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
        ];

        filteredAndSortedMovies.forEach(movie => {
            const dateStr = movie.updated_at || movie.created_at;
            let groupName = "Неизвестная дата";
            let sortKey = 0;
            
            if (dateStr) {
                const d = new Date(dateStr);
                if (!isNaN(d.getTime())) {
                    groupName = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
                    sortKey = d.getFullYear() * 100 + d.getMonth();
                }
            }

            if (!groups[groupName]) {
                groups[groupName] = { name: groupName, movies: [], sortKey };
            }
            groups[groupName].movies.push(movie);
        });

        return Object.values(groups).sort((a, b) => b.sortKey - a.sortKey);
    }, [filteredAndSortedMovies, isWatchedView, watchedViewMode]);

    const finalDisplayMovies = useMemo(() => {
        if (isWatchedView && watchedViewMode === 'folders' && activeFolder) {
            const monthNames = [
                "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
                "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
            ];
            return filteredAndSortedMovies.filter(m => {
                const dateStr = m.updated_at || m.created_at;
                if (!dateStr) return activeFolder === "Неизвестная дата";
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return activeFolder === "Неизвестная дата";
                const gName = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
                return gName === activeFolder;
            });
        }
        return filteredAndSortedMovies;
    }, [filteredAndSortedMovies, isWatchedView, watchedViewMode, activeFolder]);

    const hasActiveFilter = useMemo(() => {
        return !!(
            deferredFilterQuery.trim() ||
            filterGenres.length > 0 ||
            filterType !== 'all' ||
            filterDirectors.length > 0 ||
            filterActors.length > 0 ||
            filterRating[0] > 0 ||
            filterRating[1] < 10 ||
            filterYear[0] > 1900 ||
            filterYear[1] < new Date().getFullYear() + 2
        );
    }, [deferredFilterQuery, filterGenres, filterType, filterDirectors, filterActors, filterRating, filterYear]);

    const filtersRef = useRef({
        filterGenres, filterDirectors, filterActors, filterRating, filterYear, filterType, filterGenreMode, searchFields
    });
    useEffect(() => {
        filtersRef.current = {
            filterGenres, filterDirectors, filterActors, filterRating, filterYear, filterType, filterGenreMode, searchFields
        };
    });

    const performBgSearch = useCallback((manualLimit = null) => {
        if (searchDb !== 'library') return;
        
        setIsBgCacheSearching(true);
        const queryParams = new URLSearchParams();
        const query = deferredFilterQuery.trim();
        if (query.length >= 3) {
            queryParams.append('query', query);
        }
        
        const { filterGenres, filterDirectors, filterActors, filterRating, filterYear, filterType, filterGenreMode, searchFields } = filtersRef.current;
        queryParams.append('fields', JSON.stringify(searchFields));
        if (filterGenres.length > 0) queryParams.append('genres', filterGenres.join(','));
        if (filterDirectors.length > 0) queryParams.append('directors', filterDirectors.join(','));
        if (filterActors.length > 0) queryParams.append('actors', filterActors.join(','));
        queryParams.append('ratingMin', filterRating[0]);
        queryParams.append('ratingMax', filterRating[1]);
        queryParams.append('yearMin', filterYear[0]);
        queryParams.append('yearMax', filterYear[1]);
        if (filterType !== 'all') queryParams.append('type', filterType);
        queryParams.append('genreMode', filterGenreMode);
        
        if (manualLimit) {
            queryParams.append('limit', manualLimit);
        }
        queryParams.append('offset', 0);
        
        fetch(`/api/cache/search?${queryParams.toString()}`)
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                const results = data.results || data || [];
                setBackgroundCacheResults(results);
                setBgCacheOffset(results.length);
                
                if (data.timeMs) {
                    setBackgroundSearchStats({ total: data.total, timeMs: data.timeMs });
                } else {
                    setBackgroundSearchStats(null);
                }

                if (results.length < 30) {
                    setHasMoreBgCache(false);
                    // Trigger live search immediately if initial results are insufficient
                    if (deferredFilterQuery && deferredFilterQuery.length >= 3) {
                        setHasFiredLiveSearch(true);
                        setIsLiveSearching(true);
                        queryParams.append('live', 'true');
                        fetch(`/api/cache/search?${queryParams.toString()}`)
                            .then(r => r.ok ? r.json() : [])
                            .then(liveData => {
                                const liveResults = liveData.results || liveData || [];
                                if (liveResults.length > 0) {
                                    setBackgroundCacheResults(prv => {
                                        const exist = new Set(prv.map(m => m.link));
                                        const newLive = liveResults.filter(m => !exist.has(m.link));
                                        return [...prv, ...newLive];
                                    });
                                }
                            })
                            .catch(console.error)
                            .finally(() => setIsLiveSearching(false));
                    }
                } else {
                    setHasMoreBgCache(true);
                    setHasFiredLiveSearch(false);
                }
            })
            .catch(err => {
                console.error("Bg cache search error:", err);
                setBackgroundCacheResults([]);
                setBackgroundSearchStats(null);
                setHasMoreBgCache(false);
            })
            .finally(() => {
                setIsBgCacheSearching(false);
            });
    }, [deferredFilterQuery, searchDb]);

    const loadMoreBgSearch = useCallback(() => {
        if (searchDb !== 'library' || !hasMoreBgCache || isBgCacheSearching) return;
        
        setIsBgCacheSearching(true);
        const queryParams = new URLSearchParams();
        const query = deferredFilterQuery.trim();
        if (query.length >= 3) {
            queryParams.append('query', query);
        }
        
        const { filterGenres, filterDirectors, filterActors, filterRating, filterYear, filterType, filterGenreMode, searchFields } = filtersRef.current;
        queryParams.append('fields', JSON.stringify(searchFields));
        if (filterGenres.length > 0) queryParams.append('genres', filterGenres.join(','));
        if (filterDirectors.length > 0) queryParams.append('directors', filterDirectors.join(','));
        if (filterActors.length > 0) queryParams.append('actors', filterActors.join(','));
        queryParams.append('ratingMin', filterRating[0]);
        queryParams.append('ratingMax', filterRating[1]);
        queryParams.append('yearMin', filterYear[0]);
        queryParams.append('yearMax', filterYear[1]);
        if (filterType !== 'all') queryParams.append('type', filterType);
        queryParams.append('genreMode', filterGenreMode);
        
        queryParams.append('offset', bgCacheOffset);
        
        fetch(`/api/cache/search?${queryParams.toString()}`)
            .then(res => res.ok ? res.json() : [])
            .then(data => {
                const results = data.results || data || [];
                if (results.length > 0) {
                    setBackgroundCacheResults(prev => {
                        const existingLinks = new Set(prev.map(m => m.link));
                        const newMovies = results.filter(m => !existingLinks.has(m.link));
                        return [...prev, ...newMovies];
                    });
                    setBgCacheOffset(prev => prev + results.length);
                }
                if (results.length < 30) {
                    setHasMoreBgCache(false);
                    // Check if we should trigger live search
                    if (deferredFilterQuery && !hasFiredLiveSearch) {
                        setHasFiredLiveSearch(true);
                        setIsLiveSearching(true);
                        queryParams.append('live', 'true');
                        fetch(`/api/cache/search?${queryParams.toString()}`)
                            .then(r => r.ok ? r.json() : [])
                            .then(liveData => {
                                const liveResults = liveData.results || liveData || [];
                                if (liveResults.length > 0) {
                                    setBackgroundCacheResults(prv => {
                                        const exist = new Set(prv.map(m => m.link));
                                        const newLive = liveResults.filter(m => !exist.has(m.link));
                                        return [...prv, ...newLive];
                                    });
                                }
                            })
                            .catch(console.error)
                            .finally(() => setIsLiveSearching(false));
                    }
                }
            })
            .catch(err => {
                console.error("Bg cache search error:", err);
                setHasMoreBgCache(false);
            })
            .finally(() => {
                setIsBgCacheSearching(false);
            });
    }, [deferredFilterQuery, searchDb, bgCacheOffset, hasMoreBgCache, isBgCacheSearching]);

    // Background cache search when integrated cache search is enabled (automatic for text queries)
    useEffect(() => {
        if (searchDb !== 'library') {
            setBackgroundCacheResults([]);
            setBackgroundSearchStats(null);
            return;
        }

        const query = deferredFilterQuery.trim();
        
        if (query.length === 0 && !hasActiveFilter) {
            setBackgroundCacheResults([]);
            setBackgroundSearchStats(null);
            return;
        }
        
        if (query.length < 3) {
            return; // Do not automatically search if query is too short (wait for manual button click)
        }

        const controller = new AbortController();

        const delayDebounceFn = setTimeout(() => {
            performBgSearch();
        }, 50); // Fast 50ms debounce for background search

        return () => {
            clearTimeout(delayDebounceFn);
            controller.abort();
        };
    }, [deferredFilterQuery, searchDb, hasActiveFilter, performBgSearch]);


    const { minBoundYear, maxBoundYear } = useMemo(() => {
        if (!movies.length) return { minBoundYear: 1900, maxBoundYear: new Date().getFullYear() + 2 };
        const years = movies.map(m => m.year).filter(y => y && !isNaN(y));
        if (!years.length) return { minBoundYear: 1900, maxBoundYear: new Date().getFullYear() + 2 };
        return {
            minBoundYear: Math.min(...years),
            maxBoundYear: Math.max(...years)
        };
    }, [movies]);

    const searchSuggestions = useMemo(() => {
        if (!deferredFilterQuery.trim()) return { movies: [], years: [], genres: [], directors: [], actors: [] };
        const query = deferredFilterQuery.toLowerCase().trim();

        // 1. Movies / Titles
        const activeMoviesSource = searchDb === 'cache' ? cacheMoviesResults : movies;
        const matchedMovies = searchFields.title ? activeMoviesSource.filter(m =>
            (m.title && m.title.toLowerCase().includes(query)) ||
            (m.original_title && m.original_title.toLowerCase().includes(query))
        ).slice(0, 5) : [];

        // 2. Years
        const uniqueYears = Array.from(new Set(movies.map(m => m.year).filter(y => y)));
        const matchedYears = searchFields.year ? uniqueYears.filter(y =>
            y.toString().includes(query)
        ).sort((a, b) => b - a).slice(0, 5) : [];

        // 3. Genres
        const matchedGenres = availableGenres.filter(g =>
            g && g.toLowerCase().includes(query)
        ).slice(0, 5);

        // 4. Directors
        const matchedDirectors = searchFields.director ? availableDirectors.filter(d =>
            d && d.name && d.name.toLowerCase().includes(query)
        ).slice(0, 5) : [];

        // 5. Actors
        const matchedActors = searchFields.actor ? availableActors.filter(a =>
            a && a.name && a.name.toLowerCase().includes(query)
        ).slice(0, 5) : [];

        return {
            movies: matchedMovies,
            years: matchedYears,
            genres: matchedGenres,
            directors: matchedDirectors,
            actors: matchedActors
        };
    }, [deferredFilterQuery, availableDirectors, availableActors, availableGenres, movies, searchDb, cacheMoviesResults, searchFields]);

    useEffect(() => {
        setFilterYear([minBoundYear, maxBoundYear]);
    }, [minBoundYear, maxBoundYear]);

    useEffect(() => {
        fetch('/api/genres')
            .then(res => res.json())
            .then(data => setAvailableGenres(data))
            .catch(err => console.error('Failed to fetch genres:', err));

        fetch('/api/directors')
            .then(res => res.json())
            .then(data => setAvailableDirectors(data))
            .catch(err => console.error('Failed to fetch directors:', err));

        fetch('/api/actors')
            .then(res => res.json())
            .then(data => setAvailableActors(data))
            .catch(err => console.error('Failed to fetch actors:', err));

        // Fetch global cache genres for filter panel when browsing global DB
        fetch('/api/cache/genres')
            .then(res => res.json())
            .then(data => setGlobalCacheGenres(data))
            .catch(() => {}); // Silently fail — not critical
    }, []);


    const ratingDistribution = useMemo(() => {
        const bins = new Array(20).fill(0);
        movies.forEach(m => {
            const r = parseFloat(m.rating) || 0;
            const idx = Math.min(Math.floor(r * 2), 19);
            bins[idx]++;
        });
        return bins;
    }, [movies]);

    const yearDistribution = useMemo(() => {
        const binCount = 30;
        const bins = new Array(binCount).fill(0);
        const range = maxBoundYear - minBoundYear;
        if (range <= 0) return new Array(binCount).fill(movies.length ? 1 : 0);

        movies.forEach(m => {
            if (!m.year) return;
            const ratio = (m.year - minBoundYear) / range;
            const idx = Math.min(Math.floor(ratio * binCount), binCount - 1);
            if (idx >= 0) bins[idx]++;
        });
        return bins;
    }, [movies, minBoundYear, maxBoundYear]);

    // Delete Animation Sequence
    useEffect(() => {
        if (deletingIds.length === 0) {
            setAnimationPhase(null);
            return;
        }
        setAnimationPhase('fade');
    }, [deletingIds]);

    const handleSizeChange = (e) => {
        const val = parseInt(e.target.value);
        setPosterSize(val);
        localStorage.setItem('posterSize', val);
    };

    // Reset visible count when filters change
    useEffect(() => {
        setVisibleCount(30);
    }, [filterQuery, filterGenres, filterDirectors, filterActors, filterRating, filterYear, filterType, filterGenreMode, sortField, sortDir, hideWatched, searchDb]);

    // Infinite Scroll Observer for visibleCount
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setVisibleCount(prev => prev + 30);
            }
        }, { rootMargin: '1500px', threshold: 0.1 });

        if (sentinelRef.current) {
            observer.observe(sentinelRef.current);
        }

        return () => observer.disconnect();
    }, [finalDisplayMovies.length]); // Now this is safe
    
    // Trigger loadMoreBgSearch when visibleCount hits the end
    useEffect(() => {
        if (visibleCount >= finalDisplayMovies.length && hasMoreBgCache && !isBgCacheSearching && searchDb === 'library' && backgroundCacheResults.length > 0) {
            loadMoreBgSearch();
        }
    }, [visibleCount, finalDisplayMovies.length, hasMoreBgCache, isBgCacheSearching, searchDb, backgroundCacheResults.length, loadMoreBgSearch]);

    // Helper: build directory query params from current filters
    const buildDirectoryParams = useCallback((extraOffset = 0) => {
        const params = new URLSearchParams();
        params.set('limit', '50');
        params.set('offset', extraOffset);
        params.set('seed', onboardingSeed);
        if (globalSortField !== 'random') {
            params.set('sort', globalSortField);
            params.set('order', globalSortDir);
        }
        if (filterRating[0] > 0) params.set('ratingMin', filterRating[0]);
        if (filterRating[1] < 10) params.set('ratingMax', filterRating[1]);
        // Only send year filter if user has explicitly narrowed it (not just the library default range).
        // We detect this by checking if the year values differ significantly from the library bounds.
        if (filterYear[0] > minBoundYear + 4) params.set('yearMin', filterYear[0]);
        if (filterYear[1] < maxBoundYear - 4) params.set('yearMax', filterYear[1]);
        if (filterGenres.length > 0) params.set('genres', filterGenres.join(','));
        if (filterGenreMode !== 'include') params.set('genreMode', filterGenreMode);
        if (filterDirectors.length > 0) params.set('directors', filterDirectors.join(','));
        if (filterActors.length > 0) params.set('actors', filterActors.join(','));
        if (filterType !== 'all') params.set('type', filterType);
        return params.toString();
    }, [onboardingSeed, globalSortField, globalSortDir, filterRating, filterYear, filterGenres, filterGenreMode, filterDirectors, filterActors, filterType, minBoundYear, maxBoundYear]);


    // Fetch Stats and Onboarding Cache Movies (re-fetches when filters or sort change)
    useEffect(() => {
        if (isTrashMode) return;

        const token = localStorage.getItem('token');

        // Fetch cache stats
        fetch('/api/cache/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.ok ? res.json() : { totalCached: 2500 })
            .then(data => setOnboardingCacheStats(data))
            .catch(err => console.error('Error fetching cache stats:', err));

        // Reset and fetch first page with current filters
        setOnboardingCacheMovies([]);
        setOnboardingOffset(0);
        setHasMoreOnboarding(true);
        setOnboardingTotal(null);
        setIsOnboardingLoading(true);

        const qs = buildDirectoryParams(0);
        fetch(`/api/cache/directory?${qs}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
            .then(res => res.ok ? res.json() : { movies: [], total: 0 })
            .then(data => {
                // Support both old array response and new {movies, total} response
                const movies = Array.isArray(data) ? data : (data.movies || []);
                const total = typeof data.total === 'number' ? data.total : null;
                setOnboardingCacheMovies(movies);
                setOnboardingOffset(movies.length);
                setOnboardingTotal(total);
                if (movies.length < 50) setHasMoreOnboarding(false);
            })
            .catch(err => console.error('Error fetching onboarding cache:', err))
            .finally(() => setIsOnboardingLoading(false));

    }, [movies.length, isTrashMode, buildDirectoryParams]);


    // Onboarding Infinite Scroll Observer
    useEffect(() => {
        if (isTrashMode || !hasMoreOnboarding || isOnboardingLoading) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setIsOnboardingLoading(true);
                const token = localStorage.getItem('token');
                const qs = buildDirectoryParams(onboardingOffset);
                fetch(`/api/cache/directory?${qs}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                    .then(res => res.ok ? res.json() : { movies: [], total: 0 })
                    .then(data => {
                        const newMovies = Array.isArray(data) ? data : (data.movies || []);
                        if (newMovies.length > 0) {
                            setOnboardingCacheMovies(prev => {
                                const existingLinks = new Set(prev.map(m => m.link));
                                return [...prev, ...newMovies.filter(m => !existingLinks.has(m.link))];
                            });
                            setOnboardingOffset(prev => prev + newMovies.length);
                        }
                        if (newMovies.length < 50) setHasMoreOnboarding(false);
                    })
                    .catch(err => console.error('Error loading more onboarding cache:', err))
                    .finally(() => setIsOnboardingLoading(false));
            }
        }, { rootMargin: '1500px', threshold: 0.1 });

        if (onboardingSentinelRef.current) observer.observe(onboardingSentinelRef.current);
        return () => observer.disconnect();
    }, [movies.length, isTrashMode, onboardingOffset, hasMoreOnboarding, isOnboardingLoading, buildDirectoryParams]);

    // Auto-enrichment: when a page of global movies loads, enrich the ones missing details
    useEffect(() => {
        if (!onboardingCacheMovies.length || isTrashMode) return;

        // Find movies that lack enriched data (description or genres+actors missing)
        const needsEnrich = onboardingCacheMovies
            .filter(m => !enrichingLinks.has(m.link) && (!m.genres || !m.description))
            .slice(-50) // Only check the last batch loaded
            .map(m => m.link);

        if (needsEnrich.length === 0) return;

        // Mark them as enriching
        setEnrichingLinks(prev => new Set([...prev, ...needsEnrich]));

        const token = localStorage.getItem('token');
        fetch('/api/cache/enrich-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ links: needsEnrich })
        })
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (!data || !data.results) return;
                // Merge enriched data into existing onboarding movies
                const enrichedMap = new Map();
                data.results.forEach(r => {
                    if (r.ok && r.data) enrichedMap.set(r.link, r.data);
                });
                if (enrichedMap.size === 0) return;

                setOnboardingCacheMovies(prev => prev.map(m => {
                    const enriched = enrichedMap.get(m.link);
                    if (!enriched) return m;
                    return {
                        ...m,
                        rating: enriched.rating ?? m.rating,
                        misc: enriched.genres || m.misc,
                        description: enriched.description || m.description,
                    };
                }));
            })
            .catch(() => {})
            .finally(() => {
                setEnrichingLinks(prev => {
                    const next = new Set(prev);
                    needsEnrich.forEach(l => next.delete(l));
                    return next;
                });
            });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onboardingCacheMovies.length, isTrashMode]);


    const handleSort = (field, forceDir) => {
        if (forceDir) {
            setSortField(field);
            setSortDir(forceDir);
        } else if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const isAllSelected = finalDisplayMovies.length > 0 && selectedIds.length === finalDisplayMovies.length;

    const handleSelectAll = () => {
        if (isAllSelected) {
            onSelectAll([]);
        } else {
            onSelectAll(finalDisplayMovies.map(m => m.id));
        }
    };

    const toggleSelect = (id) => {
        if (selectedIds.includes(id)) {
            const next = selectedIds.filter(sid => sid !== id);
            onSelect(next);
            if (next.length === 0) setSelectionAnchor(null);
        } else {
            onSelect([...selectedIds, id]);
        }
    };

    const handleUpdateMovie = async (id, fields) => {
        if (onUpdate) {
            await onUpdate(id, fields);
            setSelectedMovie(prev => {
                if (!prev) return null; // Prevent zombie reopening if closed
                if (prev.id === id || (id === null && fields.link && cleanLinkPath(prev.link) === cleanLinkPath(fields.link))) {
                    return { ...prev, ...fields };
                }
                return prev;
            });
        }
    };

    return (
        <div>
            {/* Auto Switch Toast */}
            {showAutoSwitchToast && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    background: 'rgba(212, 175, 55, 0.95)',
                    color: '#000',
                    padding: '14px 24px',
                    borderRadius: '12px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    animation: 'slideUp 0.3s ease-out',
                    border: '1px solid rgba(255,255,255,0.2)'
                }}>
                    <span style={{ fontSize: '1.2rem' }}>⚡</span>
                    <span>Automatically switched to Global Search (found {backgroundCacheResults.length} matches)!</span>
                    <button
                        onClick={() => setShowAutoSwitchToast(false)}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#000',
                            fontSize: '1.1rem',
                            cursor: 'pointer',
                            padding: '0 5px',
                            fontWeight: 'bold',
                            outline: 'none'
                        }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {globalHideError && (
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    background: 'rgba(239, 68, 68, 0.95)',
                    color: '#fff',
                    padding: '14px 20px',
                    borderRadius: '12px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
                    zIndex: 99999,
                    fontWeight: 'bold',
                    fontSize: '0.9rem',
                    border: '1px solid rgba(255,255,255,0.18)'
                }}>
                    {globalHideError}
                </div>
            )}

            {/* Modal for Details ... */}
            {selectedMovie && (
                <MovieDetailsModal
                    movie={selectedMovie}
                    openWithWatchedPrompt={openWithWatchedPrompt}
                    onClose={() => { setSelectedMovie(null); setOpenWithWatchedPrompt(false); }}
                    onUpdate={handleUpdateMovie}
                    onDelete={handleGridDelete}
                    isTrashMode={isTrashMode}
                    readOnly={selectedMovie.readOnly}
                    isAdded={selectedMovie ? (addedLinks.has(selectedMovie.link) || libraryLinks.has(cleanLinkPath(selectedMovie.link))) : false}
                    isWatched={selectedMovie ? (localWatchedLinks.has(selectedMovie.link) ? true : (selectedMovie.status === 'watched' || historyList.some(h => cleanLinkPath(h.movie_link) === cleanLinkPath(selectedMovie.link) && h.is_watched))) : false}
                    libMovieId={selectedMovie ? (allMovies.find(m => cleanLinkPath(m.link) === cleanLinkPath(selectedMovie.link) && m.id !== null)?.id || null) : null}
                    onAddMovie={handleAddMovieFromCache}
                    onAddToCollection={onAddToCollectionClick}
                    onToggleWatched={(link, newStatus) => {
                        if (newStatus === 'watched') {
                            setLocalWatchedLinks(prev => new Set([...prev, link]));
                            setLocalUnwatchedLinks(prev => {
                                const next = new Set(prev);
                                next.delete(link);
                                return next;
                            });
                            setJustWatchedLink(link);
                            setTimeout(() => setJustWatchedLink(null), 450);
                        } else {
                            setLocalWatchedLinks(prev => {
                                const next = new Set(prev);
                                next.delete(link);
                                return next;
                            });
                            setLocalUnwatchedLinks(prev => new Set([...prev, link]));
                            setJustUnwatchedLink(link);
                            setTimeout(() => setJustUnwatchedLink(null), 450);
                        }
                    }}
                    onRemoveMovie={async (id, link) => {
                        setAddedLinks(prev => {
                            const next = new Set(prev);
                            next.delete(link);
                            return next;
                        });
                        setLocalDeletedLinks(prev => new Set([...prev, cleanLinkPath(link)]));
                        try {
                            const res = await fetch(`/api/trash/${id}`, { method: 'DELETE' });
                            if (res.ok && typeof onUpdate === 'function') {
                                onUpdate(null);
                            }
                        } catch (e) { console.error(e); }
                    }}
                    onHideMovie={handleHideGlobalMovie}
                    isSelected={selectedMovie.id ? (selectedIds ? selectedIds.includes(selectedMovie.id) : false) : false}
                    onSelectToggle={selectedMovie.id && selectedIds && onSelect ? () => {
                        if (selectedIds.includes(selectedMovie.id)) {
                            onSelect(selectedIds.filter(sid => sid !== selectedMovie.id));
                        } else {
                            onSelect([...selectedIds, selectedMovie.id]);
                        }
                    } : undefined}
                />
            )}

            <>
                <div className="controls-top-bar sticky-search-bar" style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '15px' }}>
                    {/* Row 1: Super Compact Controls AND Filters */}
                    <div className="compact-controls-row" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        flexWrap: 'wrap',
                        justifyContent: 'space-between'
                    }}>
                        {/* Left Controls */}
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {/* Type Switcher */}
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '15px', padding: '2px', border: '1px solid rgba(255,255,255,0.1)', order: isMobile ? 1 : 'unset' }}>
                            {[
                                { id: 'all', label: 'All' },
                                { id: 'movie', label: 'Movies' },
                                { id: 'series', label: 'Series' },
                                { id: 'cartoon', label: 'Cartoons' },
                                { id: 'anime', label: 'Anime' }
                            ].map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => setFilterType(type.id)}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: '13px',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        border: 'none',
                                        background: filterType === type.id ? 'var(--accent-gold)' : 'transparent',
                                        color: filterType === type.id ? '#000' : '#888',
                                        fontWeight: '500',
                                        transition: 'all 0.2s',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {type.label}
                                </button>
                            ))}
                        </div>
                        
                        {/* User Rating Status Switcher */}
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '15px', padding: '2px', border: '1px solid rgba(255,255,255,0.1)', order: isMobile ? 4 : 'unset' }}>
                            {[
                                { id: 'rated', label: 'Rated' },
                                { id: 'unrated', label: 'Unrated' }
                            ].map(status => (
                                <button
                                    key={status.id}
                                    onClick={() => setFilterUserRatingStatus(prev => prev === status.id ? 'all' : status.id)}
                                    style={{
                                        padding: '4px 10px',
                                        borderRadius: '13px',
                                        fontSize: '0.75rem',
                                        cursor: 'pointer',
                                        border: 'none',
                                        background: filterUserRatingStatus === status.id ? 'var(--accent-gold)' : 'transparent',
                                        color: filterUserRatingStatus === status.id ? '#000' : '#888',
                                        fontWeight: '500',
                                        transition: 'all 0.2s',
                                        whiteSpace: 'nowrap'
                                    }}
                                >
                                    {status.label}
                                </button>
                            ))}
                        </div>


                        {isMobile && <div style={{ flexBasis: '100%', height: 0, order: 3 }}></div>}
                        </div>

                        {/* Right Controls */}
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', flex: isMobile ? 1 : 'unset' }}>
                        {/* View settings (Size & Grid/List Toggle) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', order: isMobile ? 2 : 'unset' }}>
                            {/* Poster Size (Desktop only) */}
                            {viewMode === 'grid' && (
                                <div className="desktop-genres-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginRight: '5px' }}>
                                    <span style={{ fontSize: '0.75rem', color: '#666' }}>Size:</span>
                                    <input
                                        type="range" min="150" max="400" value={posterSize} onChange={handleSizeChange}
                                        style={{ accentColor: 'var(--accent-gold)', width: '60px', cursor: 'pointer' }}
                                    />
                                </div>
                            )}

                            {/* View Mode Toggle */}
                            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '15px', padding: '2px', border: '1px solid rgba(255,255,255,0.1)' }}>
                                {isWatchedView && (
                                    <button
                                        onClick={() => { setWatchedViewMode('folders'); setViewMode('grid'); }}
                                        style={{
                                            padding: '4px 8px',
                                            borderRadius: '13px',
                                            border: 'none',
                                            cursor: 'pointer',
                                            background: watchedViewMode === 'folders' ? 'var(--accent-gold)' : 'transparent',
                                            color: watchedViewMode === 'folders' ? '#000' : '#888',
                                            display: 'flex',
                                            alignItems: 'center',
                                            transition: 'all 0.2s'
                                        }}
                                        title="Folders View"
                                    >
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                    </button>
                                )}
                                <button
                                    onClick={() => { if(isWatchedView) setWatchedViewMode('grid'); setViewMode('grid'); }}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '13px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: viewMode === 'grid' && (!isWatchedView || watchedViewMode === 'grid') ? 'var(--accent-gold)' : 'transparent',
                                        color: viewMode === 'grid' && (!isWatchedView || watchedViewMode === 'grid') ? '#000' : '#888',
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                    title="Grid View"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                                </button>
                                <button
                                    onClick={() => { if(isWatchedView) setWatchedViewMode('grid'); setViewMode('table'); }}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '13px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: viewMode === 'table' && (!isWatchedView || watchedViewMode === 'grid') ? 'var(--accent-gold)' : 'transparent',
                                        color: viewMode === 'table' && (!isWatchedView || watchedViewMode === 'grid') ? '#000' : '#888',
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                    title="Table View"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                                </button>
                            </div>
                        </div>

                        {/* Hide/Show Watched Controls */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', order: isMobile ? 5 : 'unset' }}>
                            <button
                                onClick={() => setHideWatched(!hideWatched)}
                                disabled={isWatchedView}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '4px 8px',
                                    borderRadius: '15px',
                                    fontSize: '0.75rem',
                                    fontWeight: '500',
                                    cursor: isWatchedView ? 'not-allowed' : 'pointer',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: isWatchedView ? 'rgba(255,255,255,0.02)' : hideWatched ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255,255,255,0.05)',
                                    color: isWatchedView ? '#555' : hideWatched ? 'var(--accent-gold)' : '#888',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap',
                                    opacity: isWatchedView ? 0.5 : 1
                                }}
                            >
                                {hideWatched ? (
                                    <>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                                        <span>{isMobile ? 'Watched' : 'Hide Watched'}</span>
                                    </>
                                ) : (
                                    <>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                                        <span>{isMobile ? 'Watched' : 'Show Watched'}</span>
                                    </>
                                )}
                            </button>

                            <label style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.75rem',
                                color: hideWatchedInGlobal ? 'var(--accent-gold)' : '#888',
                                cursor: isWatchedView ? 'not-allowed' : 'pointer',
                                opacity: (!hideWatched || guestLimitReached) ? 0 : (isWatchedView ? 0.5 : 1),
                                visibility: (!hideWatched || guestLimitReached) ? 'hidden' : 'visible',
                                pointerEvents: (!hideWatched || guestLimitReached) ? 'none' : 'auto',
                                transition: 'color 0.2s'
                            }} title="Also hide watched movies in global search">
                                <input
                                    type="checkbox"
                                    checked={hideWatchedInGlobal}
                                    onChange={(e) => setHideWatchedInGlobal(e.target.checked)}
                                    disabled={isWatchedView}
                                    style={{ accentColor: 'var(--accent-gold)' }}
                                />
                                {isMobile ? 'Global' : 'in Global DB'}
                            </label>
                        </div>
                        {/* Filters Button (Right aligned inside Right Controls) */}
                        <div style={{ display: 'flex', order: isMobile ? 10 : 'unset' }}>
                            <button
                                className="btn btn-ghost"
                                onClick={(e) => {
                                    if (!showFilters && filterPanelRef.current) {
                                        const rect = filterPanelRef.current.getBoundingClientRect();
                                        setFilterRipple({
                                            x: e.clientX - rect.left,
                                            y: e.clientY - rect.top,
                                            id: Date.now()
                                        });
                                    }
                                    setShowFilters(!showFilters);
                                }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '8px',
                                    color: showFilters || filterGenres.length > 0 || filterRating[0] > 0 || filterRating[1] < 10 || filterDirectors.length > 0 || filterActors.length > 0 ? 'var(--accent-gold)' : 'inherit',
                                    background: showFilters ? 'rgba(212, 175, 55, 0.1)' : 'transparent',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '20px',
                                    padding: '8px 15px',
                                    flexShrink: 0
                                }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                                <span>Filters</span>
                                {(filterGenres.length > 0 || filterDirectors.length > 0 || filterActors.length > 0) && (
                                    <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>
                                        ({filterGenres.length + filterDirectors.length + filterActors.length})
                                    </span>
                                )}
                            </button>
                        </div>
                        </div>
                    </div>
                    {/* Expanded Filters Panel */}
                    <div ref={filterPanelRef} className={`expanded-filters-panel ${showFilters ? 'is-open' : ''}`} style={{ position: 'relative' }}>
                        {filterRipple && showFilters && (
                            <div className="filter-edge-glow" style={{ '--click-x': `${filterRipple.x}px`, '--click-y': `${filterRipple.y}px` }} key={`edge-${filterRipple.id}`} onAnimationEnd={() => setFilterRipple(null)} />
                        )}

                        <div className="filters-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                            gap: '20px',
                            marginBottom: '20px'
                        }}>
                            {/* Genre Selection */}
                            <div style={{ gridColumn: '1 / -1' }}>
                                {/* When browsing global DB (no search query), show global genres; else show library genres */}
                                {((!deferredFilterQuery && globalCacheGenres.length > 0) ? globalCacheGenres : availableGenres).length === 0 ? (
                                    <div style={{ color: '#888', fontSize: '0.9rem', fontStyle: 'italic', padding: '15px 0', textAlign: 'center', lineHeight: '1.5' }}>
                                        Список жанров формируется из вашей личной коллекции. Добавьте свои первые фильмы, чтобы увидеть и попробовать удобную фильтрацию!
                                    </div>
                                ) : (

                                    <>
                                        {/* Desktop Genres */}
                                        <div className="desktop-genres-row">
                                    <div style={{
                                        fontSize: '0.85rem', color: '#888', marginBottom: '10px',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                    }}>
                                        <span>Genres</span>
                                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '15px', padding: '2px' }}>
                                            <button
                                                onClick={() => setFilterGenreMode('include')}
                                                style={{
                                                    padding: '2px 10px', fontSize: '0.7rem', borderRadius: '13px', border: 'none', cursor: 'pointer',
                                                    background: filterGenreMode === 'include' ? 'var(--accent-gold)' : 'transparent',
                                                    color: filterGenreMode === 'include' ? '#000' : '#888',
                                                    transition: 'all 0.2s'
                                                }}
                                            >Include</button>
                                            <button
                                                onClick={() => setFilterGenreMode('exclude')}
                                                style={{
                                                    padding: '2px 10px', fontSize: '0.7rem', borderRadius: '13px', border: 'none', cursor: 'pointer',
                                                    background: filterGenreMode === 'exclude' ? 'var(--danger)' : 'transparent',
                                                    color: filterGenreMode === 'exclude' ? '#fff' : '#888',
                                                    transition: 'all 0.2s'
                                                }}
                                            >Exclude</button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                        {(() => {
                                            const activeGenres = (!deferredFilterQuery && globalCacheGenres.length > 0) ? globalCacheGenres : availableGenres;
                                            return (showAllGenres ? activeGenres : activeGenres.slice(0, 15)).map(genre => {
                                                const isSelected = filterGenres.includes(genre);
                                                return (
                                                    <button
                                                        key={genre}
                                                        onClick={() => setFilterGenres(isSelected ? filterGenres.filter(g => g !== genre) : [...filterGenres, genre])}
                                                        style={{
                                                            padding: '4px 12px', borderRadius: '15px', fontSize: '0.8rem', cursor: 'pointer',
                                                            background: isSelected ? (filterGenreMode === 'include' ? 'var(--accent-gold)' : 'var(--danger)') : 'rgba(255,255,255,0.05)',
                                                            color: isSelected ? (filterGenreMode === 'include' ? '#000' : '#fff') : '#888',
                                                            border: isSelected ? `1px solid ${filterGenreMode === 'include' ? 'var(--accent-gold)' : 'var(--danger)'}` : '1px solid rgba(255,255,255,0.1)',
                                                            transition: 'all 0.2s'
                                                        }}
                                                    >
                                                        {genre}
                                                    </button>
                                                );
                                            });
                                        })()}
                                        {((!deferredFilterQuery && globalCacheGenres.length > 0) ? globalCacheGenres : availableGenres).length > 15 && (
                                            <button
                                                onClick={() => setShowAllGenres(!showAllGenres)}
                                                style={{
                                                    padding: '4px 12px', borderRadius: '15px', fontSize: '0.8rem', cursor: 'pointer',
                                                    background: 'transparent',
                                                    color: 'var(--accent-gold)',
                                                    border: '1px dashed var(--accent-gold)',
                                                    transition: 'all 0.2s'
                                                }}
                                            >
                                                {showAllGenres ? 'Show Less' : `+${((!deferredFilterQuery && globalCacheGenres.length > 0) ? globalCacheGenres : availableGenres).length - 15} More`}
                                            </button>
                                        )}
                                    </div>

                                </div>

                                {/* Mobile Genres Dropdown */}
                                <div className="mobile-genres-row" style={{ display: 'none', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.85rem', color: '#888' }}>Genres</span>
                                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '15px', padding: '2px' }}>
                                            <button
                                                onClick={() => setFilterGenreMode('include')}
                                                style={{
                                                    padding: '2px 10px', fontSize: '0.7rem', borderRadius: '13px', border: 'none', cursor: 'pointer',
                                                    background: filterGenreMode === 'include' ? 'var(--accent-gold)' : 'transparent',
                                                    color: filterGenreMode === 'include' ? '#000' : '#888'
                                                }}
                                            >Include</button>
                                            <button
                                                onClick={() => setFilterGenreMode('exclude')}
                                                style={{
                                                    padding: '2px 10px', fontSize: '0.7rem', borderRadius: '13px', border: 'none', cursor: 'pointer',
                                                    background: filterGenreMode === 'exclude' ? 'var(--danger)' : 'transparent',
                                                    color: filterGenreMode === 'exclude' ? '#fff' : '#888'
                                                }}
                                            >Exclude</button>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <select
                                            value=""
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val) {
                                                    if (filterGenres.includes(val)) {
                                                        setFilterGenres(filterGenres.filter(g => g !== val));
                                                    } else {
                                                        setFilterGenres([...filterGenres, val]);
                                                    }
                                                }
                                            }}
                                            style={{
                                                flex: 1,
                                                background: 'rgba(255,255,255,0.05)',
                                                border: '1px solid rgba(255,255,255,0.1)',
                                                borderRadius: '12px',
                                                color: '#fff',
                                                padding: '6px 12px',
                                                fontSize: '0.85rem',
                                                outline: 'none',
                                                cursor: 'pointer',
                                                WebkitAppearance: 'none',
                                                MozAppearance: 'none',
                                                appearance: 'none',
                                                paddingRight: '30px',
                                                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23d4af37' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                                backgroundRepeat: 'no-repeat',
                                                backgroundPosition: 'calc(100% - 10px) 50%'
                                            }}
                                        >
                                            <option value="" disabled style={{ background: '#151515', color: '#666' }}>Toggle Genres...</option>
                                            {((!deferredFilterQuery && globalCacheGenres.length > 0) ? globalCacheGenres : availableGenres).map(genre => (
                                                <option
                                                    key={genre}
                                                    value={genre}
                                                    style={{
                                                        background: '#151515',
                                                        color: filterGenres.includes(genre) ? 'var(--accent-gold)' : '#fff'
                                                    }}
                                                >
                                                    {filterGenres.includes(genre) ? `✓ ${genre}` : genre}
                                                </option>
                                            ))}
                                        </select>
                                        {filterGenres.length > 0 && (
                                            <button
                                                onClick={() => setFilterGenres([])}
                                                style={{
                                                    background: 'rgba(255,255,255,0.05)',
                                                    border: '1px solid rgba(255,255,255,0.1)',
                                                    borderRadius: '12px',
                                                    color: 'var(--accent-gold)',
                                                    padding: '6px 12px',
                                                    fontSize: '0.85rem',
                                                    cursor: 'pointer',
                                                    flexShrink: 0
                                                }}
                                            >
                                                Clear ({filterGenres.length})
                                            </button>
                                        )}
                                    </div>
                                    {filterGenres.length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                                            {filterGenres.map(genre => (
                                                <span
                                                    key={genre}
                                                    onClick={() => setFilterGenres(filterGenres.filter(g => g !== genre))}
                                                    style={{
                                                        padding: '2px 8px',
                                                        background: filterGenreMode === 'include' ? 'rgba(212, 175, 55, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                        border: `1px solid ${filterGenreMode === 'include' ? 'rgba(212, 175, 55, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                                                        borderRadius: '10px',
                                                        fontSize: '0.75rem',
                                                        color: '#fff',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: '4px'
                                                    }}
                                                >
                                                    {genre} &times;
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                    </>
                                )}
                            </div>

                            {/* Rating & Year Row */}
                            <div className="mobile-row-layout" style={{ gridColumn: '1 / -1', display: 'contents' }}>
                                {/* Rating Range */}
                                <div>
                                    <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Rating</span>
                                        <span style={{ color: 'var(--accent-gold)' }}>{filterRating[0]} - {filterRating[1]}</span>
                                    </div>
                                    <div className="mobile-hide-histogram">
                                        <Histogram data={ratingDistribution} currentRange={filterRating} min={0} max={10} />
                                    </div>
                                    <div className="range-slider-container">
                                        <div style={{
                                            position: 'absolute',
                                            height: '2px',
                                            background: 'var(--accent-gold)',
                                            left: `${(filterRating[0] / 10) * 100}%`,
                                            right: `${100 - (filterRating[1] / 10) * 100}%`,
                                            zIndex: 1
                                        }} />
                                        <input
                                            type="range" min="0" max="10" step="0.1" value={filterRating[0]}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                setFilterRating([Math.min(val, filterRating[1]), filterRating[1]]);
                                            }}
                                        />
                                        <input
                                            type="range" min="0" max="10" step="0.1" value={filterRating[1]}
                                            onChange={(e) => {
                                                const val = parseFloat(e.target.value);
                                                setFilterRating([filterRating[0], Math.max(val, filterRating[0])]);
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Year Range */}
                                <div>
                                    <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                        <span>Year</span>
                                        <span style={{ color: 'var(--accent-gold)' }}>{filterYear[0]} - {filterYear[1]}</span>
                                    </div>
                                    <div className="mobile-hide-histogram">
                                        <Histogram data={yearDistribution} currentRange={filterYear} min={minBoundYear} max={maxBoundYear} />
                                    </div>
                                    <div className="range-slider-container">
                                        <div style={{
                                            position: 'absolute',
                                            height: '2px',
                                            background: 'var(--accent-gold)',
                                            left: `${((filterYear[0] - minBoundYear) / (maxBoundYear - minBoundYear || 1)) * 100}%`,
                                            right: `${100 - ((filterYear[1] - minBoundYear) / (maxBoundYear - minBoundYear || 1)) * 100}%`,
                                            zIndex: 1
                                        }} />
                                        <input
                                            type="range" min={minBoundYear} max={maxBoundYear} value={filterYear[0]}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                setFilterYear([Math.min(val, filterYear[1]), filterYear[1]]);
                                            }}
                                        />
                                        <input
                                            type="range" min={minBoundYear} max={maxBoundYear} value={filterYear[1]}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                setFilterYear([filterYear[0], Math.max(val, filterYear[0])]);
                                            }}
                                        />
                                    </div>
                                </div>
                            </div>
                            {/* Global DB Sort Controls - shown only when browsing global database without search query */}
                            {!deferredFilterQuery && (
                                <div style={{ gridColumn: '1 / -1', marginTop: '4px' }}>
                                    <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span>Сортировка глобальной базы</span>
                                        {globalSortField !== 'random' && (
                                            <button onClick={() => { setGlobalSortField('random'); setGlobalSortDir('desc'); }}
                                                style={{ fontSize: '0.7rem', color: '#888', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                                                Сбросить
                                            </button>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {[
                                            { key: 'random', label: '🎲 Случайный' },
                                            { key: 'rating', label: '⭐ Рейтинг' },
                                            { key: 'year', label: '📅 Год' },
                                            { key: 'title', label: '🔤 Название' },
                                        ].map(({ key, label }) => (
                                            <button
                                                key={key}
                                                onClick={() => {
                                                    if (globalSortField === key && key !== 'random') {
                                                        setGlobalSortDir(d => d === 'asc' ? 'desc' : 'asc');
                                                    } else {
                                                        setGlobalSortField(key);
                                                        setGlobalSortDir(key === 'title' ? 'asc' : 'desc');
                                                    }
                                                }}
                                                style={{
                                                    padding: '5px 14px',
                                                    fontSize: '0.8rem',
                                                    borderRadius: '20px',
                                                    border: '1px solid',
                                                    borderColor: globalSortField === key ? 'var(--accent-gold)' : 'rgba(255,255,255,0.1)',
                                                    background: globalSortField === key ? 'rgba(212,175,55,0.15)' : 'rgba(255,255,255,0.03)',
                                                    color: globalSortField === key ? 'var(--accent-gold)' : '#aaa',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    fontWeight: globalSortField === key ? '600' : '400',
                                                }}
                                            >
                                                {label}
                                                {globalSortField === key && key !== 'random' && (
                                                    <span style={{ marginLeft: '4px' }}>{globalSortDir === 'asc' ? '↑' : '↓'}</span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Reset Actions */}
                            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: '15px' }}>

                                <button
                                    className="btn-primary"
                                    onClick={() => performBgSearch()}
                                    style={{ fontSize: '0.85rem', cursor: 'pointer', padding: '6px 16px', borderRadius: '20px', background: 'var(--accent-gold)', color: '#000', border: 'none', fontWeight: 'bold' }}
                                >
                                    🔍 Искать
                                </button>
                                <button
                                    className="btn-ghost"
                                    onClick={() => setShowFilters(false)}
                                    style={{ fontSize: '0.85rem', textDecoration: 'underline', cursor: 'pointer', color: '#888' }}
                                >Collapse Filters</button>
                                <button
                                    className="btn-ghost"
                                    onClick={() => {
                                        setFilterGenres([]);
                                        setFilterRating([0, 10]);
                                        setFilterYear([minBoundYear, maxBoundYear]);
                                        setFilterQuery('');
                                        setFilterType('all');
                                        setFilterGenreMode('include');
                                        setFilterDirectors([]);
                                        setFilterActors([]);
                                        setBackgroundCacheResults([]);
                                        setBackgroundSearchStats(null);
                                    }}
                                    style={{ fontSize: '0.85rem', textDecoration: 'underline', cursor: 'pointer' }}
                                >Reset All Filters</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="controls-section-rest" style={{ marginBottom: '25px' }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        width: '100%',
                        flexWrap: isMobile ? 'nowrap' : 'wrap',
                        gap: '10px'
                    }}>
                        {/* Left Side: Select All */}
                        <label
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#aaa', flexShrink: 0 }}
                            onMouseDown={(e) => setSelectionAnchor({ x: e.clientX, y: e.clientY })}
                        >
                            <Checkbox checked={isAllSelected} onChange={handleSelectAll} />
                            <span style={{ fontSize: '0.9rem' }}>Select All ({finalDisplayMovies.length})</span>
                        </label>

                        {/* Right Side: Desktop Tabs / Mobile Select */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end', flex: isMobile ? '1' : 'initial' }}>
                            <div className="desktop-sort-tabs" style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 10px' }}></div>

                            <div className="sort-tabs-row desktop-sort-tabs" style={{ gap: '8px' }}>
                                <span style={{ color: '#666', flexShrink: 0 }}>Sort:</span>
                                {['created_at', 'rating', 'user_rating', 'year', 'title', 'status']
                                    .filter(field => !(field === 'status' && isWatchedView))
                                    .map(field => (
                                    <button key={field} className="btn-ghost" style={{ color: sortField === field ? 'var(--accent-gold)' : 'inherit', padding: '0 5px', fontSize: '0.9rem' }}
                                        onClick={() => handleSort(field)}
                                    >{field === 'status' ? 'Watched' : field === 'user_rating' ? 'My Rating' : field.charAt(0).toUpperCase() + field.slice(1).replace('_', ' ')} {sortField === field && (sortDir === 'asc' ? '↑' : '↓')}</button>
                                ))}
                            </div>

                            <div className="mobile-sort-select" style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end', width: '100%' }}>
                                <span style={{ color: '#666', fontSize: '0.85rem', flexShrink: 0 }}>Sort:</span>
                                <select
                                    value={`${sortField}-${sortDir}`}
                                    onChange={(e) => {
                                        const [field, dir] = e.target.value.split('-');
                                        handleSort(field, dir);
                                    }}
                                    style={{
                                        background: 'rgba(255,255,255,0.05)',
                                        border: '1px solid rgba(255,255,255,0.1)',
                                        borderRadius: '12px',
                                        color: '#fff',
                                        padding: '6px 12px',
                                        fontSize: '0.85rem',
                                        outline: 'none',
                                        cursor: 'pointer',
                                        WebkitAppearance: 'none',
                                        MozAppearance: 'none',
                                        appearance: 'none',
                                        paddingRight: '30px',
                                        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23d4af37' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'calc(100% - 10px) 50%',
                                        maxWidth: '160px'
                                    }}
                                >
                                    <option value="created_at-desc" style={{ background: '#151515', color: '#fff' }}>Added (Newest)</option>
                                    <option value="created_at-asc" style={{ background: '#151515', color: '#fff' }}>Added (Oldest)</option>
                                    <option value="rating-desc" style={{ background: '#151515', color: '#fff' }}>Rating (High to Low)</option>
                                    <option value="rating-asc" style={{ background: '#151515', color: '#fff' }}>Rating (Low to High)</option>
                                    <option value="user_rating-desc" style={{ background: '#151515', color: '#fff' }}>My Rating (High to Low)</option>
                                    <option value="user_rating-asc" style={{ background: '#151515', color: '#fff' }}>My Rating (Low to High)</option>
                                    <option value="year-desc" style={{ background: '#151515', color: '#fff' }}>Year (Newest)</option>
                                    <option value="year-asc" style={{ background: '#151515', color: '#fff' }}>Year (Oldest)</option>
                                    <option value="title-asc" style={{ background: '#151515', color: '#fff' }}>Title (A-Z)</option>
                                    <option value="title-desc" style={{ background: '#151515', color: '#fff' }}>Title (Z-A)</option>
                                    {!isWatchedView && <option value="status-desc" style={{ background: '#151515', color: '#fff' }}>Watched Status (Watched First)</option>}
                                    {!isWatchedView && <option value="status-asc" style={{ background: '#151515', color: '#fff' }}>Watched Status (Unwatched First)</option>}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </>

            {viewMode === 'grid' ? (
                <AnimatePresence mode="wait">
                {isWatchedView && watchedViewMode === 'folders' && !activeFolder ? (
                    <motion.div 
                        key="folders-grid"
                        className="folder-grid"
                        exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                    >
                        {folderGroups?.map(group => (
                            <FolderCard 
                                key={group.name} 
                                groupName={group.name} 
                                movies={group.movies} 
                                onClick={() => setActiveFolder(group.name)} 
                            />
                        ))}
                    </motion.div>
                ) : (
                <motion.div 
                    key="movies-grid"
                    initial={isWatchedView && watchedViewMode === 'folders' && activeFolder ? { height: 0, opacity: 0 } : false}
                    animate={isWatchedView && watchedViewMode === 'folders' && activeFolder ? { height: 'auto', opacity: 1 } : {}}
                    transition={{ duration: 0.4, ease: "easeInOut" }}
                    style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}
                >
                    {/* Collection creation toast */}
                    {collectionToast && (
                        <div style={{
                            position: 'absolute',
                            top: '10px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: 'rgba(20, 20, 25, 0.95)',
                            border: '1px solid var(--accent-gold)',
                            borderRadius: '12px',
                            padding: '12px 24px',
                            boxShadow: '0 8px 30px rgba(0,0,0,0.5), 0 0 15px rgba(212, 175, 55, 0.2)',
                            zIndex: 100,
                            display: 'flex',
                            alignItems: 'center',
                            gap: '15px',
                            color: '#fff',
                            fontSize: '0.95rem',
                            animation: 'slideDownFadeIn 0.3s ease-out forwards'
                        }}>
                            <div>
                                <span style={{ marginRight: '8px' }}>✅</span>
                                {collectionToast.message}
                            </div>
                            <button
                                onClick={() => {
                                    setCollectionToast(null);
                                    if (onNavigate) {
                                        localStorage.setItem('animateCollectionId', collectionToast.collectionId);
                                        onNavigate('collections');
                                    }
                                }}
                                style={{
                                    background: 'var(--accent-gold)',
                                    color: '#000',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '6px 12px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    fontSize: '0.85rem'
                                }}
                            >
                                {collectionToast.linkText}
                            </button>
                            <button 
                                onClick={() => setCollectionToast(null)}
                                style={{ background: 'transparent', border: 'none', color: '#999', cursor: 'pointer', fontSize: '1.2rem', padding: '0 5px' }}
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {isWatchedView && watchedViewMode === 'folders' && activeFolder && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', flexWrap: 'wrap', marginBottom: '25px', gap: '20px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                <button className="folder-back-btn" onClick={() => setActiveFolder(null)}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                    {isMobile ? 'Назад' : 'Вернуться к папкам'}
                                </button>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '2.2rem', lineHeight: 1 }}>📁</span>
                                    <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 'bold', color: '#fff', letterSpacing: '0.5px' }}>
                                        {activeFolder}
                                    </h2>
                                </div>
                            </div>
                            
                            <button 
                                className="btn" 
                                onClick={handleCreateCollectionFromFolder}
                                disabled={isCreatingCollection}
                                style={{ 
                                    marginTop: isMobile ? '0' : '35px',
                                    padding: '10px 24px', 
                                    borderRadius: '50px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '8px', 
                                    fontSize: '0.95rem',
                                    background: 'rgba(168, 85, 247, 0.15)',
                                    color: '#c084fc',
                                    border: '2px solid rgba(168, 85, 247, 0.5)',
                                    fontWeight: '600',
                                    transition: 'all 0.2s ease',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(168, 85, 247, 0.25)';
                                    e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.8)';
                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(168, 85, 247, 0.15)';
                                    e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
                                    e.currentTarget.style.transform = 'translateY(0)';
                                }}
                            >
                                {isCreatingCollection ? 'Создание...' : `Create collection from this folder`}
                            </button>
                        </div>
                    )}
                    <motion.div
                        className="movie-grid-container"
                        ref={gridRef}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(auto-fill, minmax(${posterSize}px, 1fr))`,
                            // Micro-mutation in gap to force Safari to recalculate grid layout on sort change
                            gap: `calc(25px + ${(sortField.length + (sortDir === 'asc' ? 1 : 0)) % 4 * 0.01}px)`,
                        }}>

                        {finalDisplayMovies.slice(0, visibleCount).map((movie, index) => {
                        const isDeleting = deletingIds.includes(movie.id);
                        const deletingIndex = deletingIds.indexOf(movie.id);

                        const isHighlighted = highlightedLink && movie.link === highlightedLink;

                        let motionAnimate = isDeleting ? {
                            scaleX: [1, 1, 1, 1.05, 0.02, 0],
                            scaleY: [1, 1, 1, 0.008, 0.008, 0],
                            opacity: [1, 1, 1, 1, 1, 0],
                            filter: [
                                "grayscale(0%) brightness(1) contrast(1) blur(0px)", 
                                "grayscale(100%) brightness(1.2) contrast(1.2) blur(0px)", 
                                "grayscale(100%) brightness(1.5) contrast(1.5) blur(0px)", 
                                "grayscale(100%) brightness(15) contrast(10) blur(2px)", 
                                "grayscale(100%) brightness(20) contrast(10) blur(3px)", 
                                "grayscale(100%) brightness(1) contrast(1) blur(0px)"
                            ],
                            boxShadow: [
                                "0 4px 20px rgba(0,0,0,0.3)", 
                                "0 4px 20px rgba(0,0,0,0.3)", 
                                "-5px 0 10px rgba(255, 255, 255, 0.6), 5px 0 10px rgba(255, 255, 255, 0.6)", 
                                "-15px 0 20px rgba(255, 255, 255, 1), 15px 0 20px rgba(255, 255, 255, 1)", 
                                "-30px 0 30px rgba(255, 255, 255, 1), 30px 0 30px rgba(255, 255, 255, 1)", 
                                "none"
                            ],
                            backgroundColor: ["transparent", "transparent", "transparent", "white", "white", "transparent"],
                            visibility: ["visible", "visible", "visible", "visible", "visible", "hidden"]
                        } : undefined;

                        const staggerDelay = deletingIndex > 0 ? deletingIndex * 0.2 : 0;

                        let motionTransition = isDeleting ? {
                            duration: 0.9,
                            delay: staggerDelay,
                            ease: [0.25, 0.1, 0.25, 1],
                            times: [0, 0.2, 0.5, 0.65, 0.85, 1]
                        } : { layout: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } };

                        return (
                            <motion.div
                                key={movie.id}
                                layout={!isMobile}
                                animate={motionAnimate}
                                transition={motionTransition}
                                data-movie-id={movie.id}
                                data-movie-link={movie.link}
                                className={`glass-panel movie-card${isHighlighted ? ' movie-highlight-pulse' : ''}`}
                                style={{
                                    position: 'relative',
                                    overflow: 'visible',
                                    border: hidingGlobalMovies.has(movie.link)
                                        ? '1px solid transparent'
                                        : isHighlighted
                                            ? '2px solid var(--accent-gold)'
                                            : selectedIds.includes(movie.id)
                                                ? '2px solid var(--accent-gold)'
                                                : hoveredCardLink === movie.link
                                                    ? '1px solid rgba(3, 218, 198, 0.4)'
                                                    : '1px solid rgba(255,255,255,0.05)',
                                    boxShadow: hidingGlobalMovies.has(movie.link)
                                        ? 'none'
                                        : hoveredCardLink === movie.link
                                            ? '0 6px 20px rgba(3, 218, 198, 0.15)'
                                            : '0 4px 20px rgba(0,0,0,0.3)',
                                    aspectRatio: '2/3',
                                    borderRadius: '8px',
                                    transition: 'border 0.3s ease, box-shadow 0.3s ease'
                                }}
                                onMouseEnter={() => setHoveredCardLink(movie.link)}
                                onMouseLeave={() => {
                                    setHoveredCardLink(null);
                                    setHoveredButtonLink(null);
                                    setHoveredDeleteLink(null);
                                }}
                            >
                                {ripples.filter(r => r.identifier === (movie.id || movie.link)).map(ripple => (
                                    <div
                                        key={`glow-${ripple.id}`}
                                        className="card-edge-glow"
                                        data-action-type={ripple.actionType}
                                        style={{
                                            '--click-x': `${ripple.x}px`,
                                            '--click-y': `${ripple.y}px`,
                                            animationDelay: `${ripple.delay || 0}s`,
                                            ...(ripple.customDuration && { animationDuration: `${ripple.customDuration}ms` })
                                        }}
                                    />
                                ))}
                                <DigitalDisintegration 
                                    isHiding={hidingGlobalMovies.has(movie.link)} 
                                    onAnimationComplete={() => handleHideGlobalMovie(movie.link)}
                                    style={{
                                        position: 'relative',
                                        width: '100%',
                                        height: '100%',
                                        borderRadius: 'inherit',
                                        overflow: hidingGlobalMovies.has(movie.link) ? 'visible' : 'hidden'
                                    }}
                                >
                                {ripples.filter(r => r.identifier === (movie.id || movie.link)).map(ripple => (
                                    <div
                                        key={`wave-${ripple.id}`}
                                        className="watch-ripple"
                                        data-action-type={ripple.actionType}
                                        style={{
                                            left: ripple.x,
                                            top: ripple.y,
                                            animationDelay: `${ripple.delay || 0}s`,
                                            '--ripple-color': ripple.color,
                                            ...(ripple.customOpacity !== null && { '--ripple-opacity': ripple.customOpacity }),
                                            ...(ripple.customDuration && { animationDuration: `${ripple.customDuration}ms` })
                                        }}
                                    />
                                ))}
                                {isDeleting && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: [0, 0, 0.8, 1, 0] }}
                                        transition={{ duration: 0.9, delay: staggerDelay, times: [0, 0.2, 0.3, 0.5, 0.6] }}
                                        style={{
                                            position: 'absolute',
                                            inset: 0,
                                            zIndex: 20,
                                            pointerEvents: 'none',
                                            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.7'/%3E%3C/svg%3E")`,
                                            mixBlendMode: 'screen',
                                            animation: 'staticFlicker 0.2s steps(4) infinite'
                                        }}
                                    />
                                )}
                                <div
                                    style={{ width: '100%', height: '100%', cursor: 'pointer' }}
                                    onClick={() => setSelectedMovie(movie)}
                                >
                                    <img
                                        src={movie.poster_url}
                                        alt={movie.title}
                                        style={{
                                            width: '100%', height: '100%',
                                            objectFit: 'cover'
                                        }}
                                    />
                                    {tintWatchedLink === movie.link && (
                                        <div style={{
                                            position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
                                            animation: 'watchedTintFadeOut 1.6s forwards'
                                        }} />
                                    )}
                                    {tintUnwatchedLink === movie.link && (
                                        <div style={{
                                            position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
                                            animation: 'unwatchedTintFadeOut 1.6s forwards'
                                        }} />
                                    )}
                                    {tintRatingInfo?.link === movie.link && (
                                        <div style={{
                                            position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
                                            backgroundColor: 'rgb(255, 193, 7)',
                                            opacity: tintRatingInfo.stage === 'in' ? tintRatingInfo.opacity : 0,
                                            transition: tintRatingInfo.stage === 'in' ? 'opacity 0.2s ease-out' : `opacity ${tintRatingInfo.durationOut}s ease-in-out`
                                        }} />
                                    )}
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: hoveredHideGlobalLink === movie.link ? 'rgba(239, 68, 68, 0.25)' : 'transparent',
                                        backdropFilter: hoveredHideGlobalLink === movie.link ? 'blur(10px)' : 'none',
                                        WebkitBackdropFilter: hoveredHideGlobalLink === movie.link ? 'blur(10px)' : 'none',
                                        transition: 'all 0.3s ease',
                                        pointerEvents: 'none',
                                        zIndex: 1
                                    }} />
                                    {searchDb === 'cache' && (
                                        <GlobalHideButton
                                            link={movie.link}
                                            onHide={initiateHideGlobalMovie}
                                            onHoverEnter={() => setHoveredHideGlobalLink(movie.link)}
                                            onHoverLeave={() => setHoveredHideGlobalLink(null)}
                                        />
                                    )}
                                    {/* Top Overlay Controls */}
                                    <div style={{
                                        position: 'absolute', top: '0', left: '0', width: '100%',
                                        padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                                        zIndex: 10,
                                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)',
                                        pointerEvents: 'none' // Allow click through to main card
                                    }}>
                                        {movie.id && (
                                            <div
                                                onClick={(e) => e.stopPropagation()}
                                                onMouseDown={(e) => setSelectionAnchor({ x: e.clientX, y: e.clientY })}
                                                style={{ pointerEvents: 'auto' }}
                                            >
                                                <Checkbox
                                                    checked={selectedIds.includes(movie.id)}
                                                    onChange={() => toggleSelect(movie.id)}
                                                />
                                            </div>
                                        )}
                                        <AnimatePresence mode="wait" initial={false}>
                                            <motion.div 
                                                key={movie.status === 'watched' ? 'watched' : 'unwatched'}
                                                initial={{ opacity: 0, y: -40 }}
                                                animate={{ 
                                                    opacity: 1, 
                                                    y: 0,
                                                    transition: { 
                                                        y: { type: "spring", stiffness: 180, damping: 12, mass: 1.2, delay: 0.2 },
                                                        opacity: { duration: 0.6, delay: 0.2 }
                                                    }
                                                }}
                                                exit={{ 
                                                    opacity: 0, 
                                                    y: -30,
                                                    transition: { duration: 0.25, ease: "easeIn" }
                                                }}
                                                style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', pointerEvents: 'none' }}
                                            >
                                                {/* Priority Badges: Animation */}
                                                {(movie.genres?.toLowerCase().includes('мульт') || movie.genres?.toLowerCase().includes('анимац') || movie.link?.includes('/cartoons/') || movie.link?.includes('/animation/')) ? (
                                                    <span className="badge-ui" style={{ background: 'rgba(255, 152, 0, 0.9)' }}>Cartoon</span>
                                                ) : movie.genres?.toLowerCase().includes('аниме') ? (
                                                    <span className="badge-ui" style={{ background: 'rgba(233, 30, 99, 0.9)' }}>Anime</span>
                                                ) : (
                                                    /* Other Genre Badges (only if not animated) */
                                                    <>
                                                        {movie.genres?.toLowerCase().includes('триллер') && <span className="badge-ui" style={{ background: 'rgba(183, 28, 28, 0.9)' }}>Thriller</span>}
                                                        {movie.genres?.toLowerCase().includes('детектив') && <span className="badge-ui" style={{ background: 'rgba(74, 20, 140, 0.9)' }}>Detective</span>}
                                                        {movie.genres?.toLowerCase().includes('ужас') && <span className="badge-ui" style={{ background: 'rgba(46, 125, 50, 0.9)' }}>Horror</span>}
                                                        {movie.genres?.toLowerCase().includes('комед') && <span className="badge-ui" style={{ background: 'rgba(251, 192, 45, 0.9)', color: '#000' }}>Comedy</span>}
                                                        {(movie.genres?.toLowerCase().includes('мелодрам') || movie.genres?.toLowerCase().includes('драма')) && (
                                                            <span className="badge-ui" style={{ background: 'rgba(194, 24, 91, 0.9)' }}>Drama</span>
                                                        )}
                                                    </>
                                                )}

                                                {/* Series badge is always informative */}
                                                {movie.status === 'watched' && (
                                                    <span className="badge-ui" style={{ background: 'rgba(3, 218, 198, 0.9)', color: '#fff' }}>✔ Watched</span>
                                                )}
                                                {movie.type === 'series' && <span className="badge-ui" style={{ background: 'rgba(33, 150, 243, 0.9)' }}>TV</span>}
                                                
                                                <div style={{
                                                    background: 'rgba(0,0,0,0.6)',
                                                    padding: isMobile ? '1px 4px' : '2px 6px',
                                                    borderRadius: isMobile ? '2px' : '4px',
                                                    fontWeight: 'bold',
                                                    color: 'var(--accent-gold)',
                                                    fontSize: isMobile ? '0.65rem' : '0.8rem',
                                                    backdropFilter: 'blur(4px)',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '2px'
                                                }}>
                                                    {movie.rating ? `★ ${movie.rating}` : '-'}
                                                    {movie.user_rating && (
                                                        <span style={{
                                                            color: '#03dac6',
                                                            borderLeft: '1px solid #444',
                                                            paddingLeft: isMobile ? '3px' : '5px',
                                                            marginLeft: isMobile ? '1px' : '2px'
                                                        }}>
                                                            👤 {isMobile ? '' : '★ '}{movie.user_rating}
                                                        </span>
                                                    )}
                                                </div>
                                            </motion.div>
                                        </AnimatePresence>

                                        <style>{`
                    .badge-ui {
                        padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #fff; 
                        font-size: 0.65rem; backdrop-filter: blur(4px); text-transform: uppercase;
                        display: inline-block; white-space: nowrap; overflow: hidden;
                    }
                    @media (max-width: 768px) {
                        .badge-ui {
                            padding: 1px 3px;
                            font-size: 0.5rem;
                            border-radius: 2px;
                        }
                    }
                `}</style>
                                    </div>

                                    {/* Bottom Info Overlay */}
                                    <div style={{
                                        position: 'absolute', bottom: 0, left: 0, width: '100%',
                                        display: 'flex', flexDirection: 'column', gap: '4px',
                                        textAlign: 'left',
                                        zIndex: 5
                                    }}>
                                        {/* Backdrop Layer with Mask for Smooth Fade */}
                                        <div style={{
                                            position: 'absolute', inset: 0,
                                            background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.8) 60%, transparent 100%)',
                                            backdropFilter: 'blur(4px)',
                                            WebkitBackdropFilter: 'blur(4px)',
                                            maskImage: 'linear-gradient(to bottom, transparent 0%, black 40px)',
                                            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 40px)',
                                            zIndex: -1
                                        }}></div>

                                        {/* Content Wrapper */}
                                        <div style={{ padding: '25px 10px 10px' }}>
                                            <h3
                                                style={{
                                                    fontSize: '1rem', lineHeight: '1.2', color: '#fff',
                                                    margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                                                    display: '-webkit-box',
                                                    WebkitLineClamp: '2',
                                                    WebkitBoxOrient: 'vertical',
                                                    overflow: 'hidden'
                                                }}
                                            >{movie.title}</h3>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#ccc', marginTop: '2px' }}>
                                                <span>{movie.year}</span>
                                            </div>

                                            {movie.genres && (
                                                <div style={{
                                                    fontSize: '0.7rem', color: 'var(--accent-gold)', opacity: 0.8,
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                                }}>
                                                    {movie.genres}
                                                </div>
                                            )}

                                            {movie.description && (
                                                <div
                                                    className="movie-desc-anim"
                                                    style={{
                                                        fontSize: '0.75rem', color: '#ddd',
                                                        lineHeight: '1.3',
                                                        margin: '4px 0 0',
                                                        paddingBottom: '2px'
                                                    }}
                                                >
                                                    {movie.description}
                                                </div>
                                            )}

                                            <AnimatePresence>
                                                {movie.status === 'watched' && (movie.id === null || !movie.user_rating) && (
                                                    <motion.div
                                                        key="rating-button"
                                                        initial={{ opacity: 0, filter: 'blur(8px)', height: 0, scale: 0.95, overflow: 'hidden' }}
                                                        animate={{ opacity: 1, filter: 'blur(0px)', height: 'auto', scale: 1 }}
                                                        exit={{ opacity: 0, filter: 'blur(8px)', height: 0, scale: 0.95, overflow: 'hidden' }}
                                                        transition={{ duration: 0.8, ease: [0.1, 0.8, 0.2, 1] }}
                                                    >
                                                        <CardRatingButton
                                                            movie={movie}
                                                            posterSize={posterSize}
                                                            onUpdateRating={async (ratingVal, e) => {
                                                                handleRatingAnimation(e, ratingVal, movie.link, movie.id);
                                                                await onUpdate(movie.id || null, { user_rating: ratingVal, link: movie.link });
                                                            }}
                                                        />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* Quick Actions (Mini) */}
                                            <div style={{ display: 'flex', gap: '5px', marginTop: '8px' }} onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    className="btn-ghost"
                                                    title="Add to Collection"
                                                    style={{
                                                        padding: isMobile ? '4px 6px' : '4px 8px',
                                                        background: 'rgba(212, 175, 55, 0.15)',
                                                        color: 'var(--accent-gold)',
                                                        borderRadius: '4px',
                                                        fontSize: isMobile ? '0.75rem' : '0.9rem',
                                                        height: isMobile ? '28px' : 'auto',
                                                        width: isMobile ? '28px' : '28px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0,
                                                        border: '1px solid rgba(212, 175, 55, 0.3)',
                                                        transition: 'all 0.2s'
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onAddToCollectionClick?.(movie);
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212, 175, 55, 0.3)'; setHoveredCollectionLink(movie.link); }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212, 175, 55, 0.15)'; setHoveredCollectionLink(null); }}
                                                >
                                                    📁
                                                </button>
                                                <button
                                                    className="btn-ghost"
                                                    title={movie.status === 'watched' ? 'Mark Unwatched' : 'Mark Watched'}
                                                    onMouseEnter={() => setHoveredButtonLink(movie.link)}
                                                    onMouseLeave={() => setHoveredButtonLink(null)}
                                                    style={{
                                                        flex: 1,
                                                        padding: isMobile ? '4px 6px' : '6px 8px',
                                                        fontSize: isMobile ? '0.7rem' : '0.8rem',
                                                        borderRadius: '4px',
                                                        border: (hoveredDeleteLink === movie.link || hoveredCollectionLink === movie.link || hoveredButtonLink === movie.link) ? '1px solid transparent' : '1px solid',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.25s ease-in-out',
                                                        fontWeight: 'bold',
                                                        background: (() => {
                                                            if (hoveredDeleteLink === movie.link) return 'rgba(239, 68, 68, 0.15)';
                                                            if (hoveredCollectionLink === movie.link) return 'rgba(212, 175, 55, 0.15)';
                                                            if (hoveredButtonLink === movie.link) {
                                                                return movie.status === 'watched' ? 'rgba(255, 152, 0, 0.25)' : 'rgba(3, 218, 198, 0.25)';
                                                            }
                                                             return movie.status === 'watched' ? 'rgba(3, 218, 198, 0.15)' : 'rgba(255,255,255,0.05)';
                                                        })(),
                                                        borderColor: (() => {
                                                            if (hoveredDeleteLink === movie.link) return 'rgba(239, 68, 68, 0.4)';
                                                            if (hoveredCollectionLink === movie.link) return 'rgba(212, 175, 55, 0.4)';
                                                            if (hoveredButtonLink === movie.link) return 'transparent';
                                                            return movie.status === 'watched' ? '#03dac6' : 'rgba(255,255,255,0.1)';
                                                        })(),
                                                        color: (() => {
                                                            if (hoveredDeleteLink === movie.link) return '#ff6b6b';
                                                            if (hoveredCollectionLink === movie.link) return 'var(--accent-gold)';
                                                            if (hoveredButtonLink === movie.link) {
                                                                return movie.status === 'watched' ? '#ff9800' : '#03dac6';
                                                            }
                                                            if (movie.status === 'watched') return '#03dac6';
                                                            return '#fff';
                                                        })(),
                                                        height: isMobile ? '28px' : '30px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        boxShadow: 'none'
                                                    }}
                                                    onMouseDown={(e) => {
                                                        const isBtnHovered = hoveredButtonLink === movie.link;
                                                        const isCardHovered = hoveredCardLink === movie.link;
                                                        const showDetailsText = isCardHovered && !isBtnHovered;
                                                        if (showDetailsText || hoveredDeleteLink === movie.link || hoveredCollectionLink === movie.link) return;
                                                        
                                                        if (movie.status !== 'watched') {
                                                            setTintWatchedLink(movie.link);
                                                            setTimeout(() => setTintWatchedLink(null), 1600);
                                                        } else {
                                                            setTintUnwatchedLink(movie.link);
                                                            setTimeout(() => setTintUnwatchedLink(null), 1600);
                                                        }
                                                    }}
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (hoveredDeleteLink === movie.link || hoveredCollectionLink === movie.link) return;

                                                        const isBtnHovered = hoveredButtonLink === movie.link;
                                                        const isCardHovered = hoveredCardLink === movie.link;
                                                        const showDetailsText = isCardHovered && !isBtnHovered;

                                                        if (showDetailsText) {
                                                            setSelectedMovie(movie);
                                                        } else {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            const cardRect = e.currentTarget.closest('.movie-card').getBoundingClientRect();
                                                            const x = rect.left + rect.width / 2 - cardRect.left;
                                                            const y = rect.top + rect.height / 2 - cardRect.top;
                                                            const isWatching = movie.status !== 'watched';
                                                            addRipple(movie.id || movie.link, x, y, isWatching);

                                                            if (movie.status !== 'watched') {
                                                                await onUpdate(movie.id || null, { status: 'watched', link: movie.link });
                                                            } else {
                                                                await onUpdate(movie.id || null, { status: 'want_to_watch', link: movie.link });
                                                            }
                                                        }
                                                    }}
                                                >
                                                    {(() => {
                                                        const isDeleteHovered = hoveredDeleteLink === movie.link;
                                                        const isCollectionHovered = hoveredCollectionLink === movie.link;
                                                        const isBtnHovered = hoveredButtonLink === movie.link;
                                                        const isCardHovered = hoveredCardLink === movie.link;

                                                        let text = '';
                                                        const isSmall = posterSize <= 210;
                                                        if (isDeleteHovered) {
                                                            text = isSmall ? 'Delete' : 'Delete ->';
                                                        } else if (isCollectionHovered) {
                                                            text = isSmall ? 'Collection' : '<- Collection';
                                                        } else if (isCardHovered && !isBtnHovered) {
                                                            text = 'Details';
                                                        } else if (isBtnHovered && !isMobile) {
                                                            const isExtraSmall = posterSize < 180;
                                                            text = movie.status === 'watched' ? (isExtraSmall ? 'Unwatch' : (isSmall ? 'Unwatched' : 'Mark Unwatched')) : (isSmall ? 'Watched' : 'Mark Watched');
                                                        } else if (movie.status === 'watched') {
                                                            text = movie.user_rating ? `★ ${movie.user_rating}` : (isSmall ? 'Watched' : '✔ Watched');
                                                        } else {
                                                            text = 'Watch';
                                                        }

                                                        return (
                                                            <span key={text} className="button-text-fade" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                {text}
                                                            </span>
                                                        );
                                                    })()}
                                                </button>
                                                <button
                                                    className="btn-ghost btn-trash-hover"
                                                    title="Delete"
                                                    onMouseEnter={() => setHoveredDeleteLink(movie.link)}
                                                    onMouseLeave={() => setHoveredDeleteLink(null)}
                                                    style={{
                                                        padding: isMobile ? '4px 6px' : '4px 8px',
                                                        background: 'rgba(255,0,0,0.2)',
                                                        color: '#ff6b6b',
                                                        borderRadius: '4px',
                                                        fontSize: isMobile ? '0.75rem' : '0.9rem',
                                                        height: isMobile ? '28px' : 'auto',
                                                        width: isMobile ? '28px' : '28px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0
                                                    }}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleGridDelete(movie.id, movie.link || movie.movie_link, false, true);
                                                    }}
                                                >
                                                    🗑
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                </DigitalDisintegration>
                            </motion.div>
                        );
                    })}


                    {/* Sentinel for Infinite Scroll (Grid) */}
                    {visibleCount < finalDisplayMovies.length && (
                        <div ref={sentinelRef} style={{ height: '50px', width: '100%', gridColumn: '1 / -1' }} />
                    )}
                </motion.div>
                </motion.div>
                )}
                </AnimatePresence>
            ) : (
                <div className="movie-table-container">
                    <AnimatePresence mode="wait">
                    {isWatchedView && watchedViewMode === 'folders' && !activeFolder ? (
                        <motion.div 
                            key="folders-list"
                            className="folder-grid"
                            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
                        >
                            {folderGroups?.map(group => (
                                <FolderCard 
                                    key={group.name} 
                                    groupName={group.name} 
                                    movies={group.movies} 
                                    onClick={() => setActiveFolder(group.name)} 
                                />
                            ))}
                        </motion.div>
                    ) : (
                    <motion.div 
                        key="movies-list"
                        initial={isWatchedView && watchedViewMode === 'folders' && activeFolder ? { height: 0, opacity: 0 } : false}
                        animate={isWatchedView && watchedViewMode === 'folders' && activeFolder ? { height: 'auto', opacity: 1 } : {}}
                        transition={{ duration: 0.4, ease: "easeInOut" }}
                        className="glass-panel" 
                        style={{ overflowX: 'auto', display: 'flex', flexDirection: 'column', position: 'relative', overflowY: 'hidden' }}
                    >
                        {/* Collection creation toast (Table View) */}
                        {collectionToast && (
                            <div style={{
                                position: 'absolute',
                                top: '10px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                background: 'rgba(20, 20, 25, 0.95)',
                                border: '1px solid var(--accent-gold)',
                                borderRadius: '12px',
                                padding: '12px 24px',
                                boxShadow: '0 8px 30px rgba(0,0,0,0.5), 0 0 15px rgba(212, 175, 55, 0.2)',
                                zIndex: 100,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px',
                                color: '#fff',
                                fontSize: '0.95rem',
                                animation: 'slideDownFadeIn 0.3s ease-out forwards'
                            }}>
                                <div>
                                    <span style={{ marginRight: '8px' }}>✅</span>
                                    {collectionToast.message}
                                </div>
                                <button
                                    onClick={() => {
                                        setCollectionToast(null);
                                        if (onNavigate) {
                                            localStorage.setItem('animateCollectionId', collectionToast.collectionId);
                                            onNavigate('collections');
                                        }
                                    }}
                                    style={{
                                        background: 'var(--accent-gold)',
                                        color: '#000',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '6px 12px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    {collectionToast.linkText}
                                </button>
                                <button 
                                    onClick={() => setCollectionToast(null)}
                                    style={{ background: 'transparent', border: 'none', color: '#999', cursor: 'pointer', fontSize: '1.2rem', padding: '0 5px' }}
                                >
                                    ×
                                </button>
                            </div>
                        )}

                        {isWatchedView && watchedViewMode === 'folders' && activeFolder && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', flexWrap: 'wrap', marginBottom: '25px', gap: '20px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    <button className="folder-back-btn" onClick={() => setActiveFolder(null)}>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                                        {isMobile ? 'Назад' : 'Вернуться к папкам'}
                                    </button>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '2.2rem', lineHeight: 1 }}>📁</span>
                                        <h2 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 'bold', color: '#fff', letterSpacing: '0.5px' }}>
                                            {activeFolder}
                                        </h2>
                                    </div>
                                </div>
                                
                                <button 
                                    className="btn" 
                                    onClick={handleCreateCollectionFromFolder}
                                    disabled={isCreatingCollection}
                                    style={{ 
                                        marginTop: isMobile ? '0' : '35px',
                                        padding: '10px 24px', 
                                        borderRadius: '50px', 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '8px', 
                                        fontSize: '0.95rem',
                                        background: 'rgba(168, 85, 247, 0.15)',
                                        color: '#c084fc',
                                        border: '2px solid rgba(168, 85, 247, 0.5)',
                                        fontWeight: '600',
                                        transition: 'all 0.2s ease',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap'
                                    }}
                                    onMouseEnter={(e) => {
                                        e.currentTarget.style.background = 'rgba(168, 85, 247, 0.25)';
                                        e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.8)';
                                        e.currentTarget.style.transform = 'translateY(-1px)';
                                    }}
                                    onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'rgba(168, 85, 247, 0.15)';
                                        e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                    }}
                                >
                                    {isCreatingCollection ? 'Создание...' : `Create collection from this folder`}
                                </button>
                            </div>
                        )}
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                    <th style={{ padding: '15px', width: '40px' }}>
                                    </th>
                                    <th style={{ padding: '15px' }}>Poster</th>
                                    <th style={{ padding: '15px' }}>Title</th>
                                    <th style={{ padding: '15px' }}>Description</th>
                                    <th style={{ padding: '15px' }}>Rating</th>
                                    <th style={{ padding: '15px' }}>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {finalDisplayMovies.slice(0, visibleCount).map(movie => (
                                <tr key={movie.id || movie.link} style={{
                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                    background: selectedIds.includes(movie.id) ? 'rgba(212, 175, 55, 0.05)' : 'transparent'
                                }}>
                                    <td
                                        style={{ padding: '15px', textAlign: 'center' }}
                                        onMouseDown={(e) => setSelectionAnchor({ x: e.clientX, y: e.clientY })}
                                    >
                                        {movie.id && (
                                            <Checkbox
                                                checked={selectedIds.includes(movie.id)}
                                                onChange={() => toggleSelect(movie.id)}
                                            />
                                        )}
                                    </td>
                                    <td style={{ padding: '10px' }}>
                                        <div className="poster-preview-wrapper">
                                            <img
                                                src={movie.poster_url}
                                                alt=""
                                                style={{ width: '40px', borderRadius: '4px', cursor: 'pointer' }}
                                                onClick={() => setSelectedMovie(movie)}
                                            />
                                            <img
                                                src={movie.poster_url}
                                                className="poster-preview-large"
                                                alt="Preview"
                                            />
                                        </div>
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ width: '290px', whiteSpace: 'normal', wordWrap: 'break-word' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span
                                                    style={{ color: '#fff', textDecoration: 'none', fontWeight: 'bold', cursor: 'pointer' }}
                                                    onClick={() => setSelectedMovie(movie)}
                                                >{movie.title}</span>
                                                {(() => {
                                                    const isCartoon = movie.genres?.toLowerCase().includes('мульт') || movie.genres?.toLowerCase().includes('анимац') || movie.link?.includes('/cartoons/') || movie.link?.includes('/animation/');
                                                    const isAnime = movie.genres?.toLowerCase().includes('аниме');

                                                    if (isCartoon) return <span className="badge-table" style={{ background: 'rgba(255, 152, 0, 0.2)', color: '#ffcc80', borderColor: 'rgba(255,152,0,0.4)' }}>Cartoon</span>;
                                                    if (isAnime) return <span className="badge-table" style={{ background: 'rgba(233, 30, 99, 0.2)', color: '#f48fb1', borderColor: 'rgba(233,30,99,0.4)' }}>Anime</span>;

                                                    return (
                                                        <>
                                                            {movie.genres?.toLowerCase().includes('триллер') && <span className="badge-table" style={{ background: 'rgba(183, 28, 28, 0.2)', color: '#ef9a9a', borderColor: 'rgba(183,28,28,0.4)' }}>Thriller</span>}
                                                            {movie.genres?.toLowerCase().includes('детектив') && <span className="badge-table" style={{ background: 'rgba(74, 20, 140, 0.2)', color: '#ce93d8', borderColor: 'rgba(74,20,140,0.4)' }}>Detective</span>}
                                                            {movie.genres?.toLowerCase().includes('ужас') && <span className="badge-table" style={{ background: 'rgba(46, 125, 50, 0.2)', color: '#a5d6a7', borderColor: 'rgba(46,125,50,0.4)' }}>Horror</span>}
                                                            {movie.genres?.toLowerCase().includes('комед') && <span className="badge-table" style={{ background: 'rgba(251, 192, 45, 0.2)', color: '#fff59d', borderColor: 'rgba(251,192,45,0.4)' }}>Comedy</span>}
                                                            {(movie.genres?.toLowerCase().includes('мелодрам') || movie.genres?.toLowerCase().includes('драма')) && (
                                                                <span className="badge-table" style={{ background: 'rgba(194, 24, 91, 0.2)', color: '#f48fb1', borderColor: 'rgba(194,24,91,0.4)' }}>Drama</span>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                                {movie.type === 'series' && <span className="badge-table" style={{ background: 'rgba(33, 150, 243, 0.2)', color: '#90caf9', borderColor: 'rgba(33,150,243,0.4)' }}>TV</span>}
                                                <style>{`
                                                    .badge-table {
                                                        font-size: 0.55rem; padding: 1px 4px; border-radius: 3px; border: 1px solid;
                                                        text-transform: uppercase; line-height: 1; margin-right: 4px;
                                                    }
                                                `}</style>
                                            </div>
                                            <div style={{ color: '#888', fontSize: '0.85rem' }}>{movie.original_title} ({movie.year})</div>
                                        </div>
                                    </td>
                                    <td style={{ padding: '15px', fontSize: '0.9rem', color: '#ccc', verticalAlign: 'top' }}>
                                        <div
                                            className={`table-desc-anim ${hoveredDescId === movie.id ? 'active' : ''}`}
                                            onMouseEnter={() => setHoveredDescId(movie.id)}
                                            onMouseLeave={() => setHoveredDescId(null)}
                                            style={{
                                                lineHeight: '1.4', /* Ensure consistent calculation for max-height */
                                                whiteSpace: 'normal'
                                            }}
                                        >
                                            {movie.description}
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-gold)', marginTop: '4px', opacity: 0.7 }}>
                                            {movie.genres}
                                        </div>
                                    </td>
                                    <td style={{ padding: '15px', color: 'var(--accent-gold)', fontWeight: 'bold' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <span>★ {movie.rating || '-'}</span>
                                            {movie.user_rating && (
                                                <span style={{ color: '#03dac6', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>👤 ★ {movie.user_rating}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <button
                                                className="btn-ghost"
                                                onClick={async (e) => {
                                                    e.stopPropagation();
                                                    if (movie.status !== 'watched') {
                                                        await onUpdate(movie.id || null, { status: 'watched', link: movie.link });
                                                    } else {
                                                        await onUpdate(movie.id || null, { status: 'want_to_watch', link: movie.link });
                                                    }
                                                }}
                                                style={{
                                                    padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem',
                                                    background: movie.status === 'watched' ? 'rgba(3, 218, 198, 0.15)' : 'rgba(212, 175, 55, 0.15)',
                                                    border: movie.status === 'watched' ? '1px solid #03dac6' : '1px solid rgba(212, 175, 55, 0.3)',
                                                    color: movie.status === 'watched' ? '#03dac6' : '#d4af37',
                                                    whiteSpace: 'nowrap',
                                                    cursor: 'pointer',
                                                    fontWeight: 'bold',
                                                    transition: 'all 0.2s ease',
                                                    width: '140px',
                                                    textAlign: 'center'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.transform = 'scale(1.03)';
                                                    if (movie.status === 'watched') {
                                                        e.currentTarget.style.boxShadow = '0 0 8px rgba(3, 218, 198, 0.3)';
                                                    }
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.transform = 'scale(1)';
                                                    e.currentTarget.style.boxShadow = 'none';
                                                }}
                                            >
                                                {movie.status === 'watched' ? (
                                                    <span>
                                                        {movie.user_rating ? `★ ${movie.user_rating}` : '✔ Watched'}
                                                        {movie.community_rating ? ` (${movie.community_rating})` : ''}
                                                    </span>
                                                ) : 'Want to Watch'}
                                            </button>

                                            <button
                                                className="btn-ghost btn-trash-hover"
                                                title="Delete"
                                                style={{
                                                    color: 'var(--danger)',
                                                    fontSize: '1.2rem',
                                                    padding: '4px',
                                                    lineHeight: 1,
                                                    borderRadius: '4px',
                                                    width: '28px',
                                                    height: '28px',
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleGridDelete(movie.id, movie.link || movie.movie_link, false, true);
                                                }}
                                            >
                                                🗑
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}


                        </tbody>
                    </table>
                    {/* Sentinel for Infinite Scroll (Table) */}
                    {visibleCount < finalDisplayMovies.length && (
                        <div ref={sentinelRef} style={{ height: '50px', width: '100%' }} />
                    )}
                </motion.div>
                )}
                </AnimatePresence>
                </div>
            )}

            {movies.length < 5 && !isTrashMode && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '25px',
                    marginTop: '40px',
                    animation: 'fadeIn 0.5s ease-out'
                }}>
                    {/* 1. Onboarding Glassmorphic Info Banner */}
                    <div className="glass-panel" style={{
                        padding: '24px 30px',
                        borderRadius: '20px',
                        border: '1px solid rgba(255,255,255,0.12)',
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.01) 100%)',
                        position: 'relative',
                        overflow: 'hidden',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                    }}>
                        {/* Soft ambient background glow */}
                        <div style={{
                            position: 'absolute', top: '-10%', right: '-10%', width: '180px', height: '180px',
                            background: 'radial-gradient(circle, rgba(192, 132, 252, 0.15) 0%, transparent 70%)',
                            pointerEvents: 'none', zIndex: 1
                        }} />

                        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '15px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '1.8rem' }}>👋</span>
                                    <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '700', color: '#fff' }}>
                                        Welcome to your Cinemathèque!
                                    </h2>
                                </div>

                                {/* Live Counter Badge */}
                                <div style={{
                                    background: 'rgba(168, 85, 247, 0.12)',
                                    border: '1px solid rgba(168, 85, 247, 0.35)',
                                    color: '#c084fc',
                                    padding: '8px 16px',
                                    borderRadius: '30px',
                                    fontSize: '0.85rem',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    boxShadow: '0 0 15px rgba(168, 85, 247, 0.15)',
                                    animation: 'pulse 2s infinite ease-in-out'
                                }}>
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#c084fc', display: 'inline-block', boxShadow: '0 0 8px #c084fc' }}></span>
                                    <span>In cache database: <strong style={{ color: '#fff' }}>{onboardingCacheStats.totalCached.toLocaleString() || '2,500+'}</strong> movies</span>
                                </div>
                            </div>

                            <p style={{ margin: 0, fontSize: '0.9rem', color: '#ccc', lineHeight: '1.6' }}>
                                Your personal watchlist is empty or just starting. You can easily add movies using the search bar above:
                            </p>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                                gap: '15px',
                                marginTop: '5px'
                            }}>
                                <div style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.04)',
                                    borderRadius: '12px',
                                    padding: '12px 15px',
                                    display: 'flex',
                                    gap: '12px',
                                    alignItems: 'flex-start'
                                }}>
                                    <span style={{ fontSize: '1.2rem' }}>🔗</span>
                                    <div>
                                        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#fff', fontWeight: '600' }}>Global HDRezka Search</h4>
                                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#aaa', lineHeight: '1.4' }}>
                                            Just paste a **direct link** to any movie or series from HDRezka into the search input above.
                                        </p>
                                    </div>
                                </div>
                                <div style={{
                                    background: 'rgba(255,255,255,0.02)',
                                    border: '1px solid rgba(255,255,255,0.04)',
                                    borderRadius: '12px',
                                    padding: '12px 15px',
                                    display: 'flex',
                                    gap: '12px',
                                    alignItems: 'flex-start'
                                }}>
                                    <span style={{ fontSize: '1.2rem' }}>🔮</span>
                                    <div>
                                        <h4 style={{ margin: '0 0 4px 0', fontSize: '0.85rem', color: '#fff', fontWeight: '600' }}>Local Cache Directory Search</h4>
                                        <p style={{ margin: 0, fontSize: '0.78rem', color: '#aaa', lineHeight: '1.4' }}>
                                            Search by titles, actors, or genres. Our local database is constantly updated by our background crawler.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {!isTrashMode && (movies.length < 5 || visibleCount >= finalDisplayMovies.length || hasActiveFilter) && filteredOnboardingCacheMovies.length > 0 && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '25px',
                    marginTop: '40px',
                    animation: 'fadeIn 0.5s ease-out'
                }}>
                    {/* 2. Purple Divider */}
                    <div className="cache-divider" style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '15px',
                        margin: '20px 0 10px',
                        width: '100%'
                    }}>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(168, 85, 247, 0.4), transparent)' }}></div>
                        <span style={{
                            fontSize: '0.85rem',
                            fontWeight: 'bold',
                            color: '#c084fc',
                            textTransform: 'uppercase',
                            letterSpacing: '1px',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}>
                            <span>🔮</span> Global Database
                        </span>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(168, 85, 247, 0.4), transparent)' }}></div>
                    </div>

                    {/* 3. Infinite Scrolling Grid */}
                    <motion.div
                        className="movie-grid-container"
                        ref={listRef}
                        style={{
                            display: 'grid',
                            gridTemplateColumns: `repeat(auto-fill, minmax(${posterSize}px, 1fr))`,
                            gap: '25px',
                        }}>
                        {filteredOnboardingCacheMovies.map((movie, idx) => {
                            const isFirstPartialMatch = movie._isExactMatch === false && (idx === 0 || filteredOnboardingCacheMovies[idx - 1]._isExactMatch !== false);
                            const isAdded = addedLinks.has(movie.link) || libraryLinks.has(cleanLinkPath(movie.link));
                            const isAdding = addingLinks.has(movie.link);
                            const isMovieWatched = localWatchedLinks.has(movie.link) || 
                                                   allMovies.some(m => cleanLinkPath(m.link) === cleanLinkPath(movie.link) && m.status === 'watched') ||
                                                   historyList.some(h => cleanLinkPath(h.movie_link) === cleanLinkPath(movie.link) && h.is_watched === 1);
                            const isCheckmarkHovered = hoveredCheckmarkLink === movie.link && clickedCheckmarkLink !== movie.link;
                            const userRating = allMovies.find(m => cleanLinkPath(m.link) === cleanLinkPath(movie.link))?.user_rating ||
                                               historyList.find(h => cleanLinkPath(h.movie_link) === cleanLinkPath(movie.link))?.user_rating;
                            
                            const libMovie = allMovies.find(m => cleanLinkPath(m.link) === cleanLinkPath(movie.link));

                            const cardNode = (
                                <motion.div
                                    key={movie.link || idx}
                                    layout={!isMobile}
                                    transition={{ layout: { duration: 0.35, ease: [0.4, 0, 0.2, 1] } }}
                                    className="movie-card"
                                    onClick={() => {
                                        if (libMovie) {
                                            setSelectedMovie(libMovie);
                                        } else {
                                            const histMovie = historyList.find(h => cleanLinkPath(h.movie_link) === cleanLinkPath(movie.link));
                                            setSelectedMovie({
                                                ...movie,
                                                poster_url: movie.poster_url || movie.img,
                                                user_rating: histMovie?.user_rating || null,
                                                notes: histMovie?.notes || null,
                                                notes_public: histMovie?.notes_public || 0,
                                                status: histMovie?.is_watched ? 'watched' : 'want_to_watch'
                                            });
                                        }
                                    }}
                                    onMouseEnter={() => setHoveredCardLink(movie.link)}
                                    onMouseLeave={() => {
                                        setHoveredCardLink(null);
                                        setHoveredButtonLink(null);
                                        setHoveredCheckmarkLink(null);
                                        setClickedCheckmarkLink(null);
                                    }}
                                    style={{
                                        position: 'relative',
                                        borderRadius: '16px',
                                        overflow: 'visible',
                                        aspectRatio: '2/3',
                                        animation: 'fadeIn 0.4s ease',
                                    }}
                                >
                                    {ripples.filter(r => r.identifier === (movie.id || movie.link)).map(ripple => (
                                        <div
                                            key={`glow-${ripple.id}`}
                                            className="card-edge-glow"
                                            data-action-type={ripple.actionType}
                                            style={{
                                                '--click-x': `${ripple.x}px`,
                                                '--click-y': `${ripple.y}px`,
                                                animationDelay: `${ripple.delay || 0}s`,
                                                ...(ripple.customDuration && { animationDuration: `${ripple.customDuration}ms` })
                                            }}
                                        />
                                    ))}
                                    <DigitalDisintegration 
                                        isHiding={hidingGlobalMovies.has(movie.link)} 
                                        onAnimationComplete={() => handleHideGlobalMovie(movie.link)}
                                        style={{
                                            height: '100%',
                                            width: '100%',
                                            position: 'relative',
                                            borderRadius: '16px',
                                            overflow: hidingGlobalMovies.has(movie.link) ? 'visible' : 'hidden',
                                            boxShadow: hidingGlobalMovies.has(movie.link)
                                                ? 'none'
                                                : hoveredCardLink === movie.link
                                                    ? '0 6px 20px rgba(168, 85, 247, 0.25)'
                                                    : '0 4px 20px rgba(0,0,0,0.3)',
                                            border: hidingGlobalMovies.has(movie.link)
                                                ? '1px solid transparent'
                                                : hoveredCardLink === movie.link
                                                    ? '1px solid rgba(168, 85, 247, 0.5)'
                                                    : '1px solid rgba(255,255,255,0.06)',
                                            background: 'rgba(255,255,255,0.02)',
                                            transition: 'border 0.3s ease, box-shadow 0.3s ease',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            cursor: 'pointer'
                                        }}
                                    >
                                    {ripples.filter(r => r.identifier === (movie.id || movie.link)).map(ripple => (
                                        <div
                                            key={`wave-${ripple.id}`}
                                            className="watch-ripple"
                                            data-action-type={ripple.actionType}
                                            style={{
                                                left: ripple.x,
                                                top: ripple.y,
                                                animationDelay: `${ripple.delay || 0}s`,
                                                '--ripple-color': ripple.color,
                                                ...(ripple.customOpacity !== null && { '--ripple-opacity': ripple.customOpacity }),
                                                ...(ripple.customDuration && { animationDuration: `${ripple.customDuration}ms` })
                                            }}
                                        />
                                    ))}
                                    {/* Poster Image */}
                                    <img
                                        src={movie.poster_url || movie.img}
                                        alt={movie.title}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            pointerEvents: 'none',
                                            filter: isMovieWatched ? 'grayscale(1)' : 'none',
                                            transition: 'filter 0.3s ease'
                                        }}
                                        loading="lazy"
                                    />
                                    {/* Top Overlay Controls */}
                                    <div style={{
                                        position: 'absolute', top: '0', left: '0', width: '100%',
                                        padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                                        zIndex: 10,
                                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)',
                                        pointerEvents: 'none' // Allow click through to main card
                                    }}>
                                        {(() => {
                                            const selectId = libMovie ? libMovie.id : movie.link;
                                            return (
                                                <div
                                                    onClick={(e) => e.stopPropagation()}
                                                    onMouseDown={(e) => setSelectionAnchor({ x: e.clientX, y: e.clientY })}
                                                    style={{ pointerEvents: 'auto' }}
                                                >
                                                    <Checkbox
                                                        checked={selectedIds.includes(selectId)}
                                                        onChange={() => toggleSelect(selectId)}
                                                    />
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    
                                    {justAddedLink === movie.link && (
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            zIndex: 5,
                                            pointerEvents: 'none',
                                            animation: 'purpleTintFadeOut 1.5s forwards'
                                        }} />
                                    )}
                                    {justRemovedLink === movie.link && (
                                        <div style={{
                                            position: 'absolute',
                                            inset: 0,
                                            zIndex: 5,
                                            pointerEvents: 'none',
                                            animation: 'redTintFadeOut 1.6s forwards'
                                        }} />
                                    )}
                                    {tintWatchedLink === movie.link && (
                                        <div style={{
                                            position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
                                            animation: 'watchedTintFadeOut 1.6s forwards'
                                        }} />
                                    )}
                                    {tintUnwatchedLink === movie.link && (
                                        <div style={{
                                            position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
                                            animation: 'unwatchedTintFadeOut 1.6s forwards'
                                        }} />
                                    )}
                                    {tintRatingInfo?.link === movie.link && (
                                        <div style={{
                                            position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none',
                                            backgroundColor: 'rgb(255, 193, 7)',
                                            opacity: tintRatingInfo.stage === 'in' ? tintRatingInfo.opacity : 0,
                                            transition: tintRatingInfo.stage === 'in' ? 'opacity 0.2s ease-out' : `opacity ${tintRatingInfo.durationOut}s ease-in-out`
                                        }} />
                                    )}
                                    
                                    {/* Top Overlay Controls */}
                                    <div style={{
                                        position: 'absolute', top: '0', left: '0', width: '100%',
                                        padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                                        zIndex: 10,
                                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)',
                                        pointerEvents: 'none' // Allow click through to main card
                                    }}>
                                        {(() => {
                                            const libMovie = allMovies.find(m => cleanLinkPath(m.link) === cleanLinkPath(movie.link));
                                            const selectId = libMovie ? libMovie.id : movie.link;
                                            return (
                                                <div
                                                    onClick={(e) => e.stopPropagation()}
                                                    onMouseDown={(e) => setSelectionAnchor({ x: e.clientX, y: e.clientY })}
                                                    style={{ pointerEvents: 'auto' }}
                                                >
                                                    <Checkbox
                                                        checked={selectedIds.includes(selectId)}
                                                        onChange={() => toggleSelect(selectId)}
                                                    />
                                                </div>
                                            );
                                        })()}
                                    </div>
                                    
                                    {/* Hide blur overlay */}
                                    <div style={{
                                        position: 'absolute', inset: 0,
                                        background: hoveredHideGlobalLink === movie.link ? 'rgba(239, 68, 68, 0.25)' : 'transparent',
                                        backdropFilter: hoveredHideGlobalLink === movie.link ? 'blur(10px)' : 'none',
                                        WebkitBackdropFilter: hoveredHideGlobalLink === movie.link ? 'blur(10px)' : 'none',
                                        transition: 'all 0.3s ease',
                                        pointerEvents: 'none',
                                        zIndex: 1
                                    }} />
                                    <GlobalHideButton
                                        link={movie.link}
                                        onHide={initiateHideGlobalMovie}
                                        onHoverEnter={() => setHoveredHideGlobalLink(movie.link)}
                                        onHoverLeave={() => setHoveredHideGlobalLink(null)}
                                    />

                                    {/* Ambient Hover overlay */}
                                    <div className="hover-overlay" style={{
                                        position: 'absolute', inset: 0,
                                        background: 'rgba(0, 0, 0, 0.4)',
                                        opacity: 0, transition: 'opacity 0.25s ease'
                                    }} />

                                    {/* Bottom Details panel */}
                                    <div style={{
                                        position: 'absolute', bottom: 0, left: 0, width: '100%',
                                        display: 'flex', flexDirection: 'column', gap: '4px',
                                        textAlign: 'left', zIndex: 5
                                    }}>
                                        {/* Smooth mask background */}
                                        <div style={{
                                            position: 'absolute', inset: 0,
                                            background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.85) 60%, transparent 100%)',
                                            backdropFilter: 'blur(3px)',
                                            WebkitBackdropFilter: 'blur(3px)',
                                            maskImage: 'linear-gradient(to bottom, transparent 0%, black 40px)',
                                            WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 40px)',
                                            zIndex: -1
                                        }} />

                                        <div style={{ padding: '25px 10px 10px' }}>
                                            <h3 style={{
                                                fontSize: '0.95rem', lineHeight: '1.2', color: '#fff',
                                                margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                                                display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical',
                                                overflow: 'hidden'
                                            }}>{movie.title}</h3>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#ccc', marginTop: '3px' }}>
                                                <span>{movie.year}</span>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                    {movie.rating ? `★ ${movie.rating}` : '-'}
                                                    {userRating && (
                                                        <span style={{
                                                            color: '#03dac6',
                                                            borderLeft: '1px solid #444',
                                                            paddingLeft: '5px',
                                                            marginLeft: '2px'
                                                        }}>
                                                            👤 ★ {userRating}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {movie.misc && (
                                                <div style={{
                                                    fontSize: '0.7rem', color: '#aaa',
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                                    marginTop: '2px'
                                                }}>
                                                    {movie.misc}
                                                </div>
                                            )}

                                            <AnimatePresence>
                                                {(() => {
                                                    const isAdded = addedLinks.has(movie.link) || libraryLinks.has(cleanLinkPath(movie.link));
                                                    const libMovie = allMovies.find(m => cleanLinkPath(m.link) === cleanLinkPath(movie.link));
                                                    const rating = libMovie?.user_rating || localRatings[movie.link];
                                                    return isMovieWatched && (!isAdded || !rating);
                                                })() && (
                                                    <motion.div
                                                        key="rating-button"
                                                        initial={{ opacity: 0, filter: 'blur(8px)', height: 0, scale: 0.95, overflow: 'hidden' }}
                                                        animate={{ opacity: 1, filter: 'blur(0px)', height: 'auto', scale: 1 }}
                                                        exit={{ opacity: 0, filter: 'blur(8px)', height: 0, scale: 0.95, overflow: 'hidden' }}
                                                        transition={{ duration: 0.8, ease: [0.1, 0.8, 0.2, 1] }}
                                                    >
                                                        <CardRatingButton
                                                            movie={allMovies.find(m => cleanLinkPath(m.link) === cleanLinkPath(movie.link)) || { ...movie, user_rating: localRatings[movie.link] }}
                                                            posterSize={posterSize}
                                                            onUpdateRating={async (ratingVal, e) => {
                                                                const libMovie = allMovies.find(m => cleanLinkPath(m.link) === cleanLinkPath(movie.link));
                                                                handleRatingAnimation(e, ratingVal, movie.link, libMovie?.id || movie.id);
                                                                setLocalRatings(prev => ({ ...prev, [movie.link]: ratingVal }));
                                                                if (libMovie) {
                                                                    await onUpdate(libMovie.id, { user_rating: ratingVal, link: movie.link });
                                                                } else {
                                                                    await onUpdate(null, { user_rating: ratingVal, link: movie.link });
                                                                }
                                                            }}
                                                        />
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* Action Buttons */}
                                            <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }} onClick={(e) => e.stopPropagation()}>
                                                {(() => {
                                                     const isHideBtnHovered = hoveredHideGlobalLink === movie.link;
                                                     const isCollectionHovered = hoveredCollectionLink === movie.link;
                                                     const isSlideActive = (hoveredButtonLink === movie.link) || isCheckmarkHovered || isHideBtnHovered || isCollectionHovered;
                                                     const btnBgRest = isCollectionHovered ? 'rgba(212,175,55,0.2)' : (isHideBtnHovered ? 'rgba(255, 152, 0, 0.2)' : (isAdded ? 'rgba(3, 218, 198, 0.15)' : 'rgba(168, 85, 247, 0.15)'));
                                                     const btnBorderRest = isCollectionHovered ? 'rgba(212,175,55,0.4)' : (isHideBtnHovered ? 'rgba(255, 152, 0, 0.4)' : (isAdded ? '#03dac6' : 'rgba(168, 85, 247, 0.4)'));
                                                     const btnColorRest = isCollectionHovered ? 'var(--accent-gold)' : (isHideBtnHovered ? '#ff9800' : (isAdded ? '#03dac6' : '#c084fc'));
                                                     const btnBgHover = isCollectionHovered 
                                                         ? 'rgba(212,175,55,0.1)'
                                                         : (isCheckmarkHovered 
                                                             ? (isMovieWatched ? 'rgba(255, 152, 0, 0.1)' : 'rgba(3, 218, 198, 0.1)') 
                                                             : (isAdded ? 'rgba(239, 68, 68, 0.2)' : 'rgba(168, 85, 247, 0.3)'));
                                                     const btnBorderHover = isCollectionHovered 
                                                         ? 'rgba(212,175,55,0.3)'
                                                         : (isCheckmarkHovered 
                                                             ? (isMovieWatched ? 'rgba(255, 152, 0, 0.3)' : 'rgba(3, 218, 198, 0.3)') 
                                                             : (isAdded ? '#ef4444' : 'rgba(168, 85, 247, 0.7)'));
                                                     const btnColorHover = isCollectionHovered 
                                                         ? 'var(--accent-gold)'
                                                         : (isCheckmarkHovered 
                                                             ? (isMovieWatched ? '#ff9800' : '#03dac6') 
                                                             : (isAdded ? '#ef4444' : '#d8b4fe'));
                                                     
                                                     return (
                                                         <>
                                                             <button
                                                                 title="Add to Collection"
                                                                 onClick={(e) => {
                                                                     e.stopPropagation();
                                                                     if (isAdded) {
                                                                         const libMovie = allMovies.find(m => cleanLinkPath(m.link) === cleanLinkPath(movie.link) && m.id !== null);
                                                                         if (libMovie && onAddToCollectionClick) onAddToCollectionClick(libMovie);
                                                                     } else {
                                                                         handleAddToCollectionGlobal(movie.link);
                                                                     }
                                                                 }}
                                                                 style={{
                                                                     background: 'rgba(212,175,55,0.12)', border: '1px solid rgba(212,175,55,0.3)',
                                                                     color: 'var(--accent-gold)', borderRadius: '8px', padding: '6px 10px',
                                                                     fontSize: '0.85rem', cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s',
                                                                     display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                                 }}
                                                                 onMouseEnter={e => {
                                                                     e.currentTarget.style.background = 'rgba(212,175,55,0.28)';
                                                                     setHoveredCollectionLink(movie.link);
                                                                 }}
                                                                 onMouseLeave={e => {
                                                                     e.currentTarget.style.background = 'rgba(212,175,55,0.12)';
                                                                     setHoveredCollectionLink(null);
                                                                 }}
                                                             >📁</button>
                                                             <button
                                                                 className={`btn btn-slide-effect ${isSlideActive ? 'slide-active slide-entering' : 'slide-leaving'}`}
                                                                 disabled={isAdding}
                                                                 onMouseEnter={() => setHoveredButtonLink(movie.link)}
                                                                 onMouseLeave={() => setHoveredButtonLink(null)}
                                                                 onMouseDown={(e) => {
                                                                     if (!isAdding) {
                                                                         if (!isAdded) {
                                                                             setJustAddedLink(movie.link);
                                                                             setTimeout(() => setJustAddedLink(null), 1500);
                                                                         } else {
                                                                             setJustRemovedLink(movie.link);
                                                                             setTimeout(() => setJustRemovedLink(null), 1600);
                                                                         }
                                                                     }
                                                                 }}
                                                                 onClick={async (e) => {
                                                                     e.stopPropagation();
                                                                     if (isAdding) return;
                                                                     
                                                                     const rect = e.currentTarget.getBoundingClientRect();
                                                                     const cardRect = e.currentTarget.closest('.movie-card').getBoundingClientRect();
                                                                     const x = rect.left + rect.width / 2 - cardRect.left;
                                                                     const y = rect.top + rect.height / 2 - cardRect.top;
                                                                     addRipple(movie.link, x, y, isAdded ? 'remove_from_library' : 'add_to_library');
                                                                     
                                                                     if (isAdded) {
                                                                         const libMovie = allMovies.find(m => cleanLinkPath(m.link) === cleanLinkPath(movie.link) && m.id !== null);
                                                                         if (libMovie) {
                                                                             // Optimistic UI update
                                                                             setAddedLinks(prev => {
                                                                                 const next = new Set(prev);
                                                                                 next.delete(movie.link);
                                                                                 return next;
                                                                             });
                                                                             setLocalDeletedLinks(prev => new Set([...prev, cleanLinkPath(movie.link)]));
                                                                             
                                                                             // Fire and forget fetch
                                                                             try {
                                                                                 const res = await fetch(`/api/trash/${libMovie.id}`, { method: 'DELETE' });
                                                                                 if (res.ok && typeof onUpdate === 'function') {
                                                                                     onUpdate(null);
                                                                                 }
                                                                             } catch (error) {
                                                                                 console.error(error);
                                                                             }
                                                                         }
                                                                     } else {
                                                                         handleAddMovieFromCache(movie.link);
                                                                     }
                                                                 }}
                                                                 style={{
                                                                     flex: 1,
                                                                     padding: '6px 10px',
                                                                     borderRadius: '8px',
                                                                     fontSize: '0.78rem',
                                                                     fontWeight: 'bold',
                                                                     cursor: isAdding ? 'default' : 'pointer',
                                                                     border: '1px solid',
                                                                     height: isMobile ? '28px' : '30px',
                                                                     display: 'flex',
                                                                     alignItems: 'center',
                                                                     justifyContent: 'center',
                                                                     '--btn-bg-rest': btnBgRest,
                                                                     '--btn-bg-hover': btnBgHover,
                                                                     '--btn-border-rest': btnBorderRest,
                                                                     '--btn-border-hover': btnBorderHover,
                                                                     '--btn-color-rest': btnColorRest,
                                                                     '--btn-color-hover': btnColorHover,
                                                                     '--slide-translate': isSlideActive ? '0%' : '-101%',
                                                                     boxShadow: hoveredButtonLink === movie.link ? (isAdded ? '0 0 12px rgba(3, 218, 198, 0.3)' : '0 0 12px rgba(168, 85, 247, 0.4)') : (isHideBtnHovered ? '0 0 12px rgba(255, 152, 0, 0.2)' : (isCollectionHovered ? '0 0 12px rgba(212,175,55,0.2)' : 'none')),
                                                                     transform: hoveredButtonLink === movie.link ? 'scale(1.02)' : 'scale(1)',
                                                                     textAlign: 'center'
                                                                 }}
                                                                 title={isAdded ? "Remove from Library" : "Add to Library"}
                                                             >
                                                                 <span className="btn-slide-effect-text">
                                                                     {(() => {
                                                                         const isBtnHovered = hoveredButtonLink === movie.link;
                                                                         const isCardHovered = hoveredCardLink === movie.link;
                                                                         
                                                                         let text = '';
                                                                         const isSmall = posterSize <= 210;
                                                                         if (isCollectionHovered) {
                                                                             text = isSmall ? 'Collection' : '<- Collection';
                                                                         } else if (isHideBtnHovered) {
                                                                             text = '🚫 Hide film';
                                                                         } else if (isCheckmarkHovered) {
                                                                             const isExtraSmall = posterSize < 180;
                                                                             text = isMovieWatched ? (isExtraSmall ? 'Unwatch' : (isSmall ? 'Unwatched' : 'Unwatched ->')) : (isSmall ? 'Watched' : 'Mark watched ->');
                                                                         } else if (isCardHovered && !isBtnHovered) {
                                                                             text = 'Details';
                                                                         } else {
                                                                             text = isAdding ? '⏳ Adding...' : isAdded ? (isBtnHovered ? '🗑 Remove' : '✓ In My Library') : '➕ Add to Library';
                                                                         }
                                                                         
                                                                         return (
                                                                             <span key={text} className="button-text-fade" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                                                                                 {text}
                                                                             </span>
                                                                         );
                                                                     })()}
                                                                 </span>
                                                             </button>
                                                         </>
                                                     );
                                                 })()}

                                                <button
                                                     className={`btn-checkmark ${
                                                         justWatchedLink === movie.link ? 'checkmark-pop-watched' : ''
                                                     } ${
                                                         justUnwatchedLink === movie.link ? 'checkmark-pop-unwatched' : ''
                                                     }`}
                                                     onMouseEnter={() => setHoveredCheckmarkLink(movie.link)}
                                                     onMouseLeave={() => {
                                                         setHoveredCheckmarkLink(null);
                                                         setClickedCheckmarkLink(null);
                                                     }}
                                                     onMouseDown={(e) => {
                                                         if (isAdding || updatingCheckmarkLink === movie.link) return;
                                                         if (!isMovieWatched) {
                                                             setTintWatchedLink(movie.link);
                                                             setTimeout(() => setTintWatchedLink(null), 1600);
                                                         } else {
                                                             setTintUnwatchedLink(movie.link);
                                                             setTimeout(() => setTintUnwatchedLink(null), 1600);
                                                         }
                                                     }}
                                                     onClick={async (e) => {
                                                         e.stopPropagation();
                                                         if (isAdding || updatingCheckmarkLink === movie.link) return;
                                                         
                                                         setClickedCheckmarkLink(movie.link);
                                                         setUpdatingCheckmarkLink(movie.link);
                                                         
                                                         const rect = e.currentTarget.getBoundingClientRect();
                                                         const cardRect = e.currentTarget.closest('.movie-card').getBoundingClientRect();
                                                         const x = rect.left + rect.width / 2 - cardRect.left;
                                                         const y = rect.top + rect.height / 2 - cardRect.top;
                                                         const isWatching = !isMovieWatched;
                                                         addRipple(movie.id || movie.link, x, y, isWatching);
                                                         
                                                         try {
                                                             const libMovie = allMovies.find(m => cleanLinkPath(m.link) === cleanLinkPath(movie.link) && m.id !== null);
                                                             if (isMovieWatched) {
                                                                 if (libMovie) {
                                                                     await onUpdate(libMovie.id, { status: 'want_to_watch' });
                                                                 } else {
                                                                     await onUpdate(null, { status: 'want_to_watch', link: movie.link });
                                                                 }
                                                                 setLocalWatchedLinks(prev => {
                                                                     const next = new Set(prev);
                                                                     next.delete(movie.link);
                                                                     return next;
                                                                 });
                                                                 
                                                                 setJustUnwatchedLink(movie.link);
                                                                 setTimeout(() => setJustUnwatchedLink(null), 450);
                                                             } else {
                                                                 setLocalWatchedLinks(prev => new Set([...prev, movie.link]));
                                                                 if (libMovie) {
                                                                     await onUpdate(libMovie.id, { status: 'watched' });
                                                                 } else {
                                                                     await onUpdate(null, { status: 'watched', link: movie.link });
                                                                 }
                                                                 
                                                                 setJustWatchedLink(movie.link);
                                                                 setTimeout(() => setJustWatchedLink(null), 450);
                                                             }
                                                         } catch (err) {
                                                             console.error(err);
                                                         } finally {
                                                             setUpdatingCheckmarkLink(null);
                                                         }
                                                     }}
                                                     style={{
                                                         width: '32px',
                                                         height: '32px',
                                                         borderRadius: '8px',
                                                         background: isCheckmarkHovered
                                                             ? 'rgba(3, 218, 198, 0.2)'
                                                             : isMovieWatched ? '#03dac6' : 'rgba(255,255,255,0.05)',
                                                         borderColor: isCheckmarkHovered
                                                             ? '#03dac6'
                                                             : isMovieWatched ? '#03dac6' : 'rgba(255,255,255,0.1)',
                                                         color: isCheckmarkHovered
                                                             ? '#03dac6'
                                                             : isMovieWatched ? '#000' : '#fff',
                                                         border: '1px solid',
                                                         display: 'flex',
                                                         alignItems: 'center',
                                                         justifyContent: 'center',
                                                         cursor: (isAdding || updatingCheckmarkLink === movie.link) ? 'default' : 'pointer',
                                                         fontSize: '0.9rem',
                                                         fontWeight: 'bold',
                                                         transform: isCheckmarkHovered ? 'scale(1.08)' : 'scale(1)',
                                                         boxShadow: isCheckmarkHovered ? '0 0 15px rgba(3, 218, 198, 0.7), 0 0 5px rgba(3, 218, 198, 0.4)' : 'none',
                                                         transition: 'all 0.25s ease-in-out',
                                                         flexShrink: 0
                                                     }}
                                                     title={isMovieWatched ? "Mark Unwatched" : "Mark Watched & Add to Library"}
                                                 >
                                                     {updatingCheckmarkLink === movie.link ? (
                                                         <svg className="btn-loading-spin" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ display: 'block' }}>
                                                             <circle cx="8" cy="8" r="6" style={{ opacity: 0.25 }} />
                                                             <path d="M8 2a6 6 0 0 1 6 6" />
                                                         </svg>
                                                     ) : (
                                                         <svg
                                                             width="14"
                                                             height="14"
                                                             viewBox="0 0 14 14"
                                                             fill="none"
                                                             stroke="currentColor"
                                                             strokeWidth="2.5"
                                                             strokeLinecap="round"
                                                             strokeLinejoin="round"
                                                             style={{ display: 'block' }}
                                                         >
                                                             <path
                                                                 d="M3 7.5L5.5 10L11 3.5"
                                                                 className={isCheckmarkHovered ? 'draw-checkmark-path' : ''}
                                                                 style={{
                                                                     strokeDashoffset: isCheckmarkHovered ? undefined : 0,
                                                                     strokeDasharray: 15,
                                                                     opacity: isCheckmarkHovered ? 1 : (isMovieWatched ? 1 : 0.35),
                                                                     transition: 'opacity 0.25s ease-in-out'
                                                                 }}
                                                             />
                                                         </svg>
                                                     )}
                                                 </button>
                                            </div>
                                        </div>
                                    </div>
                                </DigitalDisintegration>
                                </motion.div>
                            );

                            if (isFirstPartialMatch) {
                                return (
                                    <Fragment key={`frag-${movie.link || idx}`}>
                                        <div style={{ gridColumn: '1 / -1', marginTop: '20px', marginBottom: '10px' }}>
                                            <div className="cache-divider" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.15), transparent)' }}></div>
                                                <span style={{ fontSize: '0.80rem', color: '#888', textTransform: 'uppercase', letterSpacing: '1px' }}>
                                                    Частичное совпадение
                                                </span>
                                                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(255, 255, 255, 0.15), transparent)' }}></div>
                                            </div>
                                        </div>
                                        {cardNode}
                                    </Fragment>
                                );
                            }

                            return cardNode;
                        })}

                        {isLiveSearching && Array.from({ length: 12 }).map((_, idx) => (
                            <motion.div
                                key={`skeleton-${idx}`}
                                className="movie-card"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                style={{
                                    position: 'relative',
                                    borderRadius: '16px',
                                    overflow: 'hidden',
                                    aspectRatio: '2/3',
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                            >
                                <div style={{
                                    position: 'absolute',
                                    top: 0, left: 0, right: 0, bottom: 0,
                                    background: 'linear-gradient(90deg, transparent 0%, rgba(212, 175, 55, 0.08) 50%, transparent 100%)',
                                    backgroundSize: '200% 100%',
                                    animation: 'shimmer 1.5s infinite linear'
                                }}></div>
                            </motion.div>
                        ))}
                    </motion.div>

                    {/* Onboarding Infinite Scroll Sentinel or Guest CTA */}
                    {isGuest && !hasMoreOnboarding && filteredOnboardingCacheMovies.length > 0 ? (
                        <div style={{
                            gridColumn: '1 / -1',
                            padding: '100px 20px 40px',
                            textAlign: 'center',
                            background: 'linear-gradient(to top, rgba(15, 15, 20, 1) 20%, rgba(15, 15, 20, 0) 100%)',
                            marginTop: '-120px',
                            position: 'relative',
                            zIndex: 10,
                            borderRadius: '0 0 16px 16px',
                            pointerEvents: 'auto'
                        }}>
                            <h3 style={{ color: '#fff', marginBottom: '12px', fontSize: '1.4rem' }}>Вы посмотрели демо-выборку</h3>
                            <p style={{ color: '#aaa', marginBottom: '25px', fontSize: '0.95rem', maxWidth: '400px', margin: '0 auto 25px' }}>
                                В нашей базе тысячи отличных фильмов. Зарегистрируйтесь, чтобы получить полный доступ и сохранять фильмы в свою библиотеку!
                            </p>
                            <button
                                onClick={onRegisterClick}
                                className="btn"
                                style={{
                                    background: 'var(--accent-gold)',
                                    color: '#000',
                                    padding: '14px 35px',
                                    fontSize: '1rem',
                                    fontWeight: '800',
                                    borderRadius: '30px',
                                    border: 'none',
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 20px rgba(212, 175, 55, 0.4)',
                                    transition: 'transform 0.2s, box-shadow 0.2s'
                                }}
                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                Зарегистрироваться
                            </button>
                        </div>
                    ) : hasMoreOnboarding && (
                        <div ref={onboardingSentinelRef} style={{
                            gridColumn: '1 / -1',
                            display: 'flex',
                            justifyContent: 'center',
                            padding: '20px 0',
                            height: '60px'
                        }}>
                            {isOnboardingLoading && (
                                <div style={{
                                    width: '30px', height: '30px',
                                    border: '3px solid rgba(168, 85, 247, 0.1)',
                                    borderTopColor: '#c084fc',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }} />
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default MovieGrid;
