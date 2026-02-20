const QRCode = require('qrcode');
const db = require('../../lib/db');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const meetingId = req.query?.meeting_id || new URL(req.url, `http://${req.headers.host}`).searchParams.get('meeting_id');

    if (!meetingId) {
      return res.status(400).json({ error: 'meeting_id is required' });
    }

    // Verify meeting exists
    const meeting = db.prepare('SELECT id, date FROM meetings WHERE id = ?').get(meetingId);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    try {
      // Build the check-in URL using the request's host
      const protocol = req.headers['x-forwarded-proto'] || 'http';
      const host = req.headers.host;
      const checkinUrl = `${protocol}://${host}/checkin?meeting=${meetingId}`;

      // Generate QR code as data URL
      const qrDataUrl = await QRCode.toDataURL(checkinUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      res.json({ qrCode: qrDataUrl, checkinUrl, meetingId: meeting.id, date: meeting.date });
    } catch (error) {
      console.error('QR code generation error:', error);
      res.status(500).json({ error: 'Failed to generate QR code' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
