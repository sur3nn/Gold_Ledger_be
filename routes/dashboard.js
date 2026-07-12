const express = require("express");
const { dashboardSummary } = require("../controllers/dashboardCOntroller");

const router = express.Router();
const authMiddleware = require("../middleware/AuthMiddleware");



router.get("/",authMiddleware, dashboardSummary);

module.exports = router;