
const express = require("express")
const router = express.Router()
const factoryController = require("../controllers/factoryController")
const authMiddleware = require("../middleware/AuthMiddleWare");

router.get("/",authMiddleware,factoryController.getFactories)

module.exports = router