import React, { useEffect, useRef } from 'react';

export default function MatrixRain2D({ textSource, color = '#D4AF37', customPhrases = [], stopping = false }) {
    const canvasRef = useRef(null);
    const stoppingRef = useRef(stopping);

    useEffect(() => {
        stoppingRef.current = stopping;
    }, [stopping]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        let animationFrameId;

        // Use unique characters from the textSource and customPhrases, filtering out spaces
        const allText = textSource + ' ' + customPhrases.join(' ');
        const charSet = Array.from(new Set(allText.split('').filter(c => c.trim().length > 0)));
        if (charSet.length === 0) charSet.push('0', '1'); // fallback

        const resizeCanvas = () => {
            if (canvas.parentElement) {
                canvas.width = canvas.parentElement.offsetWidth;
                canvas.height = canvas.parentElement.offsetHeight;
            }
        };

        const resizeObserver = new ResizeObserver(() => {
            resizeCanvas();
        });
        
        if (canvas.parentElement) {
            resizeObserver.observe(canvas.parentElement);
        }
        resizeCanvas();

        const fontSize = 16;
        let grid = [];
        const initGrid = () => {
            const columns = Math.floor(canvas.width / fontSize) + 1;
            if (grid.length < columns) {
                const diff = columns - grid.length;
                for (let i = 0; i < diff; i++) {
                    grid.push({
                        headY: Math.floor(Math.random() * -50),
                        speed: 0.5 + Math.random() * 0.5,
                        accumulator: 0,
                        chars: []
                    });
                }
            }
        };

        const draw = () => {
            initGrid();
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Resolve CSS variable if needed
            let actualColor = color;
            if (color.startsWith('var(')) {
                const varName = color.match(/var\(([^)]+)\)/)[1];
                actualColor = getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#D4AF37';
            }
            
            ctx.font = `${fontSize}px monospace`;
            ctx.textAlign = 'center';

            let hasActiveChars = false;

            for (let i = 0; i < grid.length; i++) {
                const stream = grid[i];
                
                stream.accumulator += stream.speed;
                if (stream.accumulator >= 1) {
                    stream.accumulator -= 1;
                    
                    if (!stoppingRef.current) {
                        const newChar = charSet[Math.floor(Math.random() * charSet.length)];
                        stream.chars.push({ y: stream.headY, text: newChar, opacity: 1.0 });
                    }
                    stream.headY++;

                    if (stream.headY * fontSize > canvas.height + 200 && Math.random() > 0.95) {
                        if (!stoppingRef.current) {
                            stream.headY = Math.floor(Math.random() * -20);
                            stream.chars = [];
                        }
                    }
                }

                if (stream.chars.length > 0) {
                    hasActiveChars = true;
                }

                for (let j = stream.chars.length - 1; j >= 0; j--) {
                    const c = stream.chars[j];
                    
                    // Decrease opacity
                    c.opacity -= 0.035; 
                    
                    if (c.opacity <= 0) {
                        stream.chars.splice(j, 1);
                        continue;
                    }

                    // Randomly flip character to match real Matrix style
                    if (Math.random() > 0.98) {
                        c.text = charSet[Math.floor(Math.random() * charSet.length)];
                    }

                    ctx.globalAlpha = c.opacity;
                    // Make the leading character white and brighter
                    ctx.fillStyle = (c.opacity > 0.95 && !stoppingRef.current) ? '#ffffff' : actualColor; 
                    
                    const xPos = i * fontSize + fontSize / 2;
                    const yPos = c.y * fontSize;
                    
                    ctx.fillText(c.text, xPos, yPos);
                }
            }
            
            ctx.globalAlpha = 1.0;
            
            if (stoppingRef.current && !hasActiveChars) {
                return;
            }
            
            timeoutId = setTimeout(loop, 30);
        };

        let timeoutId;
        const loop = () => {
            draw();
        };
        
        loop();

        return () => {
            resizeObserver.disconnect();
            clearTimeout(timeoutId);
        };
    }, [textSource, color, customPhrases.join(',')]);

    return (
        <canvas 
            ref={canvasRef} 
            style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%', 
                pointerEvents: 'none',
                zIndex: 0
            }} 
        />
    );
}
