import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility function to merge class names.
 * 
 * @param inputs - Variable number of class names to merge.
 * @returns The merged class name.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}