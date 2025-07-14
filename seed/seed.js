import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import Review from '../models/Review.js';

dotenv.config();

await mongoose.connect(process.env.MONGO_URI);
console.log('🌱 Connected to MongoDB');

// Wipe existing data
await Promise.all([
  User.deleteMany({}),
  Product.deleteMany({}),
  Order.deleteMany({}),
  Cart.deleteMany({}),
  Review.deleteMany({})
]);

console.log('🧹 Old data cleared');

// 1. Seed users (10 buyers, 5 sellers, 1 admin)
const users = [];

for (let i = 1; i <= 10; i++) {
  users.push(new User({
    name: `Buyer ${i}`,
    email: `buyer${i}@mail.com`,
    password: `buyerpass${i}`,
    role: 'buyer',
    phone: `12345678${i}`,
    country: 'CountryX',
    state: 'StateY',
    city: 'CityZ',
    address1: `Street ${i}`
  }));
}

for (let i = 1; i <= 5; i++) {
  users.push(new User({
    name: `Seller ${i}`,
    email: `seller${i}@mail.com`,
    password: `sellerpass${i}`,
    role: 'seller',
    phone: `98765432${i}`,
    country: 'CountryX',
    state: 'StateY',
    city: 'CityZ',
    address1: `Commerce St ${i}`,
    companyName: `Store ${i}`
  }));
}

// Admin
users.push(new User({
  name: 'Admin User',
  email: 'admin@mail.com',
  password: 'admin123',
  role: 'admin'
}));

const savedUsers = await User.insertMany(users);
console.log(`👤 Inserted ${savedUsers.length} users`);

const sellerIDs = savedUsers.filter(u => u.role === 'seller').map(u => u._id);
const buyerIDs = savedUsers.filter(u => u.role === 'buyer').map(u => u._id);

// 2. Seed products (each seller posts 4 products = 20)
const products = [];

for (let i = 0; i < sellerIDs.length; i++) {
  for (let j = 1; j <= 4; j++) {
    products.push(new Product({
      name: `Product ${j} by Seller ${i + 1}`,
      description: `Description for product ${j}`,
      price: Math.floor(Math.random() * 100) + 10,
      category: 'General',
      stock: Math.floor(Math.random() * 50),
      seller: sellerIDs[i]
    }));
  }
}

const savedProducts = await Product.insertMany(products);
console.log(`📦 Inserted ${savedProducts.length} products`);

// 3. Seed orders (each buyer makes 1 order with 2 items)
const orders = buyerIDs.map((buyerId, i) => {
  const randomProducts = [
    {
      product: savedProducts[i]._id,
      quantity: 1
    },
    {
      product: savedProducts[i + 1]._id,
      quantity: 2
    }
  ];

  return {
    user: buyerId,
    products: randomProducts,
    totalAmount: randomProducts.reduce((sum, item) => {
      const prod = savedProducts.find(p => p._id.equals(item.product));
      return sum + (prod.price * item.quantity);
    }, 0),
    status: 'paid'
  };
});

await Order.insertMany(orders);
console.log(`🧾 Inserted ${orders.length} orders`);

// 4. Seed carts (each buyer has 1 cart with 2 items)
const carts = buyerIDs.map((buyerId, i) => {
  return {
    user: buyerId,
    items: [
      { product: savedProducts[i]._id, quantity: 1 },
      { product: savedProducts[i + 1]._id, quantity: 3 }
    ]
  };
});

await Cart.insertMany(carts);
console.log(`🛒 Inserted ${carts.length} carts`);

// 5. Seed reviews (each buyer reviews one product)
const reviews = buyerIDs.map((buyerId, i) => {
  return {
    user: buyerId,
    product: savedProducts[i]._id,
    rating: Math.floor(Math.random() * 5) + 1,
    comment: `Nice product ${i + 1}`
  };
});

await Review.insertMany(reviews);
console.log(`⭐ Inserted ${reviews.length} reviews`);

console.log('✅ Seeding complete!');
process.exit();
