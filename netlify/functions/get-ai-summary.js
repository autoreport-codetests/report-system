// This function runs on Netlify's servers, not in the user's browser.
exports.handler = async function(event) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { reportItems } = JSON.parse(event.body);
        const apiKey = process.env.OPENAI_API_KEY;

        // Filter for only items that need attention to save tokens and cost.
        const itemsForAI = reportItems.filter(item => item.status === 'caution' || item.status === 'repair');
        
        // If there are no items needing attention, return a simple message.
        if (itemsForAI.length === 0) {
            return {
                statusCode: 200,
                body: JSON.stringify({ summary: "Excellent news! Our detailed inspection found no items that require immediate attention or repair. The vehicle is in great condition based on our checklist." })
            };
        }

        // Create a clean, text-based version of the report for the AI.
        const reportText = itemsForAI
            .map(item => `- Item: ${item.name} (in ${item.category})\n  - Status: ${item.status}\n  - Notes: ${item.notes}`)
            .join("\n\n");

        // This is the "prompt" you send to the AI. It gives it context and instructions.
        const prompt = `
            You are an expert auto mechanic who is excellent at communicating with customers who don't know about cars.
            Your tone should be professional, reassuring, and clear.
            Based *only* on the following inspection items, write a summary for the vehicle owner.
            - Start with the most critical items first (anything marked 'repair').
            - Group related items if it makes sense (e.g., both front and rear brakes).
            - Explain the 'why' behind the recommendation in simple terms.
            - Do not use technical jargon. For example, instead of 'brake pads are at 2mm', say 'the brake pads are very thin and need to be replaced for safety'.
            - Conclude with a reassuring statement about next steps.
            - Do not mention anything not present in the list of items.

            Here are the items that need attention:
            ${reportText}
        `;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }],
                max_tokens: 300, // A reasonable limit for a summary
                temperature: 0.5 // A little creative but still factual
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('OpenAI API Error:', errorData);
            throw new Error('The AI service returned an error.');
        }

        const data = await response.json();
        const summary = data.choices[0].message.content;

        return {
            statusCode: 200,
            body: JSON.stringify({ summary: summary.trim() })
        };

    } catch (error) {
        console.error('Error in serverless function:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Sorry, we couldn't generate the AI summary at this time." })
        };
    }
};