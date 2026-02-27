const db = require('../../lib/db');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // Get date range from query parameters
    const startDate = req.query.startDate || '2025-10-01';
    const now = new Date();
    const estNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const endDate = req.query.endDate || estNow.getFullYear() + '-' + String(estNow.getMonth() + 1).padStart(2, '0') + '-' + String(estNow.getDate()).padStart(2, '0');
        
    try {
      // Get all active members
      const members = db.prepare(`
        SELECT id, name
        FROM members
        WHERE is_active = 1 AND email != 'CCET_Admin'
        ORDER BY name
      `).all();

      const participationData = [];
      
      for (const member of members) {
        // Count speeches
        const speechCount = db.prepare(`
          SELECT COUNT(*) as count
          FROM speeches s
          JOIN meetings m ON s.meeting_id = m.id
          WHERE s.speaker_id = ? AND m.date >= ? AND m.date <= ?
        `).get(member.id, startDate, endDate).count;

        // Count evaluations
        const evaluationCount = db.prepare(`
          SELECT COUNT(*) as count
          FROM evaluators e
          JOIN meetings m ON e.meeting_id = m.id
          WHERE e.member_id = ? AND m.date >= ? AND m.date <= ?
        `).get(member.id, startDate, endDate).count;

        // Count Toastmaster of the Evening
        const toastmasterCount = db.prepare(`
          SELECT COUNT(*) as count
          FROM toastmasters_of_the_evening t
          JOIN meetings m ON t.meeting_id = m.id
          WHERE t.member_id = ? AND m.date >= ? AND m.date <= ?
        `).get(member.id, startDate, endDate).count;

        // Count General Evaluator
        const generalEvaluatorCount = db.prepare(`
          SELECT COUNT(*) as count
          FROM general_evaluators g
          JOIN meetings m ON g.meeting_id = m.id
          WHERE g.member_id = ? AND m.date >= ? AND m.date <= ?
        `).get(member.id, startDate, endDate).count;

        // Count Table Topics Master
        const tableTopicsCount = db.prepare(`
          SELECT COUNT(*) as count
          FROM table_topics_masters t
          JOIN meetings m ON t.meeting_id = m.id
          WHERE t.member_id = ? AND m.date >= ? AND m.date <= ?
        `).get(member.id, startDate, endDate).count;

        // Count Ah-Counter/Grammarian
        const grammarianCount = db.prepare(`
          SELECT COUNT(*) as count
          FROM ah_counter_grammarians a
          JOIN meetings m ON a.meeting_id = m.id
          WHERE a.member_id = ? AND m.date >= ? AND m.date <= ?
        `).get(member.id, startDate, endDate).count;

        // Count Timer
        const timerCount = db.prepare(`
          SELECT COUNT(*) as count
          FROM timers t
          JOIN meetings m ON t.meeting_id = m.id
          WHERE t.member_id = ? AND m.date >= ? AND m.date <= ?
        `).get(member.id, startDate, endDate).count;

        // Count TT Speeches (Table Topics Speaker)
        const ttSpeechCount = db.prepare(`
          SELECT COUNT(*) as count
          FROM table_topics_speakers t
          JOIN meetings m ON t.meeting_id = m.id
          WHERE t.member_id = ? AND m.date >= ? AND m.date <= ?
        `).get(member.id, startDate, endDate).count;

        // Calculate total contribution
        const totalContribution = speechCount + ttSpeechCount + evaluationCount + toastmasterCount +
                                 generalEvaluatorCount + tableTopicsCount +
                                 grammarianCount + timerCount;

        participationData.push({
          id: member.id,
          name: member.name,
          speeches: speechCount,
          ttSpeeches: ttSpeechCount,
          evaluations: evaluationCount,
          toastmaster: toastmasterCount,
          generalEvaluator: generalEvaluatorCount,
          tableTopics: tableTopicsCount,
          grammarian: grammarianCount,
          timer: timerCount,
          total: totalContribution
        });
      }

      // Sort by total contribution (descending), then by speeches (descending) if tied
      participationData.sort((a, b) => {
        if (b.total !== a.total) {
          return b.total - a.total;
        }
        return b.speeches - a.speeches;
      });

      res.json(participationData);
    } catch (error) {
      console.error('Get participation tracker error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
