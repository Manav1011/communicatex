import { ApiRequest, HttpMethod, AuthMethod, BodyType } from '../types';

export const parseCurl = (curl: string): Partial<ApiRequest> | null => {
    const trimmed = curl.trim();
    if (!trimmed.toLowerCase().startsWith('curl')) return null;

    const result: Partial<ApiRequest> = {
        method: HttpMethod.GET,
        headers: [],
        params: [],
        bodyContent: '',
        auth: { type: AuthMethod.NONE },
        bodyType: 'none',
    };

    // Find URL - look for strings starting with http or just a standalone string that looks like a URL
    const urlMatch = trimmed.match(/['"](https?:\/\/[^'"]+)['"]/i) ||
        trimmed.match(/(https?:\/\/[^\s'"]+)/i);
    if (urlMatch) result.url = urlMatch[1];

    // Method
    const methodMatch = trimmed.match(/(?:-X|--request)\s+['"]?(\w+)['"]?/i);
    if (methodMatch) {
        result.method = methodMatch[1].toUpperCase() as HttpMethod;
    }

    // Headers
    const headerRegex = /(?:-H|--header)\s+['"]([^'"]+)['"]/gi;
    let headerMatch;
    while ((headerMatch = headerRegex.exec(trimmed)) !== null) {
        const headerStr = headerMatch[1];
        const colonIndex = headerStr.indexOf(':');
        if (colonIndex !== -1) {
            const key = headerStr.substring(0, colonIndex).trim();
            const value = headerStr.substring(colonIndex + 1).trim();
            result.headers?.push({ id: crypto.randomUUID(), key, value, enabled: true });

            // Check for content-type to set bodyType
            if (key.toLowerCase() === 'content-type') {
                if (value.toLowerCase().includes('application/json')) result.bodyType = 'json';
                else if (value.toLowerCase().includes('application/x-www-form-urlencoded')) result.bodyType = 'x-www-form-urlencoded';
                else if (value.toLowerCase().includes('multipart/form-data')) result.bodyType = 'form-data';
            }
        }
    }

    // Data
    const dataRegex = /(?:-d|--data|--data-raw|--data-binary)\s+(['"])([\s\S]*?)\1/gi;
    let dataMatch = dataRegex.exec(trimmed);
    if (dataMatch) {
        result.bodyContent = dataMatch[2];
        if (result.bodyType === 'none') result.bodyType = 'json';
        if (result.method === HttpMethod.GET) result.method = HttpMethod.POST;
    } else {
        // Try without quotes if not found
        const simpleDataMatch = trimmed.match(/(?:-d|--data|--data-raw|--data-binary)\s+([^\s'"]+)/i);
        if (simpleDataMatch) {
            result.bodyContent = simpleDataMatch[1];
            if (result.bodyType === 'none') result.bodyType = 'json';
            if (result.method === HttpMethod.GET) result.method = HttpMethod.POST;
        }
    }

    // Basic Auth
    const authMatch = trimmed.match(/(?:-u|--user)\s+['"]?([^'"]+)['"]?/i);
    if (authMatch) {
        const [user, pass] = authMatch[1].split(':');
        result.auth = { type: AuthMethod.BASIC, username: user, password: pass || '' };
    }

    return result;
};
