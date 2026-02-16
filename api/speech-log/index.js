const db = require('../../lib/db');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    try {
      const rows = db.prepare(`
        SELECT 
          s.id as speech_id,
          s.speech_title,
          s.speech_project,
          s.logged_in_pathways,
          s.speaker_id,
          m.name as speaker_name,
          mt.date as meeting_date
        FROM speeches s
        JOIN members m ON s.speaker_id = m.id
        JOIN meetings mt ON s.meeting_id = mt.id
        WHERE s.speaker_id IS NOT NULL
        ORDER BY m.name ASC, mt.date DESC
      `).all();

      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
