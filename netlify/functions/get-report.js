const fs = require('fs');
const path = require('path');

exports.handler = async function(event) {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const vin = event.queryStringParameters && event.queryStringParameters.vin;
  if (!vin) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'VIN parameter is required' }),
    };
  }

  const reportPath = path.join(__dirname, 'reports', `${vin}.json`);

  try {
    const data = await fs.promises.readFile(reportPath, 'utf8');
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: data,
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Report not found' }),
      };
    }

    console.error('Error reading report:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
