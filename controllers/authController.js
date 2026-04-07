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

    const students = await Teacher.find();

    const user = await Model.findOne({
      email: username.toLowerCase().trim(),
    });
    console.log(students);

    if (!user) {  
      return res.status(404).json({
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
      admin: '/',
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
