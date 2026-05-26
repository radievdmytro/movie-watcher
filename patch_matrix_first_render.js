const fs = require('fs');
let content = fs.readFileSync('client/src/components/MatrixText.jsx', 'utf8');

if (!content.includes("useRef")) {
    content = content.replace(
        "import React, { useState, useEffect } from 'react';",
        "import React, { useState, useEffect, useRef } from 'react';"
    );
}

const hookStartOld = `    const [displayText, setDisplayText] = useState(text);
    const [isAnimating, setIsAnimating] = useState(false);`;

const hookStartNew = `    const [displayText, setDisplayText] = useState(text);
    const [isAnimating, setIsAnimating] = useState(false);
    const isFirstRender = useRef(true);`;
    
content = content.replace(hookStartOld, hookStartNew);

const useEffectStartOld = `    useEffect(() => {
        // Only trigger if text actually changes
        let active = true;
        
        if (skipAnimation) {`;

const useEffectStartNew = `    useEffect(() => {
        // Only trigger if text actually changes
        let active = true;
        
        if (isFirstRender.current) {
            isFirstRender.current = false;
            setDisplayText(text);
            return;
        }

        if (skipAnimation) {`;

content = content.replace(useEffectStartOld, useEffectStartNew);

fs.writeFileSync('client/src/components/MatrixText.jsx', content);
console.log('Patched MatrixText.jsx for first render successfully.');
