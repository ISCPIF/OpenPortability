export type ReasonType = 'com.atproto.moderation.defs#reasonSpam' | 'com.atproto.moderation.defs#reasonViolation' | 'com.atproto.moderation.defs#reasonMisleading' | 'com.atproto.moderation.defs#reasonSexual' | 'com.atproto.moderation.defs#reasonRude' | 'com.atproto.moderation.defs#reasonOther' | 'com.atproto.moderation.defs#reasonAppeal' | (string & {});
/** Spam: frequent unwanted promotion, replies, mentions */
export declare const REASONSPAM = "com.atproto.moderation.defs#reasonSpam";
/** Direct violation of server rules, laws, terms of service */
export declare const REASONVIOLATION = "com.atproto.moderation.defs#reasonViolation";
/** Misleading identity, affiliation, or content */
export declare const REASONMISLEADING = "com.atproto.moderation.defs#reasonMisleading";
/** Unwanted or mislabeled sexual content */
export declare const REASONSEXUAL = "com.atproto.moderation.defs#reasonSexual";
/** Rude, harassing, explicit, or otherwise unwelcoming behavior */
export declare const REASONRUDE = "com.atproto.moderation.defs#reasonRude";
/** Other: reports not falling under another report category */
export declare const REASONOTHER = "com.atproto.moderation.defs#reasonOther";
/** Appeal: appeal a previously taken moderation action */
export declare const REASONAPPEAL = "com.atproto.moderation.defs#reasonAppeal";
//# sourceMappingURL=defs.d.ts.map