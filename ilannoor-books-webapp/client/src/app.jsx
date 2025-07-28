import React, { useState, useEffect } from 'react';
import { ChevronLeft, Book, User, Phone, MapPin, Eye, EyeOff, Calendar, CheckCircle, XCircle, Clock, Plus } from 'lucide-react';

const IlannoorBooksApp = () => {
  // Authentication token stored in localStorage
  const [authToken, setAuthToken] = useState(localStorage.getItem('adminToken') || '');
  const [currentView, setCurrentView] = useState('initial');
  const [currentStep, setCurrentStep] = useState('initial');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStandard, setSelectedStandard] = useState('');
  const [selectedBooks, setSelectedBooks] = useState([]);
  const [contactInfo, setContactInfo] = useState({ name: '', phone: '', address: '' });
  const [adminCredentials, setAdminCredentials] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminName, setAdminName] = useState('');
  const [requests, setRequests] = useState([]);
  const [books, setBooks] = useState({});
  const [loading, setLoading] = useState(false);
  const [adminBookType, setAdminBookType] = useState('');
  const [adminBookStandard, setAdminBookStandard] = useState('');
  const [adminSelectedBooks, setAdminSelectedBooks] = useState([]);
  const [customBook, setCustomBook] = useState({ title: '', subject: '' });

  const API_BASE = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000';

  // Check for existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      fetch(`${API_BASE}/api/admin/requests`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => {
        if (res.ok) {
          setAuthToken(token);
          setIsAdmin(true);
          // Optionally decode token for adminName
        } else {
          localStorage.removeItem('adminToken');
        }
      })
      .catch(() => localStorage.removeItem('adminToken'));
    }
  }, []);

  // Predefined books structure
  const predefinedBooks = { /* ... as before ... */ };

  // Load books for borrower
  useEffect(() => {
    if (currentView === 'borrower' && currentStep === 'book-selection') loadBooksFromDB();
  }, [currentView, currentStep, selectedStandard]);

  const loadBooksFromDB = async () => { /* unchanged */ };

  // Borrower handlers (unchanged)
  const handleBookSelection = book => { /* ... */ };
  const handleFullSetSelection = standard => { /* ... */ };
  const handleBorrowerSubmit = async () => { /* ... */ };

  // Admin login with JWT
  const handleAdminLogin = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminCredentials)
      });
      const data = await res.json();
      if (data.success) {
        setIsAdmin(true);
        setAdminName(data.admin);
        setAuthToken(data.token);
        localStorage.setItem('adminToken', data.token);
        setCurrentView('admin-dashboard');
        loadRequests();
      } else alert('Invalid credentials!');
    } catch (err) {
      alert('Login error. Please try again.');
    }
    setLoading(false);
  };

  // Load requests with Bearer token
  const loadRequests = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/requests`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        alert('Session expired. Please login again.');
        return;
      }
      const data = await res.json();
      if (data.success) setRequests(data.requests);
    } catch (err) {
      console.error('Error loading requests:', err);
    }
  };

  // Submit new books with token
  const handleAdminBookSubmit = async () => {
    if (!adminSelectedBooks.length) return alert('Please select or add at least one book');
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/books`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ books: adminSelectedBooks })
      });
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        alert('Session expired. Please login again.');
      } else {
        const data = await res.json();
        data.success
          ? (alert('Books added successfully!'), resetAdminForm())
          : alert('Error adding books: ' + data.message);
      }
    } catch (err) {
      alert('Error adding books. Please try again.');
    }
    setLoading(false);
  };

  // Logout handler
  const handleLogout = () => {
    setIsAdmin(false);
    setAdminName('');
    setAuthToken('');
    setCurrentView('initial');
    setAdminCredentials({ username: '', password: '' });
    localStorage.removeItem('adminToken');
  };

  const resetAdminForm = () => {
    setAdminBookType('');
    setAdminBookStandard('');
    setAdminSelectedBooks([]);
  };

  // Render functions...
  // Update logout button to use handleLogout
  // ... rest of render logic unchanged

  return (
    <div>
      {currentView === 'initial' && renderInitialScreen()}
      {currentView === 'admin-login' && renderAdminLogin()}
      {currentView === 'admin-dashboard' && renderAdminDashboard()}
      {currentView === 'add-books' && renderAddBooks()}
      {/* ... borrower views ... */}
    </div>
  );
};

export default IlannoorBooksApp;
