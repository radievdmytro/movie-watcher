const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'client', 'src', 'App.jsx');
let content = fs.readFileSync(p, 'utf8');

const gridTarget = `                                    globalSearchQuery={globalSearchQuery}`;
const gridReplacement = `                                    globalSearchQuery={globalSearchQuery}
                                    setGlobalSearchQuery={setGlobalSearchQuery}`;

if (content.includes(gridTarget)) {
    content = content.replace(gridTarget, gridReplacement);
    console.log("Patched MovieGrid props in App.jsx");
}

fs.writeFileSync(p, content, 'utf8');
