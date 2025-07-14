import express from 'express';
import Review from '../models/Review.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { authenticateToken } from '../core/auth.js';

const router = express.Router();

// ✍️ Post a new review (only buyers can review)
router.post('/', authenticateToken, async (req, res) => {
  const { productId, rating, comment } = req.body;
  const userId = req.user.userId;

  try {
    const user = await User.findById(userId);
    if (!user || user.role !== 'buyer') {
      return res.status(403).json({ error: 'Only buyers can write reviews' });
    }

    const existingReview = await Review.findOne({ user: userId, product: productId });
    if (existingReview) {
      return res.status(400).json({ error: 'You already reviewed this product' });
    }

    const review = new Review({
      user: userId,
      product: productId,
      rating,
      comment
    });

    await review.save();
    res.status(201).json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✏️ Edit an existing review (only owner can edit)
router.put('/:reviewId', authenticateToken, async (req, res) => {
  const { rating, comment } = req.body;

  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    if (review.user.toString() !== req.user.userId) {
      return res.status(403).json({ error: 'You can only edit your own reviews' });
    }

    review.rating = rating ?? review.rating;
    review.comment = comment ?? review.comment;

    await review.save();
    res.json(review);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ❌ Delete a review (only owner or admin)
router.delete('/:reviewId', authenticateToken, async (req, res) => {
  try {
    const review = await Review.findById(req.params.reviewId);
    if (!review) return res.status(404).json({ error: 'Review not found' });

    if (
      review.user.toString() !== req.user.userId &&
      req.user.role !== 'admin'
    ) {
      return res.status(403).json({ error: 'You are not allowed to delete this review' });
    }

    await review.deleteOne();
    res.json({ message: 'Review deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔍 Get all reviews for a specific product
router.get('/product/:productId', async (req, res) => {
  try {
    const reviews = await Review.find({ product: req.params.productId }).populate('user', 'name');
    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
