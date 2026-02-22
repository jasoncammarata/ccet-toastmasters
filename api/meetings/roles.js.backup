const db = require('../../lib/db');
const { authMiddleware } = require('../../lib/auth');

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // Allow anyone to view roles - no auth required
    const { meetingId } = req.query;

    if (!meetingId) {
      return res.status(400).json({ error: 'Meeting ID required' });
    }

    try {
      const roles = db.prepare(`
        SELECT
          mr.id,
          mr.role_name,
          mr.member_id,
          mr.word_of_the_day,
          m.name as member_name
        FROM meeting_roles mr
        LEFT JOIN members m ON mr.member_id = m.id
        WHERE mr.meeting_id = ?
      `).all(meetingId);

      res.json(roles);
    } catch (error) {
      console.error('Get roles error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
  else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    // Require auth for modifying roles
    authMiddleware(async (req, res) => {
      if (req.method === 'POST') {
        const { meetingId, roleName, memberId, wordOfTheDay } = req.body;

        if (!meetingId || !roleName) {
          return res.status(400).json({ error: 'Meeting ID and role name required' });
        }

        try {
          // First, delete any existing assignment for this role
          db.prepare(`
            DELETE FROM meeting_roles 
            WHERE meeting_id = ? AND role_name = ?
          `).run(meetingId, roleName);

          // Then insert the new assignment if memberId is provided
          if (memberId) {
          const result = db.prepare(`
              INSERT INTO meeting_roles (meeting_id, role_name, member_id, word_of_the_day)
              VALUES (?, ?, ?, ?)
            `).run(meetingId, roleName, memberId, wordOfTheDay || null);

            res.json({
              id: result.lastInsertRowid,
              meetingId,
              roleName,
              memberId
            });
          } else {
            res.json({ success: true, message: 'Role cleared' });
          }
        } catch (error) {
          console.error('Update role error:', error);
          res.status(500).json({ error: 'Internal server error' });
        }
      }

      else if (req.method === 'PUT') {
        const { meetingId, roleType, wordOfTheDay } = req.body;
        
        if (!meetingId || !roleType) {
          return res.status(400).json({ error: 'Meeting ID and role type required' });
        }
        
        try {
          // Map roleType to roleName
          const roleNames = {
            'ah-counter-grammarian': 'Ah-Counter/Grammarian'
          };
          const roleName = roleNames[roleType] || roleType;
          
          db.prepare(`
            UPDATE meeting_roles
            SET word_of_the_day = ?
            WHERE meeting_id = ? AND role_name = ?
          `).run(wordOfTheDay || null, meetingId, roleName);
          
          res.json({ success: true });
        } catch (error) {
          console.error('Update word error:', error);
          res.status(500).json({ error: 'Internal server error' });
        }
      }

      else if (req.method === 'DELETE') {
        const { meetingId, roleType } = req.body;

        if (!meetingId || !roleType) {
          return res.status(400).json({ error: 'Meeting ID and role type required' });
        }

        try {
          db.prepare(`
            DELETE FROM meeting_roles 
            WHERE meeting_id = ? AND role_name = ?
          `).run(meetingId, roleType);

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
