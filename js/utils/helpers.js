/**
 * SOY-BIS - Yardımcı Fonksiyonlar (helpers.js)
 * Genel amaçlı yardımcı fonksiyonlar
 */

const Helpers = (function() {
    'use strict';

    // Aylar listesi
    const AYLAR = [
        "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
        "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"
    ];

    // Yaş grupları (TFF Standartları)
    const YAS_GRUPLARI = [
        'U7', 'U8', 'U9', 'U10', 'U11', 'U12', 'U13',
        'U14', 'U15', 'U16', 'U17', 'U18', 'U19', 'U21'
    ];

    /**
     * Para formatı (2000 -> 2.000)
     * @param {number|string} sayi - Formatlanacak sayı
     * @param {boolean} kisaFormat - Büyük rakamlar için kısa format (1.5M gibi)
     * @returns {string} Formatlanmış para değeri
     */
    function paraFormat(sayi, kisaFormat = false) {
        if (sayi === null || sayi === undefined) return '0';
        const num = typeof sayi === 'string' ? parseFloat(sayi.replace(/\./g, '').replace(',', '.')) : sayi;
        if (isNaN(num)) return '0';
        
        // Büyük rakamlar için kısa format (dashboard kartları için)
        if (kisaFormat && num >= 1000000) {
            const milyon = num / 1000000;
            return milyon.toFixed(1).replace('.', ',') + 'M';
        } else if (kisaFormat && num >= 1000) {
            const bin = num / 1000;
            return bin.toFixed(1).replace('.', ',') + 'K';
        }
        
        return num.toLocaleString('tr-TR');
    }

    /**
     * Input için para formatı (yazarken)
     * @param {HTMLInputElement} input - Input elementi
     */
    function paraFormatInput(input) {
        let val = input.value.replace(/\D/g, '');
        if (val) {
            val = val.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }
        input.value = val;
    }

    /**
     * Para string'ini sayıya çevir (2.000 -> 2000, 1234.50 -> 1234.50)
     * @param {string} str - Para string'i
     * @returns {number} Sayısal değer (2 ondalık basamağa yuvarlanmış)
     */
    function paraCoz(str) {
        if (!str) return 0;
        // Binlik ayırıcıları kaldır, virgülü noktaya çevir
        const cleaned = str.toString().replace(/\./g, '').replace(',', '.');
        const num = parseFloat(cleaned);
        if (isNaN(num)) return 0;
        // Floating point hassasiyet sorunlarını önlemek için 2 ondalık basamağa yuvarla
        // Örnek: 0.1 + 0.2 = 0.30000000000000004 -> Math.round((0.1 + 0.2) * 100) / 100 = 0.3
        return Math.round(num * 100) / 100;
    }

    /**
     * Tarih formatla (ISO -> TR)
     * @param {string} isoDate - ISO tarih formatı
     * @returns {string} TR formatında tarih
     */
    function tarihFormat(isoDate) {
        if (!isoDate) return '-';
        const date = new Date(isoDate);
        return date.toLocaleDateString('tr-TR');
    }

    /**
     * Bugünün ISO formatında tarihi
     * @returns {string} YYYY-MM-DD formatında bugün
     */
    function bugunISO() {
        return new Date().toISOString().split('T')[0];
    }

    /**
     * Doğum tarihinden yaş hesapla
     * @param {string} dogumTarihi - Doğum tarihi (YYYY-MM-DD)
     * @returns {number} Yaş
     */
    function yasHesapla(dogumTarihi) {
        if (!dogumTarihi) return 0;
        const dogum = new Date(dogumTarihi);
        const bugun = new Date();
        let yas = bugun.getFullYear() - dogum.getFullYear();
        const ayFarki = bugun.getMonth() - dogum.getMonth();
        
        if (ayFarki < 0 || (ayFarki === 0 && bugun.getDate() < dogum.getDate())) {
            yas--;
        }
        return yas;
    }

    /**
     * Yaşa göre TFF yaş grubu belirle
     * @param {number} yas - Yaş
     * @returns {string} Yaş grubu (U7, U8, vb.)
     */
    function yasGrubuBelirle(yas) {
        if (yas < 7) return 'U7';
        if (yas > 21) return 'U21+';
        return 'U' + yas;
    }

    /**
     * Doğum tarihinden yaş grubu hesapla
     * @param {string} dogumTarihi - Doğum tarihi
     * @returns {string} Yaş grubu
     */
    function yasGrubuHesapla(dogumTarihi) {
        const yas = yasHesapla(dogumTarihi);
        return yasGrubuBelirle(yas);
    }

    /**
     * Benzersiz ID üret
     * @returns {number} Benzersiz ID
     */
    function benzersizId() {
        return Date.now() + Math.random().toString(36).substr(2, 9);
    }

    /**
     * Debounce fonksiyonu
     * @param {Function} func - Çalıştırılacak fonksiyon
     * @param {number} wait - Bekleme süresi (ms)
     * @returns {Function} Debounced fonksiyon
     */
    function debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * DOM elementi oluştur
     * @param {string} tag - HTML tag
     * @param {Object} attributes - Attributeler
     * @param {string|HTMLElement} content - İçerik
     * @param {boolean} allowHtml - HTML içerik kullanılsın mı? (varsayılan: false, güvenlik için)
     * @returns {HTMLElement} Oluşturulan element
     */
    function createElement(tag, attributes = {}, content = '', allowHtml = false) {
        const element = document.createElement(tag);
        
        for (const [key, value] of Object.entries(attributes)) {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'dataset') {
                for (const [dataKey, dataValue] of Object.entries(value)) {
                    element.dataset[dataKey] = dataValue;
                }
            } else if (key.startsWith('on')) {
                element.addEventListener(key.substring(2).toLowerCase(), value);
            } else {
                element.setAttribute(key, value);
            }
        }

        if (typeof content === 'string') {
            if (allowHtml) {
                // HTML içerik kullan (icon'lar, badge'ler gibi güvenli içerikler için)
            element.innerHTML = content;
            } else {
                // Güvenlik: textContent kullan (kullanıcı girdileri için)
                element.textContent = content;
            }
        } else if (content instanceof HTMLElement) {
            element.appendChild(content);
        }

        return element;
    }

    /**
     * DOM elementi seç
     * @param {string} selector - CSS seçici
     * @returns {HTMLElement|null} Element
     */
    function $(selector) {
        return document.querySelector(selector);
    }

    /**
     * Tüm DOM elementlerini seç
     * @param {string} selector - CSS seçici
     * @returns {NodeList} Elementler
     */
    function $$(selector) {
        return document.querySelectorAll(selector);
    }

    /**
     * Toast bildirimi göster
     * @param {string} message - Mesaj
     * @param {string} type - Tip (success, error, warning, info)
     * @param {number} duration - Süre (ms)
     */
    function toast(message, type = 'info', duration = 3000) {
        const container = $('#toastContainer');
        if (!container) return;

        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        // HTML içerik kullan (icon'lar için güvenli)
        const toastEl = createElement('div', { className: `toast toast-${type}` }, `
            <i class="fa-solid ${icons[type]} toast-icon"></i>
            <span class="toast-message">${Helpers.escapeHtml(message)}</span>
            <button class="toast-close">&times;</button>
        `, true);

        container.appendChild(toastEl);

        // Kapat butonuna tıklama
        toastEl.querySelector('.toast-close').addEventListener('click', () => {
            toastEl.remove();
        });

        // Otomatik kapat
        setTimeout(() => {
            if (toastEl.parentNode) {
                toastEl.style.animation = 'toastSlide 0.3s ease reverse';
                setTimeout(() => toastEl.remove(), 300);
            }
        }, duration);
    }

    /**
     * Onay modalı göster
     * @param {string} message - Mesaj
     * @returns {boolean} Onay durumu
     */
    function onay(message) {
        return confirm(message);
    }

    /**
     * Prompt göster
     * @param {string} message - Mesaj
     * @param {string} defaultValue - Varsayılan değer
     * @returns {string|null} Girilen değer
     */
    function girdi(message, defaultValue = '') {
        return prompt(message, defaultValue);
    }

    /**
     * Yüzde hesapla
     * @param {number} kisim - Kısım
     * @param {number} toplam - Toplam
     * @returns {number} Yüzde
     */
    function yuzdeHesapla(kisim, toplam) {
        if (toplam === 0) return 0;
        return Math.round((kisim / toplam) * 100);
    }

    /**
     * String'i slug'a çevir
     * @param {string} str - String
     * @returns {string} Slug
     */
    function slugify(str) {
        return str
            .toLowerCase()
            .replace(/ğ/g, 'g')
            .replace(/ü/g, 'u')
            .replace(/ş/g, 's')
            .replace(/ı/g, 'i')
            .replace(/ö/g, 'o')
            .replace(/ç/g, 'c')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    /**
     * Dizi'yi grupla
     * @param {Array} array - Dizi
     * @param {string} key - Gruplama anahtarı
     * @returns {Object} Gruplanmış obje
     */
    function grupla(array, key) {
        return array.reduce((acc, item) => {
            const groupKey = typeof key === 'function' ? key(item) : item[key];
            (acc[groupKey] = acc[groupKey] || []).push(item);
            return acc;
        }, {});
    }

    /**
     * Dizi'yi sırala
     * @param {Array} array - Dizi
     * @param {string} key - Sıralama anahtarı
     * @param {string} order - Sıralama yönü (asc, desc)
     * @returns {Array} Sıralanmış dizi
     */
    function sirala(array, key, order = 'asc') {
        return [...array].sort((a, b) => {
            const valA = typeof key === 'function' ? key(a) : a[key];
            const valB = typeof key === 'function' ? key(b) : b[key];
            
            if (valA < valB) return order === 'asc' ? -1 : 1;
            if (valA > valB) return order === 'asc' ? 1 : -1;
            return 0;
        });
    }

    /**
     * Ay adını getir
     * @param {number} ayIndex - Ay indeksi (1-12)
     * @returns {string} Ay adı
     */
    function ayAdi(ayIndex) {
        return AYLAR[ayIndex - 1] || '';
    }

    /**
     * Şu anki ay ve yılı getir
     * @param {Date} tarih - Tarih (opsiyonel, varsayılan: bugün)
     * @returns {Object} {ay, yil}
     */
    function suAnkiDonem(tarih = null) {
        const date = tarih || new Date();
        return {
            ay: date.getMonth() + 1,
            yil: date.getFullYear()
        };
    }

    /**
     * Tarih objesini ISO string'e çevir (YYYY-MM-DD)
     * @param {Date} tarih - Tarih objesi
     * @returns {string} ISO format tarih
     */
    function tarihISO(tarih) {
        if (!tarih) return bugunISO();
        const date = tarih instanceof Date ? tarih : new Date(tarih);
        const yil = date.getFullYear();
        const ay = String(date.getMonth() + 1).padStart(2, '0');
        const gun = String(date.getDate()).padStart(2, '0');
        return `${yil}-${ay}-${gun}`;
    }

    /**
     * Skeleton loader oluştur - Stat Card
     * @param {number} count - Kaç tane skeleton gösterilecek
     * @returns {string} HTML
     */
    function skeletonStatCard(count = 1) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="skeleton-stat-card">
                    <div class="skeleton skeleton-stat-icon"></div>
                    <div class="skeleton-stat-content">
                        <div class="skeleton skeleton-stat-value"></div>
                        <div class="skeleton skeleton-stat-label"></div>
                    </div>
                </div>
            `;
        }
        return html;
    }

    /**
     * Skeleton loader oluştur - Table
     * @param {number} rows - Satır sayısı
     * @param {number} cols - Sütun sayısı
     * @returns {string} HTML
     */
    function skeletonTable(rows = 5, cols = 7) {
        let html = '<table class="skeleton-table">';
        html += '<thead><tr>';
        for (let i = 0; i < cols; i++) {
            html += '<th><div class="skeleton skeleton-text" style="height: 16px;"></div></th>';
        }
        html += '</tr></thead><tbody>';
        for (let r = 0; r < rows; r++) {
            html += '<tr>';
            for (let c = 0; c < cols; c++) {
                const widthClass = c === 0 ? 'skeleton-table-cell-medium' : 
                                  c === cols - 1 ? 'skeleton-table-cell-short' : 
                                  'skeleton-table-cell';
                html += `<td><div class="skeleton ${widthClass}"></div></td>`;
            }
            html += '</tr>';
        }
        html += '</tbody></table>';
        return html;
    }

    /**
     * Skeleton loader oluştur - Chart
     * @returns {string} HTML
     */
    function skeletonChart() {
        const barCount = 12;
        const bars = Array.from({ length: barCount }, (_, i) => {
            const height = 30 + Math.random() * 70; // %30-100 arası rastgele yükseklik
            return `<div class="skeleton skeleton-chart-bar" style="height: ${height}%;"></div>`;
        }).join('');
        
        return `
            <div class="skeleton-chart">
                <div class="skeleton-chart-bars">
                    ${bars}
                </div>
            </div>
        `;
    }

    /**
     * Skeleton loader oluştur - List
     * @param {number} count - Öğe sayısı
     * @returns {string} HTML
     */
    function skeletonList(count = 5) {
        let html = '<div class="skeleton-list">';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="skeleton-list-item">
                    <div class="skeleton skeleton-list-avatar"></div>
                    <div class="skeleton-list-content">
                        <div class="skeleton skeleton-list-title"></div>
                        <div class="skeleton skeleton-list-subtitle"></div>
                    </div>
                </div>
            `;
        }
        html += '</div>';
        return html;
    }

    /**
     * Skeleton loader'ı göster
     * @param {string} containerSelector - Container selector
     * @param {string} type - Skeleton tipi ('stat', 'table', 'chart', 'list')
     * @param {Object} options - Seçenekler
     */
    function showSkeleton(containerSelector, type, options = {}) {
        const container = $(containerSelector);
        if (!container) return;

        let skeletonHTML = '';
        switch (type) {
            case 'stat':
                skeletonHTML = skeletonStatCard(options.count || 4);
                break;
            case 'table':
                skeletonHTML = skeletonTable(options.rows || 5, options.cols || 7);
                break;
            case 'chart':
                skeletonHTML = skeletonChart();
                break;
            case 'list':
                skeletonHTML = skeletonList(options.count || 5);
                break;
        }

        // Skeleton container oluştur veya güncelle
        let skeletonContainer = container.querySelector('.skeleton-container');
        if (!skeletonContainer) {
            skeletonContainer = document.createElement('div');
            skeletonContainer.className = 'skeleton-container';
            container.insertBefore(skeletonContainer, container.firstChild);
        }
        skeletonContainer.innerHTML = skeletonHTML;
        skeletonContainer.style.display = 'block';
    }

    /**
     * Skeleton loader'ı gizle
     * @param {string} containerSelector - Container selector
     */
    function hideSkeleton(containerSelector) {
        const container = $(containerSelector);
        if (!container) return;

        const skeletonContainer = container.querySelector('.skeleton-container');
        if (skeletonContainer) {
            skeletonContainer.style.display = 'none';
            skeletonContainer.innerHTML = '';
        }
    }

    /**
     * Badge oluştur (tekrarlayan badge kodlarını önlemek için)
     * @param {string} type - Badge tipi (success, danger, warning, info)
     * @param {string} text - Badge metni
     * @returns {string} HTML badge string
     */
    function createBadge(type, text) {
        // Güvenli: XSS koruması için escapeHtml kullan
        // Ancak text zaten HTML içeriyorsa (badge içinde badge gibi) escape etme
        const safeText = text && text.includes('<') ? text : escapeHtml(text);
        return `<span class="badge badge-${type}">${safeText}</span>`;
    }

    /**
     * Durum badge'i oluştur (Aktif/Pasif için)
     * @param {string} durum - Durum değeri ('Aktif' veya 'Pasif')
     * @returns {string} HTML badge string
     */
    function createDurumBadge(durum) {
        return durum === 'Aktif' 
            ? createBadge('success', 'Aktif')
            : createBadge('danger', 'Pasif');
    }

    /**
     * Empty state göster
     * @param {string} containerId - Container ID (selector)
     * @param {string} title - Başlık
     * @param {string} message - Mesaj
     * @param {Object} options - Ek seçenekler (icon, customClass)
     */
    function showEmptyState(containerId, title, message, options = {}) {
        const container = $(containerId);
        if (!container) return;

        const icon = options.icon || 'fa-inbox';
        const customClass = options.customClass || '';

        container.style.display = 'block';
        if (container.classList) {
            container.classList.add('show');
        }

        // H3 ve p elementlerini güncelle veya oluştur
        let titleEl = container.querySelector('h3');
        let messageEl = container.querySelector('p');
        
        if (!titleEl) {
            titleEl = document.createElement('h3');
            container.insertBefore(titleEl, container.firstChild);
        }
        titleEl.textContent = title;

        if (!messageEl) {
            messageEl = document.createElement('p');
            container.appendChild(messageEl);
        }
        messageEl.textContent = message;

        // Icon güncelle
        const iconEl = container.querySelector('i');
        if (iconEl) {
            iconEl.className = `fa-solid ${icon}`;
        }
    }

    /**
     * Empty state gizle
     * @param {string} containerId - Container ID (selector)
     */
    function hideEmptyState(containerId) {
        const container = $(containerId);
        if (!container) return;

        container.style.display = 'none';
        if (container.classList) {
            container.classList.remove('show');
        }
    }

    /**
     * Tablo satırı oluştur (Mobil kart görünümü destekli)
     * @param {Array} cells - Hücre içerikleri (string array veya {content, label, className} obje array)
     * @param {Object} options - Seçenekler (onclick, className, dataset, labels)
     * @returns {HTMLTableRowElement} TR elementi
     */
    function createTableRow(cells, options = {}) {
        const tr = document.createElement('tr');
        
        if (options.className) {
            tr.className = options.className;
        }

        if (options.dataset) {
            Object.entries(options.dataset).forEach(([key, value]) => {
                tr.dataset[key] = value;
            });
        }

        // labels array'i varsa data-label ekle (mobil kart görünümü için)
        const labels = options.labels || [];

        cells.forEach((cellContent, index) => {
            const td = document.createElement('td');
            
            // Obje formatı destekle: {content, label, className}
            if (typeof cellContent === 'object' && cellContent !== null && cellContent.content !== undefined) {
                td.innerHTML = cellContent.content;
                if (cellContent.label) td.setAttribute('data-label', cellContent.label);
                if (cellContent.className) td.className = cellContent.className;
            } else {
                td.innerHTML = cellContent;
                // labels array'den label al
                if (labels[index]) {
                    td.setAttribute('data-label', labels[index]);
                }
            }
            
            tr.appendChild(td);
        });

        return tr;
    }

    /**
     * Telefon numarasını formatla (5XX XXX XX XX)
     * @param {string} telefon - Telefon numarası
     * @returns {string} Formatlanmış telefon
     */
    function telefonFormat(telefon) {
        if (!telefon) return '-';
        const cleaned = telefon.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return cleaned.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1 $2 $3 $4');
        }
        return telefon;
    }

    /**
     * HTML içeriğini güvenli hale getir (XSS koruması)
     * @param {string} text - Escape edilecek metin
     * @returns {string} Güvenli HTML string
     */
    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        const div = document.createElement('div');
        div.textContent = String(text);
        return div.innerHTML;
    }

    /**
     * Event listener yönetimi için Map (memory leak önleme)
     */
    const eventListeners = new Map();

    /**
     * Güvenli event listener ekle (duplicate önleme ve cleanup desteği)
     * @param {HTMLElement} element - Element
     * @param {string} event - Event tipi
     * @param {Function} handler - Handler fonksiyonu
     * @param {Object} options - Event options
     * @returns {string} Listener key (cleanup için)
     */
    function safeAddEventListener(element, event, handler, options = {}) {
        if (!element) return null;
        
        // Unique key oluştur
        const elementId = element.id || 
                         element.className || 
                         element.tagName + Math.random().toString(36).substr(2, 9);
        const key = `${elementId}_${event}_${handler.name || 'anonymous'}`;
        
        // Önceki listener'ı kaldır (duplicate önleme)
        if (eventListeners.has(key)) {
            const oldHandler = eventListeners.get(key);
            element.removeEventListener(event, oldHandler, options);
        }
        
        element.addEventListener(event, handler, options);
        eventListeners.set(key, { element, event, handler, options });
        
        return key;
    }

    /**
     * Event listener'ı güvenli şekilde kaldır
     * @param {string} key - Listener key
     */
    function safeRemoveEventListener(key) {
        if (!eventListeners.has(key)) return;
        
        const { element, event, handler, options } = eventListeners.get(key);
        if (element && handler) {
            element.removeEventListener(event, handler, options);
        }
        eventListeners.delete(key);
    }

    /**
     * Element'e bağlı tüm listener'ları temizle
     * @param {HTMLElement} element - Element
     */
    function removeAllListeners(element) {
        if (!element) return;
        
        const keysToRemove = [];
        eventListeners.forEach((value, key) => {
            if (value.element === element) {
                keysToRemove.push(key);
            }
        });
        
        keysToRemove.forEach(key => safeRemoveEventListener(key));
    }

    /**
     * Tüm event listener'ları temizle (sayfa kapatılırken)
     */
    function cleanupAllListeners() {
        eventListeners.forEach((value, key) => {
            safeRemoveEventListener(key);
        });
    }

    // Public API
    return {
        AYLAR,
        YAS_GRUPLARI,
        paraFormat,
        paraFormatInput,
        paraCoz,
        tarihFormat,
        bugunISO,
        tarihISO,
        yasHesapla,
        yasGrubuBelirle,
        yasGrubuHesapla,
        benzersizId,
        debounce,
        createElement,
        $,
        $$,
        toast,
        onay,
        girdi,
        yuzdeHesapla,
        slugify,
        grupla,
        sirala,
        ayAdi,
        suAnkiDonem,
        skeletonStatCard,
        skeletonTable,
        skeletonChart,
        skeletonList,
        showSkeleton,
        hideSkeleton,
        createBadge,
        createDurumBadge,
        showEmptyState,
        hideEmptyState,
        createTableRow,
        telefonFormat,
        escapeHtml,
        safeAddEventListener,
        safeRemoveEventListener,
        removeAllListeners,
        cleanupAllListeners,
        Logger: (function() {
            /**
             * Logger utility - Production'da console.log'ları gizler
             * Development'ta tüm loglar görünür, production'da sadece error'lar
             */
            const isDevelopment = typeof window !== 'undefined' && 
                (window.location.hostname === 'localhost' || 
                 window.location.hostname === '127.0.0.1' ||
                 window.location.hostname.includes('dev'));

            return {
                log: function(...args) {
                    if (isDevelopment) {
                        console.log(...args);
                    }
                },
                warn: function(...args) {
                    if (isDevelopment) {
                        console.warn(...args);
                    }
                },
                error: function(...args) {
                    // Error'lar her zaman loglanmalı
                    console.error(...args);
                },
                info: function(...args) {
                    if (isDevelopment) {
                        console.info(...args);
                    }
                },
                debug: function(...args) {
                    if (isDevelopment) {
                        console.debug(...args);
                    }
                }
            };
        })()
    };
})();

// Global erişim için
window.Helpers = Helpers;
