class TranslationManager {
  constructor() {
    this.translations = {};
    this.currentLanguage = 'en';
    this.fallbackLanguage = 'en';
    this.supportedLanguages = ['en', 'ta'];
    this.initialized = false;
    
    this.init();
  }
  
  async init() {
    try {
      await this.loadTranslations();
      this.initializeLanguage();
      this.setupLanguageSelector();
      this.translatePage();
      this.initialized = true;
      console.log('[Translation] System initialized successfully');
      
      // Emit custom event for other components
      window.dispatchEvent(new CustomEvent('translationSystemReady', {
        detail: { language: this.currentLanguage }
      }));
    } catch (error) {
      console.error('[Translation] Initialization error:', error);
    }
  }
  
  async loadTranslations() {
    try {
      // Load English translations
      const enModule = await import('./translations/en.js');
      this.translations.en = enModule.en;
      
      // Load Tamil translations
      const taModule = await import('./translations/ta.js');
      this.translations.ta = taModule.ta;
      
      console.log('[Translation] All translations loaded successfully');
    } catch (error) {
      console.error('[Translation] Error loading translations:', error);
      throw error;
    }
  }
  
  initializeLanguage() {
    // Get saved language from localStorage
    const savedLanguage = localStorage.getItem('driverLogLanguage');
    
    if (savedLanguage && this.supportedLanguages.includes(savedLanguage)) {
      this.currentLanguage = savedLanguage;
    } else {
      // Try to detect browser language
      const browserLang = navigator.language.split('-')[0];
      if (this.supportedLanguages.includes(browserLang)) {
        this.currentLanguage = browserLang;
      }
      // Save detected/default language
      localStorage.setItem('driverLogLanguage', this.currentLanguage);
    }
    
    console.log(`[Translation] Language initialized: ${this.currentLanguage}`);
  }
  
  setupLanguageSelector() {
    // Find existing language selector
    const existingSelector = document.getElementById('languageSelector');
    
    if (existingSelector) {
      // Use existing selector and add event listener
      this.updateLanguageSelector();
      this.attachLanguageChangeListener();
    } else {
      // Create new language selector if none exists
      this.createLanguageSelector();
    }
  }
  
  createLanguageSelector() {
    // Find a suitable location for the language selector
    let container = document.querySelector('.language-container');
    
    if (!container) {
      // Create container in header or navigation area
      const header = document.querySelector('header, .header, .navbar, .nav');
      if (header) {
        container = document.createElement('div');
        container.className = 'language-container';
        container.style.cssText = 'display: inline-flex; align-items: center; margin-left: auto; gap: 8px;';
        header.appendChild(container);
      }
    }
    
    if (container) {
      container.innerHTML = `
        <label for="languageSelector" data-translate="selectLanguage" style="font-size: 14px; color: #666;">Select Language</label>
        <select id="languageSelector" style="padding: 4px 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
          <option value="en" data-translate="english">English</option>
          <option value="ta" data-translate="tamil">தமிழ்</option>
        </select>
      `;
      
      // Add event listener
      const selector = document.getElementById('languageSelector');
      selector.addEventListener('change', (e) => {
        this.changeLanguage(e.target.value);
      });
    }
  }
  
  updateLanguageSelector() {
    const selector = document.getElementById('languageSelector');
    if (selector) {
      selector.value = this.currentLanguage;
      console.log(`[Translation] Language selector updated to: ${this.currentLanguage}`);
    }
  }
  
  attachLanguageChangeListener() {
    const selector = document.getElementById('languageSelector');
    if (selector) {
      // Remove any existing event listeners
      selector.removeEventListener('change', this.handleLanguageChange);
      
      // Add new event listener
      this.handleLanguageChange = (e) => {
        console.log(`[Translation] Language selector changed to: ${e.target.value}`);
        this.changeLanguage(e.target.value);
      };
      
      selector.addEventListener('change', this.handleLanguageChange);
      console.log('[Translation] Language change listener attached');
    }
  }
  
  changeLanguage(languageCode) {
    if (!this.supportedLanguages.includes(languageCode)) {
      console.warn(`[Translation] Unsupported language: ${languageCode}`);
      return;
    }
    
    console.log(`[Translation] Changing language from ${this.currentLanguage} to ${languageCode}`);
    
    this.currentLanguage = languageCode;
    localStorage.setItem('driverLogLanguage', languageCode);
    
    // Update language selector
    this.updateLanguageSelector();
    
    // Apply translations immediately
    this.translatePage();
    
    // Show success notification
    this.showLanguageChangeNotification();
    
    // Emit language change event
    window.dispatchEvent(new CustomEvent('languageChanged', {
      detail: { language: languageCode }
    }));
    
    console.log(`[Translation] Language successfully changed to: ${languageCode}`);
  }
  
  translatePage() {
    console.log(`[Translation] Translating page to: ${this.currentLanguage}`);
    
    // Find all elements with data-translate attribute
    const elements = document.querySelectorAll('[data-translate]');
    console.log(`[Translation] Found ${elements.length} elements to translate`);
    
    let translatedCount = 0;
    
    elements.forEach(element => {
      const key = element.getAttribute('data-translate');
      const translation = this.getTranslation(key);
      
      if (translation && translation !== key) {
        // Handle different element types
        if (element.tagName === 'INPUT' && (element.type === 'submit' || element.type === 'button')) {
          element.value = translation;
        } else if (element.hasAttribute('data-translate-placeholder') || element.placeholder !== undefined) {
          element.placeholder = translation;
        } else if (element.tagName === 'OPTION') {
          element.textContent = translation;
        } else if (element.tagName !== 'SELECT') {
          element.textContent = translation;
        }
        translatedCount++;
      }
    });
    
    console.log(`[Translation] Successfully translated ${translatedCount} elements`);
    
    // Update document title if it has a translation key
    const titleElement = document.querySelector('title[data-translate]');
    if (titleElement) {
      const key = titleElement.getAttribute('data-translate');
      const translation = this.getTranslation(key);
      if (translation && translation !== key) {
        document.title = translation;
      }
    }
    
    // Apply Tamil font styles if Tamil is selected
    this.applyLanguageStyles();
  }
  
  applyLanguageStyles() {
    let styleElement = document.getElementById('languageStyles');
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = 'languageStyles';
      document.head.appendChild(styleElement);
    }
    
    if (this.currentLanguage === 'ta') {
      // Apply Tamil font styles
      styleElement.textContent = `
        body, [data-translate] {
          font-family: 'Noto Sans Tamil', 'Latha', 'Arial Unicode MS', sans-serif;
          font-size: 14px;
          line-height: 1.6;
        }
        
        h1, h2, h3, h4, h5, h6 {
          font-family: 'Noto Sans Tamil', 'Latha', 'Arial Unicode MS', sans-serif;
          font-weight: 600;
        }
        
        button, input, select, textarea {
          font-family: 'Noto Sans Tamil', 'Latha', 'Arial Unicode MS', sans-serif;
        }
        
        .tamil-text {
          font-size: 15px;
          letter-spacing: 0.5px;
        }
        
        /* Improve Tamil text rendering */
        [data-translate] {
          text-rendering: optimizeLegibility;
          -webkit-font-feature-settings: "liga", "kern";
          font-feature-settings: "liga", "kern";
        }
      `;
    } else {
      // Reset to default English styles
      styleElement.textContent = `
        body, [data-translate] {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 14px;
          line-height: 1.5;
        }
      `;
    }
  }
  
  getTranslation(key) {
    // Get translation from current language
    let translation = this.translations[this.currentLanguage]?.[key];
    
    // Fallback to English if not found
    if (!translation && this.currentLanguage !== this.fallbackLanguage) {
      translation = this.translations[this.fallbackLanguage]?.[key];
    }
    
    // Return key as fallback if no translation found
    return translation || key;
  }
  
  translate(key, params = {}) {
    let translation = this.getTranslation(key);
    
    // Replace parameters in translation
    Object.keys(params).forEach(param => {
      translation = translation.replace(`{${param}}`, params[param]);
    });
    
    return translation;
  }
  
  showLanguageChangeNotification() {
    // Create a simple notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      font-size: 14px;
      font-family: inherit;
      opacity: 0;
      transform: translateY(-20px);
      transition: all 0.3s ease;
    `;
    
    notification.textContent = this.translate('languageChanged');
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.opacity = '1';
      notification.style.transform = 'translateY(0)';
    }, 100);
    
    // Remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(-20px)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
  
  // Method to add translation dynamically
  addTranslation(language, key, value) {
    if (!this.translations[language]) {
      this.translations[language] = {};
    }
    this.translations[language][key] = value;
  }
  
  // Method to get current language
  getCurrentLanguage() {
    return this.currentLanguage;
  }
  
  // Method to get supported languages
  getSupportedLanguages() {
    return this.supportedLanguages;
  }
  
  // Method to check if system is ready
  isReady() {
    return this.initialized;
  }
}

// Initialize the translation manager
window.translationManager = new TranslationManager();

// Make translation function available globally
window.t = (key, params) => {
  return window.translationManager ? window.translationManager.translate(key, params) : key;
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TranslationManager;
}