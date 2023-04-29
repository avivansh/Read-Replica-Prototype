const express = require("express");
const app = express();

// It's important to use this middleware otherwise server won't be able to parse JSON and it will throw
// TypeError: Cannot destructure property 'name' of 'req.body' as it is undefined.
app.use(express.json());

const mysql = require("mysql");
require("dotenv").config();

const masterPool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.MASTER_DB_HOST,
  user: process.env.MASTER_DB_USER,
  password: process.env.MASTER_DB_PASSWORD,
  database: process.env.MASTER_DB_DATABASE,
  port: 3306,
  ssl: true,
});

const replicaPool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.REPLICA_DB_HOST,
  user: process.env.MASTER_DB_USER,
  password: process.env.MASTER_DB_PASSWORD,
  database: process.env.MASTER_DB_DATABASE,
  port: 3306,
  ssl: true,
});

const insertUser = (pool, name, email, callback) => {
  const sql = "INSERT INTO users (name, email) VALUES (?, ?)";
  const values = [name, email];

  pool.getConnection((err, connection) => {
    if (err) return callback(err);

    console.log("Connected to Master!");

    connection.query(sql, values, (error, results) => {
      if (error) return callback(error);

      console.log(`Inserted ${results.affectedRows} row(s)`);
      callback(null, results);
    });
  });
};

const GetUsers = (pool, callback) => {
  pool.getConnection((err, connection) => {
    if (err) throw err;
    console.log("Connected to Replica!");

    connection.query("SELECT * FROM users", (error, results) => {
      connection.release();
      if (error) throw error;
      console.log(results);
      callback(null, results);
    });
  });
};

// Reads will go to replica
app.get("/", (req, res) => {
  let users = [];
  GetUsers(replicaPool, (err, result) => {
    if (err) throw err;
    users.push(result);
    res.send(users);
  });
});

// Writes will go to master
app.post("/users", (req, res) => {
  const { name, email } = req.body;
  insertUser(masterPool, name, email, (err, results) => {
    if (err) throw err;

    res.send("User created!");
  });
});

app.listen(5000, () => {
  console.log("Server is running on port 5000");
});
