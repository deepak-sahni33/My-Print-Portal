const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const Order = require('../models/Order');

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Shared In-Memory Orders Fallback (Pre-seeded with demo orders)
let memoryOrders = [
  {
    orderId: 'PE-2026-0001',
    createdAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    status: 'completed',
    files: [{ originalName: 'Annual_Report_2026.pdf', filename: 'Annual_Report_2026.pdf', size: 2456000, mimetype: 'application/pdf', path: '#' }],
    settings: { colorMode: 'color', sideMode: 'double', paperSize: 'a4', copies: 5, pages: 48 },
    customer: { name: 'Priya Sharma', phone: '9876543210', email: 'priya@example.com', notes: '' },
    pricing: { pricePerPage: 8, total: 1920 }
  },
  {
    orderId: 'PE-2026-0002',
    createdAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    status: 'ready',
    files: [{ originalName: 'Resume_Rahul.docx', filename: 'Resume_Rahul.docx', size: 125000, mimetype: 'application/octet-stream', path: '#' }],
    settings: { colorMode: 'bw', sideMode: 'single', paperSize: 'a4', copies: 10, pages: 2 },
    customer: { name: 'Rahul Kumar', phone: '9123456789', email: '', notes: 'Please use thick paper' },
    pricing: { pricePerPage: 2, total: 40 }
  },
  {
    orderId: 'PE-2026-0003',
    createdAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    status: 'printing',
    files: [
      { originalName: 'Poster_Design.png', filename: 'Poster_Design.png', size: 5800000, mimetype: 'image/png', path: '#' },
      { originalName: 'Banner.jpg', filename: 'Banner.jpg', size: 3200000, mimetype: 'image/jpeg', path: '#' }
    ],
    settings: { colorMode: 'color', sideMode: 'single', paperSize: 'a3', copies: 2, pages: 1 },
    customer: { name: 'Ananya Singh', phone: '9988776655', email: 'ananya@biz.com', notes: '' },
    pricing: { pricePerPage: 10, total: 40 }
  },
  {
    orderId: 'PE-2026-0004',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    status: 'pending',
    files: [{ originalName: 'Thesis_Final.pdf', filename: 'Thesis_Final.pdf', size: 8900000, mimetype: 'application/pdf', path: '#' }],
    settings: { colorMode: 'bw', sideMode: 'double', paperSize: 'a4', copies: 1, pages: 120 },
    customer: { name: 'Dev Mehta', phone: '9000112233', email: 'dev@uni.edu', notes: 'Need spiral binding' },
    pricing: { pricePerPage: 2, total: 240 }
  }
];
let memorySequence = 4;

// POST /api/orders - Unified order placement with file upload
router.post('/', upload.array('files'), async (req, res) => {
  try {
    const filesData = (req.files || []).map(f => ({
      originalName: f.originalname,
      filename: f.filename,
      size: f.size,
      mimetype: f.mimetype,
      path: `/uploads/${f.filename}`
    }));

    const {
      name,
      phone,
      email,
      notes,
      colorMode,
      sideMode,
      paperSize,
      copies,
      pages,
      pricePerPage,
      totalPrice
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Customer name and phone number are required.' });
    }

    const orderData = {
      settings: {
        colorMode: colorMode || 'bw',
        sideMode: sideMode || 'single',
        paperSize: paperSize || 'a4',
        copies: parseInt(copies) || 1,
        pages: parseInt(pages) || 1
      },
      customer: {
        name,
        phone,
        email: email || '',
        notes: notes || ''
      },
      files: filesData,
      pricing: {
        pricePerPage: parseFloat(pricePerPage) || 0,
        total: parseFloat(totalPrice) || 0
      }
    };

    if (mongoose.connection.readyState === 1) {
      const order = new Order(orderData);
      await order.save();
      return res.status(201).json(order);
    } else {
      console.warn('MongoDB not connected, saving order to memory cache');
      memorySequence += 1;
      const year = new Date().getFullYear();
      const orderId = `PE-${year}-${String(memorySequence).padStart(4, '0')}`;
      const memoryOrder = {
        orderId,
        status: 'pending',
        createdAt: new Date().toISOString(),
        ...orderData
      };
      memoryOrders.push(memoryOrder);
      return res.status(201).json(memoryOrder);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to create order: ' + err.message });
  }
});

// GET /api/orders/stats - Retrieve overall stats for the dashboard
router.get('/stats', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const total = await Order.countDocuments();
      const pending = await Order.countDocuments({ status: 'pending' });
      const printing = await Order.countDocuments({ status: 'printing' });
      const ready = await Order.countDocuments({ status: 'ready' });
      const completed = await Order.countDocuments({ status: 'completed' });

      const revenueResult = await Order.aggregate([
        { $group: { _id: null, totalRevenue: { $sum: '$pricing.total' } } }
      ]);
      const revenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

      return res.json({ total, pending, printing, ready, completed, revenue });
    } else {
      const total = memoryOrders.length;
      const pending = memoryOrders.filter(o => o.status === 'pending').length;
      const printing = memoryOrders.filter(o => o.status === 'printing').length;
      const ready = memoryOrders.filter(o => o.status === 'ready').length;
      const completed = memoryOrders.filter(o => o.status === 'completed').length;
      const revenue = memoryOrders.reduce((sum, o) => sum + (o.pricing?.total || 0), 0);

      return res.json({ total, pending, printing, ready, completed, revenue });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve stats: ' + err.message });
  }
});

// GET /api/orders - Get orders for admin dashboard (supports search and status filter)
router.get('/', async (req, res) => {
  try {
    const { search, filter } = req.query;

    if (mongoose.connection.readyState === 1) {
      let query = {};

      if (filter && filter !== 'all') {
        query.status = filter;
      }

      if (search) {
        const searchRegex = new RegExp(search, 'i');
        query.$or = [
          { orderId: searchRegex },
          { 'customer.name': searchRegex },
          { 'customer.phone': searchRegex }
        ];
      }

      const orders = await Order.find(query).sort({ createdAt: -1 });
      return res.json(orders);
    } else {
      let filtered = [...memoryOrders];
      if (filter && filter !== 'all') {
        filtered = filtered.filter(o => o.status === filter);
      }
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(o => 
          o.orderId.toLowerCase().includes(s) ||
          o.customer.name.toLowerCase().includes(s) ||
          o.customer.phone.includes(s)
        );
      }
      // Sort newest first
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json(filtered);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders: ' + err.message });
  }
});

// GET /api/orders/:id - Fetch single order details (for tracking)
router.get('/:id', async (req, res) => {
  try {
    const targetId = req.params.id.toUpperCase();
    if (mongoose.connection.readyState === 1) {
      const order = await Order.findOne({ orderId: targetId });
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      return res.json(order);
    } else {
      const order = memoryOrders.find(o => o.orderId === targetId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      return res.json(order);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to find order: ' + err.message });
  }
});

// PATCH /api/orders/:id/status - Update order status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'printing', 'ready', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const targetId = req.params.id.toUpperCase();

    if (mongoose.connection.readyState === 1) {
      const order = await Order.findOneAndUpdate(
        { orderId: targetId },
        { status },
        { new: true }
      );

      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      return res.json(order);
    } else {
      const order = memoryOrders.find(o => o.orderId === targetId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      order.status = status;
      return res.json(order);
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status: ' + err.message });
  }
});

module.exports = router;
