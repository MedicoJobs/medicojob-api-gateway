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
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
]);

const serviceUrls = {
  user: process.env.USER_SERVICE_URL || 'http://localhost:5001',
  job: process.env.JOB_SERVICE_URL || 'http://localhost:5002',
  matching: process.env.MATCHING_SERVICE_URL || 'http://localhost:5003',
  availability: process.env.AVAILABILITY_SERVICE_URL || 'http://localhost:5004',
  location: process.env.LOCATION_SERVICE_URL || 'http://localhost:5005',
  reputation: process.env.REPUTATION_SERVICE_URL || 'http://localhost:5006',
  course: process.env.COURSE_SERVICE_URL || 'http://localhost:5007',
  resume: process.env.RESUME_SERVICE_URL || 'http://localhost:5008',
};

const corsOptions = {
  origin: (origin, callback) => {
    const isLocalDevOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');

    if (!origin || allowedOrigins.has(origin) || isLocalDevOrigin) {
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
  { path: '/auth', target: serviceUrls.user },
  { path: '/jobs', target: serviceUrls.job, ws: true },
  { path: '/match', target: serviceUrls.matching },
  { path: '/availability', target: serviceUrls.availability },
  { path: '/location', target: serviceUrls.location },
  { path: '/nearby', target: serviceUrls.location },
  { path: '/reviews', target: serviceUrls.reputation },
  { path: '/courses', target: serviceUrls.course },
  { path: '/api/resume', target: serviceUrls.resume },
  { path: '/socket.io', target: serviceUrls.job, ws: true },
];

// Explicitly define the WebSocket proxy for socket.io
const wsProxy = createProxyMiddleware({
  target: serviceUrls.job,
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
