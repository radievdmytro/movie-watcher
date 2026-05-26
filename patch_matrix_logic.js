const fs = require('fs');
let content = fs.readFileSync('client/src/components/MovieDetailsModal.jsx', 'utf8');

// Add isTrailerCached state
content = content.replace(
    "const [preloadedTrailers, setPreloadedTrailers] = useState(null);",
    "const [preloadedTrailers, setPreloadedTrailers] = useState(null);\n    const [isTrailerCached, setIsTrailerCached] = useState(false);"
);

// Update fetchTrailers to use data.cached
const oldFetch = `                if (active) setPreloadedTrailers(data.results || []);`;
const newFetch = `                if (active) {
                    setPreloadedTrailers(data.results || []);
                    if (data.cached) setIsTrailerCached(true);
                }`;
content = content.replace(oldFetch, newFetch);

// Update Desktop button to only animate "Искать" -> "Смотреть"
const desktopOld = `🎬 <MatrixText text={Array.isArray(preloadedTrailers) && preloadedTrailers.length > 0 ? 'Смотреть трейлер' : 'Искать трейлер'} duration={500} />`;
const desktopNew = `🎬 <MatrixText 
                                    text={Array.isArray(preloadedTrailers) && preloadedTrailers.length > 0 ? 'Смотреть' : 'Искать'} 
                                    duration={400} 
                                    skipAnimation={isTrailerCached}
                                /> трейлер`;
content = content.replace(desktopOld, desktopNew);

// Update Mobile button to remove MatrixText
const mobileOld = `🎬 <MatrixText text={Array.isArray(preloadedTrailers) && preloadedTrailers.length > 0 ? 'Смотреть трейлер' : 'Искать трейлер'} duration={500} />`;
const mobileNew = `🎬 Трейлер`;
content = content.replace(mobileOld, mobileNew);

fs.writeFileSync('client/src/components/MovieDetailsModal.jsx', content);
console.log('Patched MovieDetailsModal.jsx successfully.');
