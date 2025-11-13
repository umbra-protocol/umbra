import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { PublicKey } from '@solana/web3.js';
import { X402ZKMiddleware } from '@x402/zk-payments-sdk';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Rate limiting for public endpoints (prevent DoS)
const publicLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// Configuration
const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const VERIFIER_PROGRAM_ID = new PublicKey(
  process.env.VERIFIER_PROGRAM_ID || '11111111111111111111111111111111'
);

// Initialize ZK middleware
const zkMiddleware = new X402ZKMiddleware(SOLANA_RPC_URL, VERIFIER_PROGRAM_ID);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10kb' })); // Limit payload size
app.use(publicLimiter); // Apply rate limiting

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.socket.remoteAddress;
  console.log(`${timestamp} - ${ip} - ${req.method} ${req.path}`);
  next();
});

// Public routes (no payment required)
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'x402-zk-example-server',
    version: '0.1.0',
    zkVerificationEnabled: true,
  });
});

app.get('/', (req, res) => {
  res.json({
    message: 'x402 ZK Payment Server',
    endpoints: {
      free: {
        '/': 'This endpoint',
        '/health': 'Health check',
      },
      paid: {
        '/api/premium-data': 'Premium data (requires payment)',
        '/api/ai-service': 'AI service endpoint (requires payment)',
        '/api/expensive-computation': 'Expensive computation (requires payment)',
      },
    },
    payment: {
      method: 'ZK proof',
      network: 'Solana',
      privacy: 'Your payment amount and identity remain private',
    },
  });
});

// Protected routes (require ZK payment proof)
const paidRouter = express.Router();

// Apply ZK verification middleware to all routes in this router
paidRouter.use(zkMiddleware.middleware());

paidRouter.get('/premium-data', (req, res) => {
  console.log('Serving premium data to verified payer');
  res.json({
    data: {
      secret: 'This is premium data that requires payment',
      timestamp: Date.now(),
      exclusive: true,
      content: [
        'Advanced analytics',
        'Real-time market data',
        'Proprietary insights',
      ],
    },
    message: 'Payment verified via ZK proof - your privacy is preserved',
  });
});

paidRouter.post('/ai-service', (req, res) => {
  const { prompt } = req.body;

  console.log('AI service called with verified payment');

  // Simulate AI processing
  const response = {
    prompt,
    response: `AI response to: "${prompt}"`,
    tokensUsed: 150,
    model: 'gpt-4',
    processingTime: 234,
  };

  res.json({
    data: response,
    message: 'AI service completed - payment verified privately',
  });
});

paidRouter.post('/expensive-computation', (req, res) => {
  const { operation, parameters } = req.body;

  console.log('Expensive computation requested with verified payment');

  // Simulate computation
  const result = {
    operation,
    parameters,
    result: Math.random() * 1000,
    computeTime: 1250,
    resourcesUsed: {
      cpu: '2.5 cores',
      memory: '4GB',
      duration: '1.25s',
    },
  };

  res.json({
    data: result,
    message: 'Computation complete - paid privately via ZK proof',
  });
});

// Mount paid routes
app.use('/api', paidRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.path} not found`,
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// Start server
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('x402 ZK Payment Server');
  console.log('='.repeat(60));
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Solana RPC: ${SOLANA_RPC_URL}`);
  console.log(`Verifier Program: ${VERIFIER_PROGRAM_ID.toBase58()}`);
  console.log('='.repeat(60));
  console.log('Free endpoints:');
  console.log(`  GET  /`);
  console.log(`  GET  /health`);
  console.log('');
  console.log('Paid endpoints (require ZK proof):');
  console.log(`  GET  /api/premium-data`);
  console.log(`  POST /api/ai-service`);
  console.log(`  POST /api/expensive-computation`);
  console.log('='.repeat(60));
  console.log('Privacy-preserving payments powered by ZK-SNARKs');
  console.log('Your payment details remain completely private');
  console.log('='.repeat(60));
});
