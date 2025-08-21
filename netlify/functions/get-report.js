const fs = require('fs');
const path = require('path');

const baseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        ...baseHeaders,
        'Access-Control-Allow-Methods': 'GET,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: baseHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  const vin = event.queryStringParameters && event.queryStringParameters.vin;
  if (!vin) {
    return {
      statusCode: 400,
      headers: baseHeaders,
      body: JSON.stringify({ error: 'VIN parameter is required' }),
    };
  }

  const reportPath = path.join(__dirname, 'reports', `${vin}.json`);

  try {
    const data = await fs.promises.readFile(reportPath, 'utf8');
    return {
      statusCode: 200,
      headers: baseHeaders,
      body: data,
    };
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {
        statusCode: 404,
        headers: baseHeaders,
        body: JSON.stringify({ error: 'Report not found' }),
      };
    }

    console.error('Error reading report:', err);
    return {
      statusCode: 500,
      headers: baseHeaders,
      body: JSON.stringify({ error: 'Internal Server Error' }),
    };
  }
};
