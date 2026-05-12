const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Comment = require('../models/Comment');

const router = express.Router();

router.get('/', async (req, res) => {
  const { gameID } = req.query;
  if (!gameID || typeof gameID !== 'string')
    return res.status(400).json({ message: 'gameID required' });

  try {
    const comments = await Comment.find({ gameID }).sort({ createdAt: -1 }).lean();
    res.json(comments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', auth, async (req, res) => {
  const { gameID, body } = req.body || {};
  if (!gameID || typeof gameID !== 'string')
    return res.status(400).json({ message: 'gameID required' });
  if (!body || typeof body !== 'string' || !body.trim())
    return res.status(400).json({ message: 'body required' });
  if (body.length > 1000)
    return res.status(400).json({ message: 'body too long' });

  try {
    const user = await User.findById(req.userId).select('username');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const comment = await Comment.create({
      gameID,
      userId: user._id,
      username: user.username,
      body: body.trim(),
    });
    res.status(201).json(comment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    const isOwner = comment.userId.toString() === req.userId;
    const isAdmin = req.role === 'admin';
    if (!isOwner && !isAdmin)
      return res.status(403).json({ message: 'Not allowed' });

    await comment.deleteOne();
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
