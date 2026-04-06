const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/db.js");
const cors = require("cors"); // <-- you MUST import cors
const path = require("path");
const helmet = require('helmet');
const morgan = require('morgan'); 

dotenv.config();
const app = express();
app.use(
  helmet({
    crossOriginResourcePolicy: false, // ✅ disable default blocking
  })
);
const courseRoutes = require("./routes/courseRoutes");
const studentRoutes = require("./routes/studentRoutes");
const classRoutes = require("./routes/classRoutes");
const teacherRoutes = require("./routes/teacherRoutes");
const feeRoutes = require("./routes/feeRoutes.js");
const {attendanceRouter} = require("./routes/attendanceRoutes.js");
// Import routes
const timetableRoutes = require('./routes/timetableRoutes');
const authRoutes = require('./routes/authRoutes');
const stockRoutes = require('./routes/stockRoutes');
const diaryRoutes = require("./routes/diaryRoutes");
const teacherAttendanceRoutes = require('./routes/teacherAttendanceRoutes');


// Connect to database
connectDB();
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Middleware
app.use(express.json());

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000", "https://oxfordprogressiveschool.vercel.app"], // frontend URL
  methods: ["GET","POST","PUT","DELETE", "PATCH"],
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
// Default route
app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use("/api/students", studentRoutes);  // <-- use app.use, not app.get
app.use("/api/courses", courseRoutes);
app.use("/api/teachers", teacherRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/fees", feeRoutes);
app.use('/api/attendance', attendanceRouter);
app.use('/api/timetable', timetableRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/stock', stockRoutes);
app.use("/api/diary", diaryRoutes);
app.use('/api/teacher-attendance', teacherAttendanceRoutes);

// Start server
const PORT = process.env.PORT;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
