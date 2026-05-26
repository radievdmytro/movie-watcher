const fs = require('fs');
let content = fs.readFileSync('client/src/components/TrailerModal.jsx', 'utf8');

// Replace the initial state declarations
const oldState = `    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);`;

const newState = `    const [results, setResults] = useState(() => Array.isArray(preloadedTrailers) ? preloadedTrailers : []);
    const [loading, setLoading] = useState(() => preloadedTrailers === null);
    const [error, setError] = useState(() => preloadedTrailers instanceof Error ? preloadedTrailers.message : null);`;

content = content.replace(oldState, newState);

fs.writeFileSync('client/src/components/TrailerModal.jsx', content);
console.log('Fixed initial flicker in TrailerModal.jsx');
