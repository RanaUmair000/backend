const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');
const multer = require("multer");

const authMiddleware = require('../middlewares/authMiddleware');
const authorizeRoles = require('../middlewares/authorizeRoles'); // if you have it

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/student_pp/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    },
});

const upload = multer({ storage });

/* ================== ROUTES ================== */

// 🔐 Admin + Teacher
router.get(
  '/getStudentByClass/:classId',
  authMiddleware,
  authorizeRoles('admin', 'teacher'),
  studentController.getStudentByClass
);


router.get(
  '/',
  authMiddleware,
  authorizeRoles('admin', 'teacher'),
  studentController.getAllStudents
);


router.get(
  '/search',
  authMiddleware,
  authorizeRoles('admin'),
  studentController.searchStudents
);

router.get(
  '/annual',
  authMiddleware,
  authorizeRoles('admin'),
  studentController.getAnnualStudents
);


router.get(
  '/:id',
  authMiddleware,
  // authorizeRoles('admin', 'teacher'),
  studentController.getStudentById
);

// 🔐 Admin Only
router.post(
  '/',
  authMiddleware,
  authorizeRoles('admin'),
  upload.fields([
      { name: "profilePic", maxCount: 1 },
      { name: "cnicPic", maxCount: 1 },
  ]),
  studentController.createStudent
);

router.put(
  '/:id',
  authMiddleware,
  authorizeRoles('admin'),
  upload.fields([
      { name: "profilePic", maxCount: 1 },
      { name: "cnicPic", maxCount: 1 },
  ]),
  studentController.updateStudent
);

router.delete(
  '/:id',
  authMiddleware,
  authorizeRoles('admin'),
  studentController.deleteStudent
);

router.get(
  '/me',
  authMiddleware,
  authorizeRoles('student'),
  studentController.getMyProfile
);

router.get(
  '/me/dashboard',
  authMiddleware,
  authorizeRoles('student'),
  studentController.getMyDashboard
);

router.get(
  '/me/fees',
  studentController.getMyFees
);

router.get(
  '/me/fees/:invoiceId',
  authMiddleware,
  authorizeRoles('student'),
  studentController.getMyInvoiceById
);

router.get(
  '/me/attendance',
  authMiddleware,
  authorizeRoles('student'),
  studentController.getMyAttendance
);
module.exports = router;
