const fs = require('fs');
let content = fs.readFileSync('client/src/components/MovieDetailsModal.jsx', 'utf8');

const desktopTargetOld = `animation: (Array.isArray(preloadedTrailers) && preloadedTrailers.length > 0 && !isTrailerCached) ? 'shimmerGold 1.5s ease-out 1' : 'none'`;
const desktopTargetNew = `animation: (Array.isArray(preloadedTrailers) && preloadedTrailers.length > 0 && !isTrailerCached) ? 'shimmerGold 1.5s ease-out 0.5s 1 forwards' : 'none'`;

// Replace all instances
content = content.split(desktopTargetOld).join(desktopTargetNew);

fs.writeFileSync('client/src/components/MovieDetailsModal.jsx', content);
console.log('Patched glow delay successfully.');
