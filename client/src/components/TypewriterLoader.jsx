import React, { useState, useEffect } from 'react';
import './TypewriterLoader.css';

export default function TypewriterLoader({ text = "Searching trailers...", isExiting }) {
    const [displayedText, setDisplayedText] = useState("");
    const [phase, setPhase] = useState('initial-blink'); // initial-blink, typing, post-blink, wave, erasing

    useEffect(() => {
        let isMounted = true;
        let currentText = displayedText;

        const runAnimation = async () => {
            // If there's already text and it's different from the target text, erase it first
            if (currentText.length > 0 && currentText !== text) {
                setPhase('erasing');
                while (currentText.length > 0) {
                    if (!isMounted) return;
                    await new Promise(r => setTimeout(r, 40)); // Fast erase
                    currentText = currentText.slice(0, -1);
                    setDisplayedText(currentText);
                }
            }

            if (!isMounted) return;
            
            // If we just erased, wait a tiny bit
            if (phase === 'erasing') {
                await new Promise(r => setTimeout(r, 300));
            } else if (currentText.length === 0) {
                // 1. Initial blink only if starting from empty AND we are searching
                if (text.includes("Searching")) {
                    setPhase('initial-blink');
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            if (!isMounted) return;
            
            // Only type if we need to
            if (currentText !== text) {
                setPhase('typing');
                const typeDelay = 1500 / text.length;
                
                while (currentText.length < text.length) {
                    if (!isMounted) return;
                    await new Promise(r => setTimeout(r, typeDelay));
                    currentText = text.slice(0, currentText.length + 1);
                    setDisplayedText(currentText);
                }
            }

            if (!isMounted) return;
            // 3. Post blink
            setPhase('post-blink');
            await new Promise(r => setTimeout(r, 1500));
            
            // 4. Wave effect (only if text says "Searching trailers...")
            if (!isMounted) return;
            if (text.includes("Searching")) {
                setPhase('wave');
            } else {
                // Keep blinking if it's a success message
                setPhase('initial-blink');
            }
        };
        
        runAnimation();
        
        return () => {
            isMounted = false;
        };
    }, [text]); // Re-run when target text changes

    // Determine blinker class
    let blinkerClass = 'blinking';
    if (phase === 'typing' || phase === 'erasing') blinkerClass = 'solid';
    else if (phase === 'wave') blinkerClass = 'hidden';

    return (
        <div className={`typewriter-container ${isExiting ? 'exiting' : ''}`}>
            <div className="typewriter-text">
                <span className="typewriter-prompt" style={{ color: 'var(--accent-gold, #ff9900)', marginRight: '12px' }}>{'>'}</span>
                
                {displayedText.split('').map((char, index) => {
                    return (
                        <span 
                            key={index} 
                            className={`typewriter-char ${phase === 'wave' ? 'wave' : ''}`}
                            style={{ 
                                animationDelay: phase === 'wave' ? `${index * 0.1}s` : '0s' 
                            }}
                        >
                            {char}
                        </span>
                    );
                })}
                
                {isExiting ? (
                    <span className="typewriter-pixel-disintegration-container" style={{ position: 'relative', display: 'inline-block', width: '16px', height: '32px', marginLeft: '4px', verticalAlign: 'middle' }}>
                        {Array.from({ length: 36 }).map((_, i) => {
                            const x = Math.random() * 16;
                            const y = Math.random() * 32;
                            const angle = Math.random() * Math.PI * 2; // full 360°
                            const distance = 60 + Math.random() * 100; // 60–160px travel
                            const dx = Math.cos(angle) * distance;
                            const dy = Math.sin(angle) * distance - 30; // bias upward
                            const size = Math.floor(Math.random() * 3) + 1; // 1px to 3px
                            const delay = Math.random() * 0.6; // wide stagger 0–0.6s
                            const duration = 1.4 + Math.random() * 0.8; // 1.4s to 2.2s
                            
                            return (
                                <span 
                                    key={i}
                                    style={{
                                        position: 'absolute',
                                        left: `${x}px`,
                                        top: `${y}px`,
                                        width: `${size}px`,
                                        height: `${size}px`,
                                        backgroundColor: 'var(--accent-gold, #ff9900)',
                                        boxShadow: `0 0 ${size + 2}px var(--accent-gold, #ff9900)`,
                                        borderRadius: '1px',
                                        // ease-in: slow start → accelerate → gone
                                        animation: `pixelScatter ${duration}s cubic-bezier(0.4, 0, 1, 1) ${delay}s both`,
                                        '--dx': `${dx}px`,
                                        '--dy': `${dy}px`,
                                    }}
                                />
                            );
                        })}
                    </span>
                ) : (
                    <span className={`typewriter-blinker ${blinkerClass}`}></span>
                )}
            </div>
        </div>
    );
}
