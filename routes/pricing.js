const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Pricing = require('../models/Pricing');

// Shared in-memory pricing fallback
const memoryPricing = {
  bw_a4: 2,
  color_a4: 8,
  bw_a3: 4,
  color_a3: 10,
  bw_legal: 3,
  color_legal: 9
};

// GET /api/pricing - Get all pricing configuration as a key-value object
router.get('/', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const pricingList = await Pricing.find({});
      const pricingMap = {};
      pricingList.forEach(item => {
        pricingMap[item.key] = item.value;
      });
      // Sync memory cache
      Object.assign(memoryPricing, pricingMap);
      return res.json(pricingMap);
    } else {
      console.warn('MongoDB not connected, serving pricing from memory cache');
      return res.json(memoryPricing);
    }
  } catch (err) {
    console.error('Database error fetching pricing:', err);
    res.json(memoryPricing);
  }
});

// POST /api/pricing/update - Update pricing configuration
router.post('/update', async (req, res) => {
  try {
    const updates = req.body; // Expects object: { bw_a4: 2, color_a4: 8, ... }
    
    // Save to memory cache in all cases
    Object.keys(updates).forEach(key => {
      const val = parseFloat(updates[key]);
      if (!isNaN(val) && val >= 0.5) {
        memoryPricing[key] = val;
      }
    });

    if (mongoose.connection.readyState === 1) {
      const updatePromises = Object.keys(updates).map(async (key) => {
        const val = parseFloat(updates[key]);
        if (!isNaN(val) && val >= 0.5) {
          return Pricing.findOneAndUpdate(
            { key },
            { value: val },
            { new: true, upsert: true }
          );
        }
      });
      await Promise.all(updatePromises);
    }
    
    res.json({ 
      message: 'Pricing updated successfully (saved to ' + (mongoose.connection.readyState === 1 ? 'MongoDB' : 'Memory Cache') + ')' 
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update pricing: ' + err.message });
  }
});

module.exports = router;
