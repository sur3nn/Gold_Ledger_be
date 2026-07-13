const express = require("express");
const { creditManagement } = require("../controllers/creditManagementController");
const router = express.Router();
const authMiddleware = require("../middleware/AuthMiddleWare");


router.get("/", authMiddleware,creditManagement);

module.exports = router;