import express from 'express';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { authenticateToken } from '../core/auth.js';


const router = express.Router();

// ✅ Middleware to restrict to admin only
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }
  next();
};

// 📊 GET /api/admin/stats → Get summary stats
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await User.find();
    const products = await Product.find();
    const orders = await Order.find().populate('products.product');

    const adminCount = users.filter(u => u.role === 'admin').length;
    const totalUsers = users.length - adminCount;

    const totalRevenue = orders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const topProductsMap = {};

    orders.forEach(order => {
      order.products.forEach(p => {
        const prod = p.product;
        if (!prod || typeof prod !== 'object' || !prod.name) {
          console.warn('Skipping invalid product:', p.product);
        return;
      }
  // <-- new condition added

        const prodId = prod._id.toString();
        if (!topProductsMap[prodId]) {
          topProductsMap[prodId] = { name: prod.name, category: prod.category || 'Uncategorized', quantity: 0 };
       }
        topProductsMap[prodId].quantity += p.quantity;
      });
    });

    const topProducts = Object.values(topProductsMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    res.json({ totalUsers, adminCount, totalRevenue, topProducts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put(
  '/users/:id',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      // Only allow certain fields to be changed:
      const { name, email, role, phone, country, state, city, address1, address2 } = req.body;
      const updates = { name, email, role, phone, country, state, city, address1, address2 };

      const updated = await User.findByIdAndUpdate(
        req.params.id,
        updates,
        { new: true, select: '-password' }
      );
      if (!updated) return res.status(404).json({ error: 'User not found' });
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// 🗑 DELETE /api/admin/users/:id → Delete a user
router.delete(
  '/users/:id',
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const deleted = await User.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ error: 'User not found' });
      res.json({ message: 'User deleted successfully' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ❌ DELETE /api/admin/products/:id → Delete a product
router.delete('/products/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
