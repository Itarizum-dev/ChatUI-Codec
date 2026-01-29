/**
 * Built-in (Native) Tools - lightweight alternative to MCP tools
 * These tools run directly in the backend without MCP protocol overhead.
 */

import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

import { SkillCreator } from '../skills/skillCreator';

const execAsync = promisify(exec);

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

/**
 * write - Write file contents
 */
const writeTool: BuiltinTool = {
    name: 'write',
    description: 'Write content to a file. Creates the file if it does not exist, overwrites if it does.',
    parameters: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'The path to the file to write' },
            content: { type: 'string', description: 'The content to write to the file' }
        },
        required: ['path', 'content']
    },
    execute: async (args) => {
        const filePath = args.path as string;
        const content = args.content as string;
        if (!filePath || content === undefined) {
            return 'Error: path and content are required';
        }
        try {
            await fs.writeFile(filePath, content, 'utf-8');
            return `Successfully wrote ${content.length} characters to ${filePath}`;
        } catch (e: any) {
            return `Error writing file: ${e.message}`;
        }
    }
};

/**
 * append - Append to file
 */
const appendTool: BuiltinTool = {
    name: 'append',
    description: 'Append content to the end of a file. Creates the file if it does not exist.',
    parameters: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'The path to the file' },
            content: { type: 'string', description: 'The content to append' }
        },
        required: ['path', 'content']
    },
    execute: async (args) => {
        const filePath = args.path as string;
        const content = args.content as string;
        if (!filePath || content === undefined) {
            return 'Error: path and content are required';
        }
        try {
            await fs.appendFile(filePath, content, 'utf-8');
            return `Successfully appended ${content.length} characters to ${filePath}`;
        } catch (e: any) {
            return `Error appending to file: ${e.message}`;
        }
    }
};

/**
 * ls - List directory contents
 */
const lsTool: BuiltinTool = {
    name: 'ls',
    description: 'List the contents of a directory.',
    parameters: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'The path to the directory to list' }
        },
        required: ['path']
    },
    execute: async (args) => {
        const dirPath = args.path as string;
        if (!dirPath) {
            return 'Error: path is required';
        }
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            const result = entries.map(entry => {
                const type = entry.isDirectory() ? '[DIR]' : '[FILE]';
                return `${type} ${entry.name}`;
            }).join('\n');
            return result || '(empty directory)';
        } catch (e: any) {
            return `Error listing directory: ${e.message}`;
        }
    }
};

/**
 * mkdir - Create directory
 */
const mkdirTool: BuiltinTool = {
    name: 'mkdir',
    description: 'Create a directory (including parent directories if needed).',
    parameters: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'The path of the directory to create' }
        },
        required: ['path']
    },
    execute: async (args) => {
        const dirPath = args.path as string;
        if (!dirPath) {
            return 'Error: path is required';
        }
        try {
            await fs.mkdir(dirPath, { recursive: true });
            return `Successfully created directory: ${dirPath}`;
        } catch (e: any) {
            return `Error creating directory: ${e.message}`;
        }
    }
};

/**
 * stat - Get file/directory info
 */
const statTool: BuiltinTool = {
    name: 'stat',
    description: 'Get information about a file or directory (size, type, modification time).',
    parameters: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'The path to get info for' }
        },
        required: ['path']
    },
    execute: async (args) => {
        const filePath = args.path as string;
        if (!filePath) {
            return 'Error: path is required';
        }
        try {
            const stats = await fs.stat(filePath);
            const type = stats.isDirectory() ? 'directory' : 'file';
            return `Type: ${type}\nSize: ${stats.size} bytes\nModified: ${stats.mtime.toISOString()}\nCreated: ${stats.birthtime.toISOString()}`;
        } catch (e: any) {
            return `Error getting file info: ${e.message}`;
        }
    }
};

/**
 * exists - Check if file/directory exists
 */
const existsTool: BuiltinTool = {
    name: 'exists',
    description: 'Check if a file or directory exists.',
    parameters: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'The path to check' }
        },
        required: ['path']
    },
    execute: async (args) => {
        const filePath = args.path as string;
        if (!filePath) {
            return 'Error: path is required';
        }
        try {
            await fs.access(filePath);
            return `true - ${filePath} exists`;
        } catch {
            return `false - ${filePath} does not exist`;
        }
    }
};

/**
 * cp - Copy file
 */
const cpTool: BuiltinTool = {
    name: 'cp',
    description: 'Copy a file from source to destination.',
    parameters: {
        type: 'object',
        properties: {
            source: { type: 'string', description: 'The source file path' },
            destination: { type: 'string', description: 'The destination file path' }
        },
        required: ['source', 'destination']
    },
    execute: async (args) => {
        const src = args.source as string;
        const dest = args.destination as string;
        if (!src || !dest) {
            return 'Error: source and destination are required';
        }
        try {
            await fs.copyFile(src, dest);
            return `Successfully copied ${src} to ${dest}`;
        } catch (e: any) {
            return `Error copying file: ${e.message}`;
        }
    }
};

/**
 * gemini_ask - Ask Gemini CLI
 */
const geminiAskTool: BuiltinTool = {
    name: 'gemini_ask',
    description: 'Ask a question to Google Gemini via CLI. Use when you need Gemini\'s perspective, knowledge, or analysis.',
    parameters: {
        type: 'object',
        properties: {
            prompt: {
                type: 'string',
                description: 'The prompt/question to ask Gemini'
            },
            model: {
                type: 'string',
                description: 'Optional: Gemini model to use (e.g., gemini-2.5-flash). Defaults to CLI default.'
            }
        },
        required: ['prompt']
    },
    execute: async (args) => {
        const prompt = args.prompt as string;
        const model = args.model as string | undefined;

        if (!prompt) {
            return 'Error: prompt is required';
        }

        try {
            // Escape double quotes in the prompt
            const escapedPrompt = prompt.replace(/"/g, '\\"');

            // Build command
            let cmd = `gemini -p "${escapedPrompt}"`;
            if (model) {
                cmd += ` -m ${model}`;
            }

            console.log(`[gemini_ask] Executing: ${cmd.substring(0, 100)}...`);

            const { stdout, stderr } = await execAsync(cmd, {
                timeout: 120000, // 2 minute timeout
                maxBuffer: 10 * 1024 * 1024, // 10MB buffer
                env: { ...process.env, NO_COLOR: '1' } // Disable color codes
            });

            if (stderr && !stdout) {
                console.log(`[gemini_ask] stderr: ${stderr}`);
                return `Gemini CLI error: ${stderr}`;
            }

            const result = stdout.trim();
            console.log(`[gemini_ask] Response length: ${result.length} chars`);
            console.log(`[gemini_ask] ===== Full Response =====`);
            console.log(result);
            console.log(`[gemini_ask] ===== End Response =====`);
            return result;
        } catch (e: any) {
            console.error(`[gemini_ask] Error:`, e.message);
            return `Error calling Gemini CLI: ${e.message}`;
        }
    }
};

// Mutable array to hold tools
export const BUILTIN_TOOLS: BuiltinTool[] = [
    catTool,
    writeTool,
    appendTool,
    lsTool,
    mkdirTool,
    statTool,
    existsTool,
    cpTool,
    geminiAskTool
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

