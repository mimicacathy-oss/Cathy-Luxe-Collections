/**
 * ------------------------------------------------------------------
 * File name : seed/seed.js
 * Purpose   : Fills an empty database with everything the shop needs to
 *             be usable on the first run: one admin account (with a
 *             bcrypt-hashed password), ten sample perfumes and five
 *             sample customers. It is safe to run more than once: the
 *             script clears those three collections first, so you always
 *             end up with exactly this starting data and never with
 *             duplicates.
 * Connects  : Uses config/db.js to connect and models/User.js,
 *             models/Product.js and models/Customer.js to write the data.
 *
 * Run it with : npm run seed
 * Default login: admin@perfume.com / admin123
 * ------------------------------------------------------------------
 */

require('dotenv').config();

const bcrypt = require('bcryptjs');
const { connectToDatabase } = require('../config/db');
const mongoose = require('mongoose');
const User = require('../models/User');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Order = require('../models/Order');

// The email and password of the account created by this script.
const ADMIN_EMAIL = 'admin@perfume.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_NAME = 'Shop Admin';

// Ten bottles covering every category the shop supports.
const SAMPLE_PRODUCTS = [
  { name: 'Bleu Intense', brand: 'Chanel', category: 'Men', size: '100ml', price: 320000, stock: 12, notes: 'Bergamot, mint, cedar' },
  { name: 'Sauvage Elixir', brand: 'Dior', category: 'Men', size: '60ml', price: 410000, stock: 7, notes: 'Cinnamon, lavender, amber' },
  { name: 'Coco Mademoiselle', brand: 'Chanel', category: 'Women', size: '100ml', price: 380000, stock: 9, notes: 'Orange, jasmine, patchouli' },
  { name: 'La Vie Est Belle', brand: 'Lancome', category: 'Floral', size: '75ml', price: 295000, stock: 4, notes: 'Iris, praline, vanilla' },
  { name: 'Baccarat Rouge 540', brand: 'Maison Francis Kurkdjian', category: 'Unisex', size: '70ml', price: 780000, stock: 3, notes: 'Saffron, jasmine, ambergris' },
  { name: 'Oud Wood', brand: 'Tom Ford', category: 'Oud', size: '50ml', price: 650000, stock: 6, notes: 'Oud, rosewood, cardamom' },
  { name: 'Acqua di Gio Profumo', brand: 'Giorgio Armani', category: 'Fresh', size: '75ml', price: 330000, stock: 11, notes: 'Bergamot, sage, incense' },
  { name: 'Black Opium', brand: 'Yves Saint Laurent', category: 'Women', size: '90ml', price: 350000, stock: 2, notes: 'Coffee, vanilla, white flowers' },
  { name: 'Eros Flame', brand: 'Versace', category: 'Men', size: '100ml', price: 260000, stock: 15, notes: 'Black pepper, rose, tonka' },
  { name: 'Chloe Eau de Parfum', brand: 'Chloe', category: 'Floral', size: '50ml', price: 275000, stock: 0, notes: 'Peony, lychee, freesia' }
];

// Five sample customers with a mix of preferences.
const SAMPLE_CUSTOMERS = [
  { name: 'Amina Nakato', phone: '0772001001', email: 'amina@example.com', preferences: 'Loves fresh citrus scents for the office' },
  { name: 'Brian Okello', phone: '0772001002', email: 'brian@example.com', preferences: 'Prefers strong oud for evening events' },
  { name: 'Catherine Namusoke', phone: '0772001003', email: 'catherine@example.com', preferences: 'Buys floral gifts for her sister' },
  { name: 'David Mugisha', phone: '0772001004', email: 'david@example.com', preferences: 'Only unisex perfumes, no vanilla' },
  { name: 'Esther Auma', phone: '0772001005', email: 'esther@example.com', preferences: 'Collects designer bottles, likes sweet notes' }
];

/**
 * Create the admin account with a securely hashed password.
 *
 * @returns {Promise<Object>} The saved user document.
 */
async function createAdminUser() {
  // Step 1: Never store the plain password. bcrypt.hash adds a random salt and
  // returns a one-way hash, so even a database leak does not reveal the password.
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  // Step 2: Save the account. The email is unique, so running this after a
  // clear is always safe.
  const user = await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    passwordHash: passwordHash
  });

  return user;
}

/**
 * Main seeding routine: clear the shop collections, then insert the samples.
 *
 * @returns {Promise<void>} Resolves when the database holds the sample data.
 */
async function seedDatabase() {
  // Step 1: Connect using the same configuration the server uses.
  await connectToDatabase(process.env.MONGO_URI);

  // Step 2: Remove previous data so the script can be run repeatedly without
  // creating duplicates. Orders go first because they point at customers and
  // products.
  await Order.deleteMany({});
  await Product.deleteMany({});
  await Customer.deleteMany({});
  await User.deleteMany({});

  console.log('Cleared the existing users, products, customers and orders.');

  // Step 3: Insert the admin, the perfumes and the customers.
  const admin = await createAdminUser();
  const products = await Product.insertMany(SAMPLE_PRODUCTS);
  const customers = await Customer.insertMany(SAMPLE_CUSTOMERS);

  // Step 4: Report what was created so the operator can see it worked.
  console.log('Created admin user: ' + admin.email);
  console.log('Created ' + products.length + ' sample perfumes.');
  console.log('Created ' + customers.length + ' sample customers.');
  console.log('');
  console.log('Seeding finished. You can now log in with:');
  console.log('  Email   : ' + ADMIN_EMAIL);
  console.log('  Password: ' + ADMIN_PASSWORD);
}

seedDatabase()
  .then(function () {
    // Step 5: Close the connection so the script exits cleanly instead of
    // hanging the terminal.
    return mongoose.connection.close();
  })
  .then(function () {
    process.exit(0);
  })
  .catch(async function (error) {
    console.error('Seeding failed:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  });
