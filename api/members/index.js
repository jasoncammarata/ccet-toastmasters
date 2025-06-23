const db = require('../../lib/db');
const bcrypt = require('bcryptjs');
const { authMiddleware } = require('../../lib/auth');

module.exports = authMiddleware(async (req, res) => {
  if (req.method === 'GET') {
    try {
      const members = await db.prepare(`
        SELECT id, name, email, role, joined_date 
        FROM members 
        ORDER BY name
      `).all();
      
      res.json(members);
    } catch (error) {
      console.error('Get members error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } 
  
  else if (req.method === 'POST') {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { name, email, password, role = 'member' } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password required' });
    }

    try {
      const hashedPassword = bcrypt.hashSync(password, 10);
      const result = await db.prepare(`
        INSERT INTO members (name, email, password, role) 
        VALUES (?, ?, ?, ?)
      `).run(name, email, hashedPassword, role);

      res.json({ 
        id: result.lastInsertRowid,
        name,
        email,
        role
      });
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed') || error.message.includes('duplicate key')) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      console.error('Create member error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } 
  
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
});