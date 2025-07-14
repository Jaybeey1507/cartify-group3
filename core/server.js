import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import cors from 'cors';
import path from 'path';
import productRoutes from '../routes/productRoutes.js';
import userRoutes from '../routes/userRoutes.js';
import cartRoutes from '../routes/cart.js';
import orderRoutes from '../routes/order.js';
import reviewRoutes from '../routes/review.js';
import adminRoutes from '../routes/adminRoutes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const __dirname = path.resolve();
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'dashboard')));
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/products', productRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/carts', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reviews', reviewRoutes);

app.get('/', (req, res) => {
  res.send('🛒 Cartify API is running!');
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => console.error('❌ MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
