const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authMiddleware = require("../middlewares/authMiddleware"); // adjust to your auth middleware
const diaryController = require("../controllers/diaryController");

// ─────────────────────────────────────────────
// MULTER SETUP — PDFs + Images
// ─────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, "../uploads/diary");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (_req, file, cb) => {
  const allowed = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only PDF and image files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB per file
});

// ─────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────


// Stats widget
router.get("/stats", authMiddleware, diaryController.getDiaryStats);

// CRUD
router.post("/", authMiddleware, upload.array("attachments", 10), diaryController.createDiary);
router.get("/", authMiddleware, diaryController.getDiaries);    
router.get("/:id", authMiddleware, diaryController.getDiaryById);
router.put("/:id", authMiddleware, upload.array("attachments", 10), diaryController.updateDiary);
router.delete("/:id", authMiddleware, diaryController.deleteDiary);

// Remove single attachment
router.delete("/:id/attachments/:attachmentId", authMiddleware, diaryController.deleteAttachment);

// Student portal — GET /diary/student/:studentId
router.get("/student/:studentId", authMiddleware, diaryController.getDiariesForStudent);

module.exports = router;

// ─────────────────────────────────────────────
// Register in your main app.js / index.js:
// ─────────────────────────────────────────────
// const diaryRoutes = require("./routes/diaryRoutes");
// app.use("/api/diary", diaryRoutes);