import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

const DigitalDisintegration = ({ isHiding, onAnimationComplete, children, style, className }) => {
    const [phase, setPhase] = useState(0); // 0: Idle, 1: Glitch & Bloom, 2: Slice & Noise, 3: Particles & Fade
    const [particles, setParticles] = useState([]);

    useEffect(() => {
        if (isHiding) {
            // Start Phase 1
            setPhase(1);

            // Phase 2: slicing and noise
            const t1 = setTimeout(() => setPhase(2), 250);

            // Phase 3: Particles and dissolution
            const t2 = setTimeout(() => {
                setPhase(3);
                
                // Generate 1 and 0 particles
                const newParticles = [];
                for (let i = 0; i < 20; i++) {
                    newParticles.push({
                        id: i,
                        text: Math.random() > 0.5 ? '1' : '0',
                        x: Math.random() * 100, // random start X %
                        y: Math.random() * 100, // random start Y %
                        targetX: Math.random() * 200 - 100, // fly up/left/right
                        targetY: -(Math.random() * 150 + 50),
                        delay: Math.random() * 0.2,
                        duration: 0.5 + Math.random() * 0.5
                    });
                }
                setParticles(newParticles);
            }, 500);

            // Finish
            const t3 = setTimeout(() => {
                if (onAnimationComplete) onAnimationComplete();
            }, 1000);

            return () => {
                clearTimeout(t1);
                clearTimeout(t2);
                clearTimeout(t3);
            };
        }
    }, [isHiding, onAnimationComplete]);

    return (
        <div className={`disintegration-wrapper ${className || ''}`} style={{ width: '100%', height: '100%', position: 'relative', ...style }}>
            
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

                {/* Overlays */}
                {phase >= 1 && <div className="cyan-bloom"></div>}
                
                {/* Slices that look like parts of the image tearing away */}
                {phase >= 2 && (
                    <>
                        <div className="digital-slice">
                           <div style={{ background: 'var(--electric-blue)', width: '100%', height: '100%', opacity: 0.3 }} />
                        </div>
                        <div className="digital-slice-2">
                           <div style={{ background: 'var(--neon-cyan)', width: '100%', height: '100%', opacity: 0.3 }} />
                        </div>
                        <div className="digital-noise-overlay show-noise"></div>
                    </>
                )}
            </motion.div>

            {/* Emitted Particles (1s and 0s) */}
            {phase >= 3 && particles.map(p => (
                <motion.span
                    key={p.id}
                    initial={{ 
                        opacity: 1, 
                        x: 0,
                        y: 0,
                        scale: Math.random() * 0.5 + 0.5,
                        rotate: 0
                    }}
                    animate={{ 
                        opacity: 0, 
                        x: p.targetX, 
                        y: p.targetY,
                        scale: 0,
                        rotate: Math.random() * 180 - 90
                    }}
                    transition={{ 
                        duration: p.duration, 
                        delay: p.delay,
                        ease: "easeOut"
                    }}
                    style={{
                        position: 'absolute',
                        left: `${p.x}%`,
                        top: `${p.y}%`,
                        color: 'var(--neon-cyan)',
                        textShadow: '0 0 8px var(--electric-blue), 0 0 12px var(--neon-cyan)',
                        fontWeight: 'bold',
                        fontFamily: 'monospace',
                        fontSize: '1.2rem',
                        pointerEvents: 'none',
                        zIndex: 30
                    }}
                >
                    {p.text}
                </motion.span>
            ))}

        </div>
    );
};

export default DigitalDisintegration;
