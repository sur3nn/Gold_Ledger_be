const db = require("../config/db");

exports.creditManagement = async (req, res) => {
    let conn;

    try {
        conn = await db.getConnection();

        const search = req.query.search ?? "";
        const limit = parseInt(req.query.limit) || 10;
        const offset = parseInt(req.query.offset) || 0;

        const keyword = `%${search}%`;

        // Combined totals, no factory/retailer split
        const summarySql = `
            SELECT
            SUM(gold_given) AS total_credit_given,
            SUM(total_net_weight) AS total_credit_taken

            FROM billing
            
            WHERE deleted_at IS NULL
            AND (factory_id IS NOT NULL OR retailer_id IS NOT NULL)
        `;

        const historySql = `
            SELECT

                b.id,
                b.bill_no,
                DATE_FORMAT(b.created_at, '%d %M %Y %h:%i %p') AS bill_date,

                COALESCE(f.name, r.name) AS party_name,
                COALESCE(f.id, r.id) AS party_Id,
                CASE
                    WHEN b.factory_id IS NOT NULL
                    THEN 'Factory'
                    ELSE 'Retailer'
                END AS type,

                CASE
                    WHEN b.factory_id IS NOT NULL
                    THEN b.gold_given
                    ELSE b.total_net_weight
                END AS gold_qty,

                b.total_amount AS amount,
                b.remarks,
                b.created_at AS recorded_date

            FROM billing b

            LEFT JOIN factory f
                ON f.id = b.factory_id

            LEFT JOIN retailer r
                ON r.id = b.retailer_id

            WHERE b.deleted_at IS NULL
            AND (
                COALESCE(f.name, r.name) LIKE ?
            )

            ORDER BY b.created_at DESC 

            LIMIT ${limit}
            OFFSET ${offset}
        `;

        const countSql = `
            SELECT COUNT(*) AS total

            FROM billing b

            LEFT JOIN factory f
                ON f.id = b.factory_id

            LEFT JOIN retailer r
                ON r.id = b.retailer_id

            WHERE b.deleted_at IS NULL
            AND (
                COALESCE(f.name, r.name) LIKE ?
            )
        `;

        const [summary] = await db.execute(summarySql);

        const [rows] = await db.execute(historySql, [keyword]);

        const [count] = await db.execute(countSql, [keyword]);

        res.json({
            success: true,
            summary: summary[0],
            total: count[0].total,
            data: rows,
        });

    } catch (e) {
        console.error(e);

        res.status(500).json({
            success: false,
            error: e.message,
        });

    } finally {
        if (conn) conn.release();
    }
};