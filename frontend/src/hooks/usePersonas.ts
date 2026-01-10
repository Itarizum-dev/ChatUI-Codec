/**
 * usePersonas Hook
 * ペルソナのCRUD操作とlocalStorage永続化を管理
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Persona } from '@/types';
import { PERSONAS as BUILTIN_PERSONAS } from '@/config/providers';

const STORAGE_KEY = 'codec_custom_personas';
const BUILTIN_PROMPTS_KEY = 'codec_builtin_prompts'; // ビルトインのプロンプト編集用
const DELETED_BUILTINS_KEY = 'codec_deleted_builtins'; // 削除されたビルトインID

interface UsePersonasReturn {
    personas: Persona[];
    addPersona: (persona: Omit<Persona, 'id' | 'isBuiltIn'>) => void;
    updatePersona: (id: string, updates: Partial<Persona>) => void;
    deletePersona: (id: string) => boolean;
    getPersona: (id: string) => Persona | undefined;
    resetBuiltinPrompt: (id: string) => void;
}

export function usePersonas(): UsePersonasReturn {
    const [customPersonas, setCustomPersonas] = useState<Persona[]>([]);
    const [builtinPrompts, setBuiltinPrompts] = useState<Record<string, string>>({});
    const [deletedBuiltinIds, setDeletedBuiltinIds] = useState<string[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        try {
            // Load custom personas
            const savedCustom = localStorage.getItem(STORAGE_KEY);
            let parsedCustom: Persona[] = savedCustom ? JSON.parse(savedCustom) : [];

            // Add default user persona if not exists
            const hasUser = parsedCustom.some(p => p.isUser);
            if (!hasUser) {
                const defaultUser: Persona = {
                    id: 'user-me',
                    name: 'ME',
                    codename: 'AGENT',
                    frequency: '140.00', // Dummy
                    systemPrompt: '',
                    isBuiltIn: false,
                    isUser: true,
                    portraitUrl: '/portraits/agent.png'
                };
                parsedCustom = [...parsedCustom, defaultUser];
                setCustomPersonas(parsedCustom);
                // Save immediately to ensure it exists
                localStorage.setItem(STORAGE_KEY, JSON.stringify(parsedCustom));
            } else {
                setCustomPersonas(parsedCustom);
            }

            // Load modified builtin prompts
            const savedPrompts = localStorage.getItem(BUILTIN_PROMPTS_KEY);
            if (savedPrompts) {
                setBuiltinPrompts(JSON.parse(savedPrompts));
            }
            // Load deleted builtins
            const savedDeleted = localStorage.getItem(DELETED_BUILTINS_KEY);
            if (savedDeleted) {
                setDeletedBuiltinIds(JSON.parse(savedDeleted));
            }
        } catch (e) {
            console.error('[usePersonas] Failed to load:', e);
        }
        setIsLoaded(true);
    }, []);

    // Save to localStorage when custom personas change
    useEffect(() => {
        if (!isLoaded) return;
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(customPersonas));
        } catch (e) {
            console.error('[usePersonas] Failed to save custom personas:', e);
        }
    }, [customPersonas, isLoaded]);

    // Save builtin prompts when they change
    useEffect(() => {
        if (!isLoaded) return;
        try {
            localStorage.setItem(BUILTIN_PROMPTS_KEY, JSON.stringify(builtinPrompts));
        } catch (e) {
            console.error('[usePersonas] Failed to save builtin prompts:', e);
        }
    }, [builtinPrompts, isLoaded]);

    // Save deleted builtins when they change
    useEffect(() => {
        if (!isLoaded) return;
        try {
            localStorage.setItem(DELETED_BUILTINS_KEY, JSON.stringify(deletedBuiltinIds));
        } catch (e) {
            console.error('[usePersonas] Failed to save deleted builtins:', e);
        }
    }, [deletedBuiltinIds, isLoaded]);

    // Merge builtin personas with custom ones
    const personas: Persona[] = [
        // Builtin personas with potentially modified system prompts
        ...BUILTIN_PERSONAS
            .filter(p => !deletedBuiltinIds.includes(p.id)) // Filter out deleted built-ins
            .map(p => ({
                ...p,
                systemPrompt: builtinPrompts[p.id] ?? p.systemPrompt,
            })),
        // Custom personas
        ...customPersonas,
    ];

    const addPersona = useCallback((personaData: Omit<Persona, 'id' | 'isBuiltIn'>) => {
        const newPersona: Persona = {
            ...personaData,
            id: `custom-${crypto.randomUUID()}`,
            isBuiltIn: false,
        };
        setCustomPersonas(prev => [...prev, newPersona]);
    }, []);

    const updatePersona = useCallback((id: string, updates: Partial<Persona>) => {
        // Check if it's a builtin persona
        const builtin = BUILTIN_PERSONAS.find(p => p.id === id);
        if (builtin) {
            // Only allow updating the system prompt for builtins
            if (updates.systemPrompt !== undefined) {
                setBuiltinPrompts(prev => ({
                    ...prev,
                    [id]: updates.systemPrompt!,
                }));
            }
            return;
        }

        // Update custom persona
        setCustomPersonas(prev =>
            prev.map(p => (p.id === id ? { ...p, ...updates } : p))
        );
    }, []);

    const deletePersona = useCallback((id: string): boolean => {
        // Check if it's a builtin persona
        const builtin = BUILTIN_PERSONAS.find(p => p.id === id);
        if (builtin) {
            // "System" persona cannot be deleted
            if (id === 'system') return false;

            setDeletedBuiltinIds(prev => [...prev, id]);
            return true;
        }

        setCustomPersonas(prev => prev.filter(p => p.id !== id));
        return true;
    }, []);

    const getPersona = useCallback((id: string): Persona | undefined => {
        return personas.find(p => p.id === id);
    }, [personas]);

    const resetBuiltinPrompt = useCallback((id: string) => {
        setBuiltinPrompts(prev => {
            const newPrompts = { ...prev };
            delete newPrompts[id];
            return newPrompts;
        });
    }, []);

    return {
        personas,
        addPersona,
        updatePersona,
        deletePersona,
        getPersona,
        resetBuiltinPrompt,
    };
}

/**
 * 画像ファイルをBase64に変換し、リサイズする
 */
export async function processImageFile(file: File, maxSize: number = 512): Promise<string> {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('File is not an image'));
            return;
        }

        if (file.size > 2 * 1024 * 1024) { // 2MB limit
            reject(new Error('Image file too large (max 2MB)'));
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Create canvas for resizing
                const canvas = document.createElement('canvas');
                canvas.width = maxSize;
                canvas.height = maxSize;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Failed to create canvas context'));
                    return;
                }

                // Draw image centered and cropped to square
                const size = Math.min(img.width, img.height);
                const sx = (img.width - size) / 2;
                const sy = (img.height - size) / 2;
                ctx.drawImage(img, sx, sy, size, size, 0, 0, maxSize, maxSize);

                // Convert to base64
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => reject(new Error('Failed to load image'));
            img.src = e.target?.result as string;
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}
