const fs = require('fs');
let content = fs.readFileSync('client/src/components/MovieDetailsModal.jsx', 'utf8');

const targetOld = `animation: (Array.isArray(preloadedTrailers) && preloadedTrailers.length > 0) ? 'shimmerGold 1.5s ease-out 1' : 'none'`;
const targetNew = `animation: (Array.isArray(preloadedTrailers) && preloadedTrailers.length > 0 && !isTrailerCached) ? 'shimmerGold 1.5s ease-out 1' : 'none'`;

// Replace all instances
content = content.split(targetOld).join(targetNew);

fs.writeFileSync('client/src/components/MovieDetailsModal.jsx', content);
console.log('Patched mobile glow successfully.');
