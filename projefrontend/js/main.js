/**
 * Main Application Entrypoint
 */
import { initTheme } from './theme.js';
import { initNavigation } from './navigation.js';

document.addEventListener('DOMContentLoaded', () => {
    console.log('⚡ Proje Frontend initialized successfully!');
    
    // Initialize Core Modules
    initTheme();
    initNavigation();
});
