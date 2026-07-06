const db = require("../config/db");

exports.products = async (req, res) => {  
    let conn;
try{
        conn = await db.getConnection();
         const search = req.query.search;

        if (!search) {
            return res.status(400).json({
                success: false,
                message: "Search text is required",
            });
        }

        const sql = `
            SELECT
                id,
                name
            FROM product
            WHERE deleted_at IS NULL
              AND (name LIKE ?)
            ORDER BY name
            LIMIT 20
        `;

        const keyword = `%${search}%`;

        const [rows] = await db.execute(sql, [
            keyword,
        ]);
console.log("rows",rows);

        res.json({
            success: true,
            count: rows.length,
            data: rows,
        });

}catch(e){
  console.error(e);
        res.status(500).json({ data: "failed", error: e.message });
}finally{
        if (conn) conn.release();

}

}