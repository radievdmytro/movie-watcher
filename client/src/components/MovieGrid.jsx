import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import MovieDetailsModal from './MovieDetailsModal';

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

function MovieGrid({ movies, onUpdate, onDelete, selectedIds, onSelect, onSelectAll, setSelectionAnchor, deletingIds = [], trashButtonRef, isTrashMode, highlightedLink, onGuestActivity }) {
    const [sortField, setSortField] = useState('created_at');
    const [sortDir, setSortDir] = useState('desc');
    const [hideWatched, setHideWatched] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'
    const [posterSize, setPosterSize] = useState(() => {
        return parseInt(localStorage.getItem('posterSize')) || 220;
    });
    const [selectedMovie, setSelectedMovie] = useState(null);
    const [openWithWatchedPrompt, setOpenWithWatchedPrompt] = useState(false);
    const [hoveredDescId, setHoveredDescId] = useState(null);

    // Animation state
    const [animationPhase, setAnimationPhase] = useState(null); // 'grayscale' | 'stacking' | 'flying' | null
    const [trashButtonPos, setTrashButtonPos] = useState(null);
    const [stackPosition, setStackPosition] = useState(null);

    const [filterQuery, setFilterQuery] = useState('');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [filterGenres, setFilterGenres] = useState([]);
    const [filterRating, setFilterRating] = useState([0, 10]);
    const [filterYear, setFilterYear] = useState([1900, new Date().getFullYear() + 2]);
    const [filterType, setFilterType] = useState('all'); // 'all' | 'movie' | 'series'
    const [showFilters, setShowFilters] = useState(false);
    const [showAllGenres, setShowAllGenres] = useState(false);
    const [visibleCount, setVisibleCount] = useState(30);
    const sentinelRef = useRef(null);
    const [filterGenreMode, setFilterGenreMode] = useState('include'); // 'include' | 'exclude'
    const [availableGenres, setAvailableGenres] = useState([]);
    const [filterDirectors, setFilterDirectors] = useState([]);
    const [filterActors, setFilterActors] = useState([]);
    const [availableDirectors, setAvailableDirectors] = useState([]);
    const [availableActors, setAvailableActors] = useState([]);

    const [searchDb, setSearchDb] = useState('library'); // 'library' or 'cache'
    const [cacheMoviesResults, setCacheMoviesResults] = useState([]);
    const [isCacheLoading, setIsCacheLoading] = useState(false);

    const [autoSwitchToCache, setAutoSwitchToCache] = useState(() => {
        return localStorage.getItem('autoSwitchToCache') === 'true';
    });
    const [backgroundCacheResults, setBackgroundCacheResults] = useState([]);
    const [isBgCacheSearching, setIsBgCacheSearching] = useState(false);
    const [showAutoSwitchToast, setShowAutoSwitchToast] = useState(false);

    // Custom Onboarding / Cache Directory for sparse libraries
    const [onboardingCacheMovies, setOnboardingCacheMovies] = useState([]);
    const [onboardingCacheStats, setOnboardingCacheStats] = useState({ totalCached: 0 });
    const [onboardingOffset, setOnboardingOffset] = useState(0);
    const [isOnboardingLoading, setIsOnboardingLoading] = useState(false);
    const [hasMoreOnboarding, setHasMoreOnboarding] = useState(true);
    const onboardingSentinelRef = useRef(null);

    const uniqueBackgroundCacheResults = useMemo(() => {
        if (!backgroundCacheResults.length) return [];
        const libraryLinks = new Set(movies.map(m => cleanLinkPath(m.link)));
        return backgroundCacheResults
            .filter(m => m.link && !libraryLinks.has(cleanLinkPath(m.link)))
            .map(m => ({ ...m, isFromCache: true }));
    }, [backgroundCacheResults, movies]);

    const [addingLinks, setAddingLinks] = useState(new Set());
    const [addedLinks, setAddedLinks] = useState(new Set());

    const handleAddMovieFromCache = async (link) => {
        setAddingLinks(prev => new Set([...prev, link]));
        try {
            const res = await fetch('/api/movies/import', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: link })
            });
            if (res.ok) {
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

    const handleToggleAutoSwitch = (checked) => {
        setAutoSwitchToCache(checked);
        localStorage.setItem('autoSwitchToCache', checked ? 'true' : 'false');
    };

    useEffect(() => {
        if (searchDb !== 'cache') {
            setCacheMoviesResults([]);
            return;
        }

        if (!filterQuery.trim()) {
            setCacheMoviesResults([]);
            return;
        }

        setIsCacheLoading(true);
        const delayDebounceFn = setTimeout(() => {
            fetch(`/api/cache/search?query=${encodeURIComponent(filterQuery)}`)
                .then(res => {
                    if (res.ok) return res.json();
                    throw new Error('Failed to fetch from global cache');
                })
                .then(data => {
                    setCacheMoviesResults(data || []);
                })
                .catch(err => {
                    console.error(err);
                    setCacheMoviesResults([]);
                })
                .finally(() => {
                    setIsCacheLoading(false);
                });
        }, 300); // 300ms debounce

        return () => clearTimeout(delayDebounceFn);
    }, [filterQuery, searchDb]);

    const filteredAndSortedMovies = useMemo(() => {
        if (searchDb === 'cache') {
            return cacheMoviesResults;
        }

        let scored = movies.map(movie => {
            let score = 0;
            if (filterQuery) {
                const q = filterQuery.toLowerCase().trim();
                
                // Importance priority matching weights:
                // 1. Title match (most important)
                if (movie.title && movie.title.toLowerCase().includes(q)) score += 1000;
                if (movie.original_title && movie.original_title.toLowerCase().includes(q)) score += 800;
                
                // 2. Year match
                if (movie.year && movie.year.toString() === q) score += 600;
                else if (movie.year && movie.year.toString().includes(q)) score += 300;
                
                // 3. Genre match
                if (movie.genres && movie.genres.toLowerCase().includes(q)) score += 400;
                
                // 4. Director match
                if (movie.director && movie.director.toLowerCase().includes(q)) score += 200;
                
                // 5. Actor match
                if (movie.actors && movie.actors.toLowerCase().includes(q)) score += 100;
                
                // Description match
                if (movie.description && movie.description.toLowerCase().includes(q)) score += 50;

                // Word-by-word matches (for multi-word search queries)
                const words = q.split(/\s+/).filter(w => w.length > 1);
                if (words.length > 1) {
                    words.forEach(word => {
                        if (movie.title && movie.title.toLowerCase().includes(word)) score += 100;
                        if (movie.original_title && movie.original_title.toLowerCase().includes(word)) score += 80;
                        if (movie.year && movie.year.toString().includes(word)) score += 60;
                        if (movie.genres && movie.genres.toLowerCase().includes(word)) score += 40;
                        if (movie.director && movie.director.toLowerCase().includes(word)) score += 20;
                        if (movie.actors && movie.actors.toLowerCase().includes(word)) score += 10;
                        if (movie.description && movie.description.toLowerCase().includes(word)) score += 5;
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
                if (filterQuery && score === 0) return false;

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
                if (rating < filterRating[0] || rating > filterRating[1]) return false;

                // Year Filter
                if (movie.year < filterYear[0] || movie.year > filterYear[1]) return false;

                // Type Filter
                if (filterType !== 'all') {
                    if (filterType === 'cartoon') {
                        const isCartoon = movie.genres?.toLowerCase().includes('мульт') ||
                            movie.genres?.toLowerCase().includes('анимац') ||
                            movie.link?.includes('/cartoons/') ||
                            movie.link?.includes('/animation/');
                        if (!isCartoon) return false;
                    } else if (movie.type !== filterType) {
                        return false;
                    }
                }

                // Status Filter
                if (hideWatched && movie.status === 'watched') return false;

                return true;
            })
            .sort((a, b) => {
                // If filterQuery is active, sort by relevance score DESC first
                if (filterQuery && b.score !== a.score) {
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
    }, [movies, sortField, sortDir, filterQuery, filterGenres, filterDirectors, filterActors, filterRating, filterYear, filterType, filterGenreMode, hideWatched, searchDb, cacheMoviesResults]);

    // Background cache search when library has few/no results or integrated cache search is enabled
    useEffect(() => {
        if (searchDb !== 'library') {
            setBackgroundCacheResults([]);
            return;
        }

        const query = filterQuery.trim();
        if (query.length < 3) {
            setBackgroundCacheResults([]);
            return;
        }

        // We trigger background search if the library results are sparse (< 10 results)
        const shouldSearchBg = filteredAndSortedMovies.length < 10;
        if (!shouldSearchBg) {
            setBackgroundCacheResults([]);
            return;
        }

        setIsBgCacheSearching(true);
        const delayDebounceFn = setTimeout(() => {
            fetch(`/api/cache/search?query=${encodeURIComponent(query)}`)
                .then(res => res.ok ? res.json() : [])
                .then(data => {
                    const results = data || [];
                    setBackgroundCacheResults(results);
                })
                .catch(err => {
                    console.error("Bg cache search error:", err);
                    setBackgroundCacheResults([]);
                })
                .finally(() => {
                    setIsBgCacheSearching(false);
                });
        }, 400); // 400ms debounce for background search

        return () => clearTimeout(delayDebounceFn);
    }, [filterQuery, searchDb, filteredAndSortedMovies.length, autoSwitchToCache]);


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
        if (!filterQuery.trim()) return { movies: [], years: [], genres: [], directors: [], actors: [] };
        const query = filterQuery.toLowerCase().trim();

        // 1. Movies / Titles (ак названия)
        const activeMoviesSource = searchDb === 'cache' ? cacheMoviesResults : movies;
        const matchedMovies = activeMoviesSource.filter(m => 
            (m.title && m.title.toLowerCase().includes(query)) ||
            (m.original_title && m.original_title.toLowerCase().includes(query))
        ).slice(0, 5);

        // 2. Years
        const uniqueYears = Array.from(new Set(movies.map(m => m.year).filter(y => y)));
        const matchedYears = uniqueYears.filter(y => 
            y.toString().includes(query)
        ).sort((a, b) => b - a).slice(0, 5);

        // 3. Genres
        const matchedGenres = availableGenres.filter(g => 
            g && g.toLowerCase().includes(query)
        ).slice(0, 5);

        // 4. Directors
        const matchedDirectors = availableDirectors.filter(d => 
            d && d.name && d.name.toLowerCase().includes(query)
        ).slice(0, 5);

        // 5. Actors
        const matchedActors = availableActors.filter(a => 
            a && a.name && a.name.toLowerCase().includes(query)
        ).slice(0, 5);

        return {
            movies: matchedMovies,
            years: matchedYears,
            genres: matchedGenres,
            directors: matchedDirectors,
            actors: matchedActors
        };
    }, [filterQuery, availableDirectors, availableActors, availableGenres, movies, searchDb, cacheMoviesResults]);

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
            setStackPosition(null);
            return;
        }

        // Get trash button position
        if (trashButtonRef?.current) {
            const rect = trashButtonRef.current.getBoundingClientRect();
            setTrashButtonPos({
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            });
        }

        // Get position of first deleting item for stack anchor
        const firstDeletingId = deletingIds[0];
        const firstElement = document.querySelector(`[data-movie-id="${firstDeletingId}"]`);
        if (firstElement) {
            const rect = firstElement.getBoundingClientRect();
            setStackPosition({
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            });
        }

        // Phase 1: Grayscale (0-300ms)
        setAnimationPhase('grayscale');

        // Phase 2: Stacking (300-600ms)
        setTimeout(() => setAnimationPhase('stacking'), 300);

        // Phase 3: Flying (600-1200ms)
        setTimeout(() => setAnimationPhase('flying'), 600);

        // Phase 4: Cleanup happens in App.jsx after 1500ms
    }, [deletingIds, trashButtonRef]);

    const handleSizeChange = (e) => {
        const val = parseInt(e.target.value);
        setPosterSize(val);
        localStorage.setItem('posterSize', val);
    };

    // Reset visible count when filters change
    useEffect(() => {
        setVisibleCount(30);
    }, [filterQuery, filterGenres, filterDirectors, filterActors, filterRating, filterYear, filterType, filterGenreMode, sortField, sortDir, hideWatched, searchDb]);

    // Infinite Scroll Observer
    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setVisibleCount(prev => prev + 30);
            }
        }, { threshold: 0.1 });

        if (sentinelRef.current) {
            observer.observe(sentinelRef.current);
        }

        return () => observer.disconnect();
    }, [filteredAndSortedMovies.length]); // Now this is safe

    // Fetch Stats and Onboarding Cache Movies
    useEffect(() => {
        if (movies.length >= 5 || isTrashMode) return;

        const token = localStorage.getItem('token');

        // Fetch cache stats
        fetch('/api/cache/stats', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.ok ? res.json() : { totalCached: 2500 })
        .then(data => setOnboardingCacheStats(data))
        .catch(err => console.error("Error fetching cache stats:", err));

        // Fetch first page of cached movies
        setIsOnboardingLoading(true);
        fetch('/api/cache/directory?limit=50&offset=0', {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(res => res.ok ? res.json() : [])
        .then(data => {
            setOnboardingCacheMovies(data);
            setOnboardingOffset(50);
            if (data.length < 50) setHasMoreOnboarding(false);
        })
        .catch(err => console.error("Error fetching onboarding cache:", err))
        .finally(() => setIsOnboardingLoading(false));

    }, [movies.length, isTrashMode]);

    // Onboarding Infinite Scroll Observer
    useEffect(() => {
        if (movies.length >= 5 || isTrashMode || !hasMoreOnboarding || isOnboardingLoading) return;

        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                setIsOnboardingLoading(true);
                const token = localStorage.getItem('token');
                fetch(`/api/cache/directory?limit=50&offset=${onboardingOffset}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
                .then(res => res.ok ? res.json() : [])
                .then(data => {
                    if (data.length > 0) {
                        setOnboardingCacheMovies(prev => {
                            const existingLinks = new Set(prev.map(m => m.link));
                            const newMovies = data.filter(m => !existingLinks.has(m.link));
                            return [...prev, ...newMovies];
                        });
                        setOnboardingOffset(prev => prev + 50);
                    }
                    if (data.length < 50) {
                        setHasMoreOnboarding(false);
                    }
                })
                .catch(err => console.error("Error loading more onboarding cache:", err))
                .finally(() => setIsOnboardingLoading(false));
            }
        }, { threshold: 0.1 });

        if (onboardingSentinelRef.current) {
            observer.observe(onboardingSentinelRef.current);
        }

        return () => observer.disconnect();
    }, [movies.length, isTrashMode, onboardingOffset, hasMoreOnboarding, isOnboardingLoading]);

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

    const isAllSelected = filteredAndSortedMovies.length > 0 && selectedIds.length === filteredAndSortedMovies.length;

    const handleSelectAll = () => {
        if (isAllSelected) {
            onSelectAll([]);
        } else {
            onSelectAll(filteredAndSortedMovies.map(m => m.id));
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
            if (selectedMovie && selectedMovie.id === id) {
                setSelectedMovie(prev => ({ ...prev, ...fields }));
            }
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
                    <span>Automatically switched to Website Cache (found {backgroundCacheResults.length} matches)!</span>
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

            {/* Modal for Details ... */}
            {selectedMovie && (
                <MovieDetailsModal
                    movie={selectedMovie}
                    openWithWatchedPrompt={openWithWatchedPrompt}
                    onClose={() => { setSelectedMovie(null); setOpenWithWatchedPrompt(false); }}
                    onUpdate={handleUpdateMovie}
                    onDelete={onDelete}
                    isTrashMode={isTrashMode}
                    readOnly={!selectedMovie.id || selectedMovie.readOnly}
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
                    {/* Row 1: Search input and Filters toggle button */}
                    <div className="search-bar-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', width: '100%' }}>
                        <div style={{ position: 'relative', flex: 1, zIndex: isSearchFocused ? 9999 : 2 }}>
                            <input
                                type="text"
                                placeholder="Search library..."
                                value={filterQuery}
                                onChange={(e) => {
                                    setFilterQuery(e.target.value);
                                    if (e.target.value.trim().length >= 3 && onGuestActivity) {
                                        onGuestActivity();
                                    }
                                }}
                                onFocus={() => setIsSearchFocused(true)}
                                onBlur={() => setTimeout(() => setIsSearchFocused(false), 250)}
                                style={{
                                    width: '100%',
                                    background: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    padding: '10px 15px',
                                    borderRadius: '20px',
                                    color: '#fff',
                                    outline: 'none'
                                }}
                            />
                            {filterQuery && (
                                <button
                                    onClick={() => setFilterQuery('')}
                                    style={{ position: 'absolute', right: '15px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}
                                >&times;</button>
                            )}

                            {isSearchFocused && (
                                searchSuggestions.movies.length > 0 ||
                                searchSuggestions.years.length > 0 ||
                                searchSuggestions.genres.length > 0 ||
                                searchSuggestions.directors.length > 0 ||
                                searchSuggestions.actors.length > 0
                            ) && (
                                <div
                                    style={{
                                        position: 'absolute',
                                        top: '105%',
                                        left: 0,
                                        right: 0,
                                        background: '#151515',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '12px',
                                        zIndex: 2000,
                                        boxShadow: '0 15px 35px rgba(0,0,0,0.6)',
                                        overflow: 'hidden',
                                        padding: '5px 0',
                                        maxHeight: '400px',
                                        overflowY: 'auto'
                                    }}
                                >
                                    {/* 1. Movies / Titles Section */}
                                    {searchSuggestions.movies.length > 0 && (
                                        <div>
                                            <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 'bold', padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)', letterSpacing: '1px' }}>
                                                MOVIES ({searchSuggestions.movies.length})
                                            </div>
                                            {searchSuggestions.movies.map(item => (
                                                <div
                                                    key={item.id}
                                                    onClick={() => {
                                                        setSelectedMovie(item);
                                                        setFilterQuery('');
                                                    }}
                                                    style={{
                                                        padding: '8px 15px',
                                                        fontSize: '0.85rem',
                                                        color: '#ccc',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        transition: 'background 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                        e.currentTarget.style.color = '#fff';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'transparent';
                                                        e.currentTarget.style.color = '#ccc';
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                        <span style={{ color: 'var(--accent-gold)' }}>🎬</span>
                                                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                                            {item.title}
                                                        </span>
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', opacity: 0.8, flexShrink: 0, marginLeft: '8px' }}>
                                                        ★ {item.rating || 'N/A'} ({item.year})
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 2. Years Section */}
                                    {searchSuggestions.years.length > 0 && (
                                        <div style={{ marginTop: '5px' }}>
                                            <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 'bold', padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)', letterSpacing: '1px' }}>
                                                YEARS ({searchSuggestions.years.length})
                                            </div>
                                            {searchSuggestions.years.map(yr => (
                                                <div
                                                    key={yr}
                                                    onClick={() => {
                                                        setFilterYear([yr, yr]);
                                                        setFilterQuery('');
                                                    }}
                                                    style={{
                                                        padding: '8px 15px',
                                                        fontSize: '0.85rem',
                                                        color: '#ccc',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        transition: 'background 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                        e.currentTarget.style.color = '#fff';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'transparent';
                                                        e.currentTarget.style.color = '#ccc';
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ color: 'var(--accent-gold)' }}>📅</span> Year: {yr}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', opacity: 0.8 }}>
                                                        Show movies from {yr}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 3. Genres Section */}
                                    {searchSuggestions.genres.length > 0 && (
                                        <div style={{ marginTop: '5px' }}>
                                            <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 'bold', padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)', letterSpacing: '1px' }}>
                                                GENRES ({searchSuggestions.genres.length})
                                            </div>
                                            {searchSuggestions.genres.map(genre => (
                                                <div
                                                    key={genre}
                                                    onClick={() => {
                                                        if (!filterGenres.includes(genre)) {
                                                            setFilterGenres([...filterGenres, genre]);
                                                        }
                                                        setFilterQuery('');
                                                    }}
                                                    style={{
                                                        padding: '8px 15px',
                                                        fontSize: '0.85rem',
                                                        color: '#ccc',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        transition: 'background 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                        e.currentTarget.style.color = '#fff';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'transparent';
                                                        e.currentTarget.style.color = '#ccc';
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ color: 'var(--accent-gold)' }}>🏷️</span> {genre}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', opacity: 0.8 }}>
                                                        Filter by genre
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 4. Directors Section */}
                                    {searchSuggestions.directors.length > 0 && (
                                        <div style={{ marginTop: '5px' }}>
                                            <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 'bold', padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)', letterSpacing: '1px' }}>
                                                DIRECTORS ({searchSuggestions.directors.length})
                                            </div>
                                            {searchSuggestions.directors.map(dir => (
                                                <div
                                                    key={dir.name}
                                                    onClick={() => {
                                                        if (!filterDirectors.includes(dir.name)) {
                                                            setFilterDirectors([...filterDirectors, dir.name]);
                                                        }
                                                        setFilterQuery('');
                                                    }}
                                                    style={{
                                                        padding: '8px 15px',
                                                        fontSize: '0.85rem',
                                                        color: '#ccc',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        transition: 'background 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                        e.currentTarget.style.color = '#fff';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'transparent';
                                                        e.currentTarget.style.color = '#ccc';
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ color: 'var(--accent-gold)' }}>👤</span> {dir.name}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', opacity: 0.8 }}>
                                                        {dir.count} {dir.count === 1 ? 'movie' : 'movies'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* 5. Actors Section */}
                                    {searchSuggestions.actors.length > 0 && (
                                        <div style={{ marginTop: '5px' }}>
                                            <div style={{ fontSize: '0.7rem', color: '#666', fontWeight: 'bold', padding: '6px 12px', borderBottom: '1px solid rgba(255,255,255,0.03)', letterSpacing: '1px' }}>
                                                ACTORS ({searchSuggestions.actors.length})
                                            </div>
                                            {searchSuggestions.actors.map(act => (
                                                <div
                                                    key={act.name}
                                                    onClick={() => {
                                                        if (!filterActors.includes(act.name)) {
                                                            setFilterActors([...filterActors, act.name]);
                                                        }
                                                        setFilterQuery('');
                                                    }}
                                                    style={{
                                                        padding: '8px 15px',
                                                        fontSize: '0.85rem',
                                                        color: '#ccc',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        justifyContent: 'space-between',
                                                        alignItems: 'center',
                                                        transition: 'background 0.2s'
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                                                        e.currentTarget.style.color = '#fff';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.background = 'transparent';
                                                        e.currentTarget.style.color = '#ccc';
                                                    }}
                                                >
                                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ color: 'var(--accent-gold)' }}>🎭</span> {act.name}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', opacity: 0.8 }}>
                                                        {act.count} {act.count === 1 ? 'movie' : 'movies'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            className="btn btn-ghost"
                            onClick={() => setShowFilters(!showFilters)}
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

                    {/* Search DB Toggle replaced with a single premium, compact Checkbox */}
                    <div style={{
                        display: 'flex',
                        width: '100%',
                        padding: '2px 5px',
                        marginTop: '-4px',
                        boxSizing: 'border-box'
                    }}>
                        <label style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.82rem',
                            color: autoSwitchToCache ? '#c084fc' : '#888',
                            cursor: 'pointer',
                            userSelect: 'none',
                            transition: 'all 0.2s ease'
                        }}
                            onMouseEnter={(e) => { if (!autoSwitchToCache) e.currentTarget.style.color = '#ccc'; }}
                            onMouseLeave={(e) => { if (!autoSwitchToCache) e.currentTarget.style.color = '#888'; }}
                        >
                            <input 
                                type="checkbox" 
                                checked={autoSwitchToCache}
                                onChange={(e) => handleToggleAutoSwitch(e.target.checked)}
                                style={{
                                    accentColor: '#a855f7',
                                    width: '14px',
                                    height: '14px',
                                    cursor: 'pointer'
                                }}
                            />
                            <span>Include Website Cache matches in search results</span>
                        </label>
                    </div>

                    {/* Background Search Suggestion Banner */}
                    {searchDb === 'library' && !autoSwitchToCache && filterQuery.trim().length >= 3 && backgroundCacheResults.length > 0 && (
                        <div className="glass-panel" style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            padding: '12px 18px',
                            marginTop: '8px',
                            marginBottom: '8px',
                            borderRadius: '14px',
                            border: '1px solid rgba(168, 85, 247, 0.3)',
                            background: 'linear-gradient(90deg, rgba(168, 85, 247, 0.08) 0%, rgba(168, 85, 247, 0.03) 100%)',
                            boxShadow: '0 4px 20px rgba(168, 85, 247, 0.08), inset 0 0 10px rgba(168, 85, 247, 0.05)',
                            animation: 'fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                            boxSizing: 'border-box',
                            flexWrap: 'wrap',
                            gap: '12px'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{
                                    fontSize: '1.2rem',
                                    animation: 'pulse 1.8s infinite ease-in-out',
                                    filter: 'drop-shadow(0 0 4px rgba(251, 191, 36, 0.6))'
                                }}>💡</span>
                                <span style={{
                                    fontSize: '0.88rem',
                                    color: '#e2e8f0',
                                    lineHeight: '1.4'
                                }}>
                                    {filteredAndSortedMovies.length === 0 
                                        ? <>No matches in your library. </> 
                                        : <>Only <strong style={{ color: '#fff', textShadow: '0 0 8px rgba(255,255,255,0.2)' }}>{filteredAndSortedMovies.length}</strong> library matches. </>
                                    }
                                    Found <strong style={{ color: '#c084fc', textShadow: '0 0 8px rgba(192, 132, 252, 0.3)' }}>{backgroundCacheResults.length}</strong> movies in Website Cache!
                                </span>
                            </div>
                            <button
                                onClick={() => handleToggleAutoSwitch(true)}
                                style={{
                                    background: 'linear-gradient(135deg, #c084fc 0%, #a855f7 100%)',
                                    border: 'none',
                                    color: '#fff',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: '700',
                                    padding: '6px 14px',
                                    borderRadius: '30px',
                                    outline: 'none',
                                    boxShadow: '0 3px 10px rgba(168, 85, 247, 0.3)',
                                    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                                    whiteSpace: 'nowrap'
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.04)';
                                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(168, 85, 247, 0.45)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.boxShadow = '0 3px 10px rgba(168, 85, 247, 0.3)';
                                }}
                            >
                                🔮 Include Website Cache Matches
                            </button>
                        </div>
                    )}

                    {/* Row 2: Super Compact Controls (Type switch, View Mode, Hide Watched) */}
                    <div className="compact-controls-row" style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        flexWrap: 'nowrap'
                    }}>
                        {/* Type Switcher */}
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '15px', padding: '2px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            {[
                                { id: 'all', label: 'All' },
                                { id: 'movie', label: 'Movies' },
                                { id: 'series', label: 'Series' },
                                { id: 'cartoon', label: 'Cartoons' }
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

                        {/* View settings & Watched Toggle */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                <button 
                                    onClick={() => setViewMode('grid')}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '13px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: viewMode === 'grid' ? 'var(--accent-gold)' : 'transparent',
                                        color: viewMode === 'grid' ? '#000' : '#888',
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                    title="Grid View"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                                </button>
                                <button 
                                    onClick={() => setViewMode('table')}
                                    style={{
                                        padding: '4px 8px',
                                        borderRadius: '13px',
                                        border: 'none',
                                        cursor: 'pointer',
                                        background: viewMode === 'table' ? 'var(--accent-gold)' : 'transparent',
                                        color: viewMode === 'table' ? '#000' : '#888',
                                        display: 'flex',
                                        alignItems: 'center',
                                        transition: 'all 0.2s'
                                    }}
                                    title="Table View"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                                </button>
                            </div>

                            {/* Hide/Show Watched Button */}
                            <button
                                onClick={() => setHideWatched(!hideWatched)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '4px 10px',
                                    borderRadius: '15px',
                                    fontSize: '0.75rem',
                                    fontWeight: '500',
                                    cursor: 'pointer',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    background: hideWatched ? 'rgba(212, 175, 55, 0.15)' : 'rgba(255,255,255,0.05)',
                                    color: hideWatched ? 'var(--accent-gold)' : '#888',
                                    transition: 'all 0.2s',
                                    whiteSpace: 'nowrap'
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
                        </div>
                    </div>

                    {/* Expanded Filters Panel */}
                    <div className={`expanded-filters-panel ${showFilters ? 'is-open' : ''}`}>
                    <div className="filters-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '20px',
                        marginBottom: '20px'
                    }}>
                        {/* Genre Selection */}
                        <div style={{ gridColumn: '1 / -1' }}>
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
                                    {(showAllGenres ? availableGenres : availableGenres.slice(0, 15)).map(genre => {
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
                                    })}
                                    {availableGenres.length > 15 && (
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
                                            {showAllGenres ? 'Show Less' : `+${availableGenres.length - 15} More`}
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
                                        {availableGenres.map(genre => (
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

                        {/* Directors & Actors Row */}
                        <div className="mobile-row-layout" style={{ gridColumn: '1 / -1', display: 'contents' }}>
                            {/* Director Filter */}
                            <MultiSelectAutocomplete
                                label="Directors"
                                placeholder="Type or select directors..."
                                options={availableDirectors}
                                selected={filterDirectors}
                                onChange={setFilterDirectors}
                                accentColor="var(--accent-gold)"
                            />

                            {/* Actor Filter */}
                            <MultiSelectAutocomplete
                                label="Actors"
                                placeholder="Type or select actors..."
                                options={availableActors}
                                selected={filterActors}
                                onChange={setFilterActors}
                                accentColor="var(--accent-gold)"
                            />
                        </div>

                        {/* Reset Actions */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: '15px' }}>
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
                            <span style={{ fontSize: '0.9rem' }}>Select All ({filteredAndSortedMovies.length})</span>
                        </label>

                        {/* Right Side: Desktop Tabs / Mobile Select */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'flex-end', flex: isMobile ? '1' : 'initial' }}>
                            <div className="desktop-sort-tabs" style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 10px' }}></div>

                            <div className="sort-tabs-row desktop-sort-tabs" style={{ gap: '8px' }}>
                                <span style={{ color: '#666', flexShrink: 0 }}>Sort:</span>
                                {['created_at', 'rating', 'year', 'title', 'status'].map(field => (
                                    <button key={field} className="btn-ghost" style={{ color: sortField === field ? 'var(--accent-gold)' : 'inherit', padding: '0 5px', fontSize: '0.9rem' }}
                                        onClick={() => handleSort(field)}
                                    >{field === 'status' ? 'Watched' : field.charAt(0).toUpperCase() + field.slice(1).replace('_', ' ')} {sortField === field && (sortDir === 'asc' ? '↑' : '↓')}</button>
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
                                    <option value="year-desc" style={{ background: '#151515', color: '#fff' }}>Year (Newest)</option>
                                    <option value="year-asc" style={{ background: '#151515', color: '#fff' }}>Year (Oldest)</option>
                                    <option value="title-asc" style={{ background: '#151515', color: '#fff' }}>Title (A-Z)</option>
                                    <option value="title-desc" style={{ background: '#151515', color: '#fff' }}>Title (Z-A)</option>
                                    <option value="status-desc" style={{ background: '#151515', color: '#fff' }}>Watched Status (Watched First)</option>
                                    <option value="status-asc" style={{ background: '#151515', color: '#fff' }}>Watched Status (Unwatched First)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </>

            {viewMode === 'grid' ? (
                <div className="movie-grid-container" style={{
                    display: 'grid',
                    gridTemplateColumns: `repeat(auto-fill, minmax(${posterSize}px, 1fr))`,
                    gap: '25px'
                }}>

                    {filteredAndSortedMovies.slice(0, visibleCount).map((movie, index) => {
                        const isDeleting = deletingIds.includes(movie.id);
                        const deletingIndex = deletingIds.indexOf(movie.id);

                        // Calculate animation styles
                        let animStyle = {};
                        if (isDeleting) {
                            // Phase 1: Grayscale
                            if (animationPhase === 'grayscale') {
                                animStyle = {
                                    filter: 'grayscale(1)',
                                    transform: 'scale(0.95)',
                                    transition: 'all 0.3s ease-out'
                                };
                            }
                            // Phase 2: Stacking
                            else if (animationPhase === 'stacking' && stackPosition) {
                                const currentRect = document.querySelector(`[data-movie-id="${movie.id}"]`)?.getBoundingClientRect();
                                if (currentRect) {
                                    const deltaX = stackPosition.x - (currentRect.left + currentRect.width / 2);
                                    const deltaY = stackPosition.y - (currentRect.top + currentRect.height / 2);
                                    animStyle = {
                                        filter: 'grayscale(1)',
                                        transform: `translate(${deltaX}px, ${deltaY}px) scale(0.8) rotate(${deletingIndex * 3}deg)`,
                                        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                                        zIndex: 1000 + deletingIndex
                                    };
                                }
                            }
                            // Phase 3: Flying
                            else if (animationPhase === 'flying' && stackPosition && trashButtonPos) {
                                const deltaX = trashButtonPos.x - stackPosition.x;
                                const deltaY = trashButtonPos.y - stackPosition.y;
                                animStyle = {
                                    filter: 'grayscale(1)',
                                    transform: `translate(${deltaX}px, ${deltaY}px) scale(0.1) rotate(${deletingIndex * 15 + 360}deg)`,
                                    transition: 'all 0.6s cubic-bezier(0.6, -0.28, 0.735, 0.045)',
                                    opacity: 0.3,
                                    zIndex: 2000 + deletingIndex
                                };
                            }
                        }

                        const isHighlighted = highlightedLink && movie.link === highlightedLink;

                        return (
                            <div
                                key={movie.id}
                                data-movie-id={movie.id}
                                data-movie-link={movie.link}
                                className={`glass-panel movie-card${isHighlighted ? ' movie-highlight-pulse' : ''}`}
                                style={{
                                    position: isDeleting && animationPhase ? 'fixed' : 'relative',
                                    overflow: 'hidden',
                                    transition: isDeleting ? 'none' : 'transform 0.3s ease-out',
                                    border: isHighlighted
                                        ? '2px solid var(--accent-gold)'
                                        : selectedIds.includes(movie.id) ? '2px solid var(--accent-gold)' : '1px solid rgba(255,255,255,0.05)',
                                    aspectRatio: '2/3',
                                    borderRadius: '8px',
                                    ...animStyle
                                }}
                            >
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
                                    {/* Top Overlay Controls */}
                                    <div style={{
                                        position: 'absolute', top: '0', left: '0', width: '100%',
                                        padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                                        zIndex: 10,
                                        background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)',
                                        pointerEvents: 'none' // Allow click through to main card
                                    }}>
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
                                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', pointerEvents: 'none' }}>
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
                                        </div>

                                        <style>{`
                    .badge-ui {
                        padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #fff; 
                        font-size: 0.65rem; backdrop-filter: blur(4px); text-transform: uppercase;
                        display: inline-block;
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
                                                        margin: '4px 0 2px'
                                                    }}
                                                >
                                                    {movie.description}
                                                </div>
                                            )}

                                            {/* Quick Actions (Mini) */}
                                            <div style={{ display: 'flex', gap: '5px', marginTop: '8px' }} onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    className="btn-ghost"
                                                    title={movie.status === 'watched' ? 'Mark Unwatched' : 'Mark Watched'}
                                                    style={{
                                                        flex: 1, 
                                                        padding: isMobile ? '4px 6px' : '6px 8px', 
                                                        fontSize: isMobile ? '0.7rem' : '0.8rem',
                                                        borderRadius: '4px', 
                                                        border: '1px solid', 
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s ease', 
                                                        fontWeight: 'bold',
                                                        background: movie.status === 'watched' ? 'rgba(3, 218, 198, 0.15)' : 'rgba(255,255,255,0.05)',
                                                        borderColor: movie.status === 'watched' ? '#03dac6' : 'rgba(255,255,255,0.1)',
                                                        color: movie.status === 'watched' ? '#03dac6' : '#fff',
                                                        height: isMobile ? '28px' : 'auto',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                    onClick={async () => {
                                                        if (movie.status !== 'watched') {
                                                            await onUpdate(movie.id, { status: 'watched' });
                                                            setOpenWithWatchedPrompt(true);
                                                            setSelectedMovie({ ...movie, status: 'watched' });
                                                        } else {
                                                            await onUpdate(movie.id, { status: 'want_to_watch' });
                                                        }
                                                    }}
                                                >
                                                    {movie.status === 'watched' ? (
                                                        <span>
                                                            {movie.user_rating ? `★ ${movie.user_rating}` : '✔ Watched'}
                                                        </span>
                                                    ) : 'Watch'}
                                                </button>
                                                <button
                                                    className="btn-ghost"
                                                    title="Delete"
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
                                                    onClick={() => onDelete(movie.id)}
                                                >
                                                    🗑
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {/* Integrated Cache Results */}
                    {searchDb === 'library' && autoSwitchToCache && filteredAndSortedMovies.length < 10 && uniqueBackgroundCacheResults.length > 0 && (
                        <>
                            <div key="cache-divider" className="cache-divider" style={{
                                gridColumn: '1 / -1',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '15px',
                                margin: '40px 0 20px',
                                width: '100%',
                                animation: 'fadeIn 0.4s ease'
                            }}>
                                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(168, 85, 247, 0.4), transparent)' }}></div>
                                <span style={{
                                    fontSize: '0.78rem',
                                    color: '#c084fc',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    letterSpacing: '1px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    background: 'rgba(168, 85, 247, 0.1)',
                                    padding: '6px 16px',
                                    borderRadius: '20px',
                                    border: '1px solid rgba(168, 85, 247, 0.25)',
                                    textShadow: '0 0 10px rgba(168, 85, 247, 0.3)',
                                    whiteSpace: 'nowrap'
                                }}>
                                    🔮 Website Cache Matches (Not in Library)
                                </span>
                                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(168, 85, 247, 0.4), transparent)' }}></div>
                            </div>

                            {uniqueBackgroundCacheResults.slice(0, 30).map((movie) => {
                                return (
                                    <div
                                        key={movie.link}
                                        data-movie-link={movie.link}
                                        className="glass-panel movie-card"
                                        style={{
                                            position: 'relative',
                                            overflow: 'hidden',
                                            transition: 'transform 0.3s ease-out',
                                            border: '2px solid rgba(168, 85, 247, 0.6)',
                                            boxShadow: '0 0 12px rgba(168, 85, 247, 0.2)',
                                            aspectRatio: '2/3',
                                            borderRadius: '8px'
                                        }}
                                    >
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
                                            {/* Top Overlay Controls */}
                                            <div style={{
                                                position: 'absolute', top: '0', left: '0', width: '100%',
                                                padding: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                                                zIndex: 10,
                                                background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 100%)',
                                                pointerEvents: 'none'
                                            }}>
                                                <div style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(168, 85, 247, 0.2)', border: '1px solid rgba(168, 85, 247, 0.4)', borderRadius: '50%', width: '22px', height: '22px', fontSize: '0.9rem', boxShadow: '0 0 8px rgba(168, 85, 247, 0.3)' }} title="Website Cache Match">
                                                    🔮
                                                </div>
                                                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end', pointerEvents: 'none' }}>
                                                    {(movie.genres?.toLowerCase().includes('мульт') || movie.genres?.toLowerCase().includes('анимац') || movie.link?.includes('/cartoons/') || movie.link?.includes('/animation/')) ? (
                                                        <span className="badge-ui" style={{ background: 'rgba(255, 152, 0, 0.9)' }}>Cartoon</span>
                                                    ) : movie.genres?.toLowerCase().includes('аниме') ? (
                                                        <span className="badge-ui" style={{ background: 'rgba(233, 30, 99, 0.9)' }}>Anime</span>
                                                    ) : (
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
                                                        ★ {movie.rating || '-'}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Bottom Info Overlay */}
                                            <div style={{
                                                position: 'absolute', bottom: 0, left: 0, width: '100%',
                                                display: 'flex', flexDirection: 'column', gap: '4px',
                                                textAlign: 'left',
                                                zIndex: 5
                                            }}>
                                                <div style={{
                                                    position: 'absolute', inset: 0,
                                                    background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.8) 60%, transparent 100%)',
                                                    backdropFilter: 'blur(4px)',
                                                    WebkitBackdropFilter: 'blur(4px)',
                                                    maskImage: 'linear-gradient(to bottom, transparent 0%, black 40px)',
                                                    WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 40px)',
                                                    zIndex: -1
                                                }}></div>

                                                <div style={{ padding: '25px 10px 10px' }}>
                                                    <h3 style={{
                                                        fontSize: '1rem', lineHeight: '1.2', color: '#fff',
                                                        margin: 0, textShadow: '0 2px 4px rgba(0,0,0,0.8)',
                                                        display: '-webkit-box',
                                                        WebkitLineClamp: '2',
                                                        WebkitBoxOrient: 'vertical',
                                                        overflow: 'hidden'
                                                    }}>{movie.title}</h3>

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
                                                        <div className="movie-desc-anim" style={{
                                                            fontSize: '0.75rem', color: '#ddd',
                                                            lineHeight: '1.3',
                                                            margin: '4px 0 2px'
                                                        }}>{movie.description}</div>
                                                    )}

                                                    {/* Quick Actions */}
                                                    <div style={{ display: 'flex', gap: '5px', marginTop: '8px' }} onClick={(e) => e.stopPropagation()}>
                                                        <button
                                                            className="btn-ghost"
                                                            title="Add to Library"
                                                            style={{
                                                                flex: 1, 
                                                                padding: isMobile ? '4px 6px' : '6px 8px', 
                                                                fontSize: isMobile ? '0.7rem' : '0.8rem',
                                                                borderRadius: '4px', 
                                                                border: '1px solid', 
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease', 
                                                                fontWeight: 'bold',
                                                                background: addedLinks.has(movie.link) ? 'rgba(3, 218, 198, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                                                                borderColor: addedLinks.has(movie.link) ? '#03dac6' : 'rgba(168, 85, 247, 0.4)',
                                                                color: addedLinks.has(movie.link) ? '#03dac6' : '#c084fc',
                                                                height: isMobile ? '28px' : 'auto',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center'
                                                            }}
                                                            disabled={addingLinks.has(movie.link) || addedLinks.has(movie.link)}
                                                            onClick={async () => {
                                                                await handleAddMovieFromCache(movie.link);
                                                            }}
                                                        >
                                                            {addingLinks.has(movie.link) ? '⏳ Adding...' : addedLinks.has(movie.link) ? '✓ In My Library' : '➕ Add to Library'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                    {/* Sentinel for Infinite Scroll (Grid) */}
                    {visibleCount < filteredAndSortedMovies.length && (
                        <div ref={sentinelRef} style={{ height: '50px', width: '100%', gridColumn: '1 / -1' }} />
                    )}
                </div>
            ) : (
                <div className="glass-panel" style={{ overflowX: 'auto' }}>
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
                            {filteredAndSortedMovies.slice(0, visibleCount).map(movie => (
                                <tr key={movie.id} style={{
                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                    background: selectedIds.includes(movie.id) ? 'rgba(212, 175, 55, 0.05)' : 'transparent'
                                }}>
                                    <td
                                        style={{ padding: '15px', textAlign: 'center' }}
                                        onMouseDown={(e) => setSelectionAnchor({ x: e.clientX, y: e.clientY })}
                                    >
                                        <Checkbox
                                            checked={selectedIds.includes(movie.id)}
                                            onChange={() => toggleSelect(movie.id)}
                                        />
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
                                                onClick={async () => {
                                                    if (movie.status !== 'watched') {
                                                        await onUpdate(movie.id, { status: 'watched' });
                                                        setOpenWithWatchedPrompt(true);
                                                        setSelectedMovie({ ...movie, status: 'watched' });
                                                    } else {
                                                        await onUpdate(movie.id, { status: 'want_to_watch' });
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
                                                className="btn-ghost"
                                                title="Delete"
                                                style={{ color: 'var(--danger)', fontSize: '1.2rem', padding: '4px', lineHeight: 1 }}
                                                onClick={() => onDelete(movie.id)}
                                            >
                                                🗑
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {/* Integrated Table Cache Results */}
                            {searchDb === 'library' && autoSwitchToCache && filteredAndSortedMovies.length < 10 && uniqueBackgroundCacheResults.length > 0 && (
                                <>
                                    <tr key="cache-table-divider">
                                        <td colSpan="6" style={{ padding: '25px 15px 15px', background: 'rgba(168, 85, 247, 0.03)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', width: '100%' }}>
                                                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(168, 85, 247, 0.3), transparent)' }}></div>
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    color: '#c084fc',
                                                    fontWeight: 'bold',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '1px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    background: 'rgba(168, 85, 247, 0.1)',
                                                    padding: '4px 12px',
                                                    borderRadius: '15px',
                                                    border: '1px solid rgba(168, 85, 247, 0.2)'
                                                }}>
                                                    🔮 Results from Website Cache
                                                </span>
                                                <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(168, 85, 247, 0.3), transparent)' }}></div>
                                            </div>
                                        </td>
                                    </tr>
                                    {uniqueBackgroundCacheResults.slice(0, 30).map((movie) => (
                                        <tr key={movie.link} style={{
                                            borderBottom: '1px solid rgba(168, 85, 247, 0.15)',
                                            background: 'rgba(168, 85, 247, 0.02)',
                                            transition: 'background 0.2s'
                                        }}>
                                            <td style={{ padding: '15px', textAlign: 'center', borderLeft: '3px solid rgba(168, 85, 247, 0.6)' }}>
                                                <span style={{ fontSize: '0.9rem', opacity: 0.9 }} title="Website Cache Match">🔮</span>
                                            </td>
                                            <td style={{ padding: '10px' }}>
                                                <div className="poster-preview-wrapper">
                                                    <img
                                                        src={movie.poster_url}
                                                        alt=""
                                                        style={{ width: '40px', borderRadius: '4px', cursor: 'pointer', border: '1px solid rgba(168, 85, 247, 0.4)' }}
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
                                                    </div>
                                                    <div style={{ color: '#888', fontSize: '0.85rem' }}>{movie.original_title} ({movie.year})</div>
                                                </div>
                                            </td>
                                            <td style={{ padding: '15px', fontSize: '0.9rem', color: '#ccc', verticalAlign: 'top' }}>
                                                <div
                                                    className={`table-desc-anim ${hoveredDescId === movie.link ? 'active' : ''}`}
                                                    onMouseEnter={() => setHoveredDescId(movie.link)}
                                                    onMouseLeave={() => setHoveredDescId(null)}
                                                    style={{
                                                        lineHeight: '1.4',
                                                        whiteSpace: 'normal'
                                                    }}
                                                >
                                                    {movie.description}
                                                </div>
                                                <div style={{ fontSize: '0.8rem', color: '#c084fc', marginTop: '4px', opacity: 0.7 }}>
                                                    {movie.genres}
                                                </div>
                                            </td>
                                            <td style={{ padding: '15px', color: 'var(--accent-gold)', fontWeight: 'bold' }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                    <span>★ {movie.rating || '-'}</span>
                                                </div>
                                            </td>
                                            <td style={{ padding: '15px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <button
                                                        className="btn-ghost"
                                                        disabled={addingLinks.has(movie.link) || addedLinks.has(movie.link)}
                                                        onClick={async () => {
                                                            await handleAddMovieFromCache(movie.link);
                                                        }}
                                                        style={{
                                                            padding: '6px 12px', borderRadius: '4px', fontSize: '0.8rem',
                                                            background: addedLinks.has(movie.link) ? 'rgba(3, 218, 198, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                                                            border: addedLinks.has(movie.link) ? '1px solid #03dac6' : '1px solid rgba(168, 85, 247, 0.4)',
                                                            color: addedLinks.has(movie.link) ? '#03dac6' : '#c084fc',
                                                            whiteSpace: 'nowrap',
                                                            cursor: 'pointer',
                                                            fontWeight: 'bold',
                                                            transition: 'all 0.2s ease',
                                                            width: '140px',
                                                            textAlign: 'center'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                            e.currentTarget.style.transform = 'scale(1.03)';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            e.currentTarget.style.transform = 'scale(1)';
                                                        }}
                                                    >
                                                        {addingLinks.has(movie.link) ? '⏳ Adding...' : addedLinks.has(movie.link) ? '✓ In My Library' : '➕ Add to Library'}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </>
                            )}
                        </tbody>
                    </table>
                    {/* Sentinel for Infinite Scroll (Table) */}
                    {visibleCount < filteredAndSortedMovies.length && (
                        <div ref={sentinelRef} style={{ height: '50px', width: '100%' }} />
                    )}
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
                            <span>🔮</span> Recommendations from Website Cache (Constantly Updating)
                        </span>
                        <div style={{ flex: 1, height: '1px', background: 'linear-gradient(to right, transparent, rgba(168, 85, 247, 0.4), transparent)' }}></div>
                    </div>

                    {/* 3. Infinite Scrolling Grid */}
                    <div className="movie-grid-container" style={{
                        display: 'grid',
                        gridTemplateColumns: `repeat(auto-fill, minmax(${posterSize}px, 1fr))`,
                        gap: '25px'
                    }}>
                        {onboardingCacheMovies.map((movie, idx) => {
                            const isAdded = addedLinks.has(movie.link);
                            const isAdding = addingLinks.has(movie.link);

                            return (
                                <div
                                    key={movie.link || idx}
                                    className="movie-card glass-panel"
                                    onClick={() => setSelectedMovie({ ...movie, poster_url: movie.poster_url || movie.img, readOnly: true })}
                                    style={{
                                        position: 'relative',
                                        borderRadius: '16px',
                                        overflow: 'hidden',
                                        aspectRatio: '2/3',
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                        background: 'rgba(255,255,255,0.02)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        animation: 'fadeIn 0.4s ease',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {/* Poster Image */}
                                    <img
                                        src={movie.img}
                                        alt={movie.title}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                            pointerEvents: 'none'
                                        }}
                                        loading="lazy"
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
                                                {movie.rating && (
                                                    <span style={{ color: 'var(--accent-gold)', fontWeight: 'bold' }}>★ {movie.rating}</span>
                                                )}
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

                                            {/* Add button */}
                                            <div style={{ marginTop: '8px' }}>
                                                <button
                                                    disabled={isAdding || isAdded}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAddMovieFromCache(movie.link);
                                                    }}
                                                    className="btn"
                                                    style={{
                                                        width: '100%',
                                                        padding: '6px 10px',
                                                        borderRadius: '8px',
                                                        fontSize: '0.78rem',
                                                        fontWeight: 'bold',
                                                        cursor: (isAdding || isAdded) ? 'default' : 'pointer',
                                                        border: '1px solid',
                                                        background: isAdded ? 'rgba(3, 218, 198, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                                                        borderColor: isAdded ? '#03dac6' : 'rgba(168, 85, 247, 0.4)',
                                                        color: isAdded ? '#03dac6' : '#c084fc',
                                                        transition: 'all 0.2s ease',
                                                        textAlign: 'center'
                                                    }}
                                                >
                                                    {isAdding ? '⏳ Adding...' : isAdded ? '✓ In My Library' : '➕ Add to Library'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Onboarding Infinite Scroll Sentinel */}
                    {hasMoreOnboarding && (
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
