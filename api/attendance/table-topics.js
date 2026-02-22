const db = require('../../lib/db');
const { verifyToken } = require('../../lib/auth');

module.exports = async (req, res) => {
  const meetingId = req.query?.meeting_id || req.body?.meeting_id || 
    new URL(req.url, `http://${req.headers.host}`).searchParams.get('meeting_id');

  if (!meetingId) {
    return res.status(400).json({ error: 'meeting_id is required' });
  }

  // Check if locked (past midnight on meeting date)
  const meeting = db.prepare('SELECT date FROM meetings WHERE id = ?').get(meetingId);
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found' });
  }

  const now = new Date();
  const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const meetingEnd = new Date(meeting.date + 'T23:59:59');
  const isLocked = estNow > meetingEnd;

  // POST - toggle table topics speaker
  if (req.method === 'POST') {
    const { member_id, guest_id } = req.body;

    if (!member_id && !guest_id) {
      return res.status(400).json({ error: 'member_id or guest_id is required' });
    }

    // Check if user is admin (admins can edit even when locked)
    const token = req.headers.authorization?.replace('Bearer ', '');
    const user = token ? verifyToken(token) : null;
    const isAdmin = user?.role === 'admin';

    if (isLocked && !isAdmin) {
      return res.status(403).json({ error: 'Table topics is locked for this meeting' });
    }

    // Verify the person is checked in
    let attendee;
    if (member_id) {
      attendee = db.prepare('SELECT id FROM attendance WHERE meeting_id = ? AND member_id = ?').get(meetingId, member_id);
    } else {
      attendee = db.prepare('SELECT id FROM attendance WHERE meeting_id = ? AND guest_id = ?').get(meetingId, guest_id);
    }

    if (!attendee) {
      return res.status(400).json({ error: 'Person is not checked in to this meeting' });
    }

    try {
      // Toggle: if exists, remove; if not, add
      let existing;
      if (member_id) {
        existing = db.prepare('SELECT id FROM table_topics_speakers WHERE meeting_id = ? AND member_id = ?').get(meetingId, member_id);
      } else {
        existing = db.prepare('SELECT id FROM table_topics_speakers WHERE meeting_id = ? AND guest_id = ?').get(meetingId, guest_id);
      }

      if (existing) {
        db.prepare('DELETE FROM table_topics_speakers WHERE id = ?').run(existing.id);
        return res.json({ success: true, action: 'removed' });
      } else {
        db.prepare(
          'INSERT INTO table_topics_speakers (meeting_id, member_id, guest_id) VALUES (?, ?, ?)'
        ).run(meetingId, member_id || null, guest_id || null);
        return res.json({ success: true, action: 'added' });
      }
    } catch (error) {
      console.error('Table topics toggle error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
