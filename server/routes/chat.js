const express = require('express');
const router = express.Router();

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const SYSTEM_PROMPT = `You are the DealQuest game recommendation assistant. DealQuest helps users find video game deals from stores like Steam, Epic Games, GOG, PlayStation Store, and Xbox Store.

When a user describes their tastes, free time, or platforms, recommend 3-5 specific game titles. For each game, write one short line on why it fits. Only suggest games available on the platforms the user mentioned (if any). Use bullet points.

End every response with: "Search any of these on the Deals page to find current prices."

Keep replies under 200 words. Be conversational but brief.`;

router.post('/', async (req, res) => {
  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ message: 'messages array required' });
  }
  if (messages.length > 30) {
    return res.status(400).json({ message: 'conversation too long' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ message: 'Chatbot is not configured on the server' });
  }

  // Convert OpenAI-style {role:'user'|'assistant', content} to Gemini's contents[]
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: String(m.content || '').slice(0, 4000) }],
  }));

  try {
    const r = await fetch(
      `${API_BASE}/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      },
    );

    if (!r.ok) {
      const errText = await r.text();
      console.error('Gemini error:', r.status, errText);
      return res.status(502).json({ message: 'Upstream LLM error' });
    }

    const data = await r.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    if (!reply) {
      return res.status(502).json({ message: 'Empty response from LLM' });
    }
    res.json({ reply });
  } catch (err) {
    console.error('chat route crash:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
