import { Lexicons } from '../lexicons';
import { LexArray, LexRefVariant, LexUserType, ValidationResult } from '../types';
export declare function validate(lexicons: Lexicons, path: string, def: LexUserType, value: unknown): ValidationResult;
export declare function array(lexicons: Lexicons, path: string, def: LexArray, value: unknown): ValidationResult;
export declare function object(lexicons: Lexicons, path: string, def: LexUserType, value: unknown): ValidationResult;
export declare function validateOneOf(lexicons: Lexicons, path: string, def: LexRefVariant | LexUserType, value: unknown, mustBeObj?: boolean): ValidationResult;
//# sourceMappingURL=complex.d.ts.map