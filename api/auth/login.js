const bcrypt = require('bcryptjs');
const { generateToken } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email, password } = req.body;
  const emailLower = email ? email.toLowerCase() : '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    let user;
    
    // Check if we're using Postgres
    if (process.env.POSTGRES_URL) {
      const { sql } = require('@vercel/postgres');
      const result = await sql`SELECT * FROM members WHERE LOWER(email) = ${emailLower}`;
      user = result.rows[0];
    } else {
      // Fallback to SQLite
      const db = require('../../lib/db');
      user = await db.prepare('SELECT * FROM members WHERE LOWER(email) = ?').get(emailLower);
    }
    
    if (!user) {
      console.log('User not found:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    if (!user.password) {
      console.log('User has no password:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const validPassword = bcrypt.compareSync(password, user.password);
    if (!validPassword) {
      console.log('Invalid password for:', email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
