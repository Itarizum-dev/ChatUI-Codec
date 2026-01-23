/**
 * Next.js Route Handler for Chat API
 * 
 * This proxies requests to the backend while properly handling SSE streaming.
 * Using Route Handler instead of Next.js rewrites allows proper SSE support
 * through ngrok and other reverse proxies.
 */

import { NextRequest } from 'next/server';

// Backend URL for internal communication
const INTERNAL_API_URL = process.env.INTERNAL_API_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Forward request to backend
        const backendResponse = await fetch(`${INTERNAL_API_URL}/api/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!backendResponse.ok) {
            const errorText = await backendResponse.text();
            return new Response(JSON.stringify({ error: errorText }), {
                status: backendResponse.status,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        if (!backendResponse.body) {
            return new Response(JSON.stringify({ error: 'No response body' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // Create a TransformStream to pass through the SSE data
        const { readable, writable } = new TransformStream();

        // Pipe the backend response to the client
        backendResponse.body.pipeTo(writable);

        // Return streaming response with proper headers
        return new Response(readable, {
            status: 200,
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache, no-transform',
                'Connection': 'keep-alive',
                'X-Accel-Buffering': 'no', // Disable proxy buffering
            },
        });

    } catch (error) {
        console.error('[Route Handler] Chat API error:', error);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        );
    }
}
