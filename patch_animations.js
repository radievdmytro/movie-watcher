const fs = require('fs');
let content = fs.readFileSync('client/src/components/MovieDetailsModal.jsx', 'utf8');

// 1. Add keyframes
content = content.replace(
    "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }",
    "@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }\n                @keyframes shimmerGold { 0% { box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); color: #ccc; } 30% { box-shadow: 0 0 30px rgba(212, 175, 55, 0.8); background: rgba(212, 175, 55, 0.3); border-color: rgba(212, 175, 55, 1); color: #fff; text-shadow: 0 0 10px rgba(255,255,255,0.5); } 100% { box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2); background: rgba(255, 255, 255, 0.1); border-color: rgba(255, 255, 255, 0.2); color: #ccc; } }"
);

// 2. Add animation property to desktop button
const desktopButtonOld = `                                    gap: '8px',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)'
                                }}`;
const desktopButtonNew = `                                    gap: '8px',
                                    transition: 'all 0.2s ease',
                                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                                    animation: (Array.isArray(preloadedTrailers) && preloadedTrailers.length > 0) ? 'shimmerGold 1.5s ease-out 1' : 'none'
                                }}`;
content = content.replace(desktopButtonOld, desktopButtonNew);

// 3. Add animation property to mobile button
const mobileButtonOld = `                                        transition: 'all 0.2s ease',
                                        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)'
                                    }}`;
const mobileButtonNew = `                                        transition: 'all 0.2s ease',
                                        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
                                        animation: (Array.isArray(preloadedTrailers) && preloadedTrailers.length > 0) ? 'shimmerGold 1.5s ease-out 1' : 'none'
                                    }}`;
content = content.replace(mobileButtonOld, mobileButtonNew);

fs.writeFileSync('client/src/components/MovieDetailsModal.jsx', content);
console.log('Patched MovieDetailsModal.jsx successfully.');
