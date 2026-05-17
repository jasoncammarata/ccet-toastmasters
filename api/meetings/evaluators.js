const db = require('../../lib/db');
const { authMiddleware, verifyToken } = require('../../lib/auth');

// Helper to sync the evaluator into the matching speech (by slot position)
function syncEvaluatorToSpeech(meetingId, slotNumber, evaluatorId) {
  const speechIds = db.prepare(
    'SELECT id FROM speeches WHERE meeting_id = ? AND speaker_id IS NOT NULL ORDER BY id'
  ).all(meetingId);
  if (speechIds[slotNumber]) {
    db.prepare('UPDATE speeches SET evaluator_id = ? WHERE id = ?').run(evaluatorId, speechIds[slotNumber].id);
  }
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { meetingId } = req.query;
    if (!meetingId) return res.status(400).json({ error: 'Meeting ID required' });

    try {
      const evaluators = db.prepare(`
        SELECT e.slot_number, e.member_id, m.name as user_name
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
  else if (req.method === 'POST' || req.method === 'PUT') {
    const { meetingId, slotNumber, evaluatorId, evaluatorName, adminOverride } = req.body;

    if (!meetingId || slotNumber === undefined) {
      return res.status(400).json({ error: 'Meeting ID and slot number required' });
    }

    try {
      // Admin override path - requires valid admin token
      if (adminOverride === true) {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Admin override requires authentication' });
        const adminUser = verifyToken(token);
        if (!adminUser || adminUser.role !== 'admin') {
          return res.status(401).json({ error: 'Admin privileges required for override' });
        }

        let actualEvaluatorId = evaluatorId;
        if (!evaluatorId && evaluatorName) {
          const member = db.prepare('SELECT id FROM members WHERE name = ?').get(evaluatorName);
          if (member) {
            actualEvaluatorId = member.id;
          } else {
            const result = db.prepare(`INSERT INTO members (name, email, password, role) VALUES (?, ?, ?, ?)`)
              .run(evaluatorName, `${evaluatorName.toLowerCase().replace(/\s+/g, '.')}@temp.com`, 'temp', 'guest');
            actualEvaluatorId = result.lastInsertRowid;
          }
        }

        console.log(`[ADMIN OVERRIDE] Admin ${adminUser.email} (id=${adminUser.id}) assigned evaluator slot ${slotNumber} for meeting ${meetingId}, evaluatorId=${actualEvaluatorId} at ${new Date().toISOString()}`);

        const existing = db.prepare(`SELECT id FROM evaluators WHERE meeting_id = ? AND slot_number = ?`).get(meetingId, slotNumber);
        if (existing) {
          db.prepare(`UPDATE evaluators SET member_id = ? WHERE meeting_id = ? AND slot_number = ?`)
            .run(actualEvaluatorId, meetingId, slotNumber);
        } else {
          db.prepare(`INSERT INTO evaluators (meeting_id, slot_number, member_id) VALUES (?, ?, ?)`)
            .run(meetingId, slotNumber, actualEvaluatorId);
        }
        syncEvaluatorToSpeech(meetingId, slotNumber, actualEvaluatorId);
        return res.json({ success: true, evaluatorId: actualEvaluatorId });
      }

      // Member sign-up path - first come, first served
      if (!evaluatorId) {
        return res.status(400).json({ error: 'Evaluator ID required for sign-up' });
      }

      // Slot must be empty for member sign-up
      const existing = db.prepare(`SELECT id, member_id FROM evaluators WHERE meeting_id = ? AND slot_number = ?`).get(meetingId, slotNumber);
      if (existing && existing.member_id) {
        return res.status(409).json({ error: 'This evaluator slot is already filled. Please contact an officer if you need to make a change.' });
      }

      // Toastmasters rule: a speaker cannot evaluate their own speech.
      // Evaluators are paired with speeches by slot position - speech N is evaluated by evaluator N.
      const speeches = db.prepare('SELECT id, speaker_id FROM speeches WHERE meeting_id = ? AND speaker_id IS NOT NULL ORDER BY id').all(meetingId);
      if (speeches[slotNumber] && speeches[slotNumber].speaker_id === evaluatorId) {
        return res.status(409).json({ error: 'A speaker cannot evaluate their own speech. Please choose a different evaluator slot.' });
      }

      if (existing) {
        db.prepare(`UPDATE evaluators SET member_id = ? WHERE meeting_id = ? AND slot_number = ?`)
          .run(evaluatorId, meetingId, slotNumber);
      } else {
        db.prepare(`INSERT INTO evaluators (meeting_id, slot_number, member_id) VALUES (?, ?, ?)`)
          .run(meetingId, slotNumber, evaluatorId);
      }
      syncEvaluatorToSpeech(meetingId, slotNumber, evaluatorId);
      return res.json({ success: true, evaluatorId });

    } catch (error) {
      console.error('Update evaluator error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  else if (req.method === 'DELETE') {
    authMiddleware(async (req, res) => {
      const { meetingId, slotNumber } = req.body;
      if (!meetingId || slotNumber === undefined) {
        return res.status(400).json({ error: 'Meeting ID and slot number required' });
      }
      try {
        db.prepare(`DELETE FROM evaluators WHERE meeting_id = ? AND slot_number = ?`).run(meetingId, slotNumber);
        // Clear evaluator from matching speech by slot position
        const speechIds = db.prepare(
          'SELECT id FROM speeches WHERE meeting_id = ? AND speaker_id IS NOT NULL ORDER BY id'
        ).all(meetingId);
        if (speechIds[slotNumber]) {
          db.prepare('UPDATE speeches SET evaluator_id = NULL WHERE id = ?').run(speechIds[slotNumber].id);
        }
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
