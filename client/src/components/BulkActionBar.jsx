import { useState, useEffect, useRef } from 'react';
import Draggable from 'react-draggable';

const COLLAPSE_MS = 360;

function CollapsingDivider({ visible, vertical = true }) {
    const size = vertical ? { height: '16px', width: '1px' } : { height: '14px', width: '1px' };
    return (
        <div
            aria-hidden={!visible}
            style={{
                ...size,
                background: 'rgba(255,255,255,0.1)',
                overflow: 'hidden',
                flexShrink: 0,
                maxWidth: visible ? '1px' : 0,
                maxHeight: visible ? (vertical ? '16px' : '14px') : 0,
                opacity: visible ? 1 : 0,
                margin: visible ? undefined : 0,
                transition: `max-width ${COLLAPSE_MS}ms cubic-bezier(0.165, 0.84, 0.44, 1), max-height ${COLLAPSE_MS}ms cubic-bezier(0.165, 0.84, 0.44, 1), opacity ${COLLAPSE_MS * 0.7}ms ease, margin ${COLLAPSE_MS}ms cubic-bezier(0.165, 0.84, 0.44, 1)`,
            }}
        />
    );
}

function CollapsingCompareSlot({ visible, isMobile, onCompare }) {
    return (
        <div
            style={{
                display: 'flex',
                alignItems: 'center',
                overflow: 'hidden',
                flexShrink: 0,
                maxWidth: visible ? (isMobile ? 36 : 130) : 0,
                opacity: visible ? 1 : 0,
                pointerEvents: visible ? 'auto' : 'none',
                transition: `max-width ${COLLAPSE_MS}ms cubic-bezier(0.165, 0.84, 0.44, 1), opacity ${COLLAPSE_MS * 0.75}ms ease`,
            }}
        >
            <button
                onClick={onCompare}
                className={isMobile ? undefined : 'btn-ghost'}
                style={
                    isMobile
                        ? {
                              background: 'none',
                              border: 'none',
                              color: '#fff',
                              padding: '4px',
                              fontSize: '1rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              whiteSpace: 'nowrap',
                          }
                        : {
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              fontSize: '0.8rem',
                              padding: '4px 8px',
                              whiteSpace: 'nowrap',
                          }
                }
                title="Compare selected"
            >
                ⚖️{!isMobile && ' Compare'}
            </button>
        </div>
    );
}

function BulkActionBar({ selectedCount, onDelete, onRefresh, onRestore, onAddToCollection, onCompare, onCancelSelection, isTrashMode, anchor }) {
    const [isVisible, setIsVisible] = useState(false);
    const [lastAnchor, setLastAnchor] = useState(null);
    const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
    const nodeRef = useRef(null);

    // Track resize for responsiveness
    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth <= 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
    const compareMax = isMobile ? 3 : 4;
    const showCompare = !isTrashMode && selectedCount >= 2 && selectedCount <= compareMax && onCompare;
    const translate = activeAnchor ? 'translate(25px, -50%)' : 'translateX(-50%)';
    const scale = show ? 'scale(1)' : 'scale(0.1)';
    const barTransition = `all ${COLLAPSE_MS}ms cubic-bezier(0.165, 0.84, 0.44, 1), opacity 0.3s cubic-bezier(0.165, 0.84, 0.44, 1)`;

    const styleMobile = {
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: show ? 'translate(-50%, 0) scale(1)' : 'translate(-50%, 40px) scale(0.8)',
        opacity: show ? 1 : 0,
        pointerEvents: show ? 'auto' : 'none',
        background: 'rgba(20, 20, 20, 0.96)',
        backdropFilter: 'blur(16px)',
        padding: '8px 14px',
        borderRadius: '30px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.05)',
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        zIndex: 2500,
        border: '1px solid var(--accent-gold)',
        transition: barTransition,
        whiteSpace: 'nowrap',
        cursor: 'default'
    };

    const styleDesktop = {
        position: 'fixed',
        top: posTop,
        left: posLeft,
        opacity: show ? 1 : 0,
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
            ? `${barTransition}, top 0.4s cubic-bezier(0.2, 0.8, 0.2, 1), left 0.4s cubic-bezier(0.2, 0.8, 0.2, 1)`
            : 'opacity 0.2s ease-in, transform 0.3s ease-in',
        whiteSpace: 'nowrap',
        cursor: 'default'
    };

    if (isMobile) {
        return (
            <div ref={nodeRef} style={styleMobile}>
                <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <span style={{ color: 'var(--accent-gold)' }}>{selectedCount}</span>
                    <span style={{ color: '#aaa', fontSize: '0.78rem' }}>Selected</span>
                    <button
                        onClick={onCancelSelection}
                        style={{
                            background: 'none', border: 'none', color: '#ff6b6b',
                            padding: '2px 4px', fontSize: '0.9rem', cursor: 'pointer', marginLeft: '2px', display: 'inline-flex', alignItems: 'center'
                        }}
                        title="Deselect All"
                    >
                        ✕
                    </button>
                </div>

                <div style={{ height: '14px', width: '1px', background: 'rgba(255,255,255,0.12)' }}></div>

                {!isTrashMode ? (
                    <div
                        style={{
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'center',
                            transition: `gap ${COLLAPSE_MS}ms cubic-bezier(0.165, 0.84, 0.44, 1)`,
                        }}
                    >
                        <button
                            onClick={onRefresh}
                            style={{
                                background: 'none', border: 'none', color: '#fff',
                                padding: '4px', fontSize: '1.1rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center'
                            }}
                            title="Refresh Selected"
                        >
                            ⟳
                        </button>
                        <button
                            onClick={onAddToCollection}
                            style={{
                                background: 'none', border: 'none', color: 'var(--accent-gold)',
                                padding: '4px', fontSize: '1rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center'
                            }}
                            title="Add to Collection"
                        >
                            📁
                        </button>
                        <CollapsingDivider visible={showCompare} vertical={false} />
                        <CollapsingCompareSlot visible={showCompare} isMobile onCompare={onCompare} />
                        <button
                            onClick={onDelete}
                            style={{
                                background: 'none', border: 'none', color: 'var(--danger)',
                                padding: '4px', fontSize: '1rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center'
                            }}
                            title="Delete Selected"
                        >
                            🗑️
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <button
                            onClick={onRestore}
                            style={{
                                background: 'none', border: 'none', color: '#03dac6',
                                padding: '4px', fontSize: '1.1rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center'
                            }}
                            title="Restore Selected"
                        >
                            ↩
                        </button>
                        <button
                            onClick={onDelete}
                            style={{
                                background: 'none', border: 'none', color: 'var(--danger)',
                                padding: '4px', fontSize: '1rem', cursor: 'pointer', display: 'inline-flex', alignItems: 'center'
                            }}
                            title="Delete Permanently"
                        >
                            🗑️
                        </button>
                    </div>
                )}
            </div>
        );
    }

    return (
        <Draggable nodeRef={nodeRef} handle=".drag-handle">
            <div 
                ref={nodeRef}
                style={styleDesktop}
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
                        <CollapsingDivider visible={showCompare} />
                        <CollapsingCompareSlot visible={showCompare} isMobile={false} onCompare={onCompare} />
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
