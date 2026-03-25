/**
 * backend/authController.js
 * Login controller for School Management System
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const Admin = require('../models/Admin');
const Teacher = require('../models/Teacher');
const Student = require('../models/Student');
// const Accountant = require('../models/Accountant');

const DEMO_USERS = [
  {
    _id: 'u001',
    username: 'admin',
    password: bcrypt.hashSync('admin123', 10),
    role: 'admin',
    name: 'System Administrator',
    email: 'admin@school.edu',
    status: 'Active',
  },
  {
    _id: 'u002',
    username: 'teacher01',
    password: bcrypt.hashSync('teacher123', 10),
    role: 'teacher',
    name: 'Ahmed Khan',
    email: 'ahmed.khan@school.edu',
    teacherId: 'T001',
    status: 'Active',
  },
  {
    _id: 'u003',
    username: 'accountant',
    password: bcrypt.hashSync('acc123', 10),
    role: 'accountant',
    name: 'Sara Malik',
    email: 'sara@school.edu',
    status: 'Active',
  },
  {
    _id: 'u004',
    username: 'student01',
    password: bcrypt.hashSync('student123', 10),
    role: 'student',
    name: 'Ali Hassan',
    email: 'ali@school.edu',
    rollNumber: 'S-2024-001',
    status: 'Active',
  },
];

const JWT_SECRET = process.env.JWT_SECRET || 'school-ms-super-secret-key-2024';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// ---------------------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------------------
// exports.login = async (req, res) => {
//   try {
//     const { username, password, role } = req.body;

//     // --- Validation ---
//     if (!username || !password || !role) {
//       return res.status(400).json({
//         success: false,
//         message: 'Username, password and role are required',
//       });
//     }

//     // --- Find user ---
//     // PRODUCTION: Replace DEMO_USERS lookup with:
//     // const user = await User.findOne({ username: username.toLowerCase().trim(), role });
//     const user = DEMO_USERS.find(
//       (u) =>
//         u.username === username.toLowerCase().trim() && u.role === role
//     );

//     if (!user) {
//       return res.status(401).json({
//         success: false,
//         message: 'Invalid credentials or role mismatch',
//       });
//     }

//     // --- Check status ---
//     if (user.status !== 'Active') {
//       return res.status(403).json({
//         success: false,
//         message: 'Your account has been deactivated. Contact admin.',
//       });
//     }

//     // --- Verify password ---
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(401).json({
//         success: false,
//         message: 'Invalid credentials',
//       });
//     }

//     // --- Build JWT payload ---
//     const payload = {
//       _id: user._id,
//       username: user.username,
//       role: user.role,
//       name: user.name,
//       email: user.email,
//       // Role-specific fields
//       ...(user.teacherId && { teacherId: user.teacherId }),
//       ...(user.rollNumber && { rollNumber: user.rollNumber }),
//     };

//     const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

//     // --- Role-based redirect path ---
//     const redirectMap = {
//       admin:      '/admin/dashboard',
//       teacher:    '/teacher/dashboard',
//       accountant: '/accountant/dashboard',
//       student:    '/student/dashboard',
//     };

//     res.status(200).json({
//       success: true,
//       message: 'Login successful',
//       token,
//       user: {
//         id: user._id,
//         name: user.name,
//         username: user.username,
//         email: user.email,
//         role: user.role,
//         ...(user.teacherId && { teacherId: user.teacherId }),
//         ...(user.rollNumber && { rollNumber: user.rollNumber }),
//       },
//       redirect: redirectMap[user.role] || '/dashboard',
//     });
//   } catch (err) {
//     console.error('Login error:', err);
//     res.status(500).json({
//       success: false,
//       message: 'Server error. Please try again.',
//     });
//   }
// };

exports.login = async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Username, password and role are required',
      });
    }

    let Model;

    // 🔥 Select model based on role
    switch (role) {
      case 'admin':
        Model = Admin;
        break;
      case 'teacher':
        Model = Teacher;
        break;
      case 'student':
        Model = Student;
        break;
      case 'accountant':
        Model = Accountant;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid role selected',
        });
    }

    console.log(Model, username, password, role);

    const user = await Model.findOne({
      email: username.toLowerCase().trim(),
    });
    console.log("Selected Model:", Model.modelName);
    console.log("Searching for:", username.toLowerCase().trim());
    console.log("User found:", user);
    if (!user) {  
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // 🔐 Compare password
    const isMatch = password === user.password;;

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // 🎫 Create JWT
    const payload = {
      _id: user._id,
      role,
      name: user.name,
      username: user.email,
      };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    // 🚀 Role-based redirect
    const redirectMap = {
      admin: '/admin/dashboard',
      teacher: '/teacher/dashboard',
      accountant: '/accountant/dashboard',
      student: '/student/dashboard',
    };

    res.status(200).json({
      success: true,
      token,
      user: payload,
      redirect: redirectMap[role],
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// ---------------------------------------------------------------------------
// POST /api/auth/logout  (client-side token removal is primary, this is optional)
// ---------------------------------------------------------------------------
exports.logout = (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
};

// ---------------------------------------------------------------------------
// GET /api/auth/me  — verify token and return user info
// ---------------------------------------------------------------------------
exports.getMe = (req, res) => {
  // Requires authMiddleware to run first
  res.json({ success: true, user: req.user });
};
