import { Collection, SavedRequest, Workspace, HttpMethod, AuthMethod } from '../types';

interface OpenApiSchema {
    openapi: string;
    info: {
        title: string;
        version: string;
    };
    servers: Array<{ url: string }>;
    paths: Record<string, Record<string, any>>;
    components?: {
        securitySchemes?: Record<string, any>;
    };
    tags?: Array<{ name: string; description?: string }>;
}

export const generateOpenApi = (
    workspace: Workspace,
    collections: Collection[],
    requests: SavedRequest[]
): string => {
    const schema: OpenApiSchema = {
        openapi: '3.0.0',
        info: {
            title: workspace.name,
            version: '1.0.0'
        },
        servers: [
            { url: 'https://api.example.com' } // Default placeholder
        ],
        tags: collections.map(c => ({ name: c.name })),
        paths: {},
        components: {
            securitySchemes: {}
        }
    };

    // Helper to get collection name
    const getCollectionName = (id: string) => collections.find(c => c.id === id)?.name || 'default';

    requests.forEach(req => {
        // Parse URL to get path
        let path = '/';
        try {
            const urlObj = new URL(req.url.startsWith('http') ? req.url : `http://${req.url}`);
            path = urlObj.pathname;
        } catch {
            path = req.url; // Fallback
        }

        if (!schema.paths[path]) {
            schema.paths[path] = {};
        }

        const method = req.method.toLowerCase();

        // Construct Parameters
        const parameters = [
            ...req.params.filter(p => p.enabled).map(p => ({
                name: p.key,
                in: 'query',
                required: false,
                schema: { type: 'string', example: p.value }
            })),
            ...req.headers.filter(h => h.enabled).map(h => ({
                name: h.key,
                in: 'header',
                required: false,
                schema: { type: 'string', example: h.value }
            }))
        ];

        // Construct Body
        let requestBody = undefined;
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
            if (req.bodyType === 'json' && req.bodyContent) {
                requestBody = {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                example: JSON.parse(req.bodyContent || '{}')
                            }
                        }
                    }
                };
            } else if (req.bodyType === 'x-www-form-urlencoded') {
                const properties: Record<string, any> = {};
                req.formEncodedParams.forEach(p => {
                    if (p.enabled) properties[p.key] = { type: 'string', example: p.value };
                });
                requestBody = {
                    content: {
                        'application/x-www-form-urlencoded': {
                            schema: {
                                type: 'object',
                                properties
                            }
                        }
                    }
                };
            }
        }

        schema.paths[path][method] = {
            summary: req.name,
            description: req.description,
            tags: [getCollectionName(req.collectionId)],
            parameters,
            requestBody,
            responses: {
                '200': {
                    description: 'Successful Response'
                }
            }
        };
    });

    return JSON.stringify(schema, null, 2);
};
