const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('wishlist');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user.wishlist);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.post('/', async (req, res) => {
  const { gameID, dealID, title, thumb, storeID, salePrice, normalPrice } = req.body;
  if (!gameID || typeof gameID !== 'string')
    return res.status(400).json({ message: 'gameID required' });

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.wishlist.some(i => i.gameID === gameID))
      return res.status(409).json({ message: 'Already in wishlist' });

    user.wishlist.push({ gameID, dealID, title, thumb, storeID, salePrice, normalPrice });
    await user.save();
    res.status(201).json(user.wishlist[user.wishlist.length - 1]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.patch('/:gameID', async (req, res) => {
  const { targetPrice } = req.body || {};
  if (targetPrice !== null && (typeof targetPrice !== 'number' || !isFinite(targetPrice) || targetPrice < 0)) {
    return res.status(400).json({ message: 'targetPrice must be a non-negative number or null' });
  }

  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const item = user.wishlist.find(i => i.gameID === req.params.gameID);
    if (!item) return res.status(404).json({ message: 'Item not in wishlist' });

    item.targetPrice = targetPrice;
    await user.save();
    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

router.delete('/:gameID', async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const before = user.wishlist.length;
    user.wishlist = user.wishlist.filter(i => i.gameID !== req.params.gameID);
    if (user.wishlist.length === before)
      return res.status(404).json({ message: 'Item not in wishlist' });

    await user.save();
    res.status(204).send();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
