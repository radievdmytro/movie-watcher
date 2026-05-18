import { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';

function BulkActionBar({ selectedCount, onDelete, onRefresh, onRestore, onAddToCollection, isTrashMode }) {
    const [isVisible, setIsVisible] = useState(false);
    const nodeRef = useRef(null);

    // Coordinate state for appearance and exit animations
    useEffect(() => {
        if (selectedCount > 0) {
            setIsVisible(true);
        } else {
            const timer = setTimeout(() => {
                setIsVisible(false);
            }, 300); // Wait for fade-out
            return () => clearTimeout(timer);
        }
    }, [selectedCount]);

    if (!isVisible && selectedCount === 0) return null;

    const show = selectedCount > 0;

    return (
        <Draggable nodeRef={nodeRef} handle=".drag-handle">
            <div 
                ref={nodeRef}
                style={{
                    position: 'fixed',
                    bottom: '40px',
                    left: '50%',
                    marginLeft: '-150px', // Roughly center it
                    opacity: show ? 1 : 0,
                    transform: show ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)',
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
                        ? 'opacity 0.2s ease-out, transform 0.2s ease-out'
                        : 'opacity 0.2s ease-in, transform 0.2s ease-in',
                    whiteSpace: 'nowrap',
                    cursor: 'default'
                }}
            >
                <div className="drag-handle" style={{ cursor: 'grab', padding: '0 5px', color: '#666' }}>
                    ⋮⋮
                </div>

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
        </Draggable>
    );
}

export default BulkActionBar;
