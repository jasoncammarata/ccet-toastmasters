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
          e.slot_number,
          e.member_id,
          m.name as user_name
        FROM evaluators e
        LEFT JOIN members m ON e.member_id = m.id
        WHERE e.meeting_id = ?
        ORDER BY e.slot_number
      `).all(meetingId);

      res.json(evaluators);
    } catch (error) {
      console.error('Get evaluators error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  else if (req.method === 'PUT' || req.method === 'POST') {
    // Require auth for adding/updating evaluators
    authMiddleware(async (req, res) => {
      const { meetingId, slotNumber, evaluatorId, evaluatorName } = req.body;

      if (!meetingId || slotNumber === undefined) {
        return res.status(400).json({ error: 'Meeting ID and slot number required' });
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

        // Check if slot already exists
        const existing = db.prepare(`
          SELECT id FROM evaluators 
          WHERE meeting_id = ? AND slot_number = ?
        `).get(meetingId, slotNumber);

        if (existing) {
          // Update existing slot
          db.prepare(`
            UPDATE evaluators
            SET member_id = ?
            WHERE meeting_id = ? AND slot_number = ?
          `).run(actualEvaluatorId, meetingId, slotNumber);
        } else {
          // Insert new slot
          db.prepare(`
            INSERT INTO evaluators (meeting_id, slot_number, member_id)
            VALUES (?, ?, ?)
          `).run(meetingId, slotNumber, actualEvaluatorId);
        }

        res.json({ success: true, evaluatorId: actualEvaluatorId });
      } catch (error) {
        console.error('Update evaluator error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    })(req, res);
  }
  else if (req.method === 'DELETE') {
    // Require auth for removing evaluators
    authMiddleware(async (req, res) => {
      const { meetingId, slotNumber } = req.body;

      if (!meetingId || slotNumber === undefined) {
        return res.status(400).json({ error: 'Meeting ID and slot number required' });
      }

      try {
        db.prepare(`
          DELETE FROM evaluators
          WHERE meeting_id = ? AND slot_number = ?
        `).run(meetingId, slotNumber);

        res.json({ success: true });
      } catch (error) {
        console.error('Delete evaluator error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    })(req, res);
  }
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
