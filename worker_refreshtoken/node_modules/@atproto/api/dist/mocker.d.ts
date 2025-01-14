import { ComAtprotoLabelDefs, AppBskyFeedDefs, AppBskyActorDefs, AppBskyFeedPost, AppBskyEmbedRecord, AppBskyGraphDefs, AppBskyNotificationListNotifications } from './client';
export declare const mock: {
    post({ text, facets, reply, embed, }: {
        text: string;
        facets?: AppBskyFeedPost.Record["facets"];
        reply?: AppBskyFeedPost.ReplyRef;
        embed?: AppBskyFeedPost.Record["embed"];
    }): AppBskyFeedPost.Record;
    postView({ record, author, embed, replyCount, repostCount, likeCount, viewer, labels, }: {
        record: AppBskyFeedPost.Record;
        author: AppBskyActorDefs.ProfileViewBasic;
        embed?: AppBskyFeedDefs.PostView["embed"];
        replyCount?: number;
        repostCount?: number;
        likeCount?: number;
        viewer?: AppBskyFeedDefs.ViewerState;
        labels?: ComAtprotoLabelDefs.Label[];
    }): AppBskyFeedDefs.PostView;
    embedRecordView({ record, author, labels, }: {
        record: AppBskyFeedPost.Record;
        author: AppBskyActorDefs.ProfileViewBasic;
        labels?: ComAtprotoLabelDefs.Label[];
    }): AppBskyEmbedRecord.View;
    profileViewBasic({ handle, displayName, description, viewer, labels, }: {
        handle: string;
        displayName?: string;
        description?: string;
        viewer?: AppBskyActorDefs.ViewerState;
        labels?: ComAtprotoLabelDefs.Label[];
    }): AppBskyActorDefs.ProfileViewBasic;
    actorViewerState({ muted, mutedByList, blockedBy, blocking, blockingByList, following, followedBy, }: {
        muted?: boolean;
        mutedByList?: AppBskyGraphDefs.ListViewBasic;
        blockedBy?: boolean;
        blocking?: string;
        blockingByList?: AppBskyGraphDefs.ListViewBasic;
        following?: string;
        followedBy?: string;
    }): AppBskyActorDefs.ViewerState;
    listViewBasic({ name }: {
        name: string;
    }): AppBskyGraphDefs.ListViewBasic;
    replyNotification({ author, record, labels, }: {
        record: AppBskyFeedPost.Record;
        author: AppBskyActorDefs.ProfileViewBasic;
        labels?: ComAtprotoLabelDefs.Label[];
    }): AppBskyNotificationListNotifications.Notification;
    followNotification({ author, subjectDid, labels, }: {
        author: AppBskyActorDefs.ProfileViewBasic;
        subjectDid: string;
        labels?: ComAtprotoLabelDefs.Label[];
    }): AppBskyNotificationListNotifications.Notification;
    label({ val, uri, src, }: {
        val: string;
        uri: string;
        src?: string;
    }): ComAtprotoLabelDefs.Label;
};
//# sourceMappingURL=mocker.d.ts.map