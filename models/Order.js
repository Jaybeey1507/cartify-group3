import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  products: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
      },
      name: String,
      price: Number,
      quantity: {
        type: Number,
        required: true,
        default: 1
      }
    }
  ],
  totalAmount: {
    type: Number,
    required: true
  },
  // ← Make this optional with a default
  paymentMethod: {
    type: String,
    enum: ['balance', 'card'],
    default: 'balance'
  },
  status: {
    type: String,
    enum: [
      'pending',
      'paid',
      'shipped',
      'delivered',
      'cancelled',
      'released',   // admin has released payment
      'refunded'    // admin has refunded buyer
    ],
    default: 'pending'
  },
  shippingAddress: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('Order', orderSchema);
