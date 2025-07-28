// server.js - SECURE VERSION
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('client/build'));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb+srv://your-username:your-password@cluster0.mongodb.net/ilannoor-books?retryWrites=true&w=majority', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Auto-increment helper
const counterSchema = new mongoose.Schema({
  _id: String,
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

const getNextSequence = async (name) => {
  const counter = await Counter.findByIdAndUpdate(
    name,
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
};

// Admin Schema for database storage
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }, // This will be hashed
  createdAt: { type: Date, default: Date.now }
});

const Admin = mongoose.model('Admin', adminSchema);

// Other schemas remain the same
const borrowerRequestSchema = new mongoose.Schema({
  requestId: { type: Number, unique: true },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  standard: { type: Number, required: true },
  requestType: { type: String, enum: ['full-set', 'individual'], required: true },
  books: [{ 
    title: String, 
    subject: String 
  }],
  requestTime: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' }
});

const bookSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subject: { type: String, required: true },
  standard: { type: Number, required: true },
  addedBy: { type: String, required: true },
  addedTime: { type: Date, default: Date.now }
});

const BorrowerRequest = mongoose.model('BorrowerRequest', borrowerRequestSchema);
const Book = mongoose.model('Book', bookSchema);

// Initialize admin users (run only once)
const initializeAdmins = async () => {
  try {
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
      console.log('Initializing admin users...');
      
      const admins = [
        { username: 'furqan', password: process.env.ADMIN_PASSWORD || 'doffy1234' },
        { username: 'danish', password: process.env.ADMIN_PASSWORD || 'doffy1234' },
        { username: 'abdurrahman', password: process.env.ADMIN_PASSWORD || 'doffy1234' }
      ];
      
      for (const admin of admins) {
        const hashedPassword = await bcrypt.hash(admin.password, 10);
        await Admin.create({
          username: admin.username,
          password: hashedPassword
        });
      }
      
      console.log('Admin users initialized successfully');
    }
  } catch (error) {
    console.error('Error initializing admins:', error);
  }
};

// Call initialization on server start
initializeAdmins();

// JWT Middleware for protected routes
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-jwt-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Routes
// Borrower request submission (unchanged)
app.post('/api/borrower-requests', async (req, res) => {
  try {
    const { name, phone, address, standard, requestType, books } = req.body;
    
    const requestId = await getNextSequence('borrowerRequest');
    
    const newRequest = new BorrowerRequest({
      requestId,
      name,
      phone,
      address,
      standard,
      requestType,
      books,
      requestTime: new Date()
    });
    
    await newRequest.save();
    res.status(201).json({ success: true, requestId, message: 'Request submitted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error submitting request', error: error.message });
  }
});

// SECURE Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    // Find admin in database
    const admin = await Admin.findOne({ username });
    if (!admin) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { username: admin.username, id: admin._id },
      process.env.JWT_SECRET || 'your-jwt-secret-key',
      { expiresIn: '24h' }
    );
    
    res.json({ 
      success: true, 
      admin: admin.username,
      token: token
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Login error', error: error.message });
  }
});

// Protected admin routes
app.get('/api/admin/requests', authenticateToken, async (req, res) => {
  try {
    const requests = await BorrowerRequest.find().sort({ requestTime: -1 });
    res.json({ success: true, requests });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching requests' });
  }
});

app.post('/api/admin/books', authenticateToken, async (req, res) => {
  try {
    const { books } = req.body;
    
    const bookPromises = books.map(book => {
      const newBook = new Book({
        title: book.title,
        subject: book.subject,
        standard: book.standard,
        addedBy: req.user.username, // Get from JWT token
        addedTime: new Date()
      });
      return newBook.save();
    });
    
    await Promise.all(bookPromises);
    res.status(201).json({ success: true, message: 'Books added successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding books', error: error.message });
  }
});

// Get books by standard (unchanged)
app.get('/api/books/:standard', async (req, res) => {
  try {
    const { standard } = req.params;
    const books = await Book.find({ standard: parseInt(standard) });
    res.json({ success: true, books });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching books' });
  }
});

// Get all books (unchanged)
app.get('/api/books', async (req, res) => {
  try {
    const books = await Book.find().sort({ standard: 1, subject: 1 });
    res.json({ success: true, books });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching books' });
  }
});

// Admin management routes (bonus - for changing passwords later)
app.post('/api/admin/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ success: false, message: 'Admin not found' });
    }
    
    const isValidPassword = await bcrypt.compare(currentPassword, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }
    
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    admin.password = hashedNewPassword;
    await admin.save();
    
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error changing password' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
