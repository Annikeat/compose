// server.js
require('dotenv').config();  // Load env variables from .env file

const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');
const morgan = require('morgan');
const chalk = require('chalk');  // For colorized logs

const app = express();
const port = process.env.PORT || 3000;

// DB config from env
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
};

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Custom timestamped logging
app.use(
  morgan(function (tokens, req, res) {
    return [
      chalk.gray(`[${new Date().toISOString()}]`),
      chalk.cyan(tokens.method(req, res)),
      chalk.yellow(tokens.url(req, res)),
      chalk.green(tokens.status(req, res)),
      chalk.white(tokens['response-time'](req, res) + ' ms'),
    ].join(' ');
  })
);

// Database connection helper
async function getConnection() {
  return await mysql.createConnection(dbConfig);
}

// ------------------------- ROUTES -------------------------

// GET all inventory items
app.get('/inventory', async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.query('SELECT * FROM inventory ORDER BY name');
    await conn.end();
    res.json(rows);
  } catch (err) {
    console.error(chalk.red('GET /inventory error:'), err);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET item by id
app.get('/inventory/:id', async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.query('SELECT * FROM inventory WHERE id = ?', [req.params.id]);
    await conn.end();
    if (rows.length === 0) return res.status(404).json({ error: 'Item not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(chalk.red('GET /inventory/:id error:'), err);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST add new item
app.post('/inventory', async (req, res) => {
  try {
    const { name, quantity, price, category, supplier } = req.body;
    if (!name || quantity == null)
      return res.status(400).json({ error: 'Name and quantity are required' });

    const conn = await getConnection();
    await conn.query(
      'INSERT INTO inventory (name, quantity, price, category, supplier) VALUES (?, ?, ?, ?, ?)',
      [name, quantity, price || 0, category || '', supplier || '']
    );
    await conn.end();
    res.json({ message: 'Item added' });
  } catch (err) {
    console.error(chalk.red('POST /inventory error:'), err);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT update item
app.put('/inventory/:id', async (req, res) => {
  try {
    const { name, quantity, price, category, supplier } = req.body;
    if (!name || quantity == null)
      return res.status(400).json({ error: 'Name and quantity are required' });

    const conn = await getConnection();
    const [result] = await conn.query(
      'UPDATE inventory SET name = ?, quantity = ?, price = ?, category = ?, supplier = ? WHERE id = ?',
      [name, quantity, price || 0, category || '', supplier || '', req.params.id]
    );
    await conn.end();

    if (result.affectedRows === 0)
      return res.status(404).json({ error: 'Item not found' });

    res.json({ message: 'Item updated' });
  } catch (err) {
    console.error(chalk.red('PUT /inventory/:id error:'), err);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE item
app.delete('/inventory/:id', async (req, res) => {
  try {
    const conn = await getConnection();
    const [result] = await conn.query('DELETE FROM inventory WHERE id = ?', [req.params.id]);
    await conn.end();

    if (result.affectedRows === 0)
      return res.status(404).json({ error: 'Item not found' });

    res.json({ message: 'Item deleted' });
  } catch (err) {
    console.error(chalk.red('DELETE /inventory/:id error:'), err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Export CSV
app.get('/export/csv', async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.query('SELECT * FROM inventory ORDER BY name');
    await conn.end();

    const fields = ['id', 'name', 'quantity', 'price', 'category', 'supplier'];
    const parser = new Parser({ fields });
    const csv = parser.parse(rows);

    res.header('Content-Type', 'text/csv');
    res.attachment('inventory.csv');
    res.send(csv);
  } catch (err) {
    console.error(chalk.red('GET /export/csv error:'), err);
    res.status(500).send('Failed to export CSV');
  }
});

// Export PDF
app.get('/export/pdf', async (req, res) => {
  try {
    const conn = await getConnection();
    const [rows] = await conn.query('SELECT * FROM inventory ORDER BY name');
    await conn.end();

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    let filename = 'inventory.pdf';

    res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-type', 'application/pdf');

    doc.pipe(res);

    doc.fontSize(18).text('Inventory Report', { align: 'center' });
    doc.moveDown();

    const tableTop = 100;
    const itemX = 50;
    const qtyX = 200;
    const priceX = 260;
    const categoryX = 330;
    const supplierX = 420;

    doc.fontSize(12).text('Name', itemX, tableTop);
    doc.text('Qty', qtyX, tableTop);
    doc.text('Price', priceX, tableTop);
    doc.text('Category', categoryX, tableTop);
    doc.text('Supplier', supplierX, tableTop);

    let y = tableTop + 20;

    rows.forEach(item => {
      doc.text(item.name, itemX, y);
      doc.text(item.quantity?.toString() || '0', qtyX, y);
      doc.text('₹' + (parseFloat(item.price) || 0).toFixed(2), priceX, y); // ✅ FIXED
      doc.text(item.category || '-', categoryX, y);
      doc.text(item.supplier || '-', supplierX, y);
      y += 20;
    });

    doc.end();
  } catch (err) {
    console.error(chalk.red('GET /export/pdf error:'), err);
    res.status(500).send('Failed to export PDF');
  }
});

// -----------------------------------------------------------

app.listen(port, '0.0.0.0', () => {
  console.log(chalk.green(`🚀 Inventory backend listening at http://localhost:${port}`));
});
