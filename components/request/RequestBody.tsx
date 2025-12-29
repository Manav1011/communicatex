import React from 'react';
import { ApiRequest, BodyType, KeyValueItem } from '../../types';
import AutocompleteInput from '../AutocompleteInput';
import KeyValueEditor from '../KeyValueEditor';
import MultipartEditor from '../MultipartEditor';

interface RequestBodyProps {
  request: ApiRequest;
  onRequestChange: (req: ApiRequest) => void;
  environmentVariables: KeyValueItem[];
}

const RequestBody: React.FC<RequestBodyProps> = ({ request, onRequestChange, environmentVariables }) => {
  
  const handleBodyTypeChange = (type: BodyType) => {
    onRequestChange({ ...request, bodyType: type });
  };

  const bodyTypes: { id: BodyType; label: string }[] = [
    { id: 'none', label: 'None' },
    { id: 'json', label: 'JSON' },
    { id: 'form-data', label: 'Multipart Form' },
    { id: 'x-www-form-urlencoded', label: 'Form UrlEncoded' },
    { id: 'graphql', label: 'GraphQL' },
  ];

  return (
    <div className="h-full flex flex-col animate-in fade-in duration-300">
      <div className="mb-4 flex gap-4 overflow-x-auto border-b border-border pb-2 custom-scrollbar">
        {bodyTypes.map(t => (
            <label key={t.id} className="flex items-center gap-2 cursor-pointer group whitespace-nowrap px-2">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${request.bodyType === t.id ? 'border-primary' : 'border-zinc-600'}`}>
                {request.bodyType === t.id && <div className="w-2 h-2 rounded-full bg-primary"></div>}
                </div>
                <input 
                type="radio" 
                className="hidden"
                name="bodyType" 
                checked={request.bodyType === t.id}
                onChange={() => handleBodyTypeChange(t.id)}
                />
                <span className={`text-sm group-hover:text-white transition-colors ${request.bodyType === t.id ? 'text-zinc-100 font-medium' : 'text-zinc-400'}`}>{t.label}</span>
            </label>
        ))}
      </div>

      <div className="flex-1 relative">
        {request.bodyType === 'none' && (
            <div className="h-full flex items-center justify-center text-textSecondary text-sm italic opacity-50">
                No body content
            </div>
        )}

        {request.bodyType === 'json' && (
            <div className="h-full bg-surfaceLight border border-border rounded-lg focus-within:border-primary focus-within:ring-1 focus-within:ring-primary focus-within:z-10">
            <AutocompleteInput 
                type="textarea"
                value={request.bodyContent}
                onChange={(val) => onRequestChange({ ...request, bodyContent: val })}
                variables={environmentVariables}
                className="w-full h-full bg-transparent p-4 text-sm font-mono text-zinc-200 outline-none resize-none leading-relaxed placeholder-zinc-600"
                placeholder={`{ "id": <<id>> }`}
            />
            </div>
        )}

        {request.bodyType === 'form-data' && (
          <MultipartEditor
            title="Multipart Form Data"
            items={request.multipartParams || []}
            onChange={(items) => onRequestChange({ ...request, multipartParams: items })}
          />
        )}

        {request.bodyType === 'x-www-form-urlencoded' && (
             <KeyValueEditor 
                title="Form Url Encoded" 
                items={request.formEncodedParams || []} 
                onChange={(items) => onRequestChange({...request, formEncodedParams: items})} 
                variables={environmentVariables}
            />
        )}

        {request.bodyType === 'graphql' && (
            <div className="h-full flex flex-col gap-4">
                <div className="flex-1 flex flex-col">
                    <label className="text-xs font-bold text-textSecondary uppercase mb-1">Query</label>
                    <div className="flex-1 bg-surfaceLight border border-border rounded-lg focus-within:border-primary">
                        <AutocompleteInput 
                            type="textarea"
                            value={request.graphqlQuery || ''}
                            onChange={(val) => onRequestChange({ ...request, graphqlQuery: val })}
                            variables={environmentVariables}
                            className="w-full h-full bg-transparent p-3 text-sm font-mono text-zinc-200 outline-none resize-none"
                            placeholder="query {\n  user(id: 1) {\n    name\n  }\n}"
                        />
                    </div>
                </div>
                <div className="h-1/3 flex flex-col">
                    <label className="text-xs font-bold text-textSecondary uppercase mb-1">Variables</label>
                    <div className="flex-1 bg-surfaceLight border border-border rounded-lg focus-within:border-primary">
                        <AutocompleteInput 
                            type="textarea"
                            value={request.graphqlVariables || ''}
                            onChange={(val) => onRequestChange({ ...request, graphqlVariables: val })}
                            variables={environmentVariables}
                            className="w-full h-full bg-transparent p-3 text-sm font-mono text-zinc-200 outline-none resize-none"
                            placeholder={`{ "id": 1 }`}
                        />
                    </div>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default RequestBody;