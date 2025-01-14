"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mock = void 0;
const FAKE_CID = 'bafyreiclp443lavogvhj3d2ob2cxbfuscni2k5jk7bebjzg7khl3esabwq';
exports.mock = {
    post({ text, facets, reply, embed, }) {
        return {
            $type: 'app.bsky.feed.post',
            text,
            facets,
            reply,
            embed,
            langs: ['en'],
            createdAt: new Date().toISOString(),
        };
    },
    postView({ record, author, embed, replyCount, repostCount, likeCount, viewer, labels, }) {
        return {
            $type: 'app.bsky.feed.defs#postView',
            uri: `at://${author.did}/app.bsky.feed.post/fake`,
            cid: FAKE_CID,
            author,
            record,
            embed,
            replyCount,
            repostCount,
            likeCount,
            indexedAt: new Date().toISOString(),
            viewer,
            labels,
        };
    },
    embedRecordView({ record, author, labels, }) {
        return {
            $type: 'app.bsky.embed.record#view',
            record: {
                $type: 'app.bsky.embed.record#viewRecord',
                uri: `at://${author.did}/app.bsky.feed.post/fake`,
                cid: FAKE_CID,
                author,
                value: record,
                labels,
                indexedAt: new Date().toISOString(),
            },
        };
    },
    profileViewBasic({ handle, displayName, description, viewer, labels, }) {
        return {
            did: `did:web:${handle}`,
            handle,
            displayName,
            description, // technically not in ProfileViewBasic but useful in some cases
            viewer,
            labels,
        };
    },
    actorViewerState({ muted, mutedByList, blockedBy, blocking, blockingByList, following, followedBy, }) {
        return {
            muted,
            mutedByList,
            blockedBy,
            blocking,
            blockingByList,
            following,
            followedBy,
        };
    },
    listViewBasic({ name }) {
        return {
            uri: 'at://did:plc:fake/app.bsky.graph.list/fake',
            cid: FAKE_CID,
            name,
            purpose: 'app.bsky.graph.defs#modlist',
            indexedAt: new Date().toISOString(),
        };
    },
    replyNotification({ author, record, labels, }) {
        return {
            uri: `at://${author.did}/app.bsky.feed.post/fake`,
            cid: FAKE_CID,
            author,
            reason: 'reply',
            reasonSubject: `at://${author.did}/app.bsky.feed.post/fake-parent`,
            record,
            isRead: false,
            indexedAt: new Date().toISOString(),
            labels,
        };
    },
    followNotification({ author, subjectDid, labels, }) {
        return {
            uri: `at://${author.did}/app.bsky.graph.follow/fake`,
            cid: FAKE_CID,
            author,
            reason: 'follow',
            record: {
                $type: 'app.bsky.graph.follow',
                createdAt: new Date().toISOString(),
                subject: subjectDid,
            },
            isRead: false,
            indexedAt: new Date().toISOString(),
            labels,
        };
    },
    label({ val, uri, src, }) {
        return {
            src: src || 'did:plc:fake-labeler',
            uri,
            val,
            cts: new Date().toISOString(),
        };
    },
};
//# sourceMappingURL=mocker.js.map