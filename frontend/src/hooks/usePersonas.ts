/**
 * usePersonas Hook
 * ペルソナのCRUD操作とlocalStorage永続化を管理
 * ファイルベースのペルソナ(public/data/personas.json)と
 * ローカルストレージベースのカスタムペルソナを統合する
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Persona } from '@/types';

const STORAGE_KEY = 'codec_custom_personas';
const BUILTIN_PROMPTS_KEY = 'codec_builtin_prompts'; // ビルトインのプロンプト編集用
const DELETED_BUILTINS_KEY = 'codec_deleted_builtins'; // 削除されたビルトインID

// SYSTEMペルソナは常に存在するハードコードされた定義
const SYSTEM_PERSONA: Persona = {
    id: 'system',
    name: 'AI Assistant',
    codename: 'SYSTEM',
    frequency: '000.00',
    systemPrompt: '', // 空のシステムプロンプト = 素のAI
    portraitUrl: '',
    isBuiltIn: true,
};

interface UsePersonasReturn {
    personas: Persona[];
    addPersona: (persona: Omit<Persona, 'id' | 'isBuiltIn'>) => void;
    updatePersona: (id: string, updates: Partial<Persona>) => void;
    deletePersona: (id: string) => boolean;
    getPersona: (id: string) => Persona | undefined;
    resetBuiltinPrompt: (id: string) => void;
    isLoading: boolean;
}

export function usePersonas(): UsePersonasReturn {
    const [filePersonas, setFilePersonas] = useState<Persona[]>([]);
    const [customPersonas, setCustomPersonas] = useState<Persona[]>([]);
    const [builtinPrompts, setBuiltinPrompts] = useState<Record<string, string>>({});
    const [deletedBuiltinIds, setDeletedBuiltinIds] = useState<string[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(true);

    // Initial Data Load
    useEffect(() => {
        const loadData = async () => {
            try {
                // 1. Load File Personas (Async)
                // まずユーザー独自のペルソナ定義(personas.json)の取得を試みる
                // 失敗した場合はサンプル(personas.sample.json)ではなく、空リストとする（ユーザー要望）
                let loadedFilePersonas: Persona[] = [];
                try {
                    const res = await fetch('/data/personas.json');
                    if (res.ok) {
                        loadedFilePersonas = await res.json();
                    } else {
                        console.log('[usePersonas] personas.json not found, using minimal setup.');
                    }
                } catch (e) {
                    console.warn('[usePersonas] Failed to fetch personas.json:', e);
                }
                setFilePersonas(loadedFilePersonas);

                // 2. Load LocalStorage Data
                // Custom Personas
                const savedCustom = localStorage.getItem(STORAGE_KEY);
                let parsedCustom: Persona[] = savedCustom ? JSON.parse(savedCustom) : [];

                // Add default user persona if not exists anywhere (neither in file nor custom)
                // ファイルまたはカスタムストレージに isUser なペルソナが存在するかチェック
                const hasUserInFile = loadedFilePersonas.some(p => p.isUser);
                const hasUserInCustom = parsedCustom.some(p => p.isUser);

                if (!hasUserInFile && !hasUserInCustom) {
                    const defaultUser: Persona = {
                        id: 'user-me',
                        name: 'ME',
                        codename: 'AGENT',
                        frequency: '140.00',
                        systemPrompt: '',
                        isBuiltIn: false,
                        isUser: true, // User flag
                        portraitUrl: '/portraits/agent.png'
                    };
                    parsedCustom = [...parsedCustom, defaultUser];
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(parsedCustom));
                }
                setCustomPersonas(parsedCustom);

                // Builtin Prompts
                const savedPrompts = localStorage.getItem(BUILTIN_PROMPTS_KEY);
                if (savedPrompts) {
                    setBuiltinPrompts(JSON.parse(savedPrompts));
                }

                // Deleted Builtins
                const savedDeleted = localStorage.getItem(DELETED_BUILTINS_KEY);
                if (savedDeleted) {
                    setDeletedBuiltinIds(JSON.parse(savedDeleted));
                }

            } catch (e) {
                console.error('[usePersonas] Critical error during initialization:', e);
            } finally {
                setIsLoaded(true);
                setIsLoadingData(false);
            }
        };

        loadData();
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

    // Construct final persona list
    // Priority: SYSTEM > FileBased (overridden by deleted/prompts) > Custom
    const personas: Persona[] = [
        // SYSTEM (Always present, essentially a builtin)
        {
            ...SYSTEM_PERSONA,
            systemPrompt: builtinPrompts[SYSTEM_PERSONA.id] ?? SYSTEM_PERSONA.systemPrompt
        },

        // File-based personas (treated as builtin)
        ...filePersonas
            .filter(p => !deletedBuiltinIds.includes(p.id))
            .filter(p => p.id !== 'system') // Prevent ID collision if JSON contains system
            .map(p => ({
                ...p,
                isBuiltIn: true, // Force built-in flag for file-loaded personas
                systemPrompt: builtinPrompts[p.id] ?? p.systemPrompt,
            })),

        // Custom personas (localStorage)
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
        // SYSTEM or File Persons are "built-in" context
        const isSystem = id === SYSTEM_PERSONA.id;
        const isFilePersona = filePersonas.some(p => p.id === id);

        if (isSystem || isFilePersona) {
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
    }, [filePersonas]);

    const deletePersona = useCallback((id: string): boolean => {
        // SYSTEM or File Persons are "built-in" context
        const isSystem = id === SYSTEM_PERSONA.id;
        const isFilePersona = filePersonas.some(p => p.id === id);

        if (isSystem || isFilePersona) {
            // "System" persona cannot be deleted
            if (isSystem) return false;

            setDeletedBuiltinIds(prev => [...prev, id]);
            return true;
        }

        setCustomPersonas(prev => prev.filter(p => p.id !== id));
        return true;
    }, [filePersonas]);

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
        isLoading: isLoadingData,
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
