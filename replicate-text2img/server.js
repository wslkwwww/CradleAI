const express = require('express');
const cors = require('cors');
const config = require('./config');
const generateRouter = require('./routes/generate');

// Initialize express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/generate', generateRouter);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
    }
  });
});

// Start the server
app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});
