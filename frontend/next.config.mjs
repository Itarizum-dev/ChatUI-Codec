/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone', // Enable standalone output for Docker optimization
    eslint: {
        // Ignore ESLint errors during production build (warnings are non-critical)
        ignoreDuringBuilds: true,
    },
    async rewrites() {
        // For Docker: server-side rewrites need to use container name 'backend'
        // INTERNAL_API_URL is set in docker-compose for container-to-container communication
        // Falls back to localhost for local development
        const internalApiUrl = process.env.INTERNAL_API_URL || 'http://localhost:3001';
        return [
            {
                source: '/api/:path*',
                destination: `${internalApiUrl}/api/:path*`,
            },
        ];
    },
};

export default nextConfig;
