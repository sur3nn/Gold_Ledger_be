const db = require("../config/db");

// ⚠️ payment_type table columns unconfirmed — assuming a `name` column.
// Swap `pt.name` below if your actual column differs.

exports.salesReport = async (req, res) => {
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

        const recordsSql = `
            SELECT
                b.id,
                b.bill_date AS date,
                r.name AS customer,
                b.total_net_weight AS weight,
                b.total_amount AS amount,
                pt.name AS payment,
                b.bill_no AS historyLog
            FROM billing b
            LEFT JOIN retailer r ON r.id = b.retailer_id
            LEFT JOIN payment_type pt ON pt.id = b.payment_type_id
            WHERE b.deleted_at IS NULL
            AND b.retailer_id IS NOT NULL
            ${dateFilter}
            ORDER BY b.bill_date DESC
        `;

        const totalSql = `
            SELECT COALESCE(SUM(b.total_amount), 0) AS total_sales_amount
            FROM billing b
            WHERE b.deleted_at IS NULL
            AND b.retailer_id IS NOT NULL
            ${dateFilter}
        `;

        const [records] = await db.execute(recordsSql, params);
        const [totalRows] = await db.execute(totalSql, params);

        res.json({
            success: true,
            totalSalesAmount: totalRows[0].total_sales_amount,
            records,
        });

    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, error: e.message });
    } finally {
        if (conn) conn.release();
    }
};