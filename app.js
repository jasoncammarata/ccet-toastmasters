const express = require('express');
const path = require('path');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Function to convert Vercel handlers to Express routes
function convertHandler(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('Handler error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

// API Routes
app.post('/api/auth/login', convertHandler(require('./api/auth/login')));
app.post('/api/auth/verify', convertHandler(require('./api/auth/verify')));
app.post('/api/auth/check-password', convertHandler(require('./api/auth/check-password')));

app.all('/api/meetings/index', convertHandler(require('./api/meetings/index')));
app.all('/api/meetings/roles', convertHandler(require('./api/meetings/roles')));
app.all('/api/meetings/speeches', convertHandler(require('./api/meetings/speeches')));
app.all('/api/meetings/evaluators', convertHandler(require('./api/meetings/evaluators')));

app.all('/api/members/index', convertHandler(require('./api/members/index')));
app.all('/api/members/:id', convertHandler(require('./api/members/[id]')));
app.all('/api/applications/index', convertHandler(require('./api/applications/index')));

// Catch all route - must be last
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`External access: http://104.236.244.80:${PORT}`);
});
