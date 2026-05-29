const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'client', 'src', 'App.jsx');
let content = fs.readFileSync(p, 'utf8');

content = content.replace(`                                    globalSearchQuery={globalSearchQuery}
                                    setGlobalSearchQuery={setGlobalSearchQuery}
                                    setGlobalSearchQuery={setGlobalSearchQuery}`, `                                    globalSearchQuery={globalSearchQuery}
                                    setGlobalSearchQuery={setGlobalSearchQuery}`);

fs.writeFileSync(p, content, 'utf8');
