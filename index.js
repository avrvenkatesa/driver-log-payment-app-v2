const express = require('express');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Replit keep-alive (prevents sleeping in development)
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    console.log('🔄 Replit keep-alive ping -', new Date().toLocaleTimeString());
  }, 10 * 60 * 1000); // Every 10 minutes
}

// Basic middleware
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    message: '🚗 Driver Log App Server is running!', 
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    status: 'healthy'
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚗 Driver Log & Payment App running on port ${PORT}`);
  console.log(`📱 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
});