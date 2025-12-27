/**
 * Built-in (Native) Tools - lightweight alternative to MCP tools
 * These tools run directly in the backend without MCP protocol overhead.
 */

import fs from 'fs/promises';

export interface BuiltinTool {
    name: string;
    description: string;
    parameters: {
        type: 'object';
        properties: Record<string, { type: string; description: string }>;
        required: string[];
    };
    execute: (args: Record<string, unknown>) => Promise<string>;
}

/**
 * cat - Read file contents
 */
export const catTool: BuiltinTool = {
    name: 'cat',
    description: 'Read the contents of a file. Use this to read skill instruction files (SKILL.md).',
    parameters: {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'The path to the file to read'
            }
        },
        required: ['path']
    },
    execute: async (args) => {
        const filePath = args.path as string;
        if (!filePath) {
            return 'Error: path is required';
        }
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return content;
        } catch (e: any) {
            return `Error reading file: ${e.message}`;
        }
    }
};

// All available built-in tools
export const BUILTIN_TOOLS: BuiltinTool[] = [
    catTool
];

// Helper: Find a built-in tool by name
export function findBuiltinTool(name: string): BuiltinTool | undefined {
    return BUILTIN_TOOLS.find(t => t.name === name);
}
