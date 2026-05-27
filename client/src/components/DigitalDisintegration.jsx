import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const DigitalDisintegration = ({ isHiding, onAnimationComplete, children, style, className }) => {
    const [phase, setPhase] = useState(0); // 0: Idle, 1: Glitch & Bloom, 2: Slice & Noise, 3: Particles & Fade
    const wrapperRef = useRef(null);

    useEffect(() => {
        if (isHiding) {
            // Start Phase 1
            setPhase(1);

            // Phase 2: slicing and noise
            const t1 = setTimeout(() => setPhase(2), 250);

            // Phase 3: Particles and dissolution
            const t2 = setTimeout(() => {
                setPhase(3);
                
                if (wrapperRef.current) {
                    const rect = wrapperRef.current.getBoundingClientRect();
                    for (let i = 0; i < 20; i++) {
                        const span = document.createElement('span');
                        span.textContent = Math.random() > 0.5 ? '1' : '0';
                        span.style.position = 'fixed';
                        span.style.left = `${rect.left + Math.random() * rect.width}px`;
                        span.style.top = `${rect.top + Math.random() * rect.height}px`;
                        span.style.color = 'var(--neon-cyan)';
                        span.style.textShadow = '0 0 8px var(--electric-blue), 0 0 12px var(--neon-cyan)';
                        span.style.fontWeight = 'bold';
                        span.style.fontFamily = 'monospace';
                        span.style.fontSize = '1.2rem';
                        span.style.pointerEvents = 'none';
                        span.style.zIndex = '999999';
                        
                        const targetX = Math.random() * 600 - 300;
                        const targetY = -(Math.random() * 450 + 150);
                        const duration = 1.0 + Math.random() * 0.5;
                        const delay = Math.random() * 0.2;
                        
                        span.animate([
                            { opacity: 1, transform: `translate(0px, 0px) scale(${Math.random() * 0.5 + 0.5}) rotate(0deg)` },
                            { opacity: 0, transform: `translate(${targetX}px, ${targetY}px) scale(0) rotate(${Math.random() * 180 - 90}deg)` }
                        ], {
                            duration: duration * 1000,
                            delay: delay * 1000,
                            easing: 'ease-out',
                            fill: 'forwards'
                        });
                        
                        document.body.appendChild(span);
                        setTimeout(() => span.remove(), (duration + delay) * 1000 + 100);
                    }
                }
            }, 500);

            // Finish (trigger layout collapse 100ms after particles spawn)
            const t3 = setTimeout(() => {
                if (onAnimationComplete) onAnimationComplete();
            }, 600);

            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
                clearTimeout(t3);
            };
        }
    }, [isHiding, onAnimationComplete]);

    return (
        <div ref={wrapperRef} className={`disintegration-wrapper ${className || ''}`} style={{ width: '100%', height: '100%', position: 'relative', ...style }}>
            
            {/* The main content */}
            <motion.div
                animate={
                    phase === 0 ? { opacity: 1, filter: 'blur(0px)' } :
                    phase === 1 ? { opacity: 0.9, filter: 'blur(1px)', scale: 1.02 } :
                    phase === 2 ? { opacity: 0.5, filter: 'blur(3px)', scale: 0.98 } :
                    { opacity: 0, filter: 'blur(10px)', scale: 0.9 }
                }
                transition={{ duration: 0.3 }}
                className=""
                style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', borderRadius: 'inherit' }}
            >
                {/* Clone the children but hide overflow if needed, wait children are the movie card */}
                {children}

            </motion.div>
        </div>
    );
};

export default DigitalDisintegration;
