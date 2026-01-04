import { useCallback, useRef, useEffect } from 'react';

export const useCodecSound = () => {
    const audioContextRef = useRef<AudioContext | null>(null);
    const isMutedRef = useRef(false);

    useEffect(() => {
        // Initialize AudioContext on first user interaction if needed, 
        // but here we just try to create it.
        // It might be suspended until user interaction.
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            audioContextRef.current = new AudioContextClass();
        }

        return () => {
            audioContextRef.current?.close();
        };
    }, []);

    const playTone = (freq: number, type: OscillatorType, duration: number, startTime = 0) => {
        if (!audioContextRef.current || isMutedRef.current) return;

        const ctx = audioContextRef.current;
        if (ctx.state === 'suspended') ctx.resume();

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

        gain.gain.setValueAtTime(0.1, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
    };

    const playTypeSound = useCallback(() => {
        // Random high pitch beep for typing
        // Frequency between 1200 and 2000 Hz for that "data" sound
        // Or specific notes for MGS style
        // MGS Codec text sound: High pitch square wave, rapid consistency
        if (Math.random() > 0.5) { // Increased frequency of sound events
            // Fixed frequency around 1500Hz for that retro "data" feel (matching call sound tonality)
            // Short duration for crispness
            playTone(1500, 'square', 0.03);
        }
    }, []);

    const playCallSound = useCallback(() => {
        if (isMutedRef.current) return;

        const audio = new Audio('/sounds/codec_call.mp3');
        audio.volume = 0.5; // Adjust volume as needed
        audio.play().catch(e => console.warn("Failed to play call sound:", e));
    }, []);

    const playOpenSound = useCallback(() => {
        if (isMutedRef.current) return;

        const audio = new Audio('/sounds/codec_open.mp3');
        audio.volume = 0.5;
        audio.play().catch(e => console.warn("Failed to play open sound:", e));
    }, []);

    const toggleMute = (mute: boolean) => {
        isMutedRef.current = mute;
    };

    return { playTypeSound, playCallSound, playOpenSound, toggleMute };
};
