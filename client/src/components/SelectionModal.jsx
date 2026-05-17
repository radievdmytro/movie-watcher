import { useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import '../App.css'; // Re-use global styles/vars

function SelectionModal({ results, onSelect, onClose }) {
    const modalRef = useRef(null);

    const handleBackdropClick = (e) => {
        if (modalRef.current && !modalRef.current.contains(e.target)) {
            onClose();
        }
    };

    const content = (
        <div className="modal-backdrop" onClick={handleBackdropClick} style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99999
        }}>
            <div className="glass-panel modal-content" ref={modalRef} style={{
                width: '90%', maxWidth: '600px', maxHeight: '80vh',
                overflowY: 'auto', padding: '20px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h2>Uncertain Match</h2>
                    <button onClick={onClose} className="btn btn-ghost" style={{ fontSize: '1.5rem' }}>&times;</button>
                </div>
                <p style={{ marginBottom: '20px', color: '#ccc' }}>Multiple movies found. Please select one.</p>

                <div className="results-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {results.map((item, idx) => (
                        <div key={idx} onClick={() => onSelect(item)} style={{
                            display: 'flex', gap: '15px', padding: '10px',
                            border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                            cursor: 'pointer', transition: 'background 0.2s'
                        }}
                            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                        >
                            <img src={item.img} alt={item.title} style={{ width: '60px', height: '90px', objectFit: 'cover', borderRadius: '4px' }} />
                            <div>
                                <h3 style={{ color: 'var(--accent-gold)' }}>{item.title}</h3>
                                <p style={{ fontSize: '0.9rem', color: '#999' }}>{item.misc}</p>
                                {item.rating && <span style={{ fontSize: '0.8rem', background: '#333', padding: '2px 6px', borderRadius: '4px' }}>{item.rating}</span>}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
}

export default SelectionModal;
