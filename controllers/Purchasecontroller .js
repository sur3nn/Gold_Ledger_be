const db = require("../config/db");

exports.purchaseReport = async (req, res) => {
    let conn;

    try {
        conn = await db.getConnection();

        const { from, to } = req.query;
        const params = [];
        let dateFilter = "";

        if (from && to) {
            dateFilter = "AND b.bill_date BETWEEN ? AND ?";
            params.push(from, to);
        }

        // rate = total_amount / total_net_weight (guard divide-by-zero)
        const recordsSql = `
            SELECT
                b.id,
                b.bill_date AS date,
                f.name AS factorySource,
                b.total_net_weight AS weight,
                CASE
                    WHEN b.total_net_weight > 0
                    THEN b.total_amount / b.total_net_weight
                    ELSE 0
                END AS rate,
                b.total_amount AS total,
                b.bill_no AS historyLog
            FROM billing b
            LEFT JOIN factory f ON f.id = b.factory_id
            WHERE b.deleted_at IS NULL
            AND b.factory_id IS NOT NULL
            ${dateFilter}
            ORDER BY b.bill_date DESC
        `;

        const totalSql = `
            SELECT COALESCE(SUM(b.total_amount), 0) AS total_purchase_amount
            FROM billing b
            WHERE b.deleted_at IS NULL
            AND b.factory_id IS NOT NULL
            ${dateFilter}
        `;

        const [records] = await db.execute(recordsSql, params);
        const [totalRows] = await db.execute(totalSql, params);

        res.json({
            success: true,
            totalPurchaseAmount: totalRows[0].total_purchase_amount,
            records,
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        if (conn) conn.release();
    }
};