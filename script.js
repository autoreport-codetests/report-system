// This code runs after the entire HTML page has loaded.
document.addEventListener('DOMContentLoaded', () => {
    // 1. Find the report file name from the URL.
    // Example: for "....com/?report=vin123", it gets "vin123".
    const urlParams = new URLSearchParams(window.location.search);
    const reportFileName = urlParams.get('report');

    // If the URL doesn't have "?report=...", show an error.
    if (!reportFileName) {
        document.body.innerHTML = '<div class="container"><h1>Error: Report Not Found</h1><p>Please check the link and try again. A valid report ID is required.</p></div>';
        return;
    }

    // 2. Dynamically create a <script> tag to load the specific report data.
    // This is the magic that loads only the data for the current customer.
    const reportScriptTag = document.createElement('script');
    reportScriptTag.src = `./reports/${reportFileName}.js`;
    document.head.appendChild(reportScriptTag);

    // 3. Set up what happens once that report file is successfully loaded.
    reportScriptTag.onload = () => {
        // The 'reportData' variable is now available globally from the loaded file.
        if (typeof reportData !== 'undefined') {
            displayReport(reportData);
            getAndDisplayAISummary(reportData.items);
        } else {
            console.error("Report data object not found after script load.");
            document.body.innerHTML = '<h1>Error: Could not load report data.</h1>';
        }
    };

    // 4. Handle cases where the report file doesn't exist (e.g., typo in the link).
    reportScriptTag.onerror = () => {
        console.error(`Failed to load report file: ./reports/${reportFileName}.js`);
        document.body.innerHTML = '<div class="container"><h1>Error: Invalid Report ID</h1><p>The specified inspection report could not be found. Please verify the link.</p></div>';
    };
});

// This function takes the report data and builds the HTML to display it.
function displayReport(data) {
    document.getElementById('vehicle-info').textContent = data.vehicle;
    const container = document.getElementById('report-items-container');
    container.innerHTML = ''; // Clear any loading text.

    data.items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = `item ${item.status}`;

        let photoHtml = '';
        if (item.photoUrl) {
            photoHtml = `<div class="item-photo"><img src="${item.photoUrl}" alt="Photo for ${item.name}" loading="lazy"></div>`;
        }

        itemDiv.innerHTML = `
            <div class="item-header">
                <span>${item.name} <small>(${item.category})</small></span>
                <span class="item-status ${item.status}">${item.status}</span>
            </div>
            <p class="item-notes">${item.notes || 'No notes provided.'}</p>
            ${photoHtml}
        `;
        container.appendChild(itemDiv);
    });
}

// This function calls our secure serverless function to get the AI summary.
async function getAndDisplayAISummary(reportItems) {
    const summaryContainer = document.getElementById('ai-summary-content');
    try {
        const response = await fetch('/.netlify/functions/get-ai-summary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reportItems: reportItems })
        });

        if (!response.ok) {
            throw new Error(`The server responded with status: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }

        summaryContainer.classList.remove('loading-placeholder');
        summaryContainer.innerText = data.summary;

    } catch (error) {
        console.error('AI Summary Fetch Error:', error);
        summaryContainer.classList.remove('loading-placeholder');
        summaryContainer.innerText = 'We encountered an issue while generating the AI summary. The detailed report is available below.';
    }
}