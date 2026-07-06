const db = require("../config/db");

// exports.getFactories = async (req, res) => {  
//     let conn;
// try{
//         conn = await db.getConnection();
//          const search = req.query.search;

//         if (!search) {
//             return res.status(400).json({
//                 success: false,
//                 message: "Search text is required",
//             });
//         }

//         const sql = `
//             SELECT
//                 id,
//                 factory_code,
//                 name,
//                 phone,
//                 address
//             FROM factory
//             WHERE deleted_at IS NULL
//               AND (
//                     name LIKE ?
//                  OR phone LIKE ?
//                  OR address LIKE ?
//                  OR factory_code LIKE ?
//               )
//             ORDER BY name
//             LIMIT 20
//         `;

//         const keyword = `%${search}%`;

//         const [rows] = await db.execute(sql, [
//             keyword,
//             keyword,
//             keyword,
//             keyword,
//         ]);

//         res.json({
//             success: true,
//             count: rows.length,
//             data: rows,
//         });

// }catch(e){
//   console.error(e);
//         res.status(500).json({ data: "failed", error: e.message });
// }finally{
//         if (conn) conn.release();

// }

// }
exports.getFactories = async (req, res) => {  
    let conn;
try{
        conn = await db.getConnection();
        const search = req.query.search;
        const hasSearch = !!search && search.trim() !== "";
        const keyword = hasSearch ? `%${search}%` : null;

        conn = await db.getConnection();

        const sql = `
            SELECT
                id,
                factory_code,
                name,
                phone,
                address
            FROM factory
            WHERE deleted_at IS NULL
              AND (
                    ? IS NULL
                 OR name LIKE ?
                 OR phone LIKE ?
                 OR address LIKE ?
                 OR factory_code LIKE ?
              )
            ORDER BY name
            LIMIT 20
        `;

        const [rows] = await db.execute(sql, [
            keyword,
            keyword,
            keyword,
            keyword,
            keyword,
        ]);

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