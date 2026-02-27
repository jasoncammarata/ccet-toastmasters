const db = require('../../lib/db');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const memberId = req.query?.member_id || new URL(req.url, `http://${req.headers.host}`).searchParams.get('member_id');

    if (!memberId) {
      // Return list of active members for the dropdown
      try {
        const members = db.prepare(
          "SELECT id, name FROM members WHERE is_active = 1 AND role != 'admin' ORDER BY name ASC"
        ).all();
        return res.json({ members });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    try {
      // Get member info
      const member = db.prepare('SELECT id, name, joined_date FROM members WHERE id = ?').get(memberId);
      if (!member) {
        return res.status(404).json({ error: 'Member not found' });
      }

      // Speech history
      const speeches = db.prepare(`
        SELECT s.id as speech_id, s.speech_title, s.speech_project, s.logged_in_pathways,
               m2.name as evaluator_name, mt.date as meeting_date, mt.id as meeting_id
        FROM speeches s
        JOIN meetings mt ON s.meeting_id = mt.id
        LEFT JOIN members m2 ON s.evaluator_id = m2.id
        WHERE s.speaker_id = ?
        ORDER BY mt.date DESC
      `).all(memberId);

      // Role history (from all role tables)
      const roleTables = [
        { table: 'toastmasters_of_the_evening', role: 'Toastmaster of the Evening' },
        { table: 'timers', role: 'Timer' },
        { table: 'table_topics_masters', role: 'Table Topics Master' },
        { table: 'general_evaluators', role: 'General Evaluator' },
        { table: 'ah_counter_grammarians', role: 'Ah-Counter / Grammarian' }
      ];

      let roles = [];
      for (const rt of roleTables) {
        const rows = db.prepare(`
          SELECT mt.date as meeting_date, mt.id as meeting_id
          FROM ${rt.table} r
          JOIN meetings mt ON r.meeting_id = mt.id
          WHERE r.member_id = ?
        `).all(memberId);
        rows.forEach(row => {
          roles.push({ meeting_date: row.meeting_date, meeting_id: row.meeting_id, role_name: rt.role });
        });
      }
      roles.sort((a, b) => b.meeting_date.localeCompare(a.meeting_date));

      // Evaluations given
      const evaluations = db.prepare(`
        SELECT mt.date as meeting_date, m2.name as speaker_name
        FROM speeches s
        JOIN meetings mt ON s.meeting_id = mt.id
        JOIN members m2 ON s.speaker_id = m2.id
        WHERE s.evaluator_id = ?
        ORDER BY mt.date DESC
      `).all(memberId);

      // Table Topics participation
      const tableTopics = db.prepare(`
        SELECT mt.date as meeting_date, mt.id as meeting_id
        FROM table_topics_speakers tt
        JOIN meetings mt ON tt.meeting_id = mt.id
        WHERE tt.member_id = ?
        ORDER BY mt.date DESC
      `).all(memberId);

      // Attendance
      const attendance = db.prepare(`
        SELECT mt.date as meeting_date
        FROM attendance a
        JOIN meetings mt ON a.meeting_id = mt.id
        WHERE a.member_id = ?
        ORDER BY mt.date DESC
      `).all(memberId);

      // Awards from voting - get all meetings where voting is closed
      const awards = db.prepare(`
        SELECT v.meeting_id, v.category, v.rank, mt.date as meeting_date,
          SUM(CASE WHEN v.rank = 1 THEN 3 WHEN v.rank = 2 THEN 2 WHEN v.rank = 3 THEN 1 ELSE 0 END) as total_points
        FROM votes v
        JOIN meetings mt ON v.meeting_id = mt.id
        JOIN voting_sessions vs ON v.meeting_id = vs.meeting_id AND vs.status = 'closed'
        WHERE v.nominee_member_id = ?
        GROUP BY v.meeting_id, v.category
        ORDER BY mt.date DESC
      `).all(memberId);

      // Now determine medal placements per meeting per category
      const medalData = [];
      const meetingCategories = {};
      awards.forEach(a => {
        const key = a.meeting_id + '_' + a.category;
        if (!meetingCategories[key]) meetingCategories[key] = true;
      });

      for (const key of Object.keys(meetingCategories)) {
        const [meetingId, category] = key.split('_');
        // Get all nominees ranked for this meeting+category
        const allScores = db.prepare(`
          SELECT nominee_member_id,
            SUM(CASE WHEN rank = 1 THEN 3 WHEN rank = 2 THEN 2 WHEN rank = 3 THEN 1 ELSE 0 END) as total_points,
            SUM(CASE WHEN rank = 1 THEN 1 ELSE 0 END) as first_place_votes,
            SUM(CASE WHEN rank = 2 THEN 1 ELSE 0 END) as second_place_votes
          FROM votes
          WHERE meeting_id = ? AND category = ? AND nominee_member_id IS NOT NULL
          GROUP BY nominee_member_id
          ORDER BY total_points DESC, first_place_votes DESC, second_place_votes DESC
        `).all(parseInt(meetingId), category);

        const memberIndex = allScores.findIndex(s => s.nominee_member_id === parseInt(memberId));
        if (memberIndex >= 0 && memberIndex < 3) {
          const meetingInfo = db.prepare('SELECT date FROM meetings WHERE id = ?').get(parseInt(meetingId));
          medalData.push({
            meeting_id: parseInt(meetingId),
            meeting_date: meetingInfo.date,
            category: category,
            placement: memberIndex + 1 // 1=gold, 2=silver, 3=bronze
          });
        }
      }

      // Medal summary counts
      const medalSummary = { gold: 0, silver: 0, bronze: 0 };
      medalData.forEach(m => {
        if (m.placement === 1) medalSummary.gold++;
        else if (m.placement === 2) medalSummary.silver++;
        else if (m.placement === 3) medalSummary.bronze++;
      });

      res.json({
        member,
        speeches,
        roles,
        evaluations,
        tableTopics,
        attendance,
        medals: medalData,
        medalSummary
      });

    } catch (err) {
      console.error('Member dashboard error:', err);
      res.status(500).json({ error: err.message });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
