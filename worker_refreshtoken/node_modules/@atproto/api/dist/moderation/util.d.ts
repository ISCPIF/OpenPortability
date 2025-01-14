import { AppBskyEmbedRecord, AppBskyEmbedRecordWithMedia, AppBskyLabelerDefs, ComAtprotoLabelDefs } from '../client';
import { InterpretedLabelValueDefinition } from './types';
export declare function isQuotedPost(embed: unknown): embed is AppBskyEmbedRecord.View;
export declare function isQuotedPostWithMedia(embed: unknown): embed is AppBskyEmbedRecordWithMedia.View;
export declare function interpretLabelValueDefinition(def: ComAtprotoLabelDefs.LabelValueDefinition, definedBy: string | undefined): InterpretedLabelValueDefinition;
export declare function interpretLabelValueDefinitions(labelerView: AppBskyLabelerDefs.LabelerViewDetailed): InterpretedLabelValueDefinition[];
//# sourceMappingURL=util.d.ts.map