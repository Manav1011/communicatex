
const express = require('express');
const cors = require('cors');
const app = express();
// Use a dedicated port for the proxy so it doesn't conflict with Vite
const PORT = 4000;

// Enable CORS for the frontend
app.use(cors());

// Parse JSON bodies (increased limit for large payloads)
app.use(express.json({ limit: '50mb' }));

app.post('/proxy', async (req, res) => {
  try {
    const { url, method, headers, body } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    // Filter out forbidden headers that might confuse the upstream API
    const cleanHeaders = { ...headers };
    delete cleanHeaders['host'];
    delete cleanHeaders['content-length'];

    const startTime = performance.now();

    const fetchOptions = {
      method: method || 'GET',
      headers: cleanHeaders,
    };

    // Only attach body if method is not GET/HEAD
    if (method !== 'GET' && method !== 'HEAD' && body) {
      fetchOptions.body = typeof body === 'object' ? JSON.stringify(body) : body;
    }

    // Execute the request server-side
    const response = await fetch(url, fetchOptions);
    
    const endTime = performance.now();
    const time = Math.round(endTime - startTime);
    
    // Parse response body
    const contentType = response.headers.get('content-type');
    let data;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Convert Headers object to plain object
    const responseHeaders = {};
    response.headers.forEach((val, key) => {
      responseHeaders[key] = val;
    });

    // Return standardized response wrapper
    res.json({
      statusCode: response.status,
      statusText: response.statusText,
      time: time,
      size: Number(response.headers.get('content-length')) || 0,
      headers: responseHeaders,
      data: data
    });

  } catch (error) {
    console.error('Proxy Error:', error);
    res.status(500).json({
      statusCode: 0,
      statusText: 'Proxy Error',
      time: 0,
      size: 0,
      headers: {},
      data: null,
      error: error.message || 'Unknown proxy error'
    });
  }
});

app.listen(PORT, () => {
  console.log(`CommunicateX Proxy Server running at http://localhost:${PORT}`);
});
