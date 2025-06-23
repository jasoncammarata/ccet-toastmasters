const db = require('../../lib/db');
const { authMiddleware } = require('../../lib/auth');

module.exports = authMiddleware(async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Application ID required' });
  }

  if (req.method === 'PUT') {
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status required' });
    }

    try {
      db.prepare(`
        UPDATE applications 
        SET status = ? 
        WHERE id = ?
      `).run(status, id);

      res.json({ success: true });
    } catch (error) {
      console.error('Update application error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } 
  
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
});