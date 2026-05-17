import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Setup global API URL interceptor for production deployment
const API_URL = import.meta.env.VITE_API_URL || '';
if (API_URL) {
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
        if (typeof input === 'string' && input.startsWith('/api')) {
            // Trim any double slashes if API_URL ends with one
            const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
            return originalFetch(baseUrl + input, init);
        }
        return originalFetch(input, init);
    };
}

ReactDOM.createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
