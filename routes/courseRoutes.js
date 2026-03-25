const express = require("express");
const router = express.Router();
const courseController = require("../controllers/courseController");


router.get("/", courseController.getAllCourses);
router.post("/", courseController.createCourse);
router.get("/getCourse", courseController.getCourses);

router.patch("/:id/status", courseController.updateStatus);
router.get("/:id", courseController.getCourseById);
router.put("/:id", courseController.updateCourse);
router.delete("/:id", courseController.deleteCourse);

module.exports = router;
