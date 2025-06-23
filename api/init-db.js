const { sql } = require('@vercel/postgres');

module.exports = async (req, res) => {
  try {
    // Check connection and get users
    const result = await sql`SELECT id, email, name, role FROM members ORDER BY id`;
    
    res.json({
      connected: true,
      userCount: result.rows.length,
      users: result.rows,
      database: 'Postgres'
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ 
      connected: false,
      error: error.message,
      database: 'Error connecting to Postgres'
    });
  }
};