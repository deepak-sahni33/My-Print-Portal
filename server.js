const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/printportal';

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
app.use('/uploads', express.static(uploadsDir));

// Connect to MongoDB
mongoose.connect(MONGODB_URI)
  .then(async () => {
    console.log('Successfully connected to MongoDB');
    // Seed default pricing if empty
    await seedDefaultPricing();
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });

// Seed default pricing helper
async function seedDefaultPricing() {
  try {
    const Pricing = require('./models/Pricing');
    const count = await Pricing.countDocuments();
    if (count === 0) {
      const defaults = [
        { key: 'bw_a4', value: 2 },
        { key: 'bw_a3', value: 4 },
        { key: 'bw_legal', value: 3 },
        { key: 'color_a4', value: 8 },
        { key: 'color_a3', value: 10 },
        { key: 'color_legal', value: 9 }
      ];
      await Pricing.insertMany(defaults);
      console.log('Seeded default pricing data successfully.');
    }
  } catch (err) {
    console.error('Error seeding default pricing:', err);
  }
}

// Import & Register routes
const pricingRouter = require('./routes/pricing');
const ordersRouter = require('./routes/orders');

app.use('/api/pricing', pricingRouter);
app.use('/api/orders', ordersRouter);

// Serve frontend static files from root directory
app.use(express.static(__dirname));

// Fallback to index.html for single page application behavior
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
