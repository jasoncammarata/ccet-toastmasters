const db = require('../../lib/db');

module.exports = async (req, res) => {

  // GET - fetch voting status, nominees, results, and vote count
  if (req.method === 'GET') {
    const meetingId = req.query?.meeting_id || new URL(req.url, `http://${req.headers.host}`).searchParams.get('meeting_id');

    if (!meetingId) {
      return res.status(400).json({ error: 'meeting_id is required' });
    }

    try {
      // Get voting session
      const session = db.prepare('SELECT * FROM voting_sessions WHERE meeting_id = ?').get(meetingId);

      // Check if locked (past midnight Eastern on meeting date)
      const meeting = db.prepare('SELECT date FROM meetings WHERE id = ?').get(meetingId);
      if (!meeting) {
        return res.status(404).json({ error: 'Meeting not found' });
      }
      const now = new Date();
      const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const meetingEnd = new Date(meeting.date + 'T23:59:59');
      const isLocked = estNow > meetingEnd;

      // Get attendance count
      const attendanceCount = db.prepare('SELECT COUNT(*) as count FROM attendance WHERE meeting_id = ?').get(meetingId).count;

      // Get vote count (unique voter tokens)
      const voteCount = db.prepare('SELECT COUNT(DISTINCT voter_token) as count FROM votes WHERE meeting_id = ?').get(meetingId).count;

      // Get nominees for each category
      // Speakers - from speeches table
      const speakers = db.prepare(`
        SELECT s.speaker_id as member_id, NULL as guest_id, m.name
        FROM speeches s
        JOIN members m ON s.speaker_id = m.id
        WHERE s.meeting_id = ? AND s.speaker_id IS NOT NULL
      `).all(meetingId);

      // Evaluators - from evaluators table
      const evaluators = db.prepare(`
        SELECT e.member_id, NULL as guest_id, m.name
        FROM evaluators e
        JOIN members m ON e.member_id = m.id
        WHERE e.meeting_id = ? AND e.member_id IS NOT NULL
      `).all(meetingId);

      // Table Topics speakers - from table_topics_speakers table (can be members or guests)
      const tableTopics = db.prepare(`
        SELECT tt.member_id, tt.guest_id,
          CASE
            WHEN tt.member_id IS NOT NULL THEN m.name
            WHEN tt.guest_id IS NOT NULL THEN g.name
          END as name
        FROM table_topics_speakers tt
        LEFT JOIN members m ON tt.member_id = m.id
        LEFT JOIN guests g ON tt.guest_id = g.id
        WHERE tt.meeting_id = ?
      `).all(meetingId);

      // Build results if voting is closed
      let results = null;
      if (session && session.status === 'closed') {
        results = {};
        const categories = ['speaker', 'evaluator', 'table_topics'];

        for (const category of categories) {
          const scores = db.prepare(`
            SELECT
              nominee_member_id,
              nominee_guest_id,
              SUM(CASE WHEN rank = 1 THEN 3 WHEN rank = 2 THEN 2 WHEN rank = 3 THEN 1 ELSE 0 END) as total_points,
              SUM(CASE WHEN rank = 1 THEN 1 ELSE 0 END) as first_place_votes,
              SUM(CASE WHEN rank = 2 THEN 1 ELSE 0 END) as second_place_votes,
              CASE
                WHEN nominee_member_id IS NOT NULL THEN m.name
                WHEN nominee_guest_id IS NOT NULL THEN g.name
              END as name
            FROM votes v
            LEFT JOIN members m ON v.nominee_member_id = m.id
            LEFT JOIN guests g ON v.nominee_guest_id = g.id
            WHERE v.meeting_id = ? AND v.category = ?
            GROUP BY nominee_member_id, nominee_guest_id
            ORDER BY total_points DESC, first_place_votes DESC, second_place_votes DESC
          `).all(meetingId, category);

          results[category] = scores.slice(0, 3).map((s, i) => ({
            ...s,
            medal: i === 0 ? 'gold' : i === 1 ? 'silver' : 'bronze'
          }));
        }
      }

      res.json({
        status: session ? session.status : 'closed',
        isLocked,
        attendanceCount,
        voteCount,
        nominees: {
          speaker: speakers,
          evaluator: evaluators,
          table_topics: tableTopics
        },
        results
      });
    } catch (error) {
      console.error('Get voting error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // POST - open voting, close voting, or submit a vote
  else if (req.method === 'POST') {
    const { action, meeting_id, voter_token, rankings } = req.body;

    if (!meeting_id) {
      return res.status(400).json({ error: 'meeting_id is required' });
    }

    // Check if locked
    const meeting = db.prepare('SELECT date FROM meetings WHERE id = ?').get(meeting_id);
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    const now = new Date();
    const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const meetingEnd = new Date(meeting.date + 'T23:59:59');
    const isLocked = estNow > meetingEnd;

    if (isLocked) {
      return res.status(403).json({ error: 'Voting is locked for this meeting' });
    // Only allow opening voting on the meeting day
    if (action === "open") {
      const todayEST = estNow.getFullYear() + "-" + String(estNow.getMonth() + 1).padStart(2, "0") + "-" + String(estNow.getDate()).padStart(2, "0");
      if (meeting.date !== todayEST) {
        return res.status(403).json({ error: "Voting can only be opened on the day of the meeting" });
      }
    }
    }

    try {
      // OPEN VOTING
      if (action === 'open') {
        // Clear any existing votes for this meeting
        db.prepare('DELETE FROM votes WHERE meeting_id = ?').run(meeting_id);

        const existing = db.prepare('SELECT id FROM voting_sessions WHERE meeting_id = ?').get(meeting_id);
        if (existing) {
          db.prepare("UPDATE voting_sessions SET status = 'open', opened_at = datetime('now'), closed_at = NULL WHERE meeting_id = ?").run(meeting_id);
        } else {
          db.prepare("INSERT INTO voting_sessions (meeting_id, status, opened_at) VALUES (?, 'open', datetime('now'))").run(meeting_id);
        }

        return res.json({ success: true, status: 'open' });
      }

      // CLOSE VOTING
      if (action === 'close') {
        db.prepare("UPDATE voting_sessions SET status = 'closed', closed_at = datetime('now') WHERE meeting_id = ?").run(meeting_id);
        return res.json({ success: true, status: 'closed' });
      }

      // SUBMIT VOTE
      if (action === 'vote') {
        if (!voter_token || !rankings) {
          return res.status(400).json({ error: 'voter_token and rankings are required' });
        }

        // Check voting is open
        const session = db.prepare('SELECT status FROM voting_sessions WHERE meeting_id = ?').get(meeting_id);
        if (!session || session.status !== 'open') {
          return res.status(400).json({ error: 'Voting is not open for this meeting' });
        }

        // Check if this voter already submitted
        const existingVote = db.prepare('SELECT id FROM votes WHERE meeting_id = ? AND voter_token = ?').get(meeting_id, voter_token);
        if (existingVote) {
          return res.status(400).json({ error: 'You have already voted' });
        }

        // Insert all rankings
        const insert = db.prepare(`
          INSERT INTO votes (meeting_id, category, nominee_member_id, nominee_guest_id, rank, voter_token)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        const insertMany = db.transaction((rankings) => {
          for (const r of rankings) {
            insert.run(
              meeting_id,
              r.category,
              r.nominee_member_id || null,
              r.nominee_guest_id || null,
              r.rank,
              voter_token
            );
          }
        });

        insertMany(rankings);
        return res.json({ success: true });
      }

      return res.status(400).json({ error: 'Invalid action' });
    } catch (error) {
      console.error('Voting action error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
