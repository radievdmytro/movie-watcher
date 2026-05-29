const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'client', 'src', 'components', 'MovieGrid.jsx');
let content = fs.readFileSync(p, 'utf8');

// 1. Update signature
const sigTarget = `function MovieGrid({ movies, allMovies = movies, historyList = [], onFetchHistory, onUpdate, onDelete, selectedIds, onSelect, onSelectAll, setSelectionAnchor, deletingIds = [], trashButtonRef, isTrashMode, isWatchedView, guestLimitReached, isGuest, onRegisterClick, highlightedLink, onGuestActivity, onAddToCollectionClick, onNavigate }) {`;
const sigReplacement = `function MovieGrid({ movies, allMovies = movies, historyList = [], onFetchHistory, onUpdate, onDelete, selectedIds, onSelect, onSelectAll, setSelectionAnchor, deletingIds = [], trashButtonRef, isTrashMode, isWatchedView, guestLimitReached, isGuest, onRegisterClick, highlightedLink, onGuestActivity, onAddToCollectionClick, onNavigate, globalSearchQuery = '', setGlobalSearchQuery, globalSearchFields = {}, includeGlobalDb = false }) {`;
content = content.replace(sigTarget, sigReplacement);

// 2. Remove local filterQuery state
const stateTarget1 = `const [filterQuery, setFilterQuery] = useState('');
    const deferredFilterQuery = useDeferredValue(filterQuery);`;
const stateReplacement1 = `const filterQuery = globalSearchQuery;
    const deferredFilterQuery = useDeferredValue(filterQuery);
    const setFilterQuery = setGlobalSearchQuery || (() => {});`;
content = content.replace(stateTarget1, stateReplacement1);

// 3. Remove local searchFields state
const stateTarget2 = `const [searchFields, setSearchFields] = useState(() => {
        try {
            const saved = localStorage.getItem('searchFields');
            if (saved) return { ...{ title: true, actor: true, director: true, year: true, description: false }, ...JSON.parse(saved) };
        } catch (e) {}
        return { title: true, actor: true, director: true, year: true, description: false };
    });

    const toggleSearchField = (field) => {
        setSearchFields(prev => {
            const next = { ...prev, [field]: !prev[field] };
            // Ensure at least one field is active. If all are false, default to title.
            const allFalse = !Object.values(next).some(Boolean);
            if (allFalse) {
                next.title = true;
            }
            localStorage.setItem('searchFields', JSON.stringify(next));
            return next;
        });
    };`;
const stateReplacement2 = `const searchFields = globalSearchFields;`;
content = content.replace(stateTarget2, stateReplacement2);

// 4. Update searchDb state to use includeGlobalDb
const stateTarget3 = `const [searchDb, setSearchDb] = useState(() => localStorage.getItem('movieGrid_searchDb') || 'library'); // 'library' | 'cache' | 'global'
    const [autoSwitchToCache, setAutoSwitchToCache] = useState(() => {
        const stored = localStorage.getItem('movieGrid_autoSwitchToCache');
        return stored !== null ? JSON.parse(stored) : true;
    });

    const handleToggleAutoSwitch = (checked) => {
        setAutoSwitchToCache(checked);
        if (checked && searchDb === 'library' && filterQuery.trim().length >= 3) {
            setSearchDb('cache');
        }
    };`;
const stateReplacement3 = `const searchDb = includeGlobalDb ? 'cache' : 'library';
    const autoSwitchToCache = includeGlobalDb;
    const handleToggleAutoSwitch = () => {};`;
content = content.replace(stateTarget3, stateReplacement3);

// 5. Remove search-input container from UI
const regexInput = /<div className="search-bar-row"[^>]*>[\s\S]*?(<button\s+className="btn btn-ghost"[\s\S]*?>[\s\S]*?<\/button>\s*<\/div>)/;
content = content.replace(regexInput, (match, p1) => {
    return `<div className="search-bar-row" style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>\n                        ` + p1;
});

// 6. Remove global db checkbox
const regexCheckbox = /\{\/\* Search DB Toggle replaced with a single premium, compact Checkbox \*\/\}[\s\S]*?\(\s*<div style=\{\{[\s\S]*?<\/div>\s*\)\}/;
content = content.replace(regexCheckbox, '');

fs.writeFileSync(p, content, 'utf8');
console.log("Patched MovieGrid successfully");
