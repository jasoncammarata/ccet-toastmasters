const db = require('../../lib/db');
const { authMiddleware } = require('../../lib/auth');

function handleGet(req, res) {
  try {
    const applications = db.prepare(`
      SELECT * FROM applications 
      ORDER BY submitted_date DESC
    `).all();
    
    res.json(applications);
  } catch (error) {
    console.error('Get applications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    return authMiddleware(handleGet)(req, res);
  } 
  
  else if (req.method === 'POST') {
    // Public endpoint - no auth required
    const { name, email, phone, reason } = req.body;

    if (!name || !email) {
      return res.status(400).json({ error: 'Name and email required' });
    }

    try {
      const result = db.prepare(`
        INSERT INTO applications (name, email, phone, reason) 
        VALUES (?, ?, ?, ?)
      `).run(name, email, phone || '', reason || '');

      res.json({ 
        id: result.lastInsertRowid,
        message: 'Application submitted successfully'
      });
    } catch (error) {
      console.error('Create application error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } 
  
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};