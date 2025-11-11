const db = require('../../lib/db');
const { authMiddleware } = require('../../lib/auth');

// Mapping of role types to table names and display names
const ROLE_CONFIG = {
  'toastmaster': {
    table: 'toastmasters_of_the_evening',
    displayName: 'Toastmaster of the Evening'
  },
  'timer': {
    table: 'timers',
    displayName: 'Timer'
  },
  'topics': {
    table: 'table_topics_masters',
    displayName: 'Table Topics Master'
  },
  'evaluator': {
    table: 'general_evaluators',
    displayName: 'General Evaluator'
  },
  'ah-counter-grammarian': {
    table: 'ah_counter_grammarians',
    displayName: 'Ah-Counter/Grammarian'
  }
};

// Helper function to get role type from display name
function getRoleTypeFromDisplayName(displayName) {
  for (const [roleType, config] of Object.entries(ROLE_CONFIG)) {
    if (config.displayName === displayName) {
      return roleType;
    }
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // Allow anyone to view roles - no auth required
    const { meetingId } = req.query;
    
    if (!meetingId) {
      return res.status(400).json({ error: 'Meeting ID required' });
    }

    try {
      const roles = [];

      // Query each role table and combine results
      for (const [roleType, config] of Object.entries(ROLE_CONFIG)) {
        let query;
        
        if (roleType === 'ah-counter-grammarian') {
          // Include word_of_the_day for grammarian
          query = `
            SELECT 
              r.id,
              r.member_id,
              r.word_of_the_day,
              m.name as member_name
            FROM ${config.table} r
            LEFT JOIN members m ON r.member_id = m.id
            WHERE r.meeting_id = ?
          `;
        } else {
          // Standard query for other roles
          query = `
            SELECT 
              r.id,
              r.member_id,
              m.name as member_name
            FROM ${config.table} r
            LEFT JOIN members m ON r.member_id = m.id
            WHERE r.meeting_id = ?
          `;
        }

        const results = db.prepare(query).all(meetingId);
        
        // Add role_name to each result for frontend compatibility
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
  else if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
    // Require auth for modifying roles
    authMiddleware(async (req, res) => {
      if (req.method === 'POST') {
        const { meetingId, roleName, memberId, wordOfTheDay } = req.body;
        
        if (!meetingId || !roleName) {
          return res.status(400).json({ error: 'Meeting ID and role name required' });
        }

        try {
          // Get role type and config
          const roleType = getRoleTypeFromDisplayName(roleName);
          if (!roleType) {
            return res.status(400).json({ error: 'Invalid role name' });
          }

          const config = ROLE_CONFIG[roleType];

          // First, delete any existing assignment for this role in this meeting
          db.prepare(`DELETE FROM ${config.table} WHERE meeting_id = ?`).run(meetingId);

          // Then insert the new assignment if memberId is provided
          if (memberId) {
            let insertQuery;
            let params;

            if (roleType === 'ah-counter-grammarian') {
              insertQuery = `
                INSERT INTO ${config.table} (meeting_id, member_id, word_of_the_day)
                VALUES (?, ?, ?)
              `;
              params = [meetingId, memberId, wordOfTheDay || null];
            } else {
              insertQuery = `
                INSERT INTO ${config.table} (meeting_id, member_id)
                VALUES (?, ?)
              `;
              params = [meetingId, memberId];
            }

            const result = db.prepare(insertQuery).run(...params);
            
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

        // This should only be for ah-counter-grammarian
        if (roleType !== 'ah-counter-grammarian') {
          return res.status(400).json({ error: 'PUT only supported for ah-counter-grammarian' });
        }

        try {
          db.prepare(`
            UPDATE ah_counter_grammarians
            SET word_of_the_day = ?
            WHERE meeting_id = ?
          `).run(wordOfTheDay || null, meetingId);
          
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
          // Get role type from display name if needed
          let actualRoleType = roleType;
          const roleTypeFromDisplay = getRoleTypeFromDisplayName(roleType);
          if (roleTypeFromDisplay) {
            actualRoleType = roleTypeFromDisplay;
          }

          const config = ROLE_CONFIG[actualRoleType];
          if (!config) {
            return res.status(400).json({ error: 'Invalid role type' });
          }

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
