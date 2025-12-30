import { ApiRequest, AuthMethod, HttpMethod, KeyValueItem } from '../types';

const getHeaders = (request: ApiRequest): Record<string, string> => {
  const headers: Record<string, string> = {};
  request.headers.forEach(h => {
    if (h.enabled) headers[h.key] = h.value;
  });

  // Auth Headers
  if (request.auth.type === AuthMethod.BEARER && request.auth.token) {
    headers['Authorization'] = `Bearer ${request.auth.token}`;
  } else if (request.auth.type === AuthMethod.BASIC && request.auth.username) {
    const creds = btoa(`${request.auth.username}:${request.auth.password || ''}`);
    headers['Authorization'] = `Basic ${creds}`;
  } else if (request.auth.type === AuthMethod.API_KEY && request.auth.apiKeyLocation === 'header' && request.auth.apiKeyKey) {
    headers[request.auth.apiKeyKey] = request.auth.apiKeyValue || '';
  }

  // Content Type
  if (request.bodyType === 'json') headers['Content-Type'] = 'application/json';
  if (request.bodyType === 'x-www-form-urlencoded') headers['Content-Type'] = 'application/x-www-form-urlencoded';
  if (request.bodyType === 'graphql') headers['Content-Type'] = 'application/json';

  return headers;
};

const getBody = (request: ApiRequest): string | null => {
  if ([HttpMethod.GET, HttpMethod.HEAD].includes(request.method)) return null;

  if (request.bodyType === 'json') return request.bodyContent;

  if (request.bodyType === 'graphql') {
    return JSON.stringify({
      query: request.graphqlQuery,
      variables: request.graphqlVariables ? JSON.parse(request.graphqlVariables || '{}') : {}
    });
  }

  if (request.bodyType === 'x-www-form-urlencoded') {
    const params = new URLSearchParams();
    request.formEncodedParams.forEach(p => {
      if (p.enabled) params.append(p.key, p.value);
    });
    return params.toString();
  }

  return null;
};

export const generateCurl = (request: ApiRequest): string => {
  let cmd = `curl -X ${request.method} '${request.url}'`;

  const headers = getHeaders(request);
  Object.entries(headers).forEach(([k, v]) => {
    cmd += ` \\\n  -H '${k}: ${v}'`;
  });

  const body = getBody(request);
  if (body) {
    // Escape single quotes
    const safeBody = body.replace(/'/g, "'\\''");
    cmd += ` \\\n  -d '${safeBody}'`;
  }

  return cmd;
};

export const generateJavascript = (request: ApiRequest): string => {
  const headers = getHeaders(request);
  const body = getBody(request);

  let optionsStr = `  method: '${request.method}',\n`;

  if (Object.keys(headers).length > 0) {
    optionsStr += `  headers: ${JSON.stringify(headers, null, 4).replace(/"/g, "'")},\n`;
  }

  if (body) {
    optionsStr += `  body: JSON.stringify(${body})`; // Simplified, usually you'd format this better
  }

  return `fetch('${request.url}', {
${optionsStr}
})
.then(response => response.json())
.then(console.log);`;
};

export const generatePython = (request: ApiRequest): string => {
  const headers = getHeaders(request);
  const body = getBody(request);

  let code = `import requests\n\nurl = "${request.url}"\n\n`;

  if (Object.keys(headers).length > 0) {
    code += `headers = ${JSON.stringify(headers, null, 4)}\n\n`;
  }

  if (body) {
    code += `payload = ${JSON.stringify(JSON.parse(body || '{}'), null, 4)}\n\n`;
    code += `response = requests.request("${request.method}", url, headers=headers, json=payload)\n`;
  } else {
    code += `response = requests.request("${request.method}", url, headers=headers)\n`;
  }

  code += `\nprint(response.text)`;
  return code;
};