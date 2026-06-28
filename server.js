require("dotenv").config()
const express = require("express")
const cors = require("cors")

const app = express()
const port = process.env.PORT
app.use(express.json())
app.use(express.urlencoded({extended:true}));
app.use(cors());

const productRoute = require("./routes/factory")
const retailerRoute = require("./routes/retailer")

app.use('/api/factory',productRoute)
app.use('/api/retailer',retailerRoute)

app.listen(port,'0.0.0.0',()=>{
    console.log(`Server running on port ${port}`,);
})