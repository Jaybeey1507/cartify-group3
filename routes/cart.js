import express from 'express';
import Cart from '../models/Cart.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { authenticateToken } from '../core/auth.js'; // ✅ import auth

const router = express.Router();

// 🛒 Add item to cart (protected)
router.post('/add', authenticateToken, async (req, res) => {
  const { productId, quantity } = req.body;
  const userId = req.user.userId; // ✅ get from token

  try {
    let cart = await Cart.findOne({ user: userId });
    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    if (!cart) {
      cart = new Cart({
        user: userId,
        items: [{ product: productId, quantity }]
      });
    } else {
      const existingItem = cart.items.find(item => item.product.toString() === productId);
      if (existingItem) {
        existingItem.quantity += quantity;
      } else {
        cart.items.push({ product: productId, quantity });
      }
    }

    await cart.save();
    res.status(200).json(cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔍 Get cart (protected)
router.get('/', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart) return res.status(404).json({ error: 'Cart not found' });
    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ❌ Remove item (protected)
router.delete('/remove/:productId', authenticateToken, async (req, res) => {
  const userId = req.user.userId;
  try {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    cart.items = cart.items.filter(item => item.product.toString() !== req.params.productId);
    await cart.save();

    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔄 Update quantity (protected)
router.put('/update/:productId', authenticateToken, async (req, res) => {
  const { quantity } = req.body;
  const userId = req.user.userId;
  try {
    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ error: 'Cart not found' });

    const item = cart.items.find(i => i.product.toString() === req.params.productId);
    if (!item) return res.status(404).json({ error: 'Product not in cart' });

    item.quantity = quantity;
    await cart.save();

    res.json(cart);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
