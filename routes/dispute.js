import express from 'express';
import Dispute from '../models/Dispute.js';
import Order from '../models/Order.js';
import upload from '../core/upload.js';
import { authenticateToken } from '../core/auth.js';

const router = express.Router();

// 🧾 Buyer submits dispute
// 🧾 Buyer submits dispute
router.post('/', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { orderId, message } = req.body;
    const buyerId = req.user.userId;

    // load order and determine seller
    const order = await Order.findById(orderId).populate('products.product');
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const sellerId = order.products[0]?.product?.seller;
    if (!sellerId) return res.status(400).json({ error: 'Could not determine seller.' });

    // build initial buyer reply
    const initialFile = req.file ? `/uploads/${req.file.filename}` : null;
    const dispute = new Dispute({
      order:       orderId,
      buyer:       buyerId,
      seller:      sellerId,
      replies: [{
        author:  'buyer',
        message,
        file:    initialFile
      }]
    });

    await dispute.save();
    return res.status(201).json(dispute);
  } catch (err) {
    console.error("❌ Dispute creation error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// 👤 Buyer views their own disputes
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const disputes = await Dispute.find({ buyer: req.user.userId })
      .populate('order')
      .sort({ createdAt: -1 });
    res.json(disputes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🛍 Seller sees disputes for their orders
router.get('/for-seller', authenticateToken, async (req, res) => {
  if (req.user.role !== 'seller') return res.status(403).json({ error: 'Sellers only' });

  try {
    const disputes = await Dispute.find({ seller: req.user.userId })
      .populate('order')
      .sort({ createdAt: -1 });
    res.json(disputes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🛡 Admin sees all disputes
router.get('/all', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

  try {
    const disputes = await Dispute.find()
      .populate('order buyer seller')
      .sort({ createdAt: -1 });
    res.json(disputes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✉️ Seller replies to a dispute
// ✉️ Seller replies to a dispute
router.put('/:id/reply', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { response } = req.body;
    const filePath = req.file ? `/uploads/${req.file.filename}` : null;

    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
    if (req.user.userId !== String(dispute.seller)) {
      return res.status(403).json({ error: 'Only the seller can respond' });
    }

    // **NEW** push into replies
    dispute.replies.push({
      author: 'seller',
      message: response,
      file: filePath
    });

    await dispute.save();
    res.json(dispute);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Buyer follow-up (buyer-only)
// routes/disputes.js
// Buyer follow-up (buyer-only)
router.put('/:id/buyer-reply', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    const { message } = req.body;
    const filePath = req.file ? `/uploads/${req.file.filename}` : null;

    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });
    if (req.user.userId !== String(dispute.buyer)) {
      return res.status(403).json({ error: 'Only the buyer can follow up' });
    }

    // **NEW** push into replies
    dispute.replies.push({
      author: 'buyer',
      message,
      file: filePath
    });

    await dispute.save();

    // return full populated doc
    const updated = await Dispute.findById(req.params.id)
      .populate('buyer', 'email')
      .populate('seller', 'email');
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});


// ✅ Mark dispute resolved (Admin only)
router.put('/:id/resolve', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

  try {
    const dispute = await Dispute.findById(req.params.id);
    if (!dispute) return res.status(404).json({ error: 'Dispute not found' });

    dispute.resolved = true;
    await dispute.save();

    res.json({ message: 'Dispute resolved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/disputes/seller/mine
router.get('/seller/mine', authenticateToken, async (req, res) => {
  if (req.user.role !== 'seller') {
    return res.status(403).json({ error: 'Access denied' });
  }

  try {
    const sellerId = req.user.userId;

    const disputes = await Dispute.find()
      .populate({
        path: 'orderId',
        populate: {
          path: 'products.product',
          model: 'Product'
        }
      })
      .populate('userId', 'name email');

    // Filter disputes where at least one product belongs to this seller
    const sellerDisputes = disputes.filter(dispute =>
      dispute.orderId?.products?.some(p => p.product?.seller?.toString() === sellerId)
    );

    res.json(sellerDisputes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
