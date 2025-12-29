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

// Backend proxy server (see server.js). Keep port in sync with that file.
const PROXY_URL = 'http://localhost:4000/proxy';

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

  // Handle Body Generation
  let body: BodyInit | null = null;
  const methodHasBody = request.method !== HttpMethod.GET;

  if (methodHasBody) {
    if (request.bodyType === 'json' && request.bodyContent) {
      try {
        const interpolatedBody = interpolate(request.bodyContent, varMap);
        JSON.parse(interpolatedBody); // Validate JSON
        body = interpolatedBody;
        headers.set('Content-Type', 'application/json');
      } catch (e) {
        throw new Error("Invalid JSON body (after variable substitution)");
      }
    } else if (request.bodyType === 'x-www-form-urlencoded') {
      const params = new URLSearchParams();
      request.formEncodedParams.forEach(p => {
        if (p.enabled && p.key) {
           params.append(interpolate(p.key, varMap), interpolate(p.value, varMap));
        }
      });
      body = params.toString();
      headers.set('Content-Type', 'application/x-www-form-urlencoded');
    } else if (request.bodyType === 'form-data') {
      const formData = new FormData();
      request.multipartParams.forEach(p => {
        if (!p.enabled || !p.key) return;
        const key = interpolate(p.key, varMap);

        if (p.valueType === 'file' && p.file) {
          formData.append(key, p.file, p.file.name);
        } else {
          formData.append(key, interpolate(p.value, varMap));
        }
      });
      body = formData;
      // Do NOT set Content-Type for FormData, browser sets boundary
    } else if (request.bodyType === 'graphql') {
      try {
        const query = interpolate(request.graphqlQuery, varMap);
        const varsStr = interpolate(request.graphqlVariables || '{}', varMap);
        const variables = JSON.parse(varsStr);
        
        body = JSON.stringify({ query, variables });
        headers.set('Content-Type', 'application/json');
      } catch (e) {
        throw new Error("Invalid GraphQL variables JSON");
      }
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
      // PROXY MODE logic
      const plainHeaders: Record<string, string> = {};
      headers.forEach((val, key) => { plainHeaders[key] = val; });

      // Proxy needs a serializable body. FormData (multipart) is hard to serialize to JSON for the proxy.
      // For now, if using proxy + multipart, we convert to simple object (loses file capability, but OK for text)
      let proxyBody = body;
      
      if (request.bodyType === 'form-data' && body instanceof FormData) {
        // Full multipart with real files via proxy is not yet supported.
        // This avoids silently stripping files; instead we guide the user.
        throw new Error('File uploads are not supported when Proxy Mode is enabled. Disable Proxy to send multipart/form-data with files.');
      } 
      
      // Since server.js is simple, let's keep body strict string or JSON
      if (typeof proxyBody !== 'string' && !(proxyBody instanceof FormData)) {
        proxyBody = JSON.stringify(proxyBody);
      }

      const proxyRes = await fetch(PROXY_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: urlObj.toString(),
          method: request.method,
          headers: plainHeaders,
          body: request.bodyType === 'form-data' ? undefined : proxyBody // Cannot send FormData easily to this simple proxy
        })
      });

      if (!proxyRes.ok) {
         throw new Error(`Proxy Server Error: ${proxyRes.statusText}`);
      }

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