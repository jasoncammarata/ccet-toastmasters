const db = require('../../lib/db');
const bcrypt = require('bcryptjs');
const { authMiddleware, verifyToken } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // Check if a valid token is attached (optional - GET works either way)
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = token ? verifyToken(token) : null;

    try {
      if (user) {
        // Authenticated: return full member info (existing behavior)
        const members = db.prepare(`
          SELECT id, name, email, role, joined_date, is_active
          FROM members
          ORDER BY name
        `).all();

        const includeGuests = req.query && req.query.include_guests === 'true';
        if (includeGuests) {
          const memberEmails = members.map(m => m.email.toLowerCase());
          const guests = db.prepare('SELECT id, name, email, phone, created_at FROM guests ORDER BY name').all();
          const uniqueGuests = guests.filter(g => !memberEmails.includes(g.email.toLowerCase()));
          return res.json({ members, guests: uniqueGuests });
        }
        return res.json(members);
      } else {
        // Public: return only id, name, is_active for active members.
        // Exclude the Admin system account from the public list (it should never appear in sign-up dropdowns).
        const members = db.prepare(`
          SELECT id, name, is_active
          FROM members
          WHERE is_active = 1 AND role != 'admin'
          ORDER BY name
        `).all();
        return res.json(members);
      }
    } catch (error) {
      console.error('Get members error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  else if (req.method === 'POST') {
    // POST still requires admin auth
    return authMiddleware(async (req, res) => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      const { name, email, password, role = 'member' } = req.body;
      if (!name || !email || !password) {
        return res.status(400).json({ error: 'Name, email, and password required' });
      }
      try {
        const hashedPassword = bcrypt.hashSync(password, 10);
        const result = db.prepare(`
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
    })(req, res);
  }
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
