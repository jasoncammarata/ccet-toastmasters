const db = require('../../lib/db');
const { authMiddleware } = require('../../lib/auth');
const bcrypt = require('bcryptjs');

module.exports = authMiddleware(async (req, res) => {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Member ID required' });
  }

  if (req.method === 'DELETE') {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    try {
      db.prepare('DELETE FROM members WHERE id = ?').run(id);
      res.json({ success: true });
    } catch (error) {
      console.error('Delete member error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } 
  
  else if (req.method === 'PUT') {
    if (req.user.role !== 'admin' && req.user.id !== parseInt(id)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const { name, email, role, password } = req.body;

    try {
      const updates = [];
      const values = [];

      if (name) {
        updates.push('name = ?');
        values.push(name);
      }
      if (email) {
        updates.push('email = ?');
        values.push(email);
      }
      if (password) {
        const bcrypt = require('bcryptjs');
        const hashedPassword = bcrypt.hashSync(password, 10);
        updates.push('password = ?');
        values.push(hashedPassword);
      }
      if (role && req.user.role === 'admin') {
        updates.push('role = ?');
        values.push(role);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }

      values.push(id);
      db.prepare(`
        UPDATE members 
        SET ${updates.join(', ')} 
        WHERE id = ?
      `).run(...values);

      res.json({ success: true });
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Email already exists' });
      }
      console.error('Update member error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } 
  
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
});
