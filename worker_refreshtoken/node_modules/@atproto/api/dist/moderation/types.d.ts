import { AppBskyActorDefs, AppBskyFeedDefs, AppBskyNotificationListNotifications, AppBskyGraphDefs, ComAtprotoLabelDefs } from '../client/index';
import { KnownLabelValue } from './const/labels';
export declare const CUSTOM_LABEL_VALUE_RE: RegExp;
export interface ModerationBehavior {
    profileList?: 'blur' | 'alert' | 'inform';
    profileView?: 'blur' | 'alert' | 'inform';
    avatar?: 'blur' | 'alert';
    banner?: 'blur';
    displayName?: 'blur';
    contentList?: 'blur' | 'alert' | 'inform';
    contentView?: 'blur' | 'alert' | 'inform';
    contentMedia?: 'blur';
}
export declare const BLOCK_BEHAVIOR: ModerationBehavior;
export declare const MUTE_BEHAVIOR: ModerationBehavior;
export declare const MUTEWORD_BEHAVIOR: ModerationBehavior;
export declare const HIDE_BEHAVIOR: ModerationBehavior;
export declare const NOOP_BEHAVIOR: ModerationBehavior;
export type Label = ComAtprotoLabelDefs.Label;
export type LabelTarget = 'account' | 'profile' | 'content';
export type LabelPreference = 'ignore' | 'warn' | 'hide';
export type LabelValueDefinitionFlag = 'no-override' | 'adult' | 'unauthed' | 'no-self';
export interface InterpretedLabelValueDefinition extends ComAtprotoLabelDefs.LabelValueDefinition {
    definedBy?: string | undefined;
    configurable: boolean;
    defaultSetting: LabelPreference;
    flags: LabelValueDefinitionFlag[];
    behaviors: {
        account?: ModerationBehavior;
        profile?: ModerationBehavior;
        content?: ModerationBehavior;
    };
}
export type LabelDefinitionMap = Record<KnownLabelValue, InterpretedLabelValueDefinition>;
export type ModerationSubjectProfile = AppBskyActorDefs.ProfileViewBasic | AppBskyActorDefs.ProfileView | AppBskyActorDefs.ProfileViewDetailed;
export type ModerationSubjectPost = AppBskyFeedDefs.PostView;
export type ModerationSubjectNotification = AppBskyNotificationListNotifications.Notification;
export type ModerationSubjectFeedGenerator = AppBskyFeedDefs.GeneratorView;
export type ModerationSubjectUserList = AppBskyGraphDefs.ListViewBasic | AppBskyGraphDefs.ListView;
export type ModerationSubject = ModerationSubjectProfile | ModerationSubjectPost | ModerationSubjectNotification | ModerationSubjectFeedGenerator | ModerationSubjectUserList;
export type ModerationCauseSource = {
    type: 'user';
} | {
    type: 'list';
    list: AppBskyGraphDefs.ListViewBasic;
} | {
    type: 'labeler';
    did: string;
};
export type ModerationCause = {
    type: 'blocking';
    source: ModerationCauseSource;
    priority: 3;
    downgraded?: boolean;
} | {
    type: 'blocked-by';
    source: ModerationCauseSource;
    priority: 4;
    downgraded?: boolean;
} | {
    type: 'block-other';
    source: ModerationCauseSource;
    priority: 4;
    downgraded?: boolean;
} | {
    type: 'label';
    source: ModerationCauseSource;
    label: Label;
    labelDef: InterpretedLabelValueDefinition;
    target: LabelTarget;
    setting: LabelPreference;
    behavior: ModerationBehavior;
    noOverride: boolean;
    priority: 1 | 2 | 5 | 7 | 8;
    downgraded?: boolean;
} | {
    type: 'muted';
    source: ModerationCauseSource;
    priority: 6;
    downgraded?: boolean;
} | {
    type: 'mute-word';
    source: ModerationCauseSource;
    priority: 6;
    downgraded?: boolean;
} | {
    type: 'hidden';
    source: ModerationCauseSource;
    priority: 6;
    downgraded?: boolean;
};
export interface ModerationPrefsLabeler {
    did: string;
    labels: Record<string, LabelPreference>;
}
export interface ModerationPrefs {
    adultContentEnabled: boolean;
    labels: Record<string, LabelPreference>;
    labelers: ModerationPrefsLabeler[];
    mutedWords: AppBskyActorDefs.MutedWord[];
    hiddenPosts: string[];
}
export interface ModerationOpts {
    userDid: string | undefined;
    prefs: ModerationPrefs;
    /**
     * Map of labeler did -> custom definitions
     */
    labelDefs?: Record<string, InterpretedLabelValueDefinition[]>;
}
//# sourceMappingURL=types.d.ts.map