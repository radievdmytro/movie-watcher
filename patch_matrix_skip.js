const fs = require('fs');
let content = fs.readFileSync('client/src/components/MatrixText.jsx', 'utf8');

// Update function signature
content = content.replace(
    "export default function MatrixText({ text, duration = 600 }) {",
    "export default function MatrixText({ text, duration = 600, skipAnimation = false }) {"
);

// Update useEffect dependencies
content = content.replace(
    "}, [text, duration]);",
    "}, [text, duration, skipAnimation]);"
);

// Add skipAnimation check at the top of useEffect
const oldUseEffectStart = `    useEffect(() => {
        // Only trigger if text actually changes
        let active = true;`;

const newUseEffectStart = `    useEffect(() => {
        // Only trigger if text actually changes
        let active = true;
        
        if (skipAnimation) {
            setDisplayText(text);
            setIsAnimating(false);
            return;
        }`;

content = content.replace(oldUseEffectStart, newUseEffectStart);

fs.writeFileSync('client/src/components/MatrixText.jsx', content);
console.log('Patched MatrixText.jsx successfully.');
