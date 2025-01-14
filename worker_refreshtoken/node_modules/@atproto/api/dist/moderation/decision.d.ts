import { AppBskyGraphDefs } from '../client/index';
import { Label, LabelPreference, ModerationCause, ModerationOpts, LabelTarget, ModerationBehavior } from './types';
import { ModerationUI } from './ui';
export declare class ModerationDecision {
    did: string;
    isMe: boolean;
    causes: ModerationCause[];
    constructor();
    static merge(...decisions: (ModerationDecision | undefined)[]): ModerationDecision;
    downgrade(): this;
    get blocked(): boolean;
    get muted(): boolean;
    get blockCause(): {
        type: "blocking";
        source: import("./types").ModerationCauseSource;
        priority: 3;
        downgraded?: boolean;
    } | {
        type: "blocked-by";
        source: import("./types").ModerationCauseSource;
        priority: 4;
        downgraded?: boolean;
    } | {
        type: "block-other";
        source: import("./types").ModerationCauseSource;
        priority: 4;
        downgraded?: boolean;
    } | undefined;
    get muteCause(): {
        type: "muted";
        source: import("./types").ModerationCauseSource;
        priority: 6;
        downgraded?: boolean;
    } | undefined;
    get labelCauses(): {
        type: "label";
        source: import("./types").ModerationCauseSource;
        label: Label;
        labelDef: import("./types").InterpretedLabelValueDefinition;
        target: LabelTarget;
        setting: LabelPreference;
        behavior: ModerationBehavior;
        noOverride: boolean;
        priority: 1 | 2 | 5 | 7 | 8;
        downgraded?: boolean;
    }[];
    ui(context: keyof ModerationBehavior): ModerationUI;
    setDid(did: string): void;
    setIsMe(isMe: boolean): void;
    addHidden(hidden: boolean): void;
    addMutedWord(mutedWord: boolean): void;
    addBlocking(blocking: string | undefined): void;
    addBlockingByList(blockingByList: AppBskyGraphDefs.ListViewBasic | undefined): void;
    addBlockedBy(blockedBy: boolean | undefined): void;
    addBlockOther(blockOther: boolean | undefined): void;
    addLabel(target: LabelTarget, label: Label, opts: ModerationOpts): void;
    addMuted(muted: boolean | undefined): void;
    addMutedByList(mutedByList: AppBskyGraphDefs.ListViewBasic | undefined): void;
}
//# sourceMappingURL=decision.d.ts.map