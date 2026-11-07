import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import so from './so.json';

const STORAGE_KEY = 'pharmacy.lang';
const fallbackLng = 'en';
const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    so: { translation: so },
  },
  lng: stored || fallbackLng,
  fallbackLng,
  interpolation: { escapeValue: false },
});

export function setLanguage(lang) {
  if (lang !== 'en' && lang !== 'so') return;
  i18n.changeLanguage(lang);
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* localStorage can be blocked; language still changes for the session */
  }
}

export default i18n;
