import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { squadData, formationName, rating, chemistry } = req.body ?? {};

  if (!squadData || !formationName) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
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
      model: 'gemini-2.0-flash-lite',
      contents: prompt,
    });

    return res.status(200).json({ text: response.text ?? 'Unable to generate report.' });
  } catch (error: any) {
    const detail = error?.message ?? String(error);
    console.error('Gemini error:', detail);
    return res.status(500).json({ error: `Gemini error: ${detail}` });
  }
}
