const db = require('../../lib/db');
const { verifyToken } = require('../../lib/auth');

module.exports = async (req, res) => {
  // GET - fetch attendance for a meeting
  if (req.method === 'GET') {
    const meetingId = req.query?.meeting_id || new URL(req.url, `http://${req.headers.host}`).searchParams.get('meeting_id');

    if (!meetingId) {
      return res.status(400).json({ error: 'meeting_id is required' });
    }

    try {
      const attendance = db.prepare(`
        SELECT 
          a.id,
          a.meeting_id,
          a.member_id,
          a.guest_id,
          a.checked_in_at,
          CASE 
            WHEN a.member_id IS NOT NULL THEN m.name
            WHEN a.guest_id IS NOT NULL THEN g.name
          END as name,
          CASE 
            WHEN a.member_id IS NOT NULL THEN 'member'
            WHEN a.guest_id IS NOT NULL THEN 'guest'
          END as type,
          CASE 
            WHEN tt.id IS NOT NULL THEN 1
            ELSE 0
          END as is_table_topics_speaker
        FROM attendance a
        LEFT JOIN members m ON a.member_id = m.id
        LEFT JOIN guests g ON a.guest_id = g.id
        LEFT JOIN table_topics_speakers tt ON a.meeting_id = tt.meeting_id 
          AND (a.member_id = tt.member_id OR a.guest_id = tt.guest_id)
        WHERE a.meeting_id = ?
        ORDER BY a.checked_in_at ASC
      `).all(meetingId);

      // Check if table topics is locked (past midnight Eastern on meeting date)
      const meeting = db.prepare('SELECT date FROM meetings WHERE id = ?').get(meetingId);
      const now = new Date();
      const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const meetingEnd = new Date(meeting.date + 'T23:59:59');
      const isLocked = estNow > meetingEnd;

      // Only include guest contact info for admins
      const token = req.headers.authorization?.replace('Bearer ', '');
      const user = token ? verifyToken(token) : null;
      const isAdmin = user?.role === 'admin';

      if (isAdmin) {
        const guestIds = attendance.filter(a => a.guest_id).map(a => a.guest_id);
        if (guestIds.length > 0) {
          const guests = db.prepare(`
            SELECT id, email, phone FROM guests WHERE id IN (${guestIds.map(() => '?').join(',')})
          `).all(...guestIds);
          const guestMap = {};
          guests.forEach(g => { guestMap[g.id] = g; });
          attendance.forEach(a => {
            if (a.guest_id && guestMap[a.guest_id]) {
              a.email = guestMap[a.guest_id].email;
              a.phone = guestMap[a.guest_id].phone;
            }
          });
        }
      }

      res.json({ attendance, isLocked });
    } catch (error) {
      console.error('Get attendance error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST - check in to a meeting
  else if (req.method === 'POST') {
    const { meeting_id, guest_name, guest_email, guest_phone, admin_member_email } = req.body;
    if (!meeting_id) {
      return res.status(400).json({ error: 'meeting_id is required' });
    }

    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const user = token ? verifyToken(token) : null;

      // Admin checking in a member by email
      if (admin_member_email && user && user.role === 'admin') {
        const member = db.prepare('SELECT id, name FROM members WHERE email = ? COLLATE NOCASE').get(admin_member_email);
        if (!member) {
          return res.status(404).json({ error: 'Member not found with that email' });
        }
        const existing = db.prepare(
          'SELECT id FROM attendance WHERE meeting_id = ? AND member_id = ?'
        ).get(meeting_id, member.id);
        if (existing) {
          return res.status(400).json({ error: 'Member already checked in' });
        }
        db.prepare(
          'INSERT INTO attendance (meeting_id, member_id) VALUES (?, ?)'
        ).run(meeting_id, member.id);
        return res.json({ success: true, type: 'member', name: member.name });
      }

      // Member check-in
      if (user) {
        const existing = db.prepare(
          'SELECT id FROM attendance WHERE meeting_id = ? AND member_id = ?'
        ).get(meeting_id, user.id);

        if (existing) {
          return res.status(400).json({ error: 'Already checked in' });
        }

        db.prepare(
          'INSERT INTO attendance (meeting_id, member_id) VALUES (?, ?)'
        ).run(meeting_id, user.id);

        return res.json({ success: true, type: 'member', name: user.email });
      }

      // Guest check-in
      if (!guest_email) {
        return res.status(400).json({ error: 'Email is required for guest check-in' });
      }

      // Check for returning guest
      let guest = db.prepare('SELECT * FROM guests WHERE email = ?').get(guest_email);

      if (!guest) {
        // New guest
        if (!guest_name) {
          return res.status(400).json({ error: 'Name is required for new guests' });
        }
        const result = db.prepare(
          'INSERT INTO guests (name, email, phone) VALUES (?, ?, ?)'
        ).run(guest_name, guest_email, guest_phone || null);
        guest = { id: result.lastInsertRowid, name: guest_name };
      }

      // Check if already checked in
      const existing = db.prepare(
        'SELECT id FROM attendance WHERE meeting_id = ? AND guest_id = ?'
      ).get(meeting_id, guest.id);

      if (existing) {
        return res.status(400).json({ error: 'Already checked in' });
      }

      db.prepare(
        'INSERT INTO attendance (meeting_id, guest_id) VALUES (?, ?)'
      ).run(meeting_id, guest.id);

      return res.json({ success: true, type: 'guest', name: guest.name, returning: !!guest.id });
    } catch (error) {
      console.error('Check-in error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // DELETE - remove attendance (admin only)
  else if (req.method === 'DELETE') {
    const { meeting_id, member_id, guest_id } = req.body;
    if (!meeting_id) {
      return res.status(400).json({ error: 'meeting_id is required' });
    }
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const user = token ? verifyToken(token) : null;
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      if (member_id) {
        // Also remove from table_topics_speakers
        db.prepare('DELETE FROM table_topics_speakers WHERE meeting_id = ? AND member_id = ?').run(meeting_id, member_id);
        db.prepare('DELETE FROM attendance WHERE meeting_id = ? AND member_id = ?').run(meeting_id, member_id);
      } else if (guest_id) {
        db.prepare('DELETE FROM table_topics_speakers WHERE meeting_id = ? AND guest_id = ?').run(meeting_id, guest_id);
        db.prepare('DELETE FROM attendance WHERE meeting_id = ? AND guest_id = ?').run(meeting_id, guest_id);
      } else {
        return res.status(400).json({ error: 'member_id or guest_id is required' });
      }
      return res.json({ success: true });
    } catch (error) {
      console.error('Delete attendance error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
