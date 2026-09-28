const mongoose = require('mongoose');

// ── Counter sub-document for auto-incrementing Order ID ────────
const counterSchema = new mongoose.Schema({
  _id:     { type: String, required: true },
  seq:     { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', counterSchema);

// ── File attachment sub-schema ─────────────────────────────────
const fileSchema = new mongoose.Schema({
  originalName: String,
  filename:     String,   // stored filename on disk
  size:         Number,
  mimetype:     String,
  path:         String    // relative path under /uploads
}, { _id: false });

// ── Main Order Schema ──────────────────────────────────────────
const orderSchema = new mongoose.Schema({
  orderId: {
    type:   String,
    unique: true,
    index:  true
  },
  status: {
    type:    String,
    enum:    ['pending', 'printing', 'ready', 'completed'],
    default: 'pending'
  },
  settings: {
    colorMode: { type: String, enum: ['bw', 'color'],            default: 'bw'     },
    sideMode:  { type: String, enum: ['single', 'double'],       default: 'single' },
    paperSize: { type: String, enum: ['a4', 'a3', 'legal'],      default: 'a4'     },
    copies:    { type: Number, min: 1, max: 100,                 default: 1        },
    pages:     { type: Number, min: 1,                           default: 1        }
  },
  customer: {
    name:  { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, default: '' },
    notes: { type: String, default: '' }
  },
  files: [fileSchema],
  pricing: {
    pricePerPage: { type: Number, required: true },
    total:        { type: Number, required: true }
  }
}, {
  timestamps: true   // adds createdAt + updatedAt
});

// ── Auto-generate orderId before saving ───────────────────────
orderSchema.pre('save', async function (next) {
  if (!this.isNew) return next();
  try {
    const counter = await Counter.findByIdAndUpdate(
      'orderSeq',
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const year = new Date().getFullYear();
    this.orderId = `PE-${year}-${String(counter.seq).padStart(4, '0')}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('Order', orderSchema);
