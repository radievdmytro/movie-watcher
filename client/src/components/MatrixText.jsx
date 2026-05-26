import React, { useState, useEffect } from 'react';

const characters = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';

export default function MatrixText({ targetWord, isSearching, skipAnimation = false }) {
    const [displayText, setDisplayText] = useState(targetWord);

    useEffect(() => {
        let active = true;
        let timeout;
        let interval;

        if (skipAnimation) {
            setDisplayText(targetWord);
            return;
        }

        if (isSearching) {
            // Set initial static word (e.g. "Искать")
            setDisplayText(targetWord);
            
            // If still searching after 2.5s, start endless scramble
            timeout = setTimeout(() => {
                if (!active) return;
                interval = setInterval(() => {
                    if (!active) return;
                    setDisplayText(targetWord.split('').map(() => characters[Math.floor(Math.random() * characters.length)]).join(''));
                }, 50);
            }, 3500);
        } else {
            // Not searching -> resolve to targetWord (e.g. "Смотреть")
            let iterations = 0;
            const maxIterations = 15;
            const duration = 400; // 400ms resolve animation
            
            interval = setInterval(() => {
                if (!active) return;
                
                setDisplayText(prev => {
                    return targetWord.split('').map((char, index) => {
                        if (char === ' ') return ' ';
                        if (index < (iterations / maxIterations) * targetWord.length) {
                            return targetWord[index];
                        }
                        return characters[Math.floor(Math.random() * characters.length)];
                    }).join('');
                });
                
                iterations++;
                if (iterations >= maxIterations) {
                    clearInterval(interval);
                    if (active) setDisplayText(targetWord);
                }
            }, duration / maxIterations);
        }

        return () => {
            active = false;
            clearTimeout(timeout);
            clearInterval(interval);
        };
    }, [isSearching, targetWord, skipAnimation]);

    return (
        <span>
            {displayText}
        </span>
    );
}
