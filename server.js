const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
app.use(cors());

// Health check
app.get('/health', (req, res) => res.send('API Gateway is running'));

// Proxy definitions
const proxies = [
  { path: '/auth', target: process.env.USER_SERVICE_URL || 'http://user-service:5001' },
  { path: '/jobs', target: process.env.JOB_SERVICE_URL || 'http://job-service:5002', ws: true },
  { path: '/match', target: process.env.MATCHING_SERVICE_URL || 'http://matching-service:5003' },
  { path: '/availability', target: process.env.AVAILABILITY_SERVICE_URL || 'http://availability-service:5004' },
  { path: '/location', target: process.env.LOCATION_SERVICE_URL || 'http://location-service:5005' },
  { path: '/nearby', target: process.env.LOCATION_SERVICE_URL || 'http://location-service:5005' },
  { path: '/reviews', target: process.env.REPUTATION_SERVICE_URL || 'http://reputation-service:5006' },
];

// Explicitly define the WebSocket proxy for socket.io
const wsProxy = createProxyMiddleware({
  target: process.env.JOB_SERVICE_URL || 'http://job-service:5002',
  changeOrigin: true,
  ws: true,
  logLevel: 'debug'
});

app.use('/socket.io', wsProxy);

proxies.forEach(p => {
  app.use(p.path, createProxyMiddleware({
    target: p.target,
    changeOrigin: true,
    ws: p.ws || false,
    logLevel: 'debug',
    pathRewrite: (path, req) => {
      // Because app.use(path) strips the path, we use the original URL
      return req.originalUrl;
    }
  }));
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`API Gateway running on port ${PORT}`);
});

// CRITICAL: Attach the upgrade event for WebSockets to work!
server.on('upgrade', wsProxy.upgrade);
