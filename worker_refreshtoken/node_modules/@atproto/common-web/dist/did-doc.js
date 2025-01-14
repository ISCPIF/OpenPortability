"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.didDocument = exports.getServiceEndpoint = exports.getNotifEndpoint = exports.getFeedGenEndpoint = exports.getPdsEndpoint = exports.getSigningDidKey = exports.getVerificationMaterial = exports.getSigningKey = exports.getHandle = exports.getDid = exports.isValidDidDoc = void 0;
const zod_1 = require("zod");
// Parsing atproto data
// --------
const isValidDidDoc = (doc) => {
    return exports.didDocument.safeParse(doc).success;
};
exports.isValidDidDoc = isValidDidDoc;
const getDid = (doc) => {
    const id = doc.id;
    if (typeof id !== 'string') {
        throw new Error('No `id` on document');
    }
    return id;
};
exports.getDid = getDid;
const getHandle = (doc) => {
    const aka = doc.alsoKnownAs;
    if (aka) {
        for (let i = 0; i < aka.length; i++) {
            const alias = aka[i];
            if (alias.startsWith('at://')) {
                // strip off "at://" prefix
                return alias.slice(5);
            }
        }
    }
    return undefined;
};
exports.getHandle = getHandle;
// @NOTE we parse to type/publicKeyMultibase to avoid the dependency on @atproto/crypto
const getSigningKey = (doc) => {
    return (0, exports.getVerificationMaterial)(doc, 'atproto');
};
exports.getSigningKey = getSigningKey;
const getVerificationMaterial = (doc, keyId) => {
    // /!\ Hot path
    const key = findItemById(doc, 'verificationMethod', `#${keyId}`);
    if (!key) {
        return undefined;
    }
    if (!key.publicKeyMultibase) {
        return undefined;
    }
    return {
        type: key.type,
        publicKeyMultibase: key.publicKeyMultibase,
    };
};
exports.getVerificationMaterial = getVerificationMaterial;
const getSigningDidKey = (doc) => {
    const parsed = (0, exports.getSigningKey)(doc);
    if (!parsed)
        return;
    return `did:key:${parsed.publicKeyMultibase}`;
};
exports.getSigningDidKey = getSigningDidKey;
const getPdsEndpoint = (doc) => {
    return (0, exports.getServiceEndpoint)(doc, {
        id: '#atproto_pds',
        type: 'AtprotoPersonalDataServer',
    });
};
exports.getPdsEndpoint = getPdsEndpoint;
const getFeedGenEndpoint = (doc) => {
    return (0, exports.getServiceEndpoint)(doc, {
        id: '#bsky_fg',
        type: 'BskyFeedGenerator',
    });
};
exports.getFeedGenEndpoint = getFeedGenEndpoint;
const getNotifEndpoint = (doc) => {
    return (0, exports.getServiceEndpoint)(doc, {
        id: '#bsky_notif',
        type: 'BskyNotificationService',
    });
};
exports.getNotifEndpoint = getNotifEndpoint;
const getServiceEndpoint = (doc, opts) => {
    // /!\ Hot path
    const service = findItemById(doc, 'service', opts.id);
    if (!service) {
        return undefined;
    }
    if (opts.type && service.type !== opts.type) {
        return undefined;
    }
    if (typeof service.serviceEndpoint !== 'string') {
        return undefined;
    }
    return validateUrl(service.serviceEndpoint);
};
exports.getServiceEndpoint = getServiceEndpoint;
function findItemById(doc, type, id) {
    // /!\ Hot path
    const items = doc[type];
    if (items) {
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const itemId = item.id;
            if (itemId[0] === '#'
                ? itemId === id
                : // Optimized version of: itemId === `${doc.id}${id}`
                    itemId.length === doc.id.length + id.length &&
                        itemId[doc.id.length] === '#' &&
                        itemId.endsWith(id) &&
                        itemId.startsWith(doc.id) // <== We could probably skip this check
            ) {
                return item;
            }
        }
    }
    return undefined;
}
// Check protocol and hostname to prevent potential SSRF
const validateUrl = (urlStr) => {
    if (!urlStr.startsWith('http://') && !urlStr.startsWith('https://')) {
        return undefined;
    }
    if (!canParseUrl(urlStr)) {
        return undefined;
    }
    return urlStr;
};
const canParseUrl = URL.canParse ??
    // URL.canParse is not available in Node.js < 18.17.0
    ((urlStr) => {
        try {
            new URL(urlStr);
            return true;
        }
        catch {
            return false;
        }
    });
// Types
// --------
const verificationMethod = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.string(),
    controller: zod_1.z.string(),
    publicKeyMultibase: zod_1.z.string().optional(),
});
const service = zod_1.z.object({
    id: zod_1.z.string(),
    type: zod_1.z.string(),
    serviceEndpoint: zod_1.z.union([zod_1.z.string(), zod_1.z.record(zod_1.z.unknown())]),
});
exports.didDocument = zod_1.z.object({
    id: zod_1.z.string(),
    alsoKnownAs: zod_1.z.array(zod_1.z.string()).optional(),
    verificationMethod: zod_1.z.array(verificationMethod).optional(),
    service: zod_1.z.array(service).optional(),
});
//# sourceMappingURL=did-doc.js.map