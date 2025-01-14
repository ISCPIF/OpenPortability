import { ModerationCause } from './types';
export declare class ModerationUI {
    noOverride: boolean;
    filters: ModerationCause[];
    blurs: ModerationCause[];
    alerts: ModerationCause[];
    informs: ModerationCause[];
    get filter(): boolean;
    get blur(): boolean;
    get alert(): boolean;
    get inform(): boolean;
}
//# sourceMappingURL=ui.d.ts.map