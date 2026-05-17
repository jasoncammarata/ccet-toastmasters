const db = require('../../lib/db');
const { authMiddleware, verifyToken } = require('../../lib/auth');

const ROLE_CONFIG = {
  'toastmaster': { table: 'toastmasters_of_the_evening', displayName: 'Toastmaster of the Evening' },
  'timer': { table: 'timers', displayName: 'Timer' },
  'topics': { table: 'table_topics_masters', displayName: 'Table Topics Master' },
  'evaluator': { table: 'general_evaluators', displayName: 'General Evaluator' },
  'ah-counter-grammarian': { table: 'ah_counter_grammarians', displayName: 'Ah-Counter/Grammarian' }
};

function getRoleTypeFromDisplayName(displayName) {
  for (const [roleType, config] of Object.entries(ROLE_CONFIG)) {
    if (config.displayName === displayName) return roleType;
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const { meetingId } = req.query;
    if (!meetingId) return res.status(400).json({ error: 'Meeting ID required' });

    try {
      const roles = [];
      for (const [roleType, config] of Object.entries(ROLE_CONFIG)) {
        let query;
        if (roleType === 'ah-counter-grammarian') {
          query = `SELECT r.id, r.member_id, r.word_of_the_day, m.name as member_name FROM ${config.table} r LEFT JOIN members m ON r.member_id = m.id WHERE r.meeting_id = ?`;
        } else {
          query = `SELECT r.id, r.member_id, m.name as member_name FROM ${config.table} r LEFT JOIN members m ON r.member_id = m.id WHERE r.meeting_id = ?`;
        }
        const results = db.prepare(query).all(meetingId);
        results.forEach(result => {
          roles.push({
            id: result.id,
            role_name: config.displayName,
            member_id: result.member_id,
            member_name: result.member_name,
            word_of_the_day: result.word_of_the_day || null
          });
        });
      }
      res.json(roles);
    } catch (error) {
      console.error('Get roles error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  else if (req.method === 'POST') {
    const { meetingId, roleName, memberId, wordOfTheDay, adminOverride } = req.body;

    if (!meetingId || !roleName) {
      return res.status(400).json({ error: 'Meeting ID and role name required' });
    }

    try {
      const roleType = getRoleTypeFromDisplayName(roleName);
      if (!roleType) return res.status(400).json({ error: 'Invalid role name' });

      const config = ROLE_CONFIG[roleType];

      if (adminOverride === true) {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) return res.status(401).json({ error: 'Admin override requires authentication' });
        const adminUser = verifyToken(token);
        if (!adminUser || adminUser.role !== 'admin') {
          return res.status(401).json({ error: 'Admin privileges required for override' });
        }

        console.log(`[ADMIN OVERRIDE] Admin ${adminUser.email} (id=${adminUser.id}) modified role "${roleName}" for meeting ${meetingId}, assigning memberId=${memberId || 'CLEARED'} at ${new Date().toISOString()}`);

        db.prepare(`DELETE FROM ${config.table} WHERE meeting_id = ?`).run(meetingId);

        if (memberId) {
          let insertQuery, params;
          if (roleType === 'ah-counter-grammarian') {
            insertQuery = `INSERT INTO ${config.table} (meeting_id, member_id, word_of_the_day) VALUES (?, ?, ?)`;
            params = [meetingId, memberId, wordOfTheDay || null];
          } else {
            insertQuery = `INSERT INTO ${config.table} (meeting_id, member_id) VALUES (?, ?)`;
            params = [meetingId, memberId];
          }
          const result = db.prepare(insertQuery).run(...params);
          return res.json({ id: result.lastInsertRowid, meetingId, roleName, memberId });
        } else {
          return res.json({ success: true, message: 'Role cleared' });
        }
      }

      if (!memberId) {
        return res.status(400).json({ error: 'Member ID required for sign-up' });
      }

      const existing = db.prepare(`SELECT id, member_id FROM ${config.table} WHERE meeting_id = ?`).get(meetingId);
      if (existing) {
        return res.status(409).json({ error: 'This role is already filled. Please contact an officer if you need to make a change.' });
      }

      let insertQuery, params;
      if (roleType === 'ah-counter-grammarian') {
        insertQuery = `INSERT INTO ${config.table} (meeting_id, member_id, word_of_the_day) VALUES (?, ?, ?)`;
        params = [meetingId, memberId, wordOfTheDay || null];
      } else {
        insertQuery = `INSERT INTO ${config.table} (meeting_id, member_id) VALUES (?, ?)`;
        params = [meetingId, memberId];
      }
      const result = db.prepare(insertQuery).run(...params);
      return res.json({ id: result.lastInsertRowid, meetingId, roleName, memberId });

    } catch (error) {
      console.error('Update role error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  else if (req.method === 'PUT' || req.method === 'DELETE') {
    authMiddleware(async (req, res) => {
      if (req.method === 'PUT') {
        const { meetingId, roleType, wordOfTheDay } = req.body;
        if (!meetingId || !roleType) return res.status(400).json({ error: 'Meeting ID and role type required' });
        if (roleType !== 'ah-counter-grammarian') return res.status(400).json({ error: 'PUT only supported for ah-counter-grammarian' });

        try {
          db.prepare(`UPDATE ah_counter_grammarians SET word_of_the_day = ? WHERE meeting_id = ?`).run(wordOfTheDay || null, meetingId);
          res.json({ success: true });
        } catch (error) {
          console.error('Update word error:', error);
          res.status(500).json({ error: 'Internal server error' });
        }
      }
      else if (req.method === 'DELETE') {
        const { meetingId, roleType } = req.body;
        if (!meetingId || !roleType) return res.status(400).json({ error: 'Meeting ID and role type required' });

        try {
          let actualRoleType = roleType;
          const roleTypeFromDisplay = getRoleTypeFromDisplayName(roleType);
          if (roleTypeFromDisplay) actualRoleType = roleTypeFromDisplay;

          const config = ROLE_CONFIG[actualRoleType];
          if (!config) return res.status(400).json({ error: 'Invalid role type' });

          db.prepare(`DELETE FROM ${config.table} WHERE meeting_id = ?`).run(meetingId);
          res.json({ success: true });
        } catch (error) {
          console.error('Delete role error:', error);
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    })(req, res);
  }
  else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
