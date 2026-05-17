import React from 'react';
import { createPortal } from 'react-dom';
import '../App.css';

function ConfirmModal({ title, message, onConfirm, onCancel, confirmText = 'Confirm', confirmColor = 'var(--accent-gold)' }) {
    const content = (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 99999
        }} onClick={onCancel}>
            <div className="glass-panel" style={{
                padding: '30px', maxWidth: '400px', width: '90%', textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.1)'
            }} onClick={(e) => e.stopPropagation()}>
                <h3 style={{ fontSize: '1.5rem', marginBottom: '15px' }}>{title}</h3>
                <p style={{ marginBottom: '25px', color: '#ccc' }}>{message}</p>

                <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
                    <button
                        className="btn btn-ghost"
                        onClick={onCancel}
                        style={{ flex: 1 }}
                    >
                        Cancel
                    </button>
                    <button
                        className="btn"
                        onClick={onConfirm}
                        style={{
                            flex: 1,
                            backgroundColor: confirmColor,
                            color: confirmColor === 'var(--accent-gold)' ? '#000' : '#fff'
                        }}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
}

export default ConfirmModal;
