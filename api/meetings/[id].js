const db = require('../../lib/db');
const { authMiddleware } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method === 'PUT') {
    return authMiddleware(async (req, res) => {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const meetingId = req.params.id;
      const { meeting_type } = req.body;

      if (!meetingId) {
        return res.status(400).json({ error: 'Meeting ID required' });
      }

      if (!meeting_type || (meeting_type !== 'in-person' && meeting_type !== 'virtual')) {
        return res.status(400).json({ error: "meeting_type must be 'in-person' or 'virtual'" });
      }

      try {
        // Fetch the meeting to verify it exists and check its date
        const meeting = db.prepare('SELECT id, date FROM meetings WHERE id = ?').get(meetingId);
        if (!meeting) {
          return res.status(404).json({ error: 'Meeting not found' });
        }

        // Reject edits to past meetings (date is before today)
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        if (meeting.date < today) {
          return res.status(400).json({ error: 'Cannot edit meetings in the past.' });
        }

        // Update meeting_type; clear location_override since type and location are always aligned
        db.prepare('UPDATE meetings SET meeting_type = ?, location_override = NULL WHERE id = ?')
          .run(meeting_type, meetingId);

        console.log(`[ADMIN] Admin ${req.user.email} (id=${req.user.id}) changed meeting ${meetingId} (${meeting.date}) to ${meeting_type} at ${new Date().toISOString()}`);

        res.json({ success: true, meetingId, meeting_type });
      } catch (error) {
        console.error('Update meeting error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    })(req, res);
  }
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
