const { verifyToken } = require('../../lib/auth');

module.exports = async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ valid: false });
  }

  const user = verifyToken(token);
  
  if (!user) {
    return res.status(401).json({ valid: false });
  }

  res.json({ valid: true, user });
};