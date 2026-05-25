require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();

// Disable X-Powered-By header to avoid disclosing Express version
app.disable('x-powered-by');

const configuredOrigins = (process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  ...configuredOrigins,
  'http://medicojobs.online',
  'http://medicojob.com',
  'http://www.medicojobs.online',
  'http://www.medicojob.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
]);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked by policy for origin: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Health check
app.get('/health', (req, res) => res.send('API Gateway is running'));

// Proxy definitions
const proxies = [
  { path: '/auth', target: process.env.USER_SERVICE_URL || 'http://localhost:5001' },
  { path: '/jobs', target: process.env.JOB_SERVICE_URL || 'http://localhost:5002', ws: true },
  { path: '/match', target: process.env.MATCHING_SERVICE_URL || 'http://localhost:5003' },
  { path: '/availability', target: process.env.AVAILABILITY_SERVICE_URL || 'http://localhost:5004' },
  { path: '/location', target: process.env.LOCATION_SERVICE_URL || 'http://localhost:5005' },
  { path: '/nearby', target: process.env.LOCATION_SERVICE_URL || 'http://localhost:5005' },
  { path: '/reviews', target: process.env.REPUTATION_SERVICE_URL || 'http://localhost:5006' },
  { path: '/socket.io', target: process.env.JOB_SERVICE_URL || 'http://localhost:5002', ws: true },
];

// Explicitly define the WebSocket proxy for socket.io
const wsProxy = createProxyMiddleware({
  target: process.env.JOB_SERVICE_URL || 'http://localhost:5002',
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
