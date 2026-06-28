
const express = require("express")
const router = express.Router()
const factoryController = require("../controllers/factoryController")

router.get("/",factoryController.getFactories)

module.exports = router