import React, { useState, useEffect, useRef } from 'react';

export default function BulkImportModal({ isOpen, onClose, onMovieAdded }) {
    const [text, setText] = useState('');
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const [logs, setLogs] = useState([]);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const abortRef = useRef(false);
    const terminalEndRef = useRef(null);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
            abortRef.current = false;
        } else {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            if (!importing) {
                setText('');
                setLogs([]);
                setProgress({ current: 0, total: 0 });
            }
        }
        return () => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
        };
    }, [isOpen, importing]);

    // Auto-scroll the terminal to the bottom
    useEffect(() => {
        if (terminalEndRef.current) {
            terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    if (!isOpen) return null;

    const parseTitles = (rawText) => {
        if (!rawText) return [];
        let items = [];
        if (rawText.includes('\n')) {
            items = rawText.split('\n');
        } else if (rawText.includes(',')) {
            items = rawText.split(',');
        } else {
            items = [rawText];
        }
        
        return items
            .map(item => item.trim())
            .filter(item => item.length > 0);
    };

    const handleStop = () => {
        abortRef.current = true;
        setLogs(prev => [...prev, { msg: '🛑 Stop request received. Terminating import loop...', type: 'warning' }]);
    };

    const startImport = async () => {
        const titles = parseTitles(text);
        if (titles.length === 0) {
            setLogs([{ msg: '⚠ Please enter at least one movie title.', type: 'error' }]);
            return;
        }

        setImporting(true);
        abortRef.current = false;
        setProgress({ current: 0, total: titles.length });
        
        const newLogs = [{ msg: `🚀 Starting import of ${titles.length} movies...`, type: 'info' }];
        setLogs(newLogs);

        const token = localStorage.getItem('token');
        
        for (let i = 0; i < titles.length; i++) {
            if (abortRef.current) {
                newLogs.push({ msg: '⏹ Import stopped by admin.', type: 'error' });
                setLogs([...newLogs]);
                break;
            }

            const title = titles[i];
            setProgress(prev => ({ ...prev, current: i + 1 }));
            
            newLogs.push({ msg: `[${i + 1}/${titles.length}] 🔍 Searching for "${title}"...`, type: 'info' });
            setLogs([...newLogs]);

            try {
                // 1. Search for matching movie
                const searchRes = await fetch('/api/movies/search', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ query: title })
                });

                if (!searchRes.ok) {
                    throw new Error(`Search returned HTTP status ${searchRes.status}`);
                }

                const searchData = await searchRes.json();
                
                if (searchData.type === 'list' && searchData.data && searchData.data.length > 0) {
                    // Look for closest title match or fall back to first result
                    let bestMatch = searchData.data[0];
                    const exactMatch = searchData.data.find(m => 
                        m.title?.toLowerCase() === title.toLowerCase() || 
                        m.original_title?.toLowerCase() === title.toLowerCase()
                    );
                    if (exactMatch) bestMatch = exactMatch;

                    newLogs.push({ msg: `🔗 Found match: "${bestMatch.title}" (${bestMatch.year || 'N/A'}). Scraping details...`, type: 'info' });
                    setLogs([...newLogs]);

                    // 2. Import details via link
                    const importRes = await fetch('/api/movies/import', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ url: bestMatch.link })
                    });

                    const importData = await importRes.json();

                    if (importRes.ok) {
                        newLogs.push({ msg: `✓ Successfully Imported: "${bestMatch.title}"`, type: 'success' });
                    } else if (importRes.status === 409) {
                        newLogs.push({ msg: `ℹ Already in library: "${bestMatch.title}"`, type: 'warning' });
                    } else {
                        newLogs.push({ msg: `✗ Import Failed: ${importData.error || 'Unknown error'}`, type: 'error' });
                    }
                } else if (searchData.type === 'detail' && searchData.data) {
                    const detailData = searchData.data;
                    newLogs.push({ msg: `🔗 Direct match: "${detailData.title}". Adding...`, type: 'info' });
                    setLogs([...newLogs]);

                    const addRes = await fetch('/api/movies', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify(detailData)
                    });

                    const addData = await addRes.json();
                    if (addRes.ok) {
                        newLogs.push({ msg: `✓ Successfully Added: "${detailData.title}"`, type: 'success' });
                    } else if (addRes.status === 409) {
                        newLogs.push({ msg: `ℹ Already in library: "${detailData.title}"`, type: 'warning' });
                    } else {
                        newLogs.push({ msg: `✗ Failed to add: ${addData.error || 'Unknown error'}`, type: 'error' });
                    }
                } else {
                    newLogs.push({ msg: `✗ No matches found for: "${title}"`, type: 'error' });
                }
            } catch (err) {
                console.error(err);
                newLogs.push({ msg: `✗ Error importing "${title}": ${err.message}`, type: 'error' });
            }
            
            setLogs([...newLogs]);
            
            // Moderate safety pause to respect anti-bot/anti-spam thresholds (1 second delay)
            if (i < titles.length - 1 && !abortRef.current) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        if (!abortRef.current) {
            newLogs.push({ msg: '🏁 Bulk Movie Import Process Complete!', type: 'success' });
            setLogs([...newLogs]);
        }
        
        setImporting(false);
        onMovieAdded();
    };

    const parsedTitlesCount = parseTitles(text).length;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0, right: 0,
            height: isMobile ? '100svh' : '100vh',
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            zIndex: 300005,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: isMobile ? '12px' : '20px',
            animation: 'fadeIn 0.3s ease-out'
        }} onMouseDown={importing ? undefined : onClose}>
            <div
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '650px',
                    maxHeight: isMobile ? 'calc(100svh - 24px)' : '88vh',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'scaleIn 0.35s cubic-bezier(0.165, 0.84, 0.44, 1)',
                }}
            >
                {/* Close Button */}
                {!importing && (
                    <div style={{
                        position: 'absolute',
                        top: '15px',
                        right: '15px',
                        zIndex: 100,
                    }}>
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-ghost"
                            style={{
                                fontSize: '1.2rem',
                                padding: 0,
                                width: '38px',
                                height: '38px',
                                borderRadius: '50%',
                                background: 'rgba(0, 0, 0, 0.65)',
                                border: '1px solid rgba(255, 255, 255, 0.25)',
                                color: '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
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
                )}

                <div
                    className="glass-panel"
                    style={{
                        width: '100%',
                        maxHeight: 'inherit',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        borderRadius: '24px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                    }}
                >
                    {/* Header */}
                    <div style={{
                        padding: '20px 24px',
                        borderBottom: '1px solid rgba(255,255,255,0.06)',
                        display: 'flex',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.02)',
                        flexShrink: 0,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '1.4rem' }}>📝</span>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600, color: '#fff' }}>
                                Bulk Movie Import (Списком)
                            </h3>
                        </div>
                    </div>

                    {/* Content Scroll Area */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        
                        {!importing && logs.length === 0 ? (
                            <>
                                <p style={{ fontSize: '0.85rem', color: '#aaa', margin: '0 0 5px 0', lineHeight: 1.5 }}>
                                    Paste a list of movie titles below. Place **each movie on a new line** or separate them **with commas**. We will search our cache and HDRezka to import them.
                                </p>
                                
                                <textarea
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    placeholder="Examples:&#10;Inception&#10;Interstellar, The Matrix&#10;Семь&#10;Бойцовский клуб"
                                    style={{
                                        width: '100%',
                                        height: '180px',
                                        background: 'rgba(0, 0, 0, 0.4)',
                                        border: '1px solid rgba(255, 255, 255, 0.1)',
                                        borderRadius: '12px',
                                        padding: '12px 15px',
                                        color: '#fff',
                                        fontFamily: 'inherit',
                                        fontSize: '0.9rem',
                                        lineHeight: 1.5,
                                        outline: 'none',
                                        resize: 'none',
                                        boxSizing: 'border-box'
                                    }}
                                    disabled={importing}
                                />
                                
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', color: '#666' }}>
                                        Detected: <strong style={{ color: 'var(--accent-gold)' }}>{parsedTitlesCount}</strong> movies
                                    </span>
                                    
                                    <button
                                        onClick={startImport}
                                        disabled={parsedTitlesCount === 0 || importing}
                                        className="btn btn-gold"
                                        style={{
                                            padding: '8px 24px',
                                            borderRadius: '20px',
                                            fontWeight: 'bold',
                                            fontSize: '0.85rem',
                                            cursor: parsedTitlesCount === 0 ? 'not-allowed' : 'pointer',
                                            opacity: parsedTitlesCount === 0 ? 0.5 : 1
                                        }}
                                    >
                                        🚀 Start Bulk Import
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Progress Display */}
                                <div style={{
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    border: '1px solid rgba(255, 255, 255, 0.05)',
                                    borderRadius: '12px',
                                    padding: '15px 20px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '8px'
                                }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#aaa' }}>
                                        <span>Import Progress:</span>
                                        <span style={{ fontWeight: 'bold', color: 'var(--accent-gold)' }}>
                                            {progress.current} of {progress.total} processed
                                        </span>
                                    </div>
                                    <div style={{
                                        height: '6px',
                                        background: 'rgba(255,255,255,0.08)',
                                        borderRadius: '3px',
                                        overflow: 'hidden'
                                    }}>
                                        <div style={{
                                            height: '100%',
                                            width: `${(progress.current / progress.total) * 100}%`,
                                            background: 'linear-gradient(to right, var(--accent-gold), #ffe066)',
                                            transition: 'width 0.3s ease',
                                            borderRadius: '3px'
                                        }} />
                                    </div>
                                </div>

                                {/* Terminal Console Log */}
                                <div style={{
                                    flex: 1,
                                    background: 'rgba(0,0,0,0.5)',
                                    border: '1px solid rgba(255,255,255,0.06)',
                                    borderRadius: '12px',
                                    padding: '15px',
                                    minHeight: '220px',
                                    maxHeight: '260px',
                                    overflowY: 'auto',
                                    fontFamily: 'monospace',
                                    fontSize: '0.82rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '6px',
                                    boxSizing: 'border-box'
                                }}>
                                    {logs.map((log, index) => {
                                        let color = '#aaa';
                                        if (log.type === 'success') color = '#03dac6';
                                        if (log.type === 'error') color = '#ff6b6b';
                                        if (log.type === 'warning') color = '#ffe066';
                                        if (log.type === 'info') color = '#c084fc';
                                        return (
                                            <div key={index} style={{ color, whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>
                                                {log.msg}
                                            </div>
                                        );
                                    })}
                                    <div ref={terminalEndRef} />
                                </div>

                                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '10px' }}>
                                    {importing ? (
                                        <button
                                            onClick={handleStop}
                                            className="btn"
                                            style={{
                                                padding: '8px 20px',
                                                borderRadius: '20px',
                                                background: 'rgba(255, 77, 77, 0.1)',
                                                border: '1px solid rgba(255, 77, 77, 0.3)',
                                                color: '#ff4d4d',
                                                fontSize: '0.85rem',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            🛑 Stop Import
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => { setLogs([]); setProgress({ current: 0, total: 0 }); }}
                                            className="btn btn-gold"
                                            style={{
                                                padding: '8px 24px',
                                                borderRadius: '20px',
                                                fontSize: '0.85rem',
                                                fontWeight: 'bold',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            ✍ Import Another List
                                        </button>
                                    )}
                                </div>
                            </>
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
            `}} />
        </div>
    );
}
