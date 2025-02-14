import {createSharedPathnamesNavigation} from 'next-intl/navigation';
 
export const locales = ['en', 'fr', 'es', 'it'] as const;
export const localePrefix = 'always'; // Default
 
export const {Link, redirect, usePathname, useRouter} =
  createSharedPathnamesNavigation({locales, localePrefix});