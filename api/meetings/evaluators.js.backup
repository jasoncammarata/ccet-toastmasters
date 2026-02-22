const db = require('../../lib/db');
const { authMiddleware } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // Allow anyone to view evaluators - no auth required
    const { meetingId } = req.query;

    if (!meetingId) {
      return res.status(400).json({ error: 'Meeting ID required' });
    }

    try {
      const evaluators = db.prepare(`
        SELECT
          s.id as speech_id,
          s.evaluator_id,
          m.name as evaluator_name
        FROM speeches s
        LEFT JOIN members m ON s.evaluator_id = m.id
        WHERE s.meeting_id = ?
        ORDER BY s.id
      `).all(meetingId);

      res.json(evaluators);
    } catch (error) {
      console.error('Get evaluators error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  else if (req.method === 'PUT' || req.method === 'DELETE') {
    // Require auth for modifying evaluators
    authMiddleware(async (req, res) => {
      if (req.method === 'PUT') {
        const { speechId, evaluatorId, evaluatorName } = req.body;

        if (!speechId) {
          return res.status(400).json({ error: 'Speech ID required' });
        }

        try {
          let actualEvaluatorId = evaluatorId;

          // If evaluatorName is provided instead of evaluatorId (for admin edits)
          if (!evaluatorId && evaluatorName) {
            const member = db.prepare('SELECT id FROM members WHERE name = ?').get(evaluatorName);
            if (member) {
              actualEvaluatorId = member.id;
            } else {
              // Create a temporary member entry for non-members
              const result = db.prepare(`
                INSERT INTO members (name, email, password, role)
                VALUES (?, ?, ?, ?)
              `).run(evaluatorName, `${evaluatorName.toLowerCase().replace(/\s+/g, '.')}@temp.com`, 'temp', 'guest');
              actualEvaluatorId = result.lastInsertRowid;
            }
          }

          db.prepare(`
            UPDATE speeches 
            SET evaluator_id = ? 
            WHERE id = ?
          `).run(actualEvaluatorId, speechId);

          res.json({ success: true, evaluatorId: actualEvaluatorId });
        } catch (error) {
          console.error('Update evaluator error:', error);
          res.status(500).json({ error: 'Internal server error' });
        }
      }
      else if (req.method === 'DELETE') {
        const { meetingId, slotNumber } = req.body;

        if (!meetingId || slotNumber === undefined) {
          return res.status(400).json({ error: 'Meeting ID and slot number required' });
        }

        try {
          // Get speeches for this meeting ordered by ID
          const speeches = db.prepare(`
            SELECT id FROM speeches 
            WHERE meeting_id = ? 
            ORDER BY id
          `).all(meetingId);

          if (speeches[slotNumber]) {
            db.prepare('UPDATE speeches SET evaluator_id = NULL WHERE id = ?').run(speeches[slotNumber].id);
            res.json({ success: true });
          } else {
            res.status(404).json({ error: 'Speech not found' });
          }
        } catch (error) {
          console.error('Delete evaluator error:', error);
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    })(req, res);
  }
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
