import React, { useState, useEffect } from 'react';

const characters = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';

export default function MatrixText({ text, duration = 600 }) {
    const [displayText, setDisplayText] = useState(text);
    const [isAnimating, setIsAnimating] = useState(false);

    useEffect(() => {
        // Only trigger if text actually changes
        let active = true;
        
        let iterations = 0;
        const maxIterations = 15;
        const intervalTime = duration / maxIterations;

        setIsAnimating(true);
        const interval = setInterval(() => {
            if (!active) return;
            
            setDisplayText(prev => {
                return text.split('').map((char, index) => {
                    if (char === ' ') return ' ';
                    if (index < (iterations / maxIterations) * text.length) {
                        return text[index];
                    }
                    return characters[Math.floor(Math.random() * characters.length)];
                }).join('');
            });
            
            iterations++;
            if (iterations >= maxIterations) {
                clearInterval(interval);
                if (active) {
                    setDisplayText(text);
                    setIsAnimating(false);
                }
            }
        }, intervalTime);

        return () => {
            active = false;
            clearInterval(interval);
        };
    }, [text, duration]);

    return (
        <span style={{ 
            fontFamily: isAnimating ? 'monospace' : 'inherit',
            letterSpacing: isAnimating ? '1px' : 'inherit',
            transition: 'all 0.2s'
        }}>
            {displayText}
        </span>
    );
}
