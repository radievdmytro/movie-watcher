import React, { useState, useEffect, useRef } from 'react';

const characters = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';

export default function MatrixText({ text, duration = 600, skipAnimation = false }) {
    const [displayText, setDisplayText] = useState(text);
    const [isAnimating, setIsAnimating] = useState(false);
    const isFirstRender = useRef(true);

    useEffect(() => {
        // Only trigger if text actually changes
        let active = true;
        
        if (isFirstRender.current) {
            isFirstRender.current = false;
            setDisplayText(text);
            return;
        }

        if (skipAnimation) {
            setDisplayText(text);
            setIsAnimating(false);
            return;
        }
        
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
    }, [text, duration, skipAnimation]);

    return (
        <span>
            {displayText}
        </span>
    );
}
