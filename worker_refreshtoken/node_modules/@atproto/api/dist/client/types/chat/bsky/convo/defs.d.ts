/**
 * GENERATED CODE - DO NOT MODIFY
 */
import { ValidationResult } from '@atproto/lexicon';
import * as AppBskyRichtextFacet from '../../../app/bsky/richtext/facet';
import * as AppBskyEmbedRecord from '../../../app/bsky/embed/record';
import * as ChatBskyActorDefs from '../actor/defs';
export interface MessageRef {
    did: string;
    convoId: string;
    messageId: string;
    [k: string]: unknown;
}
export declare function isMessageRef(v: unknown): v is MessageRef;
export declare function validateMessageRef(v: unknown): ValidationResult;
export interface MessageInput {
    text: string;
    /** Annotations of text (mentions, URLs, hashtags, etc) */
    facets?: AppBskyRichtextFacet.Main[];
    embed?: AppBskyEmbedRecord.Main | {
        $type: string;
        [k: string]: unknown;
    };
    [k: string]: unknown;
}
export declare function isMessageInput(v: unknown): v is MessageInput;
export declare function validateMessageInput(v: unknown): ValidationResult;
export interface MessageView {
    id: string;
    rev: string;
    text: string;
    /** Annotations of text (mentions, URLs, hashtags, etc) */
    facets?: AppBskyRichtextFacet.Main[];
    embed?: AppBskyEmbedRecord.View | {
        $type: string;
        [k: string]: unknown;
    };
    sender: MessageViewSender;
    sentAt: string;
    [k: string]: unknown;
}
export declare function isMessageView(v: unknown): v is MessageView;
export declare function validateMessageView(v: unknown): ValidationResult;
export interface DeletedMessageView {
    id: string;
    rev: string;
    sender: MessageViewSender;
    sentAt: string;
    [k: string]: unknown;
}
export declare function isDeletedMessageView(v: unknown): v is DeletedMessageView;
export declare function validateDeletedMessageView(v: unknown): ValidationResult;
export interface MessageViewSender {
    did: string;
    [k: string]: unknown;
}
export declare function isMessageViewSender(v: unknown): v is MessageViewSender;
export declare function validateMessageViewSender(v: unknown): ValidationResult;
export interface ConvoView {
    id: string;
    rev: string;
    members: ChatBskyActorDefs.ProfileViewBasic[];
    lastMessage?: MessageView | DeletedMessageView | {
        $type: string;
        [k: string]: unknown;
    };
    muted: boolean;
    opened?: boolean;
    unreadCount: number;
    [k: string]: unknown;
}
export declare function isConvoView(v: unknown): v is ConvoView;
export declare function validateConvoView(v: unknown): ValidationResult;
export interface LogBeginConvo {
    rev: string;
    convoId: string;
    [k: string]: unknown;
}
export declare function isLogBeginConvo(v: unknown): v is LogBeginConvo;
export declare function validateLogBeginConvo(v: unknown): ValidationResult;
export interface LogLeaveConvo {
    rev: string;
    convoId: string;
    [k: string]: unknown;
}
export declare function isLogLeaveConvo(v: unknown): v is LogLeaveConvo;
export declare function validateLogLeaveConvo(v: unknown): ValidationResult;
export interface LogCreateMessage {
    rev: string;
    convoId: string;
    message: MessageView | DeletedMessageView | {
        $type: string;
        [k: string]: unknown;
    };
    [k: string]: unknown;
}
export declare function isLogCreateMessage(v: unknown): v is LogCreateMessage;
export declare function validateLogCreateMessage(v: unknown): ValidationResult;
export interface LogDeleteMessage {
    rev: string;
    convoId: string;
    message: MessageView | DeletedMessageView | {
        $type: string;
        [k: string]: unknown;
    };
    [k: string]: unknown;
}
export declare function isLogDeleteMessage(v: unknown): v is LogDeleteMessage;
export declare function validateLogDeleteMessage(v: unknown): ValidationResult;
//# sourceMappingURL=defs.d.ts.map