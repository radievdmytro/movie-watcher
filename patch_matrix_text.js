const fs = require('fs');
let content = fs.readFileSync('client/src/components/MovieDetailsModal.jsx', 'utf8');

// 1. Import MatrixText
if (!content.includes("import MatrixText")) {
    content = content.replace(
        "import React, { useState, useEffect, useMemo } from 'react';",
        "import React, { useState, useEffect, useMemo } from 'react';\nimport MatrixText from './MatrixText';"
    );
}

// 2. Replace text in desktop button
const desktopOld = `{Array.isArray(preloadedTrailers) && preloadedTrailers.length > 0 ? '🎬 Смотреть трейлер' : '🎬 Искать трейлер'}`;
const desktopNew = `🎬 <MatrixText text={Array.isArray(preloadedTrailers) && preloadedTrailers.length > 0 ? 'Смотреть трейлер' : 'Искать трейлер'} duration={500} />`;
content = content.replace(desktopOld, desktopNew);

// 3. Replace text in mobile button
content = content.replace(desktopOld, desktopNew); // The second instance

fs.writeFileSync('client/src/components/MovieDetailsModal.jsx', content);
console.log('Patched MovieDetailsModal.jsx successfully.');
