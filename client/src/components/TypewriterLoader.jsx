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
                <span style={{ color: 'var(--accent-gold, #ff9900)', marginRight: '12px' }}>{'>'}</span>
                
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
                
                <span className={`typewriter-blinker ${blinkerClass}`}></span>
            </div>
        </div>
    );
}
