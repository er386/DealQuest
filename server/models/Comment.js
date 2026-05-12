const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
  gameID:   { type: String, required: true, index: true },
  userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  body:     { type: String, required: true, maxlength: 1000, trim: true },
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);
