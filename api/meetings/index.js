const db = require('../../lib/db');
const { authMiddleware } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // Allow anyone to view meetings - no auth required
    try {
      const meetings = db.prepare(`
        SELECT * FROM meetings
        ORDER BY date DESC
      `).all();
      res.json(meetings);
    } catch (error) {
      console.error('Get meetings error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  else if (req.method === 'POST') {
    // Require auth for creating meetings
    authMiddleware(async (req, res) => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      
      const { date, theme } = req.body;
      
      if (!date) {
        return res.status(400).json({ error: 'Date is required' });
      }
      
      try {
        const result = db.prepare(`
          INSERT INTO meetings (date, theme, status)
          VALUES (?, ?, 'scheduled')
        `).run(date, theme || '');
        
        res.json({
          id: result.lastInsertRowid,
          date,
          theme,
          status: 'scheduled'
        });
      } catch (error) {
        console.error('Create meeting error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    })(req, res);
  }
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
