require("dotenv").config()
const express = require("express")
const cors = require("cors")

const app = express()
const port = process.env.PORT || 5000;
app.use(express.json())
app.use(express.urlencoded({extended:true}));
app.use(cors({
    origin:"*"
}));

const factoryRoute = require("./routes/factory")
const retailerRoute = require("./routes/retailer")
const homeRoute = require("./routes/home")
const productRoute = require("./routes/product")
const creditRoute = require("./routes/credit");
const dashboardRoute = require("./routes/dashboard");
const reportRoute = require("./routes/report");
const authRoute = require("./routes/auth");


console.log("initial");

app.use('/api/factory',factoryRoute)
console.log("factory");

app.use('/api/retailer',retailerRoute)
console.log("retailer");

app.use('/api/home',homeRoute)
console.log("home");

app.use('/api/products',productRoute)
console.log("product");

app.use("/api/credit", creditRoute);
console.log("credit");

app.use("/api/dashboard", dashboardRoute);
console.log("dash");

app.use("/api/reports", reportRoute);
console.log("report");

app.use("/api/login", authRoute);
console.log("login");


app.get("/api/health-check", (req, res) => {
    res.status(200).json({
        success: true,
        message: "Server is running fine",
        timestamp: new Date().toISOString()
    });
});

app.listen(port,()=>{
    console.log(`Server running on port ${port}`,);
})