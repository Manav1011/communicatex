import React from 'react';
import { ApiRequest, AuthMethod, KeyValueItem } from '../../types';
import AutocompleteInput from '../AutocompleteInput';
import CustomSelect from '../CustomSelect';

interface RequestAuthProps {
  request: ApiRequest;
  onRequestChange: (req: ApiRequest) => void;
  environmentVariables: KeyValueItem[];
}

const RequestAuth: React.FC<RequestAuthProps> = ({ request, onRequestChange, environmentVariables }) => {
  const authOptions = [
    { value: AuthMethod.NONE, label: 'No Authentication' },
    { value: AuthMethod.BEARER, label: 'Bearer Token' },
    { value: AuthMethod.BASIC, label: 'Basic Auth' },
    { value: AuthMethod.API_KEY, label: 'API Key' },
  ];

  return (
    <div className="h-full flex flex-col max-w-xl animate-in fade-in duration-300">
      <div className="mb-6">
        <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Authentication Type</label>
        <CustomSelect
          value={request.auth.type}
          onChange={(val) => onRequestChange({ ...request, auth: { ...request.auth, type: val as AuthMethod } })}
          options={authOptions}
          className="w-full bg-surfaceLight border border-border p-3 rounded-lg text-sm text-foreground"
        />
      </div>

      {request.auth.type === AuthMethod.BEARER && (
        <div>
          <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Token</label>
          <div className="h-32 bg-surfaceLight border border-border rounded-lg focus-within:border-primary focus-within:ring-1 focus-within:ring-primary relative focus-within:z-10">
            <AutocompleteInput
              type="textarea"
              value={request.auth.token || ''}
              onChange={(val) => onRequestChange({ ...request, auth: { ...request.auth, token: val } })}
              variables={environmentVariables}
              placeholder="Enter your JWT or var (e.g. {{token}})"
              className="w-full h-full bg-transparent p-3 text-sm text-foreground font-mono outline-none resize-none placeholder-zinc-600"
            />
          </div>
        </div>
      )}

      {request.auth.type === AuthMethod.BASIC && (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Username</label>
            <div className="bg-surfaceLight border border-border rounded-lg focus-within:border-primary relative focus-within:z-10">
              <AutocompleteInput
                value={request.auth.username || ''}
                onChange={(val) => onRequestChange({ ...request, auth: { ...request.auth, username: val } })}
                variables={environmentVariables}
                className="w-full bg-transparent p-3 text-sm text-foreground outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Password</label>
            <div className="bg-surfaceLight border border-border rounded-lg focus-within:border-primary relative focus-within:z-10">
              <AutocompleteInput
                type="password"
                value={request.auth.password || ''}
                onChange={(val) => onRequestChange({ ...request, auth: { ...request.auth, password: val } })}
                variables={environmentVariables}
                className="w-full bg-transparent p-3 text-sm text-foreground outline-none"
              />
            </div>
          </div>
        </div>
      )}

      {request.auth.type === AuthMethod.API_KEY && (
        <div className="space-y-5">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Key</label>
              <div className="bg-surfaceLight border border-border rounded-lg focus-within:border-primary relative focus-within:z-10">
                <AutocompleteInput
                  placeholder="X-API-KEY"
                  value={request.auth.apiKeyKey || ''}
                  onChange={(val) => onRequestChange({ ...request, auth: { ...request.auth, apiKeyKey: val } })}
                  variables={environmentVariables}
                  className="w-full bg-transparent p-3 text-sm text-foreground outline-none"
                />
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-2">Value</label>
              <div className="bg-surfaceLight border border-border rounded-lg focus-within:border-primary relative focus-within:z-10">
                <AutocompleteInput
                  placeholder="Key Value"
                  value={request.auth.apiKeyValue || ''}
                  onChange={(val) => onRequestChange({ ...request, auth: { ...request.auth, apiKeyValue: val } })}
                  variables={environmentVariables}
                  className="w-full bg-transparent p-3 text-sm text-foreground outline-none"
                />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-textSecondary uppercase tracking-wider mb-3">Add To</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${request.auth.apiKeyLocation === 'header' ? 'border-primary' : 'border-border'}`}>
                  {request.auth.apiKeyLocation === 'header' && <div className="w-2 h-2 rounded-full bg-primary"></div>}
                </div>
                <input
                  type="radio"
                  className="hidden"
                  name="apikey_loc"
                  checked={request.auth.apiKeyLocation === 'header'}
                  onChange={() => onRequestChange({ ...request, auth: { ...request.auth, apiKeyLocation: 'header' } })}
                />
                <span className="text-sm text-textSecondary group-hover:text-foreground">Header</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className={`w-4 h-4 rounded-full border flex items-center justify-center ${request.auth.apiKeyLocation === 'query' ? 'border-primary' : 'border-border'}`}>
                  {request.auth.apiKeyLocation === 'query' && <div className="w-2 h-2 rounded-full bg-primary"></div>}
                </div>
                <input
                  type="radio"
                  className="hidden"
                  name="apikey_loc"
                  checked={request.auth.apiKeyLocation === 'query'}
                  onChange={() => onRequestChange({ ...request, auth: { ...request.auth, apiKeyLocation: 'query' } })}
                />
                <span className="text-sm text-textSecondary group-hover:text-foreground">Query Params</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestAuth;