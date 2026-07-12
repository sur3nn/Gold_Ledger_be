const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const jwtConfig = require("../config/jwt");
const db = require("../config/db");

exports.login = async (req, res) => {
let conn;
    try {
 conn = await db.getConnection();
        const { user_name, password } = req.body;

        const [rows] = await conn.query(
            "SELECT * FROM users WHERE user_name=?",
            [user_name]
        );

        if (rows.length === 0)
            return res.status(404).json({
                success: false,
                message: "Invalid User_name or Password"
            });

        const user = rows[0];

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch)
            return res.status(401).json({
                success: false,
                message: "Invalid User_name or Password"
            });

        const token = jwt.sign(
            {
                id: user.Id,

            },
            jwtConfig.secret,
            {
                expiresIn: jwtConfig.expiresIn
            }
        );

        res.json({
            success: true,
            message: "Login Successful",
            token
        });

    } catch (err) {

        res.status(500).json({
            success: false,
            error: err.message
        });

    }

};