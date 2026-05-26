const fs = require('fs');
let content = fs.readFileSync('client/src/components/MovieDetailsModal.jsx', 'utf8');

// 1. Increase MatrixText duration to 1000ms
const desktopTargetOldText = `duration={400}`;
const desktopTargetNewText = `duration={1000}`;
content = content.split(desktopTargetOldText).join(desktopTargetNewText);

// 2. Increase glow delay to 1s
const desktopTargetOldGlow = `shimmerGold 1.5s ease-out 0.5s 1 forwards`;
const desktopTargetNewGlow = `shimmerGold 1.5s ease-out 1s 1 forwards`;
content = content.split(desktopTargetOldGlow).join(desktopTargetNewGlow);

fs.writeFileSync('client/src/components/MovieDetailsModal.jsx', content);
console.log('Patched duration and delay successfully.');
