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
    // If URL doesn't have protocol, default to http for construction (though fetch might fail if not absolute)
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
      // Interpolate the raw string BEFORE parsing to JSON to allow partial replacements
      // e.g. { "key": "<<some_value>>" }
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
    const res = await fetch(urlObj.toString(), {
      method: request.method,
      headers,
      body,
      mode: 'cors', 
    });

    const endTime = performance.now();
    const time = Math.round(endTime - startTime);
    const size = Number(res.headers.get('content-length')) || 0;
    
    // Parse headers to object
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((val, key) => {
      resHeaders[key] = val;
    });

    let data;
    const contentType = res.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }

    return {
      statusCode: res.status,
      statusText: res.statusText,
      time,
      size,
      headers: resHeaders,
      data
    };

  } catch (error: any) {
     return {
      statusCode: 0,
      statusText: 'Network Error',
      time: 0,
      size: 0,
      headers: {},
      data: null,
      error: error.message || 'Failed to fetch. This may be due to CORS policies on the target API.',
    };
  }
};