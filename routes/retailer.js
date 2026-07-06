
const express = require("express")
const router = express.Router()
const factoryController = require("../controllers/retailerController")
const authMiddleware = require("../middleware/AuthMiddleware");

router.get("/",authMiddleware,factoryController.getRetailers)

module.exports = router