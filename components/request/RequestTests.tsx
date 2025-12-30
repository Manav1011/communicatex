import React from 'react';
import { ApiRequest, TestCase, AssertionType, AssertionOperator } from '../../types';
import { Plus, Trash2, CheckCircle2, FlaskConical } from 'lucide-react';

interface RequestTestsProps {
    request: ApiRequest;
    onRequestChange: (req: ApiRequest) => void;
}

const ASSERTION_TYPES: { value: AssertionType; label: string }[] = [
    { value: 'status_code', label: 'Status Code' },
    { value: 'response_time', label: 'Response Time (ms)' },
    { value: 'json_body', label: 'JSON Body' },
    { value: 'header', label: 'Header' },
    { value: 'text_body', label: 'Text Body' },
];

const OPERATORS: { value: AssertionOperator; label: string }[] = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Not Contains' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'exists', label: 'Exists' },
    { value: 'not_exists', label: 'Not Exists' },
];

const RequestTests: React.FC<RequestTestsProps> = ({ request, onRequestChange }) => {
    const testCases = request.testCases || [];

    const addTestCase = () => {
        const newTest: TestCase = {
            id: crypto.randomUUID(),
            name: 'New Test Case',
            type: 'status_code',
            operator: 'equals',
            value: '200',
            enabled: true,
        };
        onRequestChange({
            ...request,
            testCases: [...testCases, newTest],
        });
    };

    const updateTestCase = (id: string, updates: Partial<TestCase>) => {
        onRequestChange({
            ...request,
            testCases: testCases.map((tc) => (tc.id === id ? { ...tc, ...updates } : tc)),
        });
    };

    const removeTestCase = (id: string) => {
        onRequestChange({
            ...request,
            testCases: testCases.filter((tc) => tc.id !== id),
        });
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
                <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <FlaskConical size={16} className="text-primary" />
                        Test Assertions
                    </h3>
                    <p className="text-[11px] text-textSecondary mt-1">
                        Define assertions to validate the response automatically after sending.
                    </p>
                </div>
                <button
                    onClick={addTestCase}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-lg transition-all border border-primary/20"
                >
                    <Plus size={14} />
                    Add Assertion
                </button>
            </div>

            <div className="space-y-3">
                {testCases.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 bg-surfaceHighlight/5 rounded-xl border border-dashed border-white/5">
                        <CheckCircle2 size={32} className="text-textSecondary/20 mb-3" />
                        <p className="text-xs text-textSecondary font-medium">No test assertions defined yet.</p>
                        <button
                            onClick={addTestCase}
                            className="mt-4 text-xs font-bold text-primary hover:underline"
                        >
                            Create your first test case
                        </button>
                    </div>
                ) : (
                    testCases.map((tc) => (
                        <div
                            key={tc.id}
                            className={`p-4 rounded-xl border transition-all ${tc.enabled ? 'bg-surfaceHighlight/10 border-white/5 shadow-sm' : 'bg-surfaceLight/5 border-transparent opacity-60'}`}
                        >
                            <div className="flex items-start gap-4">
                                <input
                                    type="checkbox"
                                    checked={tc.enabled}
                                    onChange={(e) => updateTestCase(tc.id, { enabled: e.target.checked })}
                                    className="mt-1 w-3.5 h-3.5 rounded border-white/10 bg-surfaceLight text-primary focus:ring-primary/20 cursor-pointer"
                                />

                                <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-3">
                                    {/* Test Name */}
                                    <div className="md:col-span-3">
                                        <input
                                            type="text"
                                            value={tc.name}
                                            onChange={(e) => updateTestCase(tc.id, { name: e.target.value })}
                                            placeholder="Test Name"
                                            className="w-full bg-transparent border-none p-0 text-xs font-bold text-foreground focus:ring-0 placeholder-zinc-600"
                                        />
                                    </div>

                                    {/* Assertion Type */}
                                    <div className="md:col-span-3">
                                        <select
                                            value={tc.type}
                                            onChange={(e) => updateTestCase(tc.id, { type: e.target.value as AssertionType })}
                                            className="w-full bg-surfaceLight border border-white/5 rounded-lg px-2 py-1.5 text-[11px] text-foreground focus:ring-1 focus:ring-primary outline-none"
                                        >
                                            {ASSERTION_TYPES.map((opt) => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Property/Target (Conditional) */}
                                    {(tc.type === 'json_body' || tc.type === 'header') && (
                                        <div className="md:col-span-3">
                                            <input
                                                type="text"
                                                value={tc.property || ''}
                                                onChange={(e) => updateTestCase(tc.id, { property: e.target.value })}
                                                placeholder={tc.type === 'json_body' ? 'JSONPath ($.id)' : 'Header Name'}
                                                className="w-full bg-surfaceLight border border-white/5 rounded-lg px-2 py-1.5 text-[11px] text-foreground focus:ring-1 focus:ring-primary outline-none placeholder-zinc-700 font-mono"
                                            />
                                        </div>
                                    )}

                                    {/* Operator */}
                                    <div className={tc.type === 'json_body' || tc.type === 'header' ? 'md:col-span-2' : 'md:col-span-3'}>
                                        <select
                                            value={tc.operator}
                                            onChange={(e) => updateTestCase(tc.id, { operator: e.target.value as AssertionOperator })}
                                            className="w-full bg-surfaceLight border border-white/5 rounded-lg px-2 py-1.5 text-[11px] text-foreground focus:ring-1 focus:ring-primary outline-none"
                                        >
                                            {OPERATORS.filter(op => {
                                                if (tc.type === 'status_code' || tc.type === 'response_time') {
                                                    return ['equals', 'not_equals', 'greater_than', 'less_than'].includes(op.value);
                                                }
                                                if (op.value === 'exists' || op.value === 'not_exists') {
                                                    return tc.type === 'json_body' || tc.type === 'header';
                                                }
                                                return true;
                                            }).map((opt) => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Value */}
                                    {tc.operator !== 'exists' && tc.operator !== 'not_exists' && (
                                        <div className={tc.type === 'json_body' || tc.type === 'header' ? 'md:col-span-1' : 'md:col-span-3'}>
                                            <input
                                                type="text"
                                                value={tc.value || ''}
                                                onChange={(e) => updateTestCase(tc.id, { value: e.target.value })}
                                                placeholder="Value"
                                                className="w-full bg-surfaceLight border border-white/5 rounded-lg px-2 py-1.5 text-[11px] text-foreground focus:ring-1 focus:ring-primary outline-none placeholder-zinc-700"
                                            />
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={() => removeTestCase(tc.id)}
                                    className="p-1.5 text-textSecondary/40 hover:text-danger hover:bg-danger/10 rounded-lg transition-all"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default RequestTests;
