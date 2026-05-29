const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'client', 'src', 'components', 'MovieGrid.jsx');
let content = fs.readFileSync(p, 'utf8');

const stateTarget = `const [hasMoreBgCache, setHasMoreBgCache] = useState(false);`;
const stateReplacement = `const [hasMoreBgCache, setHasMoreBgCache] = useState(false);
    const [hasFiredLiveSearch, setHasFiredLiveSearch] = useState(false);
    const [isLiveSearching, setIsLiveSearching] = useState(false);`;
content = content.replace(stateTarget, stateReplacement);

fs.writeFileSync(p, content, 'utf8');
console.log("Patched MovieGrid.jsx state fix");
