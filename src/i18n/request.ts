import {getRequestConfig} from 'next-intl/server';
import { headers } from 'next/headers';

// Fonction utilitaire pour fusionner récursivement les objets de traduction
function deepMerge(target: any, source: any) {
  const output = { ...target };
  
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach(key => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  
  return output;
}

// Vérifier si une valeur est un objet
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

export default getRequestConfig(async () => {
  const headersList = await headers();
  const locale = headersList.get('X-NEXT-INTL-LOCALE') || 'fr';
  
  // Charger d'abord les traductions en anglais comme fallback
  const defaultMessages = (await import(`../../messages/en.json`)).default;
  
  // Si la locale est déjà en anglais, pas besoin de fusionner
  if (locale === 'en') {
    return {
      messages: defaultMessages,
      locale: 'en'
    };
  }
  
  try {
    // Charger les traductions de la langue demandée
    const localeMessages = (await import(`../../messages/${locale}.json`)).default;
    
    // Fusionner les traductions, en donnant priorité à la langue demandée
    const mergedMessages = deepMerge(defaultMessages, localeMessages);
    
    return {
      messages: mergedMessages,
      locale: locale
    };
  } catch (error) {
    console.error(`Failed to load translations for locale ${locale}:`, error);
    
    // En cas d'erreur, utiliser les traductions anglaises par défaut
    return {
      messages: defaultMessages,
      locale: locale // Conserver la locale demandée pour l'interface
    };
  }
});