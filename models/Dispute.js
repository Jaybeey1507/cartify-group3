import mongoose from 'mongoose';

const replySchema = new mongoose.Schema({
  author: {
    type: String,
    enum: ['buyer','seller'],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  file: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const disputeSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  buyer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // everything now lives in replies
  replies: {
    type: [replySchema],
    default: []
  },

  // once the admin marks it
  resolved: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Dispute', disputeSchema);
