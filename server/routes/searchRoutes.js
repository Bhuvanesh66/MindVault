const express = require("express");
const router = express.Router();
const searchController = require("../controllers/searchController");
const { protect } = require("../middleware/authMiddleware");

// All routes protected
router.use(protect);

router.post("/semantic", searchController.semanticSearch);
router.get("/text", searchController.textSearch);
router.post("/hybrid", searchController.hybridSearch);
router.get("/similar/:id", searchController.findSimilar);

module.exports = router;
