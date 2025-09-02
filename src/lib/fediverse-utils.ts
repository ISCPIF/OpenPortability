// // src/lib/fediverse-utils.ts
// import logger from '@/lib/log_utils'
// import { supabase } from '@/lib/supabase'

// export type ServerType = 'mastodon' | 'pleroma' | 'pixelfed' | 'friendica' | 'sharkey' | 'unknown';

// export type FediverseAppData = {
//   domain: string;
//   client_id: string;
//   client_secret: string;
//   server_type: ServerType;
// }

// /**
//  * Parse a Fediverse handle into username and domain
//  */
// export function parseHandle(handle: string): [string, string] {
//   // Remove the @ prefix if present
//   const cleanHandle = handle.startsWith('@') ? handle.substring(1) : handle;
  
//   // Split by @
//   const parts = cleanHandle.split('@');
  
//   // If there's only one part, assume it's a domain without a username
//   if (parts.length === 1) {
//     return ['', parts[0]];
//   }
  
//   // Handle standard format username@domain
//   return [parts[0], parts[parts.length - 1]];
// }

// /**
//  * Fetch NodeInfo data from a domain
//  */
// export async function fetchNodeInfo(domain: string): Promise<any> {
//   try {
//     // First, discover the NodeInfo endpoint
//     const wellKnownUrl = `https://${domain}/.well-known/nodeinfo`;
//     const wellKnownResponse = await fetch(wellKnownUrl);
    
//     if (!wellKnownResponse.ok) {
//       throw new Error(`NodeInfo discovery failed: ${wellKnownResponse.status}`);
//     }
    
//     const wellKnownData = await wellKnownResponse.json();
    
//     // Find the latest supported version
//     const links = wellKnownData.links || [];
//     const supportedVersions = ['2.1', '2.0', '1.1', '1.0'];
    
//     let nodeInfoUrl = null;
//     for (const version of supportedVersions) {
//       const linkObj = links.find(l => l.rel === `http://nodeinfo.diaspora.software/ns/schema/${version}`);
//       if (linkObj?.href) {
//         nodeInfoUrl = linkObj.href;
//         break;
//       }
//     }
    
//     if (!nodeInfoUrl) {
//       throw new Error('No compatible NodeInfo endpoint found');
//     }
    
//     // Fetch the actual NodeInfo data
//     const nodeInfoResponse = await fetch(nodeInfoUrl);
    
//     if (!nodeInfoResponse.ok) {
//       throw new Error(`NodeInfo data fetch failed: ${nodeInfoResponse.status}`);
//     }
    
//     return await nodeInfoResponse.json();
//   } catch (error) {
//     logger.logError('Auth', 'fetchNodeInfo', 
//       `Error fetching NodeInfo for ${domain}`, 
//       undefined, 
//       { domain, error: error instanceof Error ? error.message : 'Unknown error' }
//     );
//     return null;
//   }
// }

// /**
//  * Normalize server type names from NodeInfo
//  */
// export function normalizeServerType(softwareName: string): ServerType {
//   const map: Record<string, ServerType> = {
//     'mastodon': 'mastodon',
//     'pleroma': 'pleroma',
//     'pixelfed': 'pixelfed',
//     'friendica': 'friendica',
//     'sharkey': 'sharkey',
//     'misskey': 'unknown', // We don't support Misskey yet
//     'peertube': 'unknown'  // We don't support PeerTube yet
//   };
  
//   for (const [key, value] of Object.entries(map)) {
//     if (softwareName.toLowerCase().includes(key)) {
//       return value;
//     }
//   }
  
//   return 'unknown';
// }

// /**
//  * Try to discover server type through various methods
//  */
// export async function discoverServerType(domain: string): Promise<ServerType> {
//   try {
//     // Try NodeInfo first
//     const nodeInfo = await fetchNodeInfo(domain);
//     if (nodeInfo?.software?.name) {
//       return normalizeServerType(nodeInfo.software.name);
//     }
    
//     // Try WebFinger as a fallback (less reliable for server type)
//     try {
//       // Just check if WebFinger is available
//       const webfingerResponse = await fetch(`https://${domain}/.well-known/webfinger?resource=acct:admin@${domain}`);
      
//       if (webfingerResponse.ok) {
//         // If WebFinger is available, it's likely a Mastodon-compatible server
//         // Most other ActivityPub implementations also support WebFinger
//         // We'll default to mastodon for now as a best guess
//         return 'mastodon';
//       }
//     } catch (error) {
//       // Failed WebFinger check, continue with other methods
//     }
    
//     // Try the API endpoints that are specific to each platform
//     try {
//       // Check for Mastodon's API
//       const mastodonApiResponse = await fetch(`https://${domain}/api/v1/instance`);
//       if (mastodonApiResponse.ok) {
//         const data = await mastodonApiResponse.json();
//         if (data.version && typeof data.version === 'string') {
//           if (data.version.toLowerCase().includes('mastodon')) {
//             return 'mastodon';
//           } else if (data.version.toLowerCase().includes('pleroma')) {
//             return 'pleroma';
//           } else if (data.version.toLowerCase().includes('pixelfed')) {
//             return 'pixelfed';
//           }
//         }
//         // If we can't determine from the version, default to mastodon
//         return 'mastodon';
//       }
//     } catch (error) {
//       // Failed API check, continue with other methods
//     }
    
//     // Default to unknown if all methods fail
//     return 'unknown';
//   } catch (error) {
//     logger.logError('Auth', 'discoverServerType', 
//       `Error discovering server type for ${domain}`, 
//       undefined, 
//       { domain, error: error instanceof Error ? error.message : 'Unknown error' }
//     );
    
//     return 'unknown';
//   }
// }