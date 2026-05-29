const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'client', 'src', 'components', 'MovieGrid.jsx');
let content = fs.readFileSync(p, 'utf8');

const target = `// Search query filter (if active)
            if (deferredFilterQuery) {`;
const replacement = `// Search query filter (if active)
            if (deferredFilterQuery && searchDb !== 'global') {`;
content = content.replace(target, replacement);

fs.writeFileSync(p, content, 'utf8');
console.log("Patched MovieGrid.jsx part 2");
