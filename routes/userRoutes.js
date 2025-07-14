import express from 'express';
import User from '../models/User.js';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { authenticateToken } from '../core/auth.js';


const router = express.Router();
dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

const ADMIN_PASSKEY = process.env.ADMIN_PASSKEY;

// POST /api/users/register
router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      phone,
      country,
      state,
      city,
      address1,
      address2,
      companyName,
      adminPasskey
    } = req.body;

    if (role === 'admin') {
      if (adminPasskey !== ADMIN_PASSKEY) {
        return res.status(401).json({ error: 'Invalid admin passkey' });
      }
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const user = new User({
      name,
      email,
      password,
      role,
      phone,
      country,
      state,
      city,
      address1,
      address2,
      companyName
    });

    const savedUser = await user.save();
    res.status(201).json({
      _id: savedUser._id,
      email: savedUser.email,
      role: savedUser.role
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/users/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // 🔍 Find user by email
    const user = await User.findOne({ email });
    if (!user || user.password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // 🔐 Generate JWT
    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    // ✅ Send token and basic user info
    res.json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});


// GET /api/users/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json(response);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/me/:id
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const updated = await User.findByIdAndUpdate(req.user.userId, req.body, {
      new: true,
      select: '-password'
    });
    if (!updated) return res.status(404).json({ error: 'User not found' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users
router.get('/', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admins only.' });
  }
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/role/:role
router.get('/role/:role', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admins only.' });
  }

  try {
    const users = await User.find({ role: req.params.role }).select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
