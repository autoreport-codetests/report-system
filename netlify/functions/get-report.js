const path = require('path');

exports.handler = async function(event) {
    const { vin } = event.queryStringParameters || {};

    if (!vin) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'VIN parameter is required' })
        };
    }

    try {
        const sanitizedVin = vin.replace(/[^a-zA-Z0-9_-]/g, '');
        const reportPath = path.join(__dirname, 'reports', `${sanitizedVin}.js`);
        const reportData = require(reportPath);
        return {
            statusCode: 200,
            body: JSON.stringify(reportData)
        };
    } catch (err) {
        return {
            statusCode: 404,
            body: JSON.stringify({ error: 'Report not found' })
        };
    }
};
