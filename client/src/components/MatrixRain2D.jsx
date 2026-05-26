import React, { useEffect, useRef } from 'react';

export default function MatrixRain2D({ textSource, color = '#D4AF37', customPhrases = [] }) {
    const canvasRef = useRef(null);

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
        let columns = 0;
        let drops = [];
        
        const initDrops = () => {
            const newColumns = Math.floor(canvas.width / fontSize);
            if (newColumns > columns) {
                for (let x = columns; x < newColumns; x++) {
                    // Initialize drops randomly across the entire height so the effect is instantly visible
                    drops[x] = Math.floor(Math.random() * (canvas.height / fontSize));
                }
                columns = newColumns;
            }
        };

        const draw = () => {
            initDrops();
            // Fade out previous frame by reducing opacity, keeping canvas transparent
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'source-over';

            // Resolve CSS variable if needed
            let actualColor = color;
            if (color.startsWith('var(')) {
                const varName = color.match(/var\(([^)]+)\)/)[1];
                actualColor = getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#D4AF37';
            }
            
            ctx.fillStyle = actualColor;
            ctx.font = `${fontSize}px monospace`;

            for (let i = 0; i < drops.length; i++) {
                const text = charSet[Math.floor(Math.random() * charSet.length)];
                
                const x = i * fontSize;
                const y = drops[i] * fontSize;

                ctx.fillText(text, x, y);

                if (y > canvas.height && Math.random() > 0.975) {
                    drops[i] = 0;
                }
                
                drops[i]++;
            }
        };

        let timeoutId;
        const loop = () => {
            draw();
            timeoutId = setTimeout(loop, 50); // 50ms = 20fps
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
                opacity: 0.6, // Increased visibility
                pointerEvents: 'none',
                zIndex: 0
            }} 
        />
    );
}
