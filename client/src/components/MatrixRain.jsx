import React, { useEffect, useRef } from 'react';

export default function MatrixRain({ textSource, color = '#D4AF37' }) {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        let animationFrameId;

        // Use unique characters from the textSource, filtering out spaces
        const charSet = Array.from(new Set(textSource.split('').filter(c => c.trim().length > 0)));
        if (charSet.length === 0) charSet.push('0', '1'); // fallback

        const resizeCanvas = () => {
            canvas.width = canvas.parentElement.offsetWidth;
            canvas.height = canvas.parentElement.offsetHeight;
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        const fontSize = 16;
        let columns = canvas.width / fontSize;
        let drops = [];
        
        for (let x = 0; x < columns; x++) {
            drops[x] = 1;
        }

        const draw = () => {
            // Translucent black background to create trail effect
            ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.fillStyle = color;
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
            
            animationFrameId = requestAnimationFrame(draw);
        };

        // Instead of setInterval, we can throttle requestAnimationFrame or just let it run
        // Matrix rain usually looks better with a slight delay, so let's use a timeout loop
        let timeoutId;
        const loop = () => {
            draw();
            timeoutId = setTimeout(loop, 50); // 50ms = 20fps
        };
        
        loop();

        return () => {
            window.removeEventListener('resize', resizeCanvas);
            clearTimeout(timeoutId);
            cancelAnimationFrame(animationFrameId);
        };
    }, [textSource, color]);

    return (
        <canvas 
            ref={canvasRef} 
            style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100%', 
                opacity: 0.3, // Subtle background effect
                pointerEvents: 'none',
                zIndex: 0
            }} 
        />
    );
}
