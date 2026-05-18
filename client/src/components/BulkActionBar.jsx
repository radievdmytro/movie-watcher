import { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';

function BulkActionBar({ selectedCount, onDelete, onRefresh, onRestore, onAddToCollection, onCancelSelection, isTrashMode, anchor }) {
    const [isVisible, setIsVisible] = useState(false);
    const [lastAnchor, setLastAnchor] = useState(null);
    const nodeRef = useRef(null);

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

    const activeAnchor = anchor || lastAnchor;
    const posTop = activeAnchor ? `${activeAnchor.y}px` : '85px';
    const posLeft = activeAnchor ? `${activeAnchor.x}px` : '50%';

    const show = selectedCount > 0;
    const translate = activeAnchor ? 'translate(25px, -50%)' : 'translateX(-50%)';
    const scale = show ? 'scale(1)' : 'scale(0.1)';

    return (
        <Draggable nodeRef={nodeRef} handle=".drag-handle">
            <div 
                ref={nodeRef}
                style={{
                    position: 'fixed',
                    top: posTop,
                    left: posLeft,
                    opacity: show ? 1 : 0,
                    // apply scale/opacity on show/hide, but let top/left animate smoothly
                    transform: `${translate} ${scale}`,
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
                    transition: show
                        ? 'opacity 0.2s ease-out, top 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), left 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)'
                        : 'opacity 0.2s ease-in, transform 0.3s ease-in',
                    whiteSpace: 'nowrap',
                    cursor: 'default'
                }}
            >
                <div className="drag-handle" style={{ cursor: 'grab', padding: '0 5px', color: '#666' }}>
                    ⋮⋮
                </div>

                <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span><span style={{ color: 'var(--accent-gold)' }}>{selectedCount}</span> Selected</span>
                    <button
                        onClick={onCancelSelection}
                        className="btn-ghost"
                        style={{ color: '#aaa', padding: '0px 4px', fontSize: '1.1rem', marginTop: '-2px' }}
                        title="Deselect All"
                    >
                        ✕
                    </button>
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
        </Draggable>
    );
}

export default BulkActionBar;
