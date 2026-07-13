
const mysql = require("mysql2/promise");
 

const connection = mysql.createPool({
    host:process.env.DB_HOST,
    user:process.env.DB_USER,
    password:process.env.DB_PASS,
    database:process.env.DB_NAME,
     waitForConnections: true,
    connectionLimit: 20, 
    queueLimit: 0
});
// Test database connection on startup
(async () => {
    try {
        const conn = await connection.getConnection();

        console.log("✅ Database connected successfully");
        console.log(`📌 Host: ${process.env.DB_HOST}`);
        console.log(`📂 Database: ${process.env.DB_NAME}`);

        conn.release();
    } catch (err) {
        console.error("❌ Database connection failed");
        console.error(err.message);
    }
})();


module.exports = connection



// const mysql = require("mysql2/promise");
// const fs = require("fs");
// const path = require("path");

// const pool = mysql.createPool({
//   host: "gateway01.ap-southeast-1.prod.alicloud.tidbcloud.com",
//   port: 4000,
//   user: "3Vs2jaEpr1nqnAq.root",
//   password: "RanXvDdvFuwtqw1A",
//   database: "gold",

//   waitForConnections: true,
//   connectionLimit: 20,
//   queueLimit: 0,

//   ssl: {
//     ca: fs.readFileSync(path.join(__dirname, "isrgrootx1.pem"))
//   }
// });

// module.exports = pool;