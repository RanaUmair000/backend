const express = require("express");
const {
  createClass,
  getAllClasses,
  getClassById,
  updateClass,
  deleteClass,
  updateStatus,
} = require("../controllers/classController");

const router = express.Router();

router.get("/", getAllClasses);
router.post("/", createClass);
router.get("/:id", getClassById);
router.put("/:id", updateClass);
router.delete("/:id", deleteClass);
router.patch("/:id/status", updateStatus);


module.exports = router; // ✅ CORRECT
