
const express = require("express")
const router = express.Router()
const factoryController = require("../controllers/retailerController")
const authMiddleware = require("../middleware/AuthMiddleWare");

router.get("/",authMiddleware,factoryController.getRetailers)

module.exports = router