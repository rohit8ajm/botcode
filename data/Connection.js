// Get filename to use in error messages
const path = require('path')
const fileName = path.basename(__filename)
const { getStaticValues } = require('./Queries')

//import required packages
require('dotenv').config();
var sql = require("mssql");
const { sendErrorMail } = require('../monitoring/Mail')
const { appInsightsClient } = require('../monitoring/AppInsights')
const { errorMessages } = require('../config/Config')


const sqlConfig = {
    user: process.env.dbuser,
    password: process.env.dbpassword,
    server: process.env.dbserver,
    database: process.env.dbname,
    encrypt: true,
    requestTimeout: 105000
};

// try to connect with DB
sql.connect(sqlConfig, function (error) {
    if (error) {
        console.error(errorMessages.dbConnectError.name, error);
        appInsightsClient(errorMessages.dbConnectError.name, error)
        sendErrorMail(`${errorMessages.dbConnectError.desc} ${fileName}`, error.stack)
    } else {
        getStaticValues();
        console.error("Database connected");

    }
});