
const express = require("express")
const router = express.Router()
const productController = require("../controllers/productController")
const authMiddleware = require("../middleware/AuthMiddleWare");

router.get("/",authMiddleware,productController.products)

module.exports = router