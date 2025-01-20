// import CryptoJS from 'crypto-js';

// const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || '';

// if (!ENCRYPTION_KEY) {
//   throw new Error('ENCRYPTION_KEY environment variable is not set');
// }

// export function encrypt(text: string): string {
//   if (!text) return text;
//   return CryptoJS.AES.encrypt(text, ENCRYPTION_KEY).toString();
// }

// export function decrypt(encryptedText: string): string {
//   if (!encryptedText) return encryptedText;
//   const bytes = CryptoJS.AES.decrypt(encryptedText, ENCRYPTION_KEY);
//   return bytes.toString(CryptoJS.enc.Utf8);
// }