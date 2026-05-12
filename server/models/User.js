const mongoose = require('mongoose');

const wishlistItemSchema = new mongoose.Schema({
  gameID:      { type: String, required: true },
  dealID:      String,
  title:       String,
  thumb:       String,
  storeID:     String,
  salePrice:   String,
  normalPrice: String,
  targetPrice: Number,
  savedAt:     { type: Date, default: Date.now },
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ['user', 'admin'], default: 'user' },
  mfaEnabled: { type: Boolean, default: false },
  mfaSecret:  { type: String, default: null, select: false },
  wishlist: { type: [wishlistItemSchema], default: [] },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
