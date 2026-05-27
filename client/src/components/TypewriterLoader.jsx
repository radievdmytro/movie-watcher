import React, { useState, useEffect } from 'react';
import './TypewriterLoader.css';

export default function TypewriterLoader({ text = "Searching trailers...", isExiting }) {
    const [displayedText, setDisplayedText] = useState("");
    const [phase, setPhase] = useState('initial-blink'); // initial-blink | typing | post-blink | wave | erasing

    useEffect(() => {
        if (isExiting) return; // freeze when fading out

        let isMounted = true;
        let currentText = displayedText;

        const runAnimation = async () => {
            // Erase existing text if it differs from target
            if (currentText.length > 0 && currentText !== text) {
                setPhase('erasing');
                while (currentText.length > 0) {
                    if (!isMounted) return;
                    await new Promise(r => setTimeout(r, 40));
                    currentText = currentText.slice(0, -1);
                    setDisplayedText(currentText);
                }
            }

            if (!isMounted) return;

            if (phase === 'erasing') {
                await new Promise(r => setTimeout(r, 300));
            } else if (currentText.length === 0) {
                if (text.includes("Searching")) {
                    setPhase('initial-blink');
                    await new Promise(r => setTimeout(r, 1000));
                }
            }

            if (!isMounted) return;

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
            setPhase('post-blink');
            await new Promise(r => setTimeout(r, 1500));

            if (!isMounted) return;
            if (text.includes("Searching")) {
                setPhase('wave');
            } else {
                setPhase('initial-blink');
            }
        };

        runAnimation();
        return () => { isMounted = false; };
    }, [text, isExiting]); // eslint-disable-line react-hooks/exhaustive-deps

    let blinkerClass = 'blinking';
    if (phase === 'typing' || phase === 'erasing') blinkerClass = 'solid';
    else if (phase === 'wave') blinkerClass = 'hidden';

    return (
        <div className={`typewriter-container ${isExiting ? 'exiting' : ''}`}>
            <div className="typewriter-text">
                <span className="typewriter-prompt" style={{ color: 'var(--accent-gold, #ff9900)', marginRight: '12px' }}>{'>'}</span>

                {displayedText.split('').map((char, index) => (
                    <span
                        key={index}
                        className={`typewriter-char ${phase === 'wave' ? 'wave' : ''}`}
                        style={{
                            animationDelay: phase === 'wave' ? `${index * 0.1}s` : '0s'
                        }}
                    >
                        {char}
                    </span>
                ))}

                <span className={`typewriter-blinker ${blinkerClass}`}></span>
            </div>
        </div>
    );
}
