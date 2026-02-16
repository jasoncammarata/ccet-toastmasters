const db = require('../../lib/db');
const { verifyToken } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Login required' });
  }

  var token = authHeader.replace('Bearer ', '');
  var user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  var speechId = req.query.id;
  if (!speechId) {
    return res.status(400).json({ error: 'Speech ID required' });
  }

  try {
    var speech = db.prepare('SELECT speaker_id FROM speeches WHERE id = ?').get(speechId);

    if (!speech) {
      return res.status(404).json({ error: 'Speech not found' });
    }

    if (speech.speaker_id !== user.id && user.role !== 'admin') {
      return res.status(403).json({ error: 'You can only update your own speeches' });
    }

    var result = db.prepare(
      'UPDATE speeches SET logged_in_pathways = CASE WHEN logged_in_pathways = 1 THEN 0 ELSE 1 END WHERE id = ?'
    ).run(speechId);

    res.json({ success: true, changes: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
