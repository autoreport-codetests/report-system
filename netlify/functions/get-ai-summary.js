// This is a Netlify serverless function.
// It acts as a secure bridge between your front-end app and the OpenAI API.

// We use the 'node-fetch' library because the standard 'fetch' is not available in this environment.
// You will need to add a 'package.json' file to your project to specify this dependency.
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    // Security: Only allow POST requests to this function.
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' }),
        };
    }

    try {
        const { prompt, sectionData } = JSON.parse(event.body);
        
        // Retrieve the secret API key securely from Netlify's environment variables.
        const apiKey = process.env.OPENAI_API_KEY;

        if (!apiKey) {
            throw new Error("API key is not configured.");
        }

        // Construct a detailed prompt for the AI, providing context.
        let fullPrompt = `You are a helpful automotive assistant. A user has a question about their vehicle inspection report.
        
        User's question: "${prompt}"
        
        Here is the relevant section data from the report for context:
        Title: ${sectionData ? sectionData.title : 'General Inquiry'}
        Content: ${sectionData ? sectionData.content.replace(/<[^>]*>?/gm, '') : 'No specific section data provided.'}
        
        Please provide a clear, concise, and helpful answer based on the user's question and the provided report data.`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo', // A cost-effective and fast model
                messages: [{ role: 'user', content: fullPrompt }],
                max_tokens: 150, // Limit the response length to control costs
                temperature: 0.7, // A balance of creative and factual
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('OpenAI API Error:', errorData);
            throw new Error('The AI service returned an error.');
        }

        const data = await response.json();
        const reply = data.choices[0].message.content;

        return {
            statusCode: 200,
            body: JSON.stringify({ reply: reply.trim() }),
        };

    } catch (error) {
        console.error('Error in serverless function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Sorry, we couldn't get a response from the assistant at this time." }),
        };
    }
};
