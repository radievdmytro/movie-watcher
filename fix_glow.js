const fs = require('fs');
let content = fs.readFileSync('client/src/components/MovieDetailsModal.jsx', 'utf8');

// The desktop button is the first occurrence of the animation logic.
// It needs the 1s delay: shimmerGold 1.5s ease-out 1s 1 forwards
// The mobile button is the second occurrence.
// It needs NO delay: shimmerGold 1.5s ease-out 1 forwards

const regex = /animation:\s*\(Array\.isArray\(preloadedTrailers\)\s*&&\s*preloadedTrailers\.length\s*>\s*0\s*&&\s*!isTrailerCached\)\s*\?\s*'shimmerGold [^']+'\s*:\s*'none'/g;

let count = 0;
content = content.replace(regex, (match) => {
    count++;
    if (count === 1) {
        // Desktop
        return "animation: (Array.isArray(preloadedTrailers) && preloadedTrailers.length > 0 && !isTrailerCached) ? 'shimmerGold 1.5s ease-out 1s 1 forwards' : 'none'";
    } else {
        // Mobile
        return "animation: (Array.isArray(preloadedTrailers) && preloadedTrailers.length > 0 && !isTrailerCached) ? 'shimmerGold 1.5s ease-out 1 forwards' : 'none'";
    }
});

fs.writeFileSync('client/src/components/MovieDetailsModal.jsx', content);
console.log('Fixed button glows!');
