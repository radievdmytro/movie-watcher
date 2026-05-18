import { useState, useEffect, useMemo, useRef } from 'react';
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
                top: rect.bottom + window.scrollY,
                left: rect.left + window.scrollX,
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
        const handleScroll = () => setIsOpen(false);
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
                
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                        setInputValue(e.target.value);
                        openDropdown();
                    }}
                    onFocus={() => openDropdown()}
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

            {isOpen && dropdownRect && (
                <div 
                    style={{
                        position: 'fixed',
                        top: `${dropdownRect.top + 6}px`,
                        left: `${dropdownRect.left}px`,
                        width: `${dropdownRect.width}px`,
                        background: '#151515',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '10px',
                        maxHeight: '432px',
                        overflowY: 'auto',
                        zIndex: 99999,
                        boxShadow: '0 15px 40px rgba(0,0,0,0.7)',
                        padding: '4px 0'
                    }}
                >
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
                    ) : (
                        <div 
                            onClick={() => {
                                if (inputValue.trim()) {
                                    handleSelect(inputValue.trim());
                                }
                            }}
                            style={{
                                padding: '8px 12px',
                                color: accentColor,
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                fontStyle: 'italic'
                            }}
                        >
                            Press to filter by custom text: "{inputValue}"
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

function MovieGrid({ movies, onUpdate, onDelete, selectedIds, onSelect, onSelectAll, setSelectionAnchor, deletingIds = [], trashButtonRef, isTrashMode, highlightedLink }) {
    const [sortField, setSortField] = useState('created_at');
    const [sortDir, setSortDir] = useState('desc');
    const [hideWatched, setHideWatched] = useState(false);
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
        if (!filterQuery.trim()) return { directors: [], actors: [], years: [] };
        const query = filterQuery.toLowerCase().trim();

        // 1. Directors
        const matchedDirectors = availableDirectors.filter(d => 
            d && d.name && d.name.toLowerCase().includes(query)
        ).slice(0, 5);

        // 2. Actors
        const matchedActors = availableActors.filter(a => 
            a && a.name && a.name.toLowerCase().includes(query)
        ).slice(0, 5);

        // 3. Years
        const uniqueYears = Array.from(new Set(movies.map(m => m.year).filter(y => y)));
        const matchedYears = uniqueYears.filter(y => 
            y.toString().includes(query)
        ).sort((a, b) => b - a).slice(0, 5);

        return {
            directors: matchedDirectors,
            actors: matchedActors,
            years: matchedYears
        };
    }, [filterQuery, availableDirectors, availableActors, movies]);

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

    const filteredAndSortedMovies = useMemo(() => {
        return [...movies]
            .filter(movie => {
                // Text Search
                if (filterQuery) {
                    const q = filterQuery.toLowerCase().trim();
                    const searchStr = `${movie.title} ${movie.original_title} ${movie.description}`.toLowerCase();
                    let matches = searchStr.includes(q);

                    if (!matches && movie.link) {
                        const cleanUrl = (url) => {
                            if (!url) return '';
                            return url
                                .toLowerCase()
                                .replace(/^https?:\/\/[^\/]+/, '') // strip domain and protocol
                                .replace(/^\/+|\/+$/g, '')         // strip leading/trailing slashes
                                .split('?')[0]                     // strip query params
                                .split('#')[0];                    // strip hash
                        };

                        const cleanQ = cleanUrl(q);
                        const cleanM = cleanUrl(movie.link);

                        if (cleanQ && cleanM && (cleanM.includes(cleanQ) || cleanQ.includes(cleanM))) {
                            matches = true;
                        } else {
                            // Match by numeric ID (e.g. 799863)
                            const queryId = q.match(/\b\d{4,9}\b/)?.[0] || q.match(/(?:film|series|movie)\/(\d+)/)?.[1];
                            const movieLinkId = movie.link.toLowerCase().match(/\b\d{4,9}\b/)?.[0] || movie.link.toLowerCase().match(/(?:film|series|movie)\/(\d+)/)?.[1];
                            if (queryId && movieLinkId && queryId === movieLinkId) {
                                matches = true;
                            }
                        }
                    }

                    if (!matches) return false;
                }

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
                let valA = a[sortField];
                let valB = b[sortField];

                if (valA === null) valA = '';
                if (valB === null) valB = '';

                if (valA < valB) return sortDir === 'asc' ? -1 : 1;
                if (valA > valB) return sortDir === 'asc' ? 1 : -1;
                return 0;
            });
    }, [movies, sortField, sortDir, filterQuery, filterGenres, filterDirectors, filterActors, filterRating, filterYear, filterType, filterGenreMode, hideWatched]);

    // Reset visible count when filters change
    useEffect(() => {
        setVisibleCount(30);
    }, [filterQuery, filterGenres, filterDirectors, filterActors, filterRating, filterYear, filterType, filterGenreMode, sortField, sortDir, hideWatched]);

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

    const handleSort = (field) => {
        if (sortField === field) {
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
            {/* Modal for Details ... */}
            {selectedMovie && (
                <MovieDetailsModal
                    movie={selectedMovie}
                    openWithWatchedPrompt={openWithWatchedPrompt}
                    onClose={() => { setSelectedMovie(null); setOpenWithWatchedPrompt(false); }}
                    onUpdate={handleUpdateMovie}
                    onDelete={onDelete}
                    isTrashMode={isTrashMode}
                    isSelected={selectedIds ? selectedIds.includes(selectedMovie.id) : false}
                    onSelectToggle={selectedIds && onSelect ? () => {
                        if (selectedIds.includes(selectedMovie.id)) {
                            onSelect(selectedIds.filter(sid => sid !== selectedMovie.id));
                        } else {
                            onSelect([...selectedIds, selectedMovie.id]);
                        }
                    } : undefined}
                />
            )}

            <>
                <div className="controls-top-bar sticky-search-bar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '15px' }}>
                    <div className="controls-top-left" style={{ display: 'flex', gap: '15px', alignItems: 'center', flex: 1, minWidth: '280px' }}>
                        <div style={{ position: 'relative', flex: 1, zIndex: isSearchFocused ? 9999 : 2 }}>
                            <input
                                type="text"
                                placeholder="Search library..."
                                value={filterQuery}
                                onChange={(e) => setFilterQuery(e.target.value)}
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

                            {isSearchFocused && (searchSuggestions.directors.length > 0 || searchSuggestions.actors.length > 0 || searchSuggestions.years.length > 0) && (
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
                                        padding: '5px 0'
                                    }}
                                >
                                    {/* Directors Section */}
                                    {searchSuggestions.directors.length > 0 && (
                                        <div>
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
                                                        <span style={{ color: 'var(--accent-gold)' }}>🎬</span> {dir.name}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--accent-gold)', opacity: 0.8 }}>
                                                        {dir.count} {dir.count === 1 ? 'movie' : 'movies'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Actors Section */}
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

                                    {/* Years Section */}
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
                                </div>
                            )}
                        </div>

                        {/* Type Switcher */}
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', borderRadius: '20px', padding: '2px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            {[
                                { id: 'all', label: 'All' },
                                { id: 'movie', label: 'Movies' },
                                { id: 'series', label: 'Series' },
                                { id: 'cartoon', label: 'Cartoon' }
                            ].map(type => (
                                <button
                                    key={type.id}
                                    onClick={() => setFilterType(type.id)}
                                    style={{
                                        padding: '6px 15px',
                                        borderRadius: '18px',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        border: 'none',
                                        background: filterType === type.id ? 'var(--accent-gold)' : 'transparent',
                                        color: filterType === type.id ? '#000' : '#888',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {type.label}
                                </button>
                            ))}
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
                                padding: '8px 15px'
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                            Filters {
                                (filterGenres.length > 0 || filterDirectors.length > 0 || filterActors.length > 0) && 
                                `(${filterGenres.length + filterDirectors.length + filterActors.length})`
                            }
                        </button>
                    </div>

                    <div className="controls-bottom-bar" style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                            {viewMode === 'grid' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#666' }}>Poster:</span>
                                    <input
                                        type="range" min="150" max="400" value={posterSize} onChange={handleSizeChange}
                                        style={{ accentColor: 'var(--accent-gold)', width: '80px', cursor: 'pointer' }}
                                    />
                                </div>
                            )}
                        </div>
                        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', padding: '2px' }}>
                            {['grid', 'table'].map(mode => (
                                <button key={mode} onClick={() => setViewMode(mode)} className="btn-ghost"
                                    style={{ padding: '5px 10px', background: viewMode === mode ? 'rgba(255,255,255,0.1)' : 'transparent', color: viewMode === mode ? '#fff' : '#888' }}
                                >{mode.charAt(0).toUpperCase() + mode.slice(1)}</button>
                            ))}
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#ccc', fontSize: '0.85rem', marginLeft: '10px' }}>
                            <input 
                                type="checkbox" 
                                checked={hideWatched} 
                                onChange={(e) => setHideWatched(e.target.checked)} 
                                style={{ width: '16px', height: '16px', accentColor: 'var(--accent-gold)' }} 
                            />
                            Hide Watched
                        </label>
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

                        {/* Rating Range */}
                        <div>
                            <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                <span>Rating</span>
                                <span style={{ color: 'var(--accent-gold)' }}>{filterRating[0]} - {filterRating[1]}</span>
                            </div>
                            <Histogram data={ratingDistribution} currentRange={filterRating} min={0} max={10} />
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
                            <Histogram data={yearDistribution} currentRange={filterYear} min={minBoundYear} max={maxBoundYear} />
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

                        {/* Reset Actions */}
                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
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

                <div className="controls-section-rest" style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '25px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                        <label
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#aaa' }}
                            onMouseDown={(e) => setSelectionAnchor({ x: e.clientX, y: e.clientY })}
                        >
                            <Checkbox checked={isAllSelected} onChange={handleSelectAll} />
                            <span style={{ fontSize: '0.9rem' }}>Select All ({filteredAndSortedMovies.length})</span>
                        </label>

                        <div style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.1)', margin: '0 10px' }}></div>

                        <div className="sort-tabs-row" style={{ gap: '8px' }}>
                            <span style={{ color: '#666', flexShrink: 0 }}>Sort:</span>
                            {['created_at', 'rating', 'year', 'title', 'status'].map(field => (
                                <button key={field} className="btn-ghost" style={{ color: sortField === field ? 'var(--accent-gold)' : 'inherit', padding: '0 5px', fontSize: '0.9rem' }}
                                    onClick={() => handleSort(field)}
                                >{field === 'status' ? 'Watched' : field.charAt(0).toUpperCase() + field.slice(1).replace('_', ' ')} {sortField === field && (sortDir === 'asc' ? '↑' : '↓')}</button>
                            ))}
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
                                                background: 'rgba(0,0,0,0.6)', padding: '2px 6px', borderRadius: '4px',
                                                fontWeight: 'bold', color: 'var(--accent-gold)', fontSize: '0.8rem',
                                                backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', gap: '4px'
                                            }}>
                                                {movie.rating ? `★ ${movie.rating}` : '-'}
                                                {movie.user_rating && (
                                                    <span style={{ color: '#03dac6', borderLeft: '1px solid #444', paddingLeft: '5px', marginLeft: '2px' }}>
                                                        👤 ★ {movie.user_rating}
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
                                                <span style={{ color: movie.status === 'watched' ? '#03dac6' : '#d4af37', fontWeight: 'bold' }}>
                                                    {movie.status === 'watched' ? `Watched ${movie.user_rating ? `(★ ${movie.user_rating})` : ''}` : 'To Watch'}
                                                </span>
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
                                                        flex: 1, padding: '6px 8px', fontSize: '0.8rem',
                                                        borderRadius: '4px', border: '1px solid', cursor: 'pointer',
                                                        transition: 'all 0.2s ease', fontWeight: 'bold',
                                                        background: movie.status === 'watched' ? 'rgba(3, 218, 198, 0.15)' : 'rgba(255,255,255,0.05)',
                                                        borderColor: movie.status === 'watched' ? '#03dac6' : 'rgba(255,255,255,0.1)',
                                                        color: movie.status === 'watched' ? '#03dac6' : '#fff',
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
                                                            {movie.community_rating ? ` (${movie.community_rating})` : ''}
                                                        </span>
                                                    ) : 'Watch'}
                                                </button>
                                                <button
                                                    className="btn-ghost"
                                                    title="Delete"
                                                    style={{ padding: '4px 8px', background: 'rgba(255,0,0,0.2)', color: '#ff6b6b', borderRadius: '4px' }}
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
                        </tbody>
                    </table>
                    {/* Sentinel for Infinite Scroll (Table) */}
                    {visibleCount < filteredAndSortedMovies.length && (
                        <div ref={sentinelRef} style={{ height: '50px', width: '100%' }} />
                    )}
                </div>
            )}
        </div>
    );
}

export default MovieGrid;
