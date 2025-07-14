import express from 'express';
import Product from '../models/Product.js';
import upload from '../core/upload.js';
import { authenticateToken } from '../core/auth.js';

const router = express.Router();

// 📦 Seller uploads product with image
router.post('/upload', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const {
      name,
      price,
      category,
      stock,
      description
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Product image is required' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    const product = new Product({
      name,
      price,
      category,
      stock,
      description,
      seller: req.user.userId, // 🧑 Assign seller from token
      image: imageUrl
    });

    const saved = await product.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🛒 Create a new product (only authenticated users)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const product = new Product({ ...req.body, seller: req.user.userId });
    const saved = await product.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 🔄 Update product (with optional image)
router.put('/:id', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    const updateFields = {
      name: req.body.name,
      price: req.body.price,
      category: req.body.category,
      stock: req.body.stock,
      description: req.body.description
    };

    if (req.file) {
      updateFields.image = `/uploads/${req.file.filename}`;
    }

    const updated = await Product.findByIdAndUpdate(req.params.id, updateFields, { new: true });

    if (!updated) return res.status(404).json({ error: 'Product not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ❌ Delete product (authenticated)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Public GET routes
router.get('/', async (req, res) => {
  try {
    const {
      search,
      minPrice,
      maxPrice,
      minStock,
      maxStock
    } = req.query;

    const filter = {};

    if (search) {
      filter.name = { $regex: search, $options: 'i' }; // case-insensitive
    }

    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    if (minStock || maxStock) {
      filter.stock = {};
      if (minStock) filter.stock.$gte = parseInt(minStock);
      if (maxStock) filter.stock.$lte = parseInt(maxStock);
    }

    const products = await Product.find(filter);
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔍 Search by name
router.get('/search/by-name', async (req, res) => {
  try {
    const { name } = req.query;
    const products = await Product.find({ name: new RegExp(name, 'i') });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🧾 Filter by category
router.get('/category/:category', async (req, res) => {
  try {
    const products = await Product.find({ category: req.params.category });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ⚠️ Low stock
router.get('/low-stock', async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold) || 5;
    const products = await Product.find({ stock: { $lt: threshold } });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ↕️ Sorted products
router.get('/sorted', async (req, res) => {
  try {
    const sortField = req.query.sort || 'price';
    const order = req.query.order === 'desc' ? -1 : 1;
    const products = await Product.find().sort({ [sortField]: order });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 👤 Get products for the currently logged-in seller
router.get('/seller/mine', authenticateToken, async (req, res) => {
  try {
    const products = await Product.find({ seller: req.user.userId });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
