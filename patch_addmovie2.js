const fs = require('fs');
const path = require('path');
const p = path.join(__dirname, 'client', 'src', 'components', 'AddMovie.jsx');
let content = fs.readFileSync(p, 'utf8');

const dropdownStateTarget = `const [searchFilterDescription, setSearchFilterDescription] = useState(false);`;
const dropdownStateReplacement = `const [searchFilterDescription, setSearchFilterDescription] = useState(false);
    const [enableDropdown, setEnableDropdown] = useState(() => {
        const stored = localStorage.getItem('am_enableDropdown');
        return stored !== null ? JSON.parse(stored) : true;
    });

    useEffect(() => {
        localStorage.setItem('am_enableDropdown', JSON.stringify(enableDropdown));
    }, [enableDropdown]);`;

if (content.includes(dropdownStateTarget)) {
    content = content.replace(dropdownStateTarget, dropdownStateReplacement);
    console.log("Patched AddMovie dropdown state");
}

const filterTarget = `                        {/* Search in Description Checkbox */}`;
const filterReplacement = `                        {/* Search in Description Checkbox */}`;

// Actually let's use replace_file_content to inject the search fields pills.
// Where should the pills go? The user said "Встроить их прямо внутрь новой объединенной строки поиска чтобы они всегда были на виду."
// So I will put them right below the search input, inside the search bar container or immediately below it.

