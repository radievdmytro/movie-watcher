import React, { useState, useEffect } from 'react';
import './TypewriterLoader.css';

export default function TypewriterLoader({ text = "Searching trailers...", isExiting }) {
    const [displayedLength, setDisplayedLength] = useState(0);
    const [phase, setPhase] = useState('initial-blink'); // initial-blink, typing, post-blink, wave

    useEffect(() => {
        let isMounted = true;

        const runAnimation = async () => {
            // 1. Initial blink (2 blinks, 500ms each = 1000ms)
            if (!isMounted) return;
            setPhase('initial-blink');
            await new Promise(r => setTimeout(r, 1000));
            
            // 2. Typing (1.5 seconds total)
            if (!isMounted) return;
            setPhase('typing');
            
            const typeDelay = 1500 / text.length;
            for (let i = 1; i <= text.length; i++) {
                if (!isMounted) return;
                await new Promise(r => setTimeout(r, typeDelay));
                setDisplayedLength(i);
            }
            
            // 3. Post blink (3 blinks = 1500ms)
            if (!isMounted) return;
            setPhase('post-blink');
            await new Promise(r => setTimeout(r, 1500));
            
            // 4. Wave effect
            if (!isMounted) return;
            setPhase('wave');
        };
        
        runAnimation();
        
        return () => {
            isMounted = false;
        };
    }, [text]);

    // Determine blinker class
    let blinkerClass = 'blinking';
    if (phase === 'typing') blinkerClass = 'solid';
    else if (phase === 'wave') blinkerClass = 'hidden';

    return (
        <div className={`typewriter-container ${isExiting ? 'exiting' : ''}`}>
            <div className="typewriter-text">
                <span style={{ color: 'var(--accent-gold, #ff9900)', marginRight: '12px' }}>{'>'}</span>
                
                {text.split('').map((char, index) => {
                    if (index >= displayedLength) return null;
                    
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
