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
      <div className="mb-6 flex gap-2 overflow-x-auto p-1 bg-surfaceHighlight/30 rounded-xl max-w-fit custom-scrollbar">
        {bodyTypes.map(t => (
          <label
            key={t.id}
            className={`flex items-center gap-2 cursor-pointer group whitespace-nowrap px-4 py-2 rounded-lg transition-all ${request.bodyType === t.id ? 'bg-primary/10 text-primary shadow-sm' : 'text-textSecondary hover:bg-surfaceLight/50'}`}
          >
            <input
              type="radio"
              className="hidden"
              name="bodyType"
              checked={request.bodyType === t.id}
              onChange={() => handleBodyTypeChange(t.id)}
            />
            <span className={`text-[10px] uppercase tracking-widest font-bold transition-colors ${request.bodyType === t.id ? 'text-primary' : 'text-textSecondary'}`}>{t.label}</span>
          </label>
        ))}
      </div>

      <div className="flex-1 relative">
        {request.bodyType === 'none' && (
          <div className="h-full flex items-center justify-center text-textSecondary text-sm italic opacity-80">
            No body content
          </div>
        )}

        {request.bodyType === 'json' && (
          <div className="h-full bg-surfaceHighlight/20 rounded-xl focus-within:ring-2 focus-within:ring-primary/30 transition-all overflow-hidden shadow-inner flex flex-col">
            <AutocompleteInput
              type="textarea"
              value={request.bodyContent}
              onChange={(val) => onRequestChange({ ...request, bodyContent: val })}
              variables={environmentVariables}
              className="w-full h-full bg-transparent p-4 text-sm font-mono text-foreground outline-none resize-none leading-relaxed placeholder-foreground"
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
            onChange={(items) => onRequestChange({ ...request, formEncodedParams: items })}
            variables={environmentVariables}
          />
        )}

        {request.bodyType === 'graphql' && (
          <div className="h-full flex flex-col gap-4">
            <div className="flex-1 flex flex-col">
              <label className="text-xs font-bold text-textSecondary uppercase mb-1">Query</label>
              <div className="flex-1 bg-surfaceHighlight/20 rounded-xl focus-within:ring-2 focus-within:ring-primary/30 shadow-inner overflow-hidden">
                <AutocompleteInput
                  type="textarea"
                  value={request.graphqlQuery || ''}
                  onChange={(val) => onRequestChange({ ...request, graphqlQuery: val })}
                  variables={environmentVariables}
                  className="w-full h-full bg-transparent p-3 text-sm font-mono text-foreground outline-none resize-none"
                  placeholder="query {\n  user(id: 1) {\n    name\n  }\n}"
                />
              </div>
            </div>
            <div className="h-1/3 flex flex-col">
              <label className="text-xs font-bold text-textSecondary uppercase mb-1">Variables</label>
              <div className="flex-1 bg-surfaceHighlight/20 rounded-xl focus-within:ring-2 focus-within:ring-primary/30 shadow-inner overflow-hidden">
                <AutocompleteInput
                  type="textarea"
                  value={request.graphqlVariables || ''}
                  onChange={(val) => onRequestChange({ ...request, graphqlVariables: val })}
                  variables={environmentVariables}
                  className="w-full h-full bg-transparent p-3 text-sm font-mono text-foreground outline-none resize-none"
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