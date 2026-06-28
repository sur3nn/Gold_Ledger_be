require("dotenv").config()
const express = require("express")
const cors = require("cors")

const app = express()
const port = process.env.PORT
app.use(express.json())
app.use(express.urlencoded({extended:true}));
app.use(cors());

const factoryRoute = require("./routes/factory")
const retailerRoute = require("./routes/retailer")
const homeRoute = require("./routes/home")
const productRoute = require("./routes/product")

app.use('/api/factory',factoryRoute)
app.use('/api/retailer',retailerRoute)
app.use('/api/home',homeRoute)
app.use('/api/products',productRoute)

app.listen(port,'0.0.0.0',()=>{
    console.log(`Server running on port ${port}`,);
})