const express = require("express");
const router = express.Router();

const teacherController = require("../controllers/teacherController");
const teacherSalaryController = require("../controllers/teacherSalaryController");
const authMiddleware = require("../middlewares/authMiddleware");
const multer = require("multer");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/teachers/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    },
});

const upload = multer({ storage });
// Create teacher
router.post(
    "/",
    upload.fields([
        { name: "profilePic", maxCount: 1 },
        { name: "cnicPic", maxCount: 1 },
    ]),
    teacherController.createTeacher
);
// Get all teachers
router.get("/", teacherController.getAllTeachers);
router.get("/salaries", teacherSalaryController.getTeacherSalaries);
router.post("/salaries/pay", teacherSalaryController.payTeacherSalary);

// ─── Dashboard ───────────────────────────────
router.get('/dashboard', authMiddleware, teacherController.getDashboard);

// ─── Timetable ───────────────────────────────
router.get('/timetable', authMiddleware, teacherController.getTimetable);

// ─── Attendance ──────────────────────────────
router.get('/classes', authMiddleware, teacherController.getAssignedClasses);
router.get('/attendance/:classId/students', authMiddleware, teacherController.getStudentsForAttendance);
router.post('/attendance', authMiddleware, teacherController.markAttendance);
router.get('/attendance/:classId', authMiddleware, teacherController.getAttendanceByClass);

// ─── Assignments ─────────────────────────────
router.post('/assignments', authMiddleware, teacherController.createAssignment);
router.get('/assignments', authMiddleware, teacherController.getAssignments);
router.put('/assignments/:id', authMiddleware, teacherController.updateAssignment);
router.delete('/assignments/:id', authMiddleware, teacherController.deleteAssignment);

// ─── Marks ───────────────────────────────────
router.post('/marks', authMiddleware, teacherController.enterMarks);
router.get('/marks/:classId', authMiddleware, teacherController.getMarksByClass);

// ─── Leave ───────────────────────────────────
router.post('/leave', authMiddleware, teacherController.applyLeave);
router.get('/leave', authMiddleware, teacherController.getLeaveRequests);

// ─── Notifications ───────────────────────────
router.get('/notifications', authMiddleware, teacherController.getNotifications);
router.patch('/notifications/read-all', authMiddleware, teacherController.markNotificationRead);

// ─── Profile ─────────────────────────────────
router.get('/profile', authMiddleware, teacherController.getProfile);
router.patch('/profile', authMiddleware, teacherController.updateProfile);
// Get teacher by ID
router.get("/:id", authMiddleware, teacherController.getTeacherById);

// Update teacher
router.put(
  "/:id",
  upload.fields([
    { name: "profilePic", maxCount: 1 },
    { name: "cnicPic", maxCount: 1 },
  ]),
  teacherController.updateTeacher
);
// Delete teacher
router.delete("/:id", teacherController.deleteTeacher);



module.exports = router;
