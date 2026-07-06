const jwt = require("jsonwebtoken");
const jwtConfig = require("../config/jwt");

module.exports = (req, res, next) => {

    const authHeader = req.headers.authorization;

    if (!authHeader)
        return res.status(401).json({
            success:false,
            message: "Invalid Token"
        });

    const token = authHeader.split(" ")[1];

    try {

        const decoded = jwt.verify(token, jwtConfig.secret);

        req.user = decoded;

        next();

    } catch {

        res.status(401).json({
            success:false,
            message: "Invalid Token"
        });

    }

};