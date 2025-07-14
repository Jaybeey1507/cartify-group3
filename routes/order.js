// routes/order.js
import express from 'express';
import mongoose from 'mongoose';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import Cart from '../models/Cart.js';
import User from '../models/User.js';
import { authenticateToken } from '../core/auth.js';

const router = express.Router();

router.post('/place', authenticateToken, async (req, res) => {
  const { shippingAddress, paymentMethod } = req.body;
  const userId = req.user.userId;

  try {
    const user = await User.findById(userId);
    const cart = await Cart.findOne({ user: userId }).populate('items.product');

    if (!user || !cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty or user not found.' });
    }

    let totalAmount = 0;
    const orderItems = [];
    const sellerAmounts = {};

    for (const item of cart.items) {
      const product = item.product;
      if (!product) continue;

      if (item.quantity > product.stock) {
        return res.status(400).json({ error: `Not enough stock for ${product.name}` });
      }

      const name = product.name || 'Unknown';
      const price = product.price || 0;
      const sellerId = product.seller?.toString();

      orderItems.push({
        product: product._id,
        name,
        price,
        quantity: item.quantity
      });

      totalAmount += price * item.quantity;

      // Credit mapping
      if (sellerId) {
        sellerAmounts[sellerId] = (sellerAmounts[sellerId] || 0) + price * item.quantity;
      }

      // Decrease stock
      product.stock -= item.quantity;
      await product.save();
    }

    // Validate shipping address
    const finalShipping = shippingAddress?.trim() || "Not Provided";

    // Handle payment method
    if (paymentMethod === 'balance') {
      if ((user.balance || 0) < totalAmount) {
        return res.status(400).json({ error: 'Insufficient balance.' });
      }

      user.balance -= totalAmount;
      await user.save();

      // Credit each seller
      for (const [sellerId, amount] of Object.entries(sellerAmounts)) {
        const seller = await User.findById(sellerId);
        if (seller) {
          seller.pendingBalance = (seller.pendingBalance || 0) + amount;
          await seller.save();
        }
      }
    } else if (paymentMethod === 'card') {
      return res.status(400).json({ error: 'Credit/Debit Card option coming soon.' });
    } else {
      return res.status(400).json({ error: 'Invalid payment method.' });
    }

    const newOrder = new Order({
      user: userId,
      products: orderItems,
      totalAmount,
      shippingAddress: finalShipping,
      paymentMethod,
      status: 'pending'
    });

    await newOrder.save();

    // Clear cart
    cart.items = [];
    await cart.save();

    res.status(201).json(newOrder);
  } catch (err) {
    console.error("❌ Order placement error:", err);
    res.status(500).json({ error: 'Transaction failed: ' + err.message });
  }
});

// 📦 Update order status (seller, admin, or buyer if pending)
router.put('/:orderId/status', authenticateToken, async (req, res) => {
  const { status } = req.body;
  const userId = req.user.userId;
  const role = req.user.role;

  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // 🛑 Only allow buyers to cancel if order is still pending
    if (role === 'buyer') {
      if (status !== 'cancelled') {
        return res.status(403).json({ error: 'Buyers can only cancel their own orders' });
      }
      if (order.user.toString() !== userId) {
        return res.status(403).json({ error: 'Unauthorized buyer' });
      }
      if (order.status !== 'pending') {
        return res.status(400).json({ error: 'Only pending orders can be cancelled' });
      }
    }

    // ✅ Allow admin and seller to update status
    if (role === 'admin' || role === 'seller' || role === 'buyer') {
      await Order.updateOne({ _id: order._id }, { $set: { status } });
      return res.json({ success: true, status });
    }

    return res.status(403).json({ error: 'Unauthorized action' });
  } catch (err) {
    console.error("❌ Status update failed:", err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/:orderId', authenticateToken, async (req, res) => {
  const { shippingAddress } = req.body;

  try {
    const userId = req.user.userId;
    const order = await Order.findById(req.params.orderId);

    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.user.toString() !== userId)
      return res.status(403).json({ error: "You can only edit your own order" });

    if (order.status !== 'pending')
      return res.status(403).json({ error: "Only pending orders can be edited" });

    if (!shippingAddress?.trim())
      return res.status(400).json({ error: "Shipping address is required" });

    order.shippingAddress = shippingAddress.trim();
    await order.save();

    res.json(order);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔍 View all orders of a user (buyer)
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    if (req.user.userId !== req.params.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized access to orders' });
    }

    const orders = await Order.find({ user: req.params.userId })
      .populate({
        path: 'items.product',
        select: 'name price',
        strictPopulate: false,
      })
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📜 Admin or seller can view all orders
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const role = req.user.role;
    if (role !== 'admin' && role !== 'seller') {
      return res.status(403).json({ error: 'Only admin or seller can view all orders' });
    }

    const orders = await Order.find().populate('user').sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/orders/:id/status → Update status and handle payout/refund
// PUT /api/orders/:id/payout-status → Update status and handle payout/refund
router.put('/:id/payout-status', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admin can update order status' });
    }

    const { status } = req.body;
    if (!['released', 'refunded'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status update' });
    }

    const order = await Order.findById(req.params.id)
      .populate('products.product')
      .populate('user');
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status === 'released' || order.status === 'refunded') {
      return res.status(400).json({ error: 'Order already processed' });
    }

    const total = order.totalAmount;

    if (status === 'released') {
      // On release: MOVE pendingBalance → availableBalance for seller(s)
      const sellersMap = new Map();
      for (const item of order.products) {
        const sellerId = item.product.seller.toString();
        const share = (item.product.price || 0) * item.quantity;
        sellersMap.set(sellerId, (sellersMap.get(sellerId) || 0) + share);
      }
      for (const [sellerId, amount] of sellersMap.entries()) {
        // decrement pending, increment available
        await User.findByIdAndUpdate(sellerId, {
          $inc: { pendingBalance: -amount, balance: amount }
        });
      }
    }

    if (status === 'refunded') {
      // On refund: return money to buyer
      await User.findByIdAndUpdate(order.user._id, { $inc: { balance: total } });

      // …and remove that money from each seller’s pendingBalance
      const sellersMap = new Map();
      for (const item of order.products) {
        const sellerId = item.product.seller.toString();
        const share = (item.product.price || 0) * item.quantity;
        sellersMap.set(sellerId, (sellersMap.get(sellerId) || 0) + share);
      }
      for (const [sellerId, amount] of sellersMap.entries()) {
        await User.findByIdAndUpdate(sellerId, { $inc: { pendingBalance: -amount } });
      }
    }

    // Finally, mark order status
    await Order.updateOne({ _id: order._id }, { $set: { status } });

    res.json({ message: `Order marked as ${status} successfully.` });
  } catch (err) {
    console.error("❌ Payout-status error:", err);
    res.status(500).json({ error: err.message });
  }
});

// 📊 Get most/least ordered products for current seller
router.get('/by-product', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can access this data' });
    }

    const sellerId = req.user.userId;

    // Load all orders with populated product data
    const orders = await Order.find().populate('products.product');

    const salesMap = {};

    for (const order of orders) {
      for (const item of order.products) {
        const product = item.product;
        if (!product || product.seller.toString() !== sellerId) continue;

        const key = product._id.toString();
        if (!salesMap[key]) {
          salesMap[key] = {
            name: product.name,
            totalSold: 0
          };
        }
        salesMap[key].totalSold += item.quantity;
      }
    }

    const result = Object.values(salesMap).sort((a, b) => b.totalSold - a.totalSold);
    res.json(result);
  } catch (err) {
    console.error("❌ Error in /by-product:", err.message);
    res.status(500).json({ error: err.message });
  }
});

router.get('/seller/summary', authenticateToken, async (req, res) => {
  try {
    const sellerId = req.user.userId;

    // ✅ Use 'products' as per schema and populate product reference
    const orders = await Order.find().populate('products.product');

    let totalSold = 0;
    let totalRevenue = 0;

    for (const order of orders) {
      for (const item of order.products) {
        // Defensive check in case product or seller is missing
        if (!item.product || !item.product.seller) continue;

        if (item.product.seller.toString() === sellerId) {
          totalSold += item.quantity;
          totalRevenue += item.quantity * (item.product.price || 0);
        }
      }
    }

    res.json({ totalSold, totalRevenue });
  } catch (err) {
    console.error("❌ Error in /seller/summary:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 🧾 Get all orders containing products owned by current seller
router.get('/seller/orders', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'seller') {
      return res.status(403).json({ error: 'Only sellers can access their orders' });
    }

    const sellerId = req.user.userId;

    // Populate product field in products array
    const orders = await Order.find().populate('products.product');

    // Filter orders that include at least one product owned by the seller
    const sellerOrders = orders.filter(order =>
      order.products.some(p => p.product?.seller?.toString() === sellerId)
    );

    res.json(sellerOrders);
  } catch (err) {
    console.error("❌ Error in /seller/orders:", err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
