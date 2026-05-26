const fs = require('fs');
let content = fs.readFileSync('client/src/components/MatrixText.jsx', 'utf8');

const oldStyle = `        <span style={{ 
            fontFamily: isAnimating ? 'monospace' : 'inherit',
            letterSpacing: isAnimating ? '1px' : 'inherit',
            transition: 'all 0.2s'
        }}>`;
const newStyle = `        <span>`;

content = content.replace(oldStyle, newStyle);

fs.writeFileSync('client/src/components/MatrixText.jsx', content);
console.log('Patched MatrixText.jsx styles successfully.');
