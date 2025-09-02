// const PROXY_BASE_URL = process.env.NEXT_PUBLIC_PROXY_API_URL || 'http://localhost:8000';

// /**
//  * Makes a proxied request to a Mastodon instance
//  * @param url The full Mastodon API URL
//  * @param method HTTP method
//  * @param headers Request headers
//  * @param data Request body for POST/PUT/PATCH
//  * @param params URL parameters for GET requests
//  */
// export async function mastodonFetch(
//   url: string, 
//   method: string = 'GET',
//   headers: Record<string, string> = {},
//   data?: any,
//   params?: Record<string, string>
// ) {
//   try {
//     const response = await fetch(`${PROXY_BASE_URL}/proxy/mastodon`, {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//       },
//       body: JSON.stringify({
//         url,
//         method,
//         headers,
//         data,
//         params,
//       }),
//     });

//     const proxyResponse = await response.json();
    
//     // Return in a format similar to a fetch response
//     return {
//       ok: proxyResponse.status_code >= 200 && proxyResponse.status_code < 300,
//       status: proxyResponse.status_code,
//       headers: proxyResponse.headers,
//       json: () => Promise.resolve(proxyResponse.body),
//       text: () => Promise.resolve(typeof proxyResponse.body === 'string' 
//         ? proxyResponse.body 
//         : JSON.stringify(proxyResponse.body)),
//     };
//   } catch (error) {
//     console.error('Mastodon proxy fetch error:', error);
//     throw error;
//   }
// }
