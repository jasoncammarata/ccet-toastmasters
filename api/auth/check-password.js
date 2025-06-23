const { sql } = require('@vercel/postgres');

module.exports = async (req, res) => {
  try {
    const result = await sql`
      SELECT 
        email, 
        name, 
        role,
        CASE WHEN password IS NOT NULL THEN 'Has password' ELSE 'NO PASSWORD' END as pwd_status,
        LEFT(password, 10) as pwd_preview
      FROM members 
      WHERE email = 'CCET_Admin'
    `;
    
    res.json({
      query: 'Direct Postgres query',
      result: result.rows[0] || 'User not found'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};