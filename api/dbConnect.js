require('dotenv').config();
const sql = require('mssql');

console.log('DB User:', process.env.DB_USER);
console.log('DB Server:', process.env.DB_SERVER);
console.log('DB Database:', process.env.DB_DATABASE);

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  options: {
    trustServerCertificate: true,
    encrypt: false,
    enableArithAbort: true
  },
  port: 1433,
  requestTimeout: 600000
};

// ✅ Explicit connect function
async function connectToDatabase() {
  if (!global.pool) {
    try {
      global.pool = await sql.connect(config);
      console.log("✅ Database connected");
    } catch (err) {
      console.error("❌ Database connection error:", err);
      throw err;
    }
  }
}

async function queryDatabase(query, params = {}) {
  if (!global.pool) {
    throw new Error("Database not connected");
  }

  const request = global.pool.request();
  for (const [key, value] of Object.entries(params)) {
    request.input(key, value);
  }

  const result = await request.query(query);

  if (query.trim().toUpperCase().startsWith("SELECT")) {
    return result.recordset;
  } else {
    return result.rowsAffected;
  }
}

// ✅ Function to fetch active users from USERSLOG
async function fetchActiveUsers(dDate_Log) {
  if (!dDate_Log) throw new Error("Date of log is required");

  const cSql = `
    SELECT 
      USERSLOG.UserName,
      USERSLOG.LogInOut,
      USERSLOG.Time____
    FROM USERSLOG
    WHERE USERSLOG.Date____ >= @dDate_Log
      AND USERSLOG.UserName <> ' '
    ORDER BY USERSLOG.RecordId`;

  return await queryDatabase(cSql, { dDate_Log });
}

module.exports = { sql, connectToDatabase, queryDatabase, fetchActiveUsers };
