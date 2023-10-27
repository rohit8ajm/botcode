require('dotenv').config();
var sql = require("mssql");
const config = {
    user: process.env.dbuser,
    password: process.env.dbpassword,
    server: process.env.dbserver,
    database: process.env.dbname,
    encrypt: true,
    requestTimeout: 105000
};
sql.connect(config, function (err) {
    if (err) {
        console.error("Database Conection failed, error occured=> ", err);
    } else {
        console.error("Database connected");
    }
});