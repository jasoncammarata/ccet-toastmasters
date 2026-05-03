const db = require('../../lib/db');
const { verifyToken } = require('../../lib/auth');

module.exports = async (req, res) => {
  const meetingId = req.query?.meeting_id || req.body?.meeting_id || 
    new URL(req.url, `http://${req.headers.host}`).searchParams.get('meeting_id');

  if (!meetingId) {
    return res.status(400).json({ error: 'meeting_id is required' });
  }

  const meeting = db.prepare('SELECT date FROM meetings WHERE id = ?').get(meetingId);
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found' });
  }

  const now = new Date();
  const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const meetingEnd = new Date(meeting.date + 'T23:59:59');
  const isLocked = estNow > meetingEnd;

  // GET - fetch table topics speakers for a meeting
  if (req.method === 'GET') {
    try {
      const speakers = db.prepare(`
        SELECT tt.id, tt.member_id, tt.guest_id, tt.guest_name, tt.topic_summary,
          CASE
            WHEN tt.member_id IS NOT NULL THEN m.name
            WHEN tt.guest_id IS NOT NULL THEN g.name
            WHEN tt.guest_name IS NOT NULL THEN tt.guest_name
          END as name
        FROM table_topics_speakers tt
        LEFT JOIN members m ON tt.member_id = m.id
        LEFT JOIN guests g ON tt.guest_id = g.id
        WHERE tt.meeting_id = ?
        ORDER BY tt.id ASC
      `).all(meetingId);

      return res.json({ speakers, isLocked });
    } catch (error) {
      console.error('Get TT speakers error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST - add a table topics speaker (no auth required)
  if (req.method === 'POST') {
    const { member_id, guest_id, guest_name, topic_summary, action } = req.body;

    // Legacy toggle action (for backward compatibility)
    if (action === 'toggle' || (!guest_name && !topic_summary && (member_id || guest_id))) {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const user = token ? verifyToken(token) : null;
      const isAdmin = user?.role === 'admin';

      if (isLocked && !isAdmin) {
        return res.status(403).json({ error: 'Table topics is locked for this meeting' });
      }

      try {
        let existing;
        if (member_id) {
          existing = db.prepare('SELECT id FROM table_topics_speakers WHERE meeting_id = ? AND member_id = ?').get(meetingId, member_id);
        } else if (guest_id) {
          existing = db.prepare('SELECT id FROM table_topics_speakers WHERE meeting_id = ? AND guest_id = ?').get(meetingId, guest_id);
        }

        if (existing) {
          db.prepare('DELETE FROM table_topics_speakers WHERE id = ?').run(existing.id);
          return res.json({ success: true, action: 'removed' });
        } else {
          db.prepare('INSERT INTO table_topics_speakers (meeting_id, member_id, guest_id) VALUES (?, ?, ?)').run(meetingId, member_id || null, guest_id || null);
          return res.json({ success: true, action: 'added' });
        }
      } catch (error) {
        console.error('TT toggle error:', error);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }

    // New add speaker action (no auth required)
    if (!member_id && !guest_name) {
      return res.status(400).json({ error: 'Either select a member or enter a guest name' });
    }

    try {
      if (member_id) {
        // Check for duplicate member
        const existing = db.prepare('SELECT id FROM table_topics_speakers WHERE meeting_id = ? AND member_id = ?').get(meetingId, member_id);
        if (existing) {
          // Update topic summary if it already exists
          db.prepare('UPDATE table_topics_speakers SET topic_summary = ? WHERE id = ?').run(topic_summary || null, existing.id);
          return res.json({ success: true, action: 'updated' });
        }
        db.prepare('INSERT INTO table_topics_speakers (meeting_id, member_id, topic_summary) VALUES (?, ?, ?)').run(meetingId, member_id, topic_summary || null);
      } else {
        db.prepare('INSERT INTO table_topics_speakers (meeting_id, guest_name, topic_summary) VALUES (?, ?, ?)').run(meetingId, guest_name, topic_summary || null);
      }
      return res.json({ success: true, action: 'added' });
    } catch (error) {
      console.error('Add TT speaker error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  // DELETE - remove a table topics speaker
  if (req.method === 'DELETE') {
    const { speaker_id } = req.body;
    if (!speaker_id) {
      return res.status(400).json({ error: 'speaker_id is required' });
    }

    try {
      db.prepare('DELETE FROM table_topics_speakers WHERE id = ? AND meeting_id = ?').run(speaker_id, meetingId);
      return res.json({ success: true });
    } catch (error) {
      console.error('Delete TT speaker error:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
