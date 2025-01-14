/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
export interface TemplateView {
    id: string;
    /** Name of the template. */
    name: string;
    /** Content of the template, can contain markdown and variable placeholders. */
    subject?: string;
    /** Subject of the message, used in emails. */
    contentMarkdown: string;
    disabled: boolean;
    /** Message language. */
    lang?: string;
    /** DID of the user who last updated the template. */
    lastUpdatedBy: string;
    createdAt: string;
    updatedAt: string;
    [k: string]: unknown;
}
export declare function isTemplateView(v: unknown): v is TemplateView;
export declare function validateTemplateView(v: unknown): ValidationResult;
//# sourceMappingURL=defs.d.ts.map