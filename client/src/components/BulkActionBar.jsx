import { useState, useEffect } from 'react';

function BulkActionBar({ selectedCount, onDelete, onRefresh, onRestore, onAddToCollection, isTrashMode, anchor }) {
    const [isVisible, setIsVisible] = useState(false);
    const [lastAnchor, setLastAnchor] = useState(null);

    // Sync last transition anchor
    useEffect(() => {
        if (anchor) setLastAnchor(anchor);
    }, [anchor]);

    // Coordinate state for appearance and exit animations
    useEffect(() => {
        if (selectedCount > 0) {
            setIsVisible(true);
        } else {
            const timer = setTimeout(() => {
                setIsVisible(false);
                setLastAnchor(null);
            }, 300); // Wait for fade-out
            return () => clearTimeout(timer);
        }
    }, [selectedCount]);

    if (!isVisible && selectedCount === 0) return null;

    // Fixed positioning at bottom center
    const show = selectedCount > 0;
    
    return (
        <div style={{
            position: 'fixed',
            bottom: '30px',
            left: '50%',
            transform: show ? 'translate(-50%, 0)' : 'translate(-50%, 50px)',
            opacity: show ? 1 : 0,
            pointerEvents: show ? 'auto' : 'none',
            background: 'rgba(31, 31, 31, 0.95)',
            backdropFilter: 'blur(10px)',
            padding: '10px 20px',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
            display: 'flex',
            gap: '15px',
            alignItems: 'center',
            zIndex: 2500,
            border: '1px solid var(--accent-gold)',
            transition: 'opacity 0.3s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            whiteSpace: 'nowrap'
        }}>
            <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--accent-gold)' }}>{selectedCount}</span> Selected
            </div>

            <div style={{ height: '16px', width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>

            {!isTrashMode ? (
                <>
                    <button
                        onClick={onRefresh}
                        className="btn-ghost"
                        style={{ color: '#fff', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 8px' }}
                    >
                        ⟳ Refresh
                    </button>
                    <div style={{ height: '16px', width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                    <button
                        onClick={onAddToCollection}
                        className="btn-ghost"
                        style={{ color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 8px' }}
                    >
                        📁 Add to Collection
                    </button>
                    <div style={{ height: '16px', width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                    <button
                        onClick={onDelete}
                        className="btn-ghost"
                        style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 8px' }}
                    >
                        🗑 Delete
                    </button>
                </>
            ) : (
                <>
                    <button
                        onClick={onRestore}
                        className="btn-ghost"
                        style={{ color: '#03dac6', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 8px' }}
                    >
                        ↩ Restore
                    </button>
                    <div style={{ height: '16px', width: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                    <button
                        onClick={onDelete}
                        className="btn-ghost"
                        style={{ color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', padding: '4px 8px' }}
                    >
                        × Delete
                    </button>
                </>
            )}
        </div>
    );
}

export default BulkActionBar;
