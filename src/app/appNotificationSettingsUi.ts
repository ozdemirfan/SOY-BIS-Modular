import * as Helpers from '../utils/helpers';
import * as Notification from '../modules/notification';

/**
 * Hatırlatma ayarlarını göster - Profesyonel Panel
 */
export function hatirlatmaAyarlariGoster(): void {
  const container = Helpers.$('#notificationSettings');
  if (!container) {
    console.warn('Hatırlatma ayarları container bulunamadı');
    return;
  }

  if (typeof window === 'undefined' || !window.Notification) {
    container.innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Bildirim modülü yüklenemedi</p></div>';
    return;
  }

  let ayarlar: {
    enabled?: boolean;
    methods?: { sms?: boolean; email?: boolean; whatsapp?: boolean; inApp?: boolean };
    timing?: { daysBefore?: number; onDueDate?: boolean; daysAfter?: number };
  };
  try {
    if (typeof Notification.ayarlariGetir === 'function') {
      ayarlar = Notification.ayarlariGetir();
    } else {
      container.innerHTML =
        '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Ayarlar fonksiyonu bulunamadı</p></div>';
      return;
    }
  } catch (error) {
    console.error('Ayarlar alınamadı:', error);
    container.innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Ayarlar yüklenemedi</p></div>';
    return;
  }

  if (!ayarlar) {
    container.innerHTML =
      '<div class="empty-state"><i class="fa-solid fa-exclamation-triangle"></i><p>Ayarlar bulunamadı</p></div>';
    return;
  }

  const methods = ayarlar.methods || {};
  const timing = ayarlar.timing || {};

  container.innerHTML = `
    <!-- Ana Toggle - Kompakt -->
    <div class="notification-compact-toggle">
      <div class="notification-compact-toggle-content">
        <span class="notification-compact-label">Hatırlatma Sistemi</span>
        <span class="notification-compact-desc">Otomatik hatırlatmaları aktifleştir</span>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" id="notificationEnabled" ${ayarlar.enabled ? 'checked' : ''} 
               onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({enabled: this.checked});">
        <span class="toggle-slider"></span>
      </label>
    </div>
    
    <!-- Bildirim Yöntemleri -->
    <div class="notification-compact-section">
      <h5 class="notification-compact-section-title">
        <i class="fa-solid fa-paper-plane"></i>
        Bildirim Kanalları
      </h5>
      <div class="notification-methods-grid-compact">
        <div class="notification-method-compact ${methods.sms ? 'active' : ''}">
          <div class="notification-method-icon-compact sms">
            <i class="fa-solid fa-sms"></i>
          </div>
          <span class="notification-method-name-compact">SMS</span>
          <label class="toggle-switch-small">
            <input type="checkbox" ${methods.sms ? 'checked' : ''} 
                   onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({methods: {sms: this.checked}});">
            <span class="toggle-slider-small"></span>
          </label>
        </div>
        
        <div class="notification-method-compact ${methods.email ? 'active' : ''}">
          <div class="notification-method-icon-compact email">
            <i class="fa-solid fa-envelope"></i>
          </div>
          <span class="notification-method-name-compact">E-posta</span>
          <label class="toggle-switch-small">
            <input type="checkbox" ${methods.email ? 'checked' : ''} 
                   onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({methods: {email: this.checked}});">
            <span class="toggle-slider-small"></span>
          </label>
        </div>
        
        <div class="notification-method-compact ${methods.whatsapp ? 'active' : ''}">
          <div class="notification-method-icon-compact whatsapp">
            <i class="fa-brands fa-whatsapp"></i>
          </div>
          <span class="notification-method-name-compact">WhatsApp</span>
          <label class="toggle-switch-small">
            <input type="checkbox" ${methods.whatsapp ? 'checked' : ''} 
                   onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({methods: {whatsapp: this.checked}});">
            <span class="toggle-slider-small"></span>
          </label>
        </div>
        
        <div class="notification-method-compact ${methods.inApp ? 'active' : ''}">
          <div class="notification-method-icon-compact inapp">
            <i class="fa-solid fa-bell"></i>
          </div>
          <span class="notification-method-name-compact">Uygulama İçi</span>
          <label class="toggle-switch-small">
            <input type="checkbox" ${methods.inApp ? 'checked' : ''} 
                   onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({methods: {inApp: this.checked}});">
            <span class="toggle-slider-small"></span>
          </label>
        </div>
      </div>
    </div>
    
    <!-- Zamanlama Ayarları - Kompakt -->
    <div class="notification-compact-section">
      <h5 class="notification-compact-section-title">
        <i class="fa-solid fa-clock"></i>
        Zamanlama
      </h5>
      <div class="notification-timing-grid-compact">
        <div class="notification-timing-compact">
          <div class="notification-timing-icon-compact">
            <i class="fa-solid fa-calendar-minus"></i>
          </div>
          <div class="notification-timing-content-compact">
            <label class="notification-timing-label-compact">Önceden Hatırlat</label>
            <div class="notification-timing-input-compact">
              <input type="number" id="notifDaysBefore" min="0" max="30" value="${timing.daysBefore || 0}" 
                     class="notification-number-input-compact"
                     onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({timing: {daysBefore: parseInt(this.value) || 0}});">
              <span class="notification-timing-unit-compact">gün</span>
            </div>
          </div>
        </div>
        
        <div class="notification-timing-compact">
          <div class="notification-timing-icon-compact today">
            <i class="fa-solid fa-calendar-day"></i>
          </div>
          <div class="notification-timing-content-compact">
            <label class="notification-timing-label-compact">Ödeme Günü</label>
            <label class="toggle-switch-small">
              <input type="checkbox" id="notifOnDueDate" ${timing.onDueDate ? 'checked' : ''}
                     onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({timing: {onDueDate: this.checked}});">
              <span class="toggle-slider-small"></span>
            </label>
          </div>
        </div>
        
        <div class="notification-timing-compact">
          <div class="notification-timing-icon-compact warning">
            <i class="fa-solid fa-calendar-xmark"></i>
          </div>
          <div class="notification-timing-content-compact">
            <label class="notification-timing-label-compact">Gecikme Hatırlatması</label>
            <div class="notification-timing-input-compact">
              <input type="number" id="notifDaysAfter" min="0" max="30" value="${timing.daysAfter || 0}" 
                     class="notification-number-input-compact"
                     onchange="if(window.Notification && window.Notification.ayarlariGuncelle) window.Notification.ayarlariGuncelle({timing: {daysAfter: parseInt(this.value) || 0}});">
              <span class="notification-timing-unit-compact">gün</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}
