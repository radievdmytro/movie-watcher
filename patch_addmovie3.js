const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'client', 'src', 'components', 'AddMovie.jsx');
let content = fs.readFileSync(p, 'utf8');

const endOfSearchBarTarget = `            {/* Elegant glowing streaming progress bar */}`;

const fieldsPillsHTML = `
            {/* Search Field Pills */}
            <div style={{
                display: 'flex',
                gap: '8px',
                marginTop: '10px',
                flexWrap: 'wrap',
                padding: '0 10px',
                alignItems: 'center'
            }}>
                <span style={{ fontSize: '0.8rem', color: '#888', marginRight: '5px' }}>Искать в:</span>
                {['title', 'actor', 'director', 'year', 'description'].map(field => (
                    <button
                        key={field}
                        onClick={() => {
                            if (setGlobalSearchFields) {
                                setGlobalSearchFields(prev => {
                                    const next = { ...prev, [field]: !prev[field] };
                                    if (!Object.values(next).some(Boolean)) next.title = true;
                                    localStorage.setItem('searchFields', JSON.stringify(next));
                                    return next;
                                });
                            }
                        }}
                        style={{
                            background: globalSearchFields?.[field] ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                            color: globalSearchFields?.[field] ? 'var(--accent-gold)' : '#aaa',
                            border: \`1px solid \${globalSearchFields?.[field] ? 'var(--accent-gold)' : 'rgba(255, 255, 255, 0.1)'}\`,
                            borderRadius: '12px',
                            padding: '4px 12px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            textTransform: 'capitalize',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        {globalSearchFields?.[field] && <span style={{ fontSize: '0.65rem' }}>✓</span>}
                        {field}
                    </button>
                ))}
                
                {/* Global DB Checkbox */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto', fontSize: '0.8rem', color: '#ccc', cursor: 'pointer' }}>
                    <input 
                        type="checkbox" 
                        checked={includeGlobalDb || false}
                        onChange={(e) => {
                            if (setIncludeGlobalDb) {
                                setIncludeGlobalDb(e.target.checked);
                                localStorage.setItem('movieGrid_searchDb', e.target.checked ? 'global' : 'library');
                            }
                        }}
                        style={{ accentColor: 'var(--accent-gold)' }}
                    />
                    Include Global DB
                </label>

                {/* Show Dropdown Panel Checkbox */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '10px', fontSize: '0.8rem', color: '#ccc', cursor: 'pointer' }}>
                    <input 
                        type="checkbox" 
                        checked={enableDropdown}
                        onChange={(e) => setEnableDropdown(e.target.checked)}
                        style={{ accentColor: 'var(--accent-gold)' }}
                    />
                    Show Top Results Panel
                </label>
            </div>
`;

if (content.includes(endOfSearchBarTarget)) {
    content = content.replace(endOfSearchBarTarget, fieldsPillsHTML + '\n            {/* Elegant glowing streaming progress bar */}');
    console.log("Patched AddMovie search pills");
}

fs.writeFileSync(p, content, 'utf8');
