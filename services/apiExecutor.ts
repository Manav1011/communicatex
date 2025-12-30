import { ApiRequest, ApiResponse, AuthMethod, HttpMethod, KeyValueItem, TestCase, TestResult } from '../types';

/**
 * Replaces instances of <<variable>> with values from the environment.
 */
const interpolate = (text: string, variables: Record<string, string>): string => {
  if (!text) return text;
  // Match both <<key>> and {{key}}
  return text.replace(/((?:<<|{{))([^>}|]+)((?:>>|}}))/g, (match, open, key, close) => {
    const trimmedKey = key.trim();
    return variables.hasOwnProperty(trimmedKey) ? variables[trimmedKey] : match;
  });
};

import { API_BASE_URL } from './api';

// Backend proxy server (see server.js). Keep port in sync with that file.
const PROXY_URL = `${API_BASE_URL}/proxy`;

/**
 * Executes assertions against the response
 */
const runTests = (request: ApiRequest, response: ApiResponse): TestResult[] => {
  if (!request.testCases || request.testCases.length === 0) return [];

  return request.testCases.filter(tc => tc.enabled).map(tc => {
    let passed = false;
    let actualValue: any = undefined;
    let message = '';

    try {
      switch (tc.type) {
        case 'status_code':
          actualValue = response.statusCode;
          break;
        case 'response_time':
          actualValue = response.time;
          break;
        case 'header':
          actualValue = tc.property ? response.headers[tc.property.toLowerCase()] : undefined;
          break;
        case 'json_body':
          if (tc.property && response.data && typeof response.data === 'object') {
            actualValue = getNestedValue(response.data, tc.property.replace(/^\$\.?/, ''));
          }
          break;
        case 'text_body':
          actualValue = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
          break;
      }

      const expectedValue = tc.value;

      switch (tc.operator) {
        case 'equals':
          passed = String(actualValue) === String(expectedValue);
          message = passed ? `Value matches expected "${expectedValue}"` : `Expected "${expectedValue}", got "${actualValue}"`;
          break;
        case 'not_equals':
          passed = String(actualValue) !== String(expectedValue);
          message = passed ? `Value correctly differs from "${expectedValue}"` : `Value unexpectedly matches "${expectedValue}"`;
          break;
        case 'contains':
          passed = String(actualValue).includes(String(expectedValue));
          message = passed ? `Value contains "${expectedValue}"` : `Value does not contain "${expectedValue}"`;
          break;
        case 'not_contains':
          passed = !String(actualValue).includes(String(expectedValue));
          message = passed ? `Value does not contain "${expectedValue}"` : `Value unexpectedly contains "${expectedValue}"`;
          break;
        case 'greater_than':
          passed = Number(actualValue) > Number(expectedValue);
          message = passed ? `${actualValue} is greater than ${expectedValue}` : `${actualValue} is not greater than ${expectedValue}`;
          break;
        case 'less_than':
          passed = Number(actualValue) < Number(expectedValue);
          message = passed ? `${actualValue} is less than ${expectedValue}` : `${actualValue} is not less than ${expectedValue}`;
          break;
        case 'exists':
          passed = actualValue !== undefined && actualValue !== null;
          message = passed ? 'Property exists' : 'Property does not exist';
          break;
        case 'not_exists':
          passed = actualValue === undefined || actualValue === null;
          message = passed ? 'Property does not exist' : 'Property exists but was expected to be absent';
          break;
      }
    } catch (e) {
      passed = false;
      message = `Error during assertion: ${e instanceof Error ? e.message : String(e)}`;
    }

    return {
      testCaseId: tc.id,
      testCaseName: tc.name,
      passed,
      message,
      actualValue
    };
  });
};

/**
 * Simple helper to get values from nested objects using dot notation
 */
const getNestedValue = (obj: any, path: string): any => {
  if (!path) return obj;
  return path.split('.').reduce((prev, curr) => {
    return prev ? prev[curr] : undefined;
  }, obj);
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
  const methodHasBody = ![HttpMethod.GET, HttpMethod.HEAD].includes(request.method);

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
      proxyData.testResults = runTests(request, proxyData);
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

      const finalResponse: ApiResponse = {
        statusCode,
        statusText,
        time,
        size,
        headers: resHeaders,
        data
      };

      finalResponse.testResults = runTests(request, finalResponse);
      return finalResponse;
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