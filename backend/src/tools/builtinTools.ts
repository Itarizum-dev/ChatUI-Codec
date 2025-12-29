/**
 * Built-in (Native) Tools - lightweight alternative to MCP tools
 * These tools run directly in the backend without MCP protocol overhead.
 */

import fs from 'fs/promises';

import { SkillCreator } from '../skills/skillCreator';

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
const catTool: BuiltinTool = {
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

// Mutable array to hold tools
export const BUILTIN_TOOLS: BuiltinTool[] = [
    catTool
];

// Helper: Find a built-in tool by name
export function findBuiltinTool(name: string): BuiltinTool | undefined {
    return BUILTIN_TOOLS.find(t => t.name === name);
}

// Register SkillCreator related tools
export function registerSkillCreator(skillCreator: SkillCreator) {
    const createSkillTool: BuiltinTool = {
        name: 'create_skill',
        description: 'Create a new Agent Skill. This generates the directory structure and a template SKILL.md file.',
        parameters: {
            type: 'object',
            properties: {
                name: {
                    type: 'string',
                    description: 'The name of the skill (kebab-case, e.g., "stock-analysis")'
                },
                description: {
                    type: 'string',
                    description: 'A description of what the skill does and when to use it'
                }
            },
            required: ['name', 'description']
        },
        execute: async (args) => {
            const name = args.name as string;
            const description = args.description as string;

            if (!name || !description) {
                return 'Error: name and description are required';
            }

            try {
                const result = await skillCreator.initSkill(name, description);
                return `Skill created successfully at ${result.path}.\n\nPlease inform the user: "Created skill '${result.name}'. You can now edit ${result.path}/SKILL.md to add specific instructions."`;
            } catch (e: any) {
                return `Error creating skill: ${e.message}`;
            }
        }
    };

    // Prevent duplicates
    if (!BUILTIN_TOOLS.find(t => t.name === 'create_skill')) {
        BUILTIN_TOOLS.push(createSkillTool);
    }
}

