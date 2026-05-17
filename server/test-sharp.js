const sharp = require('sharp');
const axios = require('axios');

async function createOgImage() {
    const posterUrls = [
        "https://static.hdrezka.ac/i/2025/2/10/la0af8501b4f0os53o50y.jpg",
        "https://static.hdrezka.ac/i/2025/2/10/la0af8501b4f0os53o50y.jpg",
        "https://static.hdrezka.ac/i/2025/2/10/la0af8501b4f0os53o50y.jpg",
        "https://static.hdrezka.ac/i/2025/2/10/la0af8501b4f0os53o50y.jpg",
        "https://static.hdrezka.ac/i/2025/2/10/la0af8501b4f0os53o50y.jpg"
    ];

    try {
        const buffers = await Promise.all(posterUrls.map(async url => {
            const res = await axios.get(url, { responseType: 'arraybuffer' });
            return Buffer.from(res.data);
        }));

        // Resize posters
        const posterWidth = 300;
        const posterHeight = 450;
        const resizedPosters = await Promise.all(buffers.map(buf => 
            sharp(buf).resize(posterWidth, posterHeight, { fit: 'cover' }).toBuffer()
        ));

        // Background
        const baseImage = await sharp(buffers[0])
            .resize(1200, 630, { fit: 'cover' })
            .blur(30)
            .composite([
                { input: Buffer.from('<svg><rect width="1200" height="630" fill="rgba(0,0,0,0.5)"/></svg>'), blend: 'over' },
                ...resizedPosters.map((buf, i) => ({
                    input: buf,
                    left: 50 + (i * 200),
                    top: 90
                }))
            ])
            .jpeg()
            .toBuffer();

        require('fs').writeFileSync('test-og.jpg', baseImage);
        console.log('test-og.jpg created!');
    } catch (err) {
        console.error(err);
    }
}
createOgImage();
