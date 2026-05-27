import React, { useEffect, useRef } from 'react';

export default function MatrixRain({ textSource, color = '#D4AF37', customPhrases = [], stopping = false }) {
    const canvasRef = useRef(null);
    const stoppingRef = useRef(stopping);

    useEffect(() => {
        stoppingRef.current = stopping;
    }, [stopping]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        
        let animationFrameId;

        // Split slogan into individual words, characters, and the full string to simulate "lines of text"
        const words = textSource ? textSource.split(' ').filter(w => w.trim().length > 0) : [];
        if (textSource) words.push(textSource);
        words.push(...customPhrases); 
        const chars = textSource ? Array.from(new Set(textSource.split('').filter(c => c.trim().length > 0))) : [];
        const textElements = [...words, ...chars].filter(t => t && t.trim().length > 0);

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

        // 3D parameters
        const numParticles = 200;
        const particles = [];
        const maxZ = 2000;
        const speed = 25; // Speed of flying forward
        const perspective = 300; // Field of view

        // Resolve CSS variable if needed
        let actualColor = color;
        if (color.startsWith('var(')) {
            const varName = color.match(/var\(([^)]+)\)/)[1];
            actualColor = getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#D4AF37';
        }

        const createParticle = (initialZ = maxZ) => {
            return {
                x: (Math.random() - 0.5) * 3500, // Spread across X
                y: (Math.random() - 0.5) * 3500, // Spread across Y
                z: initialZ,
                text: textElements[Math.floor(Math.random() * textElements.length)],
                opacity: Math.random() * 0.7 + 0.3 // Random base opacity
            };
        };

        // Initialize particles with random depth (Z)
        for (let i = 0; i < numParticles; i++) {
            particles.push(createParticle(Math.random() * maxZ));
        }

        const draw = () => {
            // Clear the canvas completely for 3D particles (no trails needed)
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (particles.length === 0) {
                // Loop idles instead of dying, so it can restart if stopping becomes false
                animationFrameId = requestAnimationFrame(draw);
                return;
            }

            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            // Sort particles by Z so further ones are drawn first
            particles.sort((a, b) => b.z - a.z);

            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.z -= speed;

                // If particle flies past the camera, reset it to the back
                if (p.z <= -280) {
                    if (stoppingRef.current) {
                        particles.splice(i, 1);
                        i--;
                    } else {
                        particles[i] = createParticle(maxZ);
                    }
                    continue;
                }

                const scale = perspective / (perspective + p.z);
                const x2d = centerX + p.x * scale;
                const y2d = centerY + p.y * scale;

                // Skip rendering if particle is way off-screen
                if (x2d < -1000 || x2d > canvas.width + 1000 || y2d < -1000 || y2d > canvas.height + 1000) {
                    continue;
                }

                // Opacity fades out as it gets further away
                let fade = 1 - (p.z / maxZ);
                
                // Fade out smoothly as it passes right in front of the camera
                if (p.z < 200) {
                    fade *= Math.max(0, (p.z + 280) / 480);
                }
                
                // Depth of field effect: blur symbols that are very close to the camera
                if (p.z < 100) {
                    const blurAmount = Math.min(15, (100 - p.z) / 25);
                    ctx.filter = `blur(${blurAmount}px)`;
                } else {
                    ctx.filter = 'none';
                }
                
                ctx.globalAlpha = p.opacity * fade;
                ctx.fillStyle = actualColor;
                
                // Font size scales with depth
                const fontSize = Math.max(4, 60 * scale);
                ctx.font = `bold ${fontSize}px monospace`;

                ctx.fillText(p.text, x2d, y2d);
            }
            
            ctx.globalAlpha = 1.0; // Reset alpha
            ctx.filter = 'none'; // Reset filter
            animationFrameId = requestAnimationFrame(draw);
        };

        draw();

        return () => {
            resizeObserver.disconnect();
            cancelAnimationFrame(animationFrameId);
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
                opacity: 0.9,
                pointerEvents: 'none',
                zIndex: 0,
                WebkitMaskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)',
                maskImage: 'radial-gradient(ellipse at center, rgba(0,0,0,1) 40%, rgba(0,0,0,0) 90%)'
            }} 
        />
    );
}
