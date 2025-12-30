import { ApiRequest, KeyValueItem } from '../types';
import { API_BASE_URL } from './api';

export interface OpenApiImportResult {
    title: string;
    baseUrl?: string;
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
        const paths = schema.paths || {};
        const groups: { [key: string]: Partial<ApiRequest>[] } = {};
        const globalSchemas = schema.components?.schemas || {};
        const globalParams = schema.components?.parameters || {};

        // Default tag for operations without tags
        const DEFAULT_TAG = 'Default';

        // Try to get base URL from servers
        let baseUrl = '';
        if (schema.servers && schema.servers.length > 0) {
            baseUrl = schema.servers[0].url;
            // Basic variable substitution for servers (e.g. {protocol}://{host})
            if (schema.servers[0].variables) {
                Object.entries(schema.servers[0].variables).forEach(([key, variable]: [string, any]) => {
                    const val = variable.default || (variable.enum ? variable.enum[0] : `{${key}}`);
                    baseUrl = baseUrl.replace(`{${key}}`, val);
                });
            }

            // If it's a relative base URL (e.g. /v1), we keep it as a prefix for path
            // instead of moving it to baseUrl variable to avoid broken absolute URLs
            if (baseUrl && !baseUrl.startsWith('http')) {
                baseUrl = '';
            }
        }

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
                    let allParameters = [...pathParameters, ...(operation.parameters || [])];

                    // Resolve parameter $refs
                    allParameters = allParameters.map(p => {
                        if (p.$ref) {
                            const refName = p.$ref.split('/').pop();
                            return globalParams[refName] || p;
                        }
                        return p;
                    });

                    allParameters.forEach((param: any) => {
                        let value = '';
                        const pSchema = param.schema;

                        if (pSchema) {
                            if (pSchema.default !== undefined) value = String(pSchema.default);
                            else if (pSchema.example !== undefined) value = String(pSchema.example);
                            else if (pSchema.enum && pSchema.enum.length > 0) value = String(pSchema.enum[0]);
                        } else if (param.example !== undefined) {
                            value = String(param.example);
                        }

                        const item: KeyValueItem = {
                            id: generateId(),
                            key: param.name || '',
                            value: value,
                            enabled: true, // Path and Required params should be enabled by default
                        };

                        if (param.in === 'query') {
                            item.enabled = param.required || false;
                            queryParams.push(item);
                        } else if (param.in === 'header') {
                            item.enabled = param.required || false;
                            headerItems.push(item);
                        } else if (param.in === 'path') {
                            // Also add path parameters to queryParams so user can easily set them as variables
                            queryParams.push(item);
                        }
                    });

                    // Convert OpenAPI path params {user_id} to CommunicateX format {{user_id}}
                    const formattedPath = path.replace(/\{([^}]+)\}/g, '{{$1}}');

                    const request: Partial<ApiRequest> = {
                        name: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
                        method: method.toUpperCase() as any,
                        // Use {{baseUrl}} and properly formatted path with {{variables}}
                        url: `{{baseUrl}}${formattedPath.startsWith('/') ? formattedPath : `/${formattedPath}`}`,
                        summary: operation.summary || '',
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
                                const bodySchema = content['application/json'].schema;
                                if (bodySchema) {
                                    request.bodyContent = JSON.stringify(generateSampleFromSchema(bodySchema, globalSchemas), null, 2);
                                }
                            } else if (content['application/x-www-form-urlencoded']) {
                                request.bodyType = 'x-www-form-urlencoded';
                                const bodySchema = content['application/x-www-form-urlencoded'].schema;
                                if (bodySchema && bodySchema.properties) {
                                    request.formEncodedParams = Object.entries(bodySchema.properties).map(([key, prop]: [string, any]) => ({
                                        id: generateId(),
                                        key,
                                        value: prop.default !== undefined ? String(prop.default) : (prop.example !== undefined ? String(prop.example) : ''),
                                        enabled: true
                                    }));
                                }
                            } else if (content['multipart/form-data']) {
                                request.bodyType = 'form-data';
                                const bodySchema = content['multipart/form-data'].schema;
                                if (bodySchema && bodySchema.properties) {
                                    request.multipartParams = Object.entries(bodySchema.properties).map(([key, prop]: [string, any]) => ({
                                        id: generateId(),
                                        key,
                                        value: prop.default !== undefined ? String(prop.default) : (prop.example !== undefined ? String(prop.example) : ''),
                                        enabled: true,
                                        valueType: prop.format === 'binary' ? 'file' : 'text'
                                    }));
                                }
                            }
                        }
                    }

                    // Handle Responses
                    if (operation.responses) {
                        request.expectedResponses = Object.entries(operation.responses).map(([code, res]: [string, any]) => {
                            let sampleBody = '';
                            if (res.content?.['application/json']?.schema) {
                                sampleBody = JSON.stringify(generateSampleFromSchema(res.content['application/json'].schema, globalSchemas), null, 2);
                            }
                            return {
                                id: generateId(),
                                statusCode: code,
                                description: res.description || '',
                                bodyContent: sampleBody
                            };
                        });
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
            baseUrl: baseUrl,
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

    // Handle polymorphic schemas
    if (schema?.anyOf || schema?.oneOf) {
        return generateSampleFromSchema(schema.anyOf?.[0] || schema.oneOf?.[0], globalSchemas);
    }
    if (schema?.allOf) {
        let sample = {};
        schema.allOf.forEach((s: any) => {
            const part = generateSampleFromSchema(s, globalSchemas);
            if (typeof part === 'object' && part !== null) {
                sample = { ...sample, ...part };
            } else if (sample === null || Object.keys(sample).length === 0) {
                sample = part;
            }
        });
        return sample;
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
        return [generateSampleFromSchema(schema.items || {}, globalSchemas)];
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
