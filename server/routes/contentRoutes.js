const express = require("express");
const router = express.Router();
const contentController = require("../controllers/contentController");
const { protect } = require("../middleware/authMiddleware");
const {upload} = require("../middleware/uploadMiddleware.js");

// All routes protected
router.use(protect);

// Content CRUD
router.get("/", contentController.getContents);
router.post("/", upload.single("file"), contentController.createContent);
router.get("/stats", contentController.getStats);
router.get("/:id", contentController.getContent);
router.put("/:id", contentController.updateContent);
router.delete("/:id", contentController.deleteContent);

module.exports = router;
