// Netlify function for explaining vehicle issues using Google Gemini
const fetch = require('node-fetch');

exports.handler = async function(event) {
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        const { part } = JSON.parse(event.body || '{}');
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            throw new Error('API key is not configured.');
        }

        const prompt = `Explain in simple terms what the automotive part "${part}" does, why it is important, and the risks of not addressing issues with it. Keep the explanation brief.`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [{ text: prompt }]
                    }
                ]
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            console.error('Gemini API Error:', errData);
            throw new Error('The AI service returned an error.');
        }

        const data = await response.json();
        const explanation = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

        return {
            statusCode: 200,
            body: JSON.stringify({ explanation: explanation.trim() })
        };
    } catch (error) {
        console.error('Error in serverless function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Sorry, we couldn't get an explanation at this time." })
        };
    }
};
