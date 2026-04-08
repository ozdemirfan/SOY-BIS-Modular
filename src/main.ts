/**
 * SOY-BIS v3.0 - Main Entry Point
 * Modern TypeScript + Vite Architecture
 */

// Stiller index.html’de <link> ile yüklenir (ilk boyama öncesi); çift yükleme olmaması için burada import yok.

// Import external libraries (for global access)
import * as XLSX from 'xlsx';
// @ts-ignore - html2pdf.js type definitions
import html2pdf from 'html2pdf.js';

// Import app module
import { init as initApp, exposeModulesToWindow } from './app';
import { whenAppShellReady } from './app/appShellReady';
import { initMobileScrollWheelFix } from './utils/mobileScrollWheelFix';

// Expose libraries to global window for backward compatibility
if (typeof window !== 'undefined') {
  (window as any).XLSX = XLSX;
  (window as any).html2pdf = html2pdf;
}

function startApp(): void {
  console.log('SOY-BIS v3.0 - Initializing...');

  initMobileScrollWheelFix();

  // Önce modülleri window'a expose et
  exposeModulesToWindow();

  // Sonra uygulamayı başlat
  void initApp();
}

// Tam index.html (sidebar + #mainNav) yoksa modül init’leri boş DOM ile koşuyordu — kabuk hazır olunca başlat
whenAppShellReady(startApp);
