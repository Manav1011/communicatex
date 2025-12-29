import { ApiRequest, ApiResponse, AuthMethod, HttpMethod, KeyValueItem } from '../types';

/**
 * Replaces instances of <<variable>> with values from the environment.
 */
const interpolate = (text: string, variables: Record<string, string>): string => {
  if (!text) return text;
  return text.replace(/<<([^>>]+)>>/g, (match, key) => {
    const trimmedKey = key.trim();
    return variables.hasOwnProperty(trimmedKey) ? variables[trimmedKey] : match;
  });
};

const PROXY_URL = 'http://localhost:3001/proxy';

export const executeRequest = async (request: ApiRequest, environmentVariables: KeyValueItem[] = []): Promise<ApiResponse> => {
  const startTime = performance.now();
  
  // Create a map for O(1) lookup of variables
  const varMap: Record<string, string> = {};
  environmentVariables.forEach(v => {
    if (v.enabled && v.key) {
      varMap[v.key] = v.value;
    }
  });

  // Interpolate URL
  let finalUrl = interpolate(request.url, varMap);
  
  // Construct URL with interpolated params
  let urlObj: URL;
  try {
    // If URL doesn't have protocol, default to http for construction
    if (!finalUrl.startsWith('http')) {
        finalUrl = 'https://' + finalUrl;
    }
    urlObj = new URL(finalUrl);
  } catch (e) {
    throw new Error("Invalid URL format");
  }

  request.params.forEach(p => {
    if (p.enabled && p.key) {
      const key = interpolate(p.key, varMap);
      const value = interpolate(p.value, varMap);
      urlObj.searchParams.append(key, value);
    }
  });

  // Construct Headers with interpolation
  const headers = new Headers();
  request.headers.forEach(h => {
    if (h.enabled && h.key) {
      const key = interpolate(h.key, varMap);
      const value = interpolate(h.value, varMap);
      headers.append(key, value);
    }
  });

  // Handle Auth with interpolation
  if (request.auth.type === AuthMethod.BEARER && request.auth.token) {
    headers.set('Authorization', `Bearer ${interpolate(request.auth.token, varMap)}`);
  } else if (request.auth.type === AuthMethod.BASIC && request.auth.username) {
    const username = interpolate(request.auth.username, varMap);
    const password = interpolate(request.auth.password || '', varMap);
    const encoded = btoa(`${username}:${password}`);
    headers.set('Authorization', `Basic ${encoded}`);
  } else if (request.auth.type === AuthMethod.API_KEY && request.auth.apiKeyKey && request.auth.apiKeyValue) {
    const key = interpolate(request.auth.apiKeyKey, varMap);
    const value = interpolate(request.auth.apiKeyValue, varMap);
    
    if (request.auth.apiKeyLocation === 'header') {
      headers.set(key, value);
    } else {
      urlObj.searchParams.append(key, value);
    }
  }

  // Handle Body with interpolation
  let body: BodyInit | null = null;
  if (request.method !== HttpMethod.GET && request.bodyType === 'json' && request.bodyContent) {
    try {
      const interpolatedBody = interpolate(request.bodyContent, varMap);
      // Validate JSON
      JSON.parse(interpolatedBody);
      body = interpolatedBody;
      headers.set('Content-Type', 'application/json');
    } catch (e) {
      throw new Error("Invalid JSON body (after variable substitution)");
    }
  }

  try {
    let res: Response;
    let data;
    let time = 0;
    let size = 0;
    let resHeaders: Record<string, string> = {};
    let statusCode = 0;
    let statusText = '';

    if (request.useProxy) {
      // PROXY MODE
      // Convert Headers object to plain object for sending JSON
      const plainHeaders: Record<string, string> = {};
      headers.forEach((val, key) => { plainHeaders[key] = val; });

      const proxyRes = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: urlObj.toString(),
          method: request.method,
          headers: plainHeaders,
          body: body
        })
      });

      if (!proxyRes.ok) {
         // If proxy server itself fails (not the target API)
         throw new Error(`Proxy Server Error: ${proxyRes.statusText}`);
      }

      // The proxy returns the structure of ApiResponse directly
      const proxyData: ApiResponse = await proxyRes.json();
      return proxyData;

    } else {
      // DIRECT BROWSER MODE
      res = await fetch(urlObj.toString(), {
        method: request.method,
        headers,
        body,
        mode: 'cors', 
      });

      const endTime = performance.now();
      time = Math.round(endTime - startTime);
      size = Number(res.headers.get('content-length')) || 0;
      statusCode = res.status;
      statusText = res.statusText;
      
      res.headers.forEach((val, key) => {
        resHeaders[key] = val;
      });

      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        data = await res.text();
      }

      return {
        statusCode,
        statusText,
        time,
        size,
        headers: resHeaders,
        data
      };
    }

  } catch (error: any) {
     return {
      statusCode: 0,
      statusText: 'Network Error',
      time: 0,
      size: 0,
      headers: {},
      data: null,
      error: error.message || 'Failed to fetch. Try enabling Proxy Mode to bypass CORS.',
    };
  }
};