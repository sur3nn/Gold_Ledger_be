
const express = require("express")
const router = express.Router()
const factoryController = require("../controllers/factoryController")
const authMiddleware = require("../middleware/AuthMiddleware");

router.get("/",authMiddleware,factoryController.getFactories)

module.exports = router