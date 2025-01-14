import { ValidationResult } from '@atproto/lexicon';
import * as ComAtprotoLabelDefs from './defs';
export interface Labels {
    seq: number;
    labels: ComAtprotoLabelDefs.Label[];
    [k: string]: unknown;
}
export declare function isLabels(v: unknown): v is Labels;
export declare function validateLabels(v: unknown): ValidationResult;
export interface Info {
    name: 'OutdatedCursor' | (string & {});
    message?: string;
    [k: string]: unknown;
}
export declare function isInfo(v: unknown): v is Info;
export declare function validateInfo(v: unknown): ValidationResult;
//# sourceMappingURL=subscribeLabels.d.ts.map