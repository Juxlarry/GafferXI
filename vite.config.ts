import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import type { Plugin } from 'vite';

function devApiPlugin(apiKey: string): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/analyze', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        const chunks: string[] = [];
        req.on('data', (chunk: Buffer | string) =>
          chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'))
        );
        req.on('end', async () => {
          try {
            if (!apiKey) throw new Error('GEMINI_API_KEY is not set in .env.local');

            const { squadData, formationName, rating, chemistry } = JSON.parse(chunks.join(''));

            const { GoogleGenAI } = await import('@google/genai');
            const ai = new GoogleGenAI({ apiKey });

            const prompt = `Analyze this football squad for the 2026 World Cup.
Formation: ${formationName}
Starting XI: ${squadData}
Team Rating: ${rating}
Team Chemistry: ${chemistry}

Provide a concise 'Scout Report' in Markdown format with:
1. Tactical Overview (1-2 sentences)
2. Key Strength
3. Main Weakness
4. Recommendation

Keep it professional and encouraging.`;

            const response = await ai.models.generateContent({
              model: 'gemini-1.5-flash',
              contents: prompt,
            });

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ text: response.text ?? 'Unable to generate report.' }));
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[dev-api] Error:', message);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: message }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), devApiPlugin(env.GEMINI_API_KEY ?? '')],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
