const db = require('../../lib/db');
const { authMiddleware } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // Allow anyone to view speeches - no auth required
    const { meetingId } = req.query;

    if (!meetingId) {
      return res.status(400).json({ error: 'Meeting ID required' });
    }

    try {
      const speeches = db.prepare(`
        SELECT
          s.id,
          s.meeting_id,
          s.speaker_id,
          s.speech_title,
          s.speech_project,
          s.evaluator_id,
          speaker.name as speaker_name,
          evaluator.name as evaluator_name
        FROM speeches s
        LEFT JOIN members speaker ON s.speaker_id = speaker.id
        LEFT JOIN members evaluator ON s.evaluator_id = evaluator.id
        WHERE s.meeting_id = ?
        ORDER BY s.id
      `).all(meetingId);

      res.json(speeches);
    } catch (error) {
      console.error('Get speeches error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    // Require auth for modifying speeches
    authMiddleware(async (req, res) => {
      if (req.method === 'POST') {
        const { meetingId, speakerId, speechTitle, speechProject, slotNumber, name } = req.body;

        if (!meetingId || (!speakerId && !name) || !speechTitle) {
          return res.status(400).json({ error: 'Meeting ID, speaker, and speech title required' });
        }

        try {
          let actualSpeakerId = speakerId;

          // If name is provided instead of speakerId (for admin edits)
          if (!speakerId && name) {
            const member = db.prepare('SELECT id FROM members WHERE name = ?').get(name);
            if (member) {
              actualSpeakerId = member.id;
            } else {
              // Create a temporary member entry for non-members
              const result = db.prepare(`
                INSERT INTO members (name, email, password, role)
                VALUES (?, ?, ?, ?)
              `).run(name, `${name.toLowerCase().replace(/\s+/g, '.')}@temp.com`, 'temp', 'guest');
              actualSpeakerId = result.lastInsertRowid;
            }
          }

          const result = db.prepare(`
            INSERT INTO speeches (meeting_id, speaker_id, speech_title, speech_project)
            VALUES (?, ?, ?, ?)
          `).run(meetingId, actualSpeakerId, speechTitle, speechProject || null);

          res.json({
            id: result.lastInsertRowid,
            meetingId,
            speakerId: actualSpeakerId,
            speechTitle,
            speechProject
          });
        } catch (error) {
          console.error('Create speech error:', error);
          res.status(500).json({ error: 'Internal server error' });
        }
      }
      
      else if (req.method === 'PUT') {
        const { meetingId, slotNumber, speechTitle, speechProject } = req.body;

        if (!meetingId || slotNumber === undefined || !speechTitle) {
          return res.status(400).json({ error: 'Meeting ID, slot number, and speech title required' });
        }

        try {
          // Get speeches for this meeting ordered by ID
          const speeches = db.prepare(`
            SELECT id FROM speeches
            WHERE meeting_id = ?
            ORDER BY id
          `).all(meetingId);

          if (speeches[slotNumber]) {
            db.prepare(`
              UPDATE speeches
              SET speech_title = ?, speech_project = ?
              WHERE id = ?
            `).run(speechTitle, speechProject || null, speeches[slotNumber].id);
            
            res.json({ success: true });
          } else {
            res.status(404).json({ error: 'Speech not found' });
          }
        } catch (error) {
          console.error('Update speech error:', error);
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
            db.prepare('DELETE FROM speeches WHERE id = ?').run(speeches[slotNumber].id);
            res.json({ success: true });
          } else {
            res.status(404).json({ error: 'Speech not found' });
          }
        } catch (error) {
          console.error('Delete speech error:', error);
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    })(req, res);
  }
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
