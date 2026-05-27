import React, { useState, useEffect, useMemo } from 'react';
import './TypewriterLoader.css';

// Approximate pixel width of one character in Courier New 28px bold
const CHAR_WIDTH = 17;
const PROMPT_WIDTH = 44; // ">" + marginRight

export default function TypewriterLoader({ text = "Searching trailers...", isDisintegrating }) {
    const [displayedText, setDisplayedText] = useState("");
    const [phase, setPhase] = useState('initial-blink'); // initial-blink | typing | post-blink | wave | erasing

    // Pre-compute ALL random values once when disintegration starts
    // useMemo is stable as long as deps don't change; isDisintegrating flips once false→true
    const disintegrationValues = useMemo(() => {
        if (!isDisintegrating) return null;

        // Per-character scatter
        const chars = text.split('').map((_, i) => ({
            dx: (Math.random() - 0.5) * 140,
            dy: (Math.random() - 0.5) * 90 - 40,
            delay: i * 0.022 + Math.random() * 0.07,
            duration: 0.85 + Math.random() * 0.7,
        }));

        // ">" prompt scatter
        const promptScatter = {
            dx: (Math.random() - 0.5) * 70,
            dy: -Math.random() * 50 - 15,
        };

        // Cursor pixel scatter (replaces the blinker)
        const cursorParticles = Array.from({ length: 28 }).map(() => {
            const angle = Math.random() * Math.PI * 2;
            const distance = 50 + Math.random() * 110;
            return {
                x: Math.random() * 16,
                y: Math.random() * 32,
                dx: Math.cos(angle) * distance,
                dy: Math.sin(angle) * distance - 30,
                size: Math.random() * 2 + 1,
                delay: Math.random() * 0.5,
                duration: 1.3 + Math.random() * 0.9,
            };
        });

        // Full-text pixel cloud: particles spread across entire text width
        const approxTotalWidth = PROMPT_WIDTH + text.length * CHAR_WIDTH;
        const particleCount = Math.min(text.length * 4, 110);
        const particles = Array.from({ length: particleCount }).map(() => {
            const angle = Math.random() * Math.PI * 2;
            const distance = 50 + Math.random() * 140;
            return {
                x: Math.random() * approxTotalWidth,
                y: 2 + Math.random() * 28,
                dx: Math.cos(angle) * distance,
                dy: Math.sin(angle) * distance - 45,
                size: Math.random() * 2.5 + 1,
                delay: Math.random() * 0.8,
                duration: 1.4 + Math.random() * 0.8,
            };
        });

        return { chars, particles, promptScatter, cursorParticles };
    }, [isDisintegrating, text]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (isDisintegrating) return; // freeze typewriter during disintegration

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
    }, [text, isDisintegrating]); // eslint-disable-line react-hooks/exhaustive-deps

    let blinkerClass = 'blinking';
    if (phase === 'typing' || phase === 'erasing') blinkerClass = 'solid';
    else if (phase === 'wave') blinkerClass = 'hidden';

    return (
        <div className="typewriter-container">
            <div className="typewriter-text" style={{ position: 'relative' }}>

                {/* Full-text pixel cloud — renders on top, spans whole text width */}
                {isDisintegrating && disintegrationValues && (
                    <span aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 2 }}>
                        {disintegrationValues.particles.map((p, i) => (
                            <span
                                key={`spark-${i}`}
                                style={{
                                    position: 'absolute',
                                    left: `${p.x}px`,
                                    top: `${p.y}px`,
                                    width: `${p.size}px`,
                                    height: `${p.size}px`,
                                    backgroundColor: 'var(--accent-gold, #ff9900)',
                                    boxShadow: `0 0 ${p.size + 2}px var(--accent-gold, #ff9900)`,
                                    borderRadius: '1px',
                                    animation: `pixelScatter ${p.duration}s cubic-bezier(0.4, 0, 1, 1) ${p.delay}s both`,
                                    '--dx': `${p.dx}px`,
                                    '--dy': `${p.dy}px`,
                                }}
                            />
                        ))}
                    </span>
                )}

                {/* Prompt ">" */}
                {isDisintegrating && disintegrationValues ? (
                    <span style={{
                        display: 'inline-block',
                        color: 'var(--accent-gold, #ff9900)',
                        marginRight: '12px',
                        fontWeight: 'bold',
                        animation: `charDisintegrate 1.2s cubic-bezier(0.4, 0, 1, 1) 0.04s both`,
                        '--cdx': `${disintegrationValues.promptScatter.dx}px`,
                        '--cdy': `${disintegrationValues.promptScatter.dy}px`,
                    }}>{'>'}</span>
                ) : (
                    <span className="typewriter-prompt" style={{ color: 'var(--accent-gold, #ff9900)', marginRight: '12px' }}>{'>'}</span>
                )}

                {/* Characters */}
                {displayedText.split('').map((char, index) => {
                    if (isDisintegrating && disintegrationValues?.chars[index]) {
                        const cv = disintegrationValues.chars[index];
                        return (
                            <span
                                key={index}
                                style={{
                                    display: 'inline-block',
                                    whiteSpace: 'pre',
                                    animation: `charDisintegrate ${cv.duration}s cubic-bezier(0.4, 0, 1, 1) ${cv.delay}s both`,
                                    '--cdx': `${cv.dx}px`,
                                    '--cdy': `${cv.dy}px`,
                                }}
                            >
                                {char}
                            </span>
                        );
                    }
                    return (
                        <span
                            key={index}
                            className={`typewriter-char ${phase === 'wave' ? 'wave' : ''}`}
                            style={{ animationDelay: phase === 'wave' ? `${index * 0.1}s` : '0s' }}
                        >
                            {char}
                        </span>
                    );
                })}

                {/* Cursor / blinker */}
                {isDisintegrating && disintegrationValues ? (
                    <span style={{ position: 'relative', display: 'inline-block', width: '16px', height: '32px', marginLeft: '4px', verticalAlign: 'middle' }}>
                        {disintegrationValues.cursorParticles.map((p, i) => (
                            <span
                                key={`cur-${i}`}
                                style={{
                                    position: 'absolute',
                                    left: `${p.x}px`,
                                    top: `${p.y}px`,
                                    width: `${p.size}px`,
                                    height: `${p.size}px`,
                                    backgroundColor: 'var(--accent-gold, #ff9900)',
                                    boxShadow: `0 0 ${p.size + 2}px var(--accent-gold, #ff9900)`,
                                    borderRadius: '1px',
                                    animation: `pixelScatter ${p.duration}s cubic-bezier(0.4, 0, 1, 1) ${p.delay}s both`,
                                    '--dx': `${p.dx}px`,
                                    '--dy': `${p.dy}px`,
                                }}
                            />
                        ))}
                    </span>
                ) : (
                    <span className={`typewriter-blinker ${blinkerClass}`}></span>
                )}

            </div>
        </div>
    );
}
