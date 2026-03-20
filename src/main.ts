/**
 * SOY-BIS v3.0 - Main Entry Point
 * Modern TypeScript + Vite Architecture
 */

// Import styles
import './styles/main.css';

// Import external libraries (for global access)
import * as XLSX from 'xlsx';
// @ts-ignore - html2pdf.js type definitions
import html2pdf from 'html2pdf.js';

// Import app module
import { init as initApp, exposeModulesToWindow } from './app';

// Expose libraries to global window for backward compatibility
if (typeof window !== 'undefined') {
  (window as any).XLSX = XLSX;
  (window as any).html2pdf = html2pdf;
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  console.log('SOY-BIS v3.0 - Initializing...');

  // Önce modülleri window'a expose et
  exposeModulesToWindow();

  // Sonra uygulamayı başlat
  initApp();
});
