import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  role: {
    type: String,
    enum: ['admin', 'seller', 'buyer'],
    default: 'buyer'
  },

  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  password: {
    type: String,
    required: true
  },

  phone: {
    type: String,
    required: function () {
      return this.role !== 'admin';
    }
  },

  country: {
    type: String,
    required: function () {
      return this.role !== 'admin';
    }
  },

  state: {
    type: String,
    required: function () {
      return this.role !== 'admin';
    }
  },

  city: {
    type: String,
    required: function () {
      return this.role !== 'admin';
    }
  },

  address1: {
    type: String,
    required: function () {
      return this.role !== 'admin';
    }
  },

  address2: {
    type: String,
    default: ''
  },

  companyName: {
    type: String,
    default: ''
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('User', userSchema);
