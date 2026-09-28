const mongoose = require('mongoose');

// Stores one document per pricing key, e.g. { key: 'bw_a4', value: 2 }
const pricingSchema = new mongoose.Schema({
  key:   { type: String, required: true, unique: true },
  value: { type: Number, required: true, min: 0.5 }
}, { timestamps: true });

module.exports = mongoose.model('Pricing', pricingSchema);
