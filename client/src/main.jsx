import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Setup global API URL and Auth token interceptor
const API_URL = import.meta.env.VITE_API_URL || '';
const originalFetch = window.fetch;
window.fetch = async function (input, init) {
    let url = input;
    let options = { ...init };

    if (typeof input === 'string' && input.startsWith('/api')) {
        // Resolve backend URL in production
        if (API_URL) {
            const baseUrl = API_URL.endsWith('/') ? API_URL.slice(0, -1) : API_URL;
            url = baseUrl + input;
        }

        // Inject JWT auth token if stored locally
        const token = localStorage.getItem('token');
        if (token) {
            options.headers = {
                ...options.headers,
                'Authorization': `Bearer ${token}`
            };
        }
    }
    
    const response = await originalFetch(url, options);
    
    // If the backend returned 401 Unauthorized (session expired or database wiped),
    // clear the token and force reload to redirect them to the auth screen.
    if (response.status === 401 && localStorage.getItem('token')) {
        localStorage.removeItem('token');
        window.location.reload();
    }
    
    return response;
};

ReactDOM.createRoot(document.getElementById('app')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
