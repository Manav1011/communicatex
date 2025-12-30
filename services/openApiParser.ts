import { ApiRequest, KeyValueItem } from '../types';
import { API_BASE_URL } from './api';

export interface OpenApiImportResult {
    title: string;
    groups: {
        tag: string;
        requests: Partial<ApiRequest>[];
    }[];
}

const generateId = () => Math.random().toString(36).substr(2, 9);

export const parseOpenApi = async (url: string): Promise<OpenApiImportResult> => {
    try {
        const response = await fetch(`${API_BASE_URL}/proxy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url,
                method: 'GET',
                headers: {}
            }),
        });
        const proxyResult = await response.json();

        if (!response.ok || proxyResult.error) {
            throw new Error(proxyResult.error || `Proxy failed with status ${response.status}`);
        }

        const schema = proxyResult.data;
        return parseOpenApiContent(schema);
    } catch (error) {
        console.error('OpenAPI Parsing Error:', error);
        throw new Error('Failed to parse OpenAPI schema. Ensure the URL is valid and proxy is working.');
    }
};

export const parseOpenApiContent = (schema: any): OpenApiImportResult => {
    try {
        const title = schema.info?.title || 'Imported API';
        // ... rest of logic
        const paths = schema.paths || {};
        const groups: { [key: string]: Partial<ApiRequest>[] } = {};

        // Default tag for operations without tags
        const DEFAULT_TAG = 'Default';

        Object.entries(paths).forEach(([path, pathItem]: [string, any]) => {
            // Inherit parameters from path level
            const pathParameters = pathItem.parameters || [];

            ['get', 'post', 'put', 'delete', 'patch'].forEach(method => {
                const operation = pathItem[method];
                if (operation) {
                    const tags = operation.tags || [DEFAULT_TAG];
                    const queryParams: KeyValueItem[] = [];
                    const headerItems: KeyValueItem[] = [];

                    // Combine path-level and operation-level parameters
                    const allParameters = [...pathParameters, ...(operation.parameters || [])];

                    allParameters.forEach((param: any) => {
                        const item: KeyValueItem = {
                            id: generateId(),
                            key: param.name || '',
                            value: param.schema?.default !== undefined ? String(param.schema.default) : '',
                            enabled: param.required || false,
                        };

                        if (param.in === 'query') {
                            queryParams.push(item);
                        } else if (param.in === 'header') {
                            headerItems.push(item);
                        }
                    });

                    const request: Partial<ApiRequest> = {
                        name: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
                        method: method.toUpperCase() as any,
                        url: path,
                        description: operation.description || '',
                        headers: headerItems,
                        params: queryParams,
                        bodyType: 'none',
                        bodyContent: '',
                    };

                    // Handle Request Body
                    if (operation.requestBody) {
                        const content = operation.requestBody.content;
                        if (content) {
                            if (content['application/json']) {
                                request.bodyType = 'json';
                                // Try to generate a sample JSON from schema if available
                                const bodySchema = content['application/json'].schema;
                                if (bodySchema) {
                                    request.bodyContent = JSON.stringify(generateSampleFromSchema(bodySchema, schema.components?.schemas), null, 2);
                                }
                            } else if (content['application/x-www-form-urlencoded']) {
                                request.bodyType = 'x-www-form-urlencoded';
                            } else if (content['multipart/form-data']) {
                                request.bodyType = 'form-data';
                            }
                        }
                    }

                    // Try to get base URL from servers
                    if (schema.servers && schema.servers.length > 0) {
                        const baseUrl = schema.servers[0].url;
                        if (baseUrl) {
                            const fullUrl = baseUrl.endsWith('/') ? `${baseUrl}${path.startsWith('/') ? path.slice(1) : path}` : `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
                            request.url = fullUrl;
                        }
                    }

                    tags.forEach((tag: string) => {
                        if (!groups[tag]) groups[tag] = [];
                        groups[tag].push(request);
                    });
                }
            });
        });

        return {
            title,
            groups: Object.entries(groups).map(([tag, requests]) => ({ tag, requests })),
        };
    } catch (error) {
        console.error('OpenAPI Content Parsing Error:', error);
        throw new Error('Failed to parse OpenAPI content.');
    }
};

/**
 * Basic helper to generate a sample object from an OpenAPI schema
 */
function generateSampleFromSchema(schema: any, globalSchemas: any): any {
    // Resolve $ref
    if (schema?.$ref) {
        const refName = schema.$ref.split('/').pop();
        const resolved = globalSchemas?.[refName];
        if (resolved) return generateSampleFromSchema(resolved, globalSchemas);
        return {};
    }

    if (schema?.type === 'object') {
        const sample: any = {};
        if (schema.properties) {
            Object.entries(schema.properties).forEach(([key, prop]: [string, any]) => {
                sample[key] = generateSampleFromSchema(prop, globalSchemas);
            });
        }
        return sample;
    }

    if (schema?.type === 'array') {
        return [generateSampleFromSchema(schema.items, globalSchemas)];
    }

    // Primitive types
    if (schema?.default !== undefined) return schema.default;
    if (schema?.example !== undefined) return schema.example;

    switch (schema?.type) {
        case 'string': return '';
        case 'number':
        case 'integer': return 0;
        case 'boolean': return false;
        default: return null;
    }
}
