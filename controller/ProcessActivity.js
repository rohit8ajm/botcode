// Get filename to use in error messages
const path = require('path')
const fileName = path.basename(__filename)

// Import required packages
const { BotFrameworkAdapter } = require('botbuilder');

// Import required project files
const { appInsightsClient } = require('../monitoring/AppInsights')
const { sendErrorMail } = require('../monitoring/Mail')
const { errorMessages } = require('../config/Config')
const { RecieveMessages } = require('./RecieveMessages')

// Create adapter to process activities of bot
const adapter = new BotFrameworkAdapter({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

// Catch-all for errors.
adapter.onTurnError = async(context, error) => {
    console.error(errorMessages.catchAllError.name, error);
    appInsightsClient(errorMessages.catchAllError.name, error)
    sendErrorMail(`${errorMessages.catchAllError.desc} ${fileName}`, error.stack)
};

// Create the main dialog.
const bot = new RecieveMessages();

// Process incoming activities
module.exports.processActivity = async(req, res) => {
    adapter.processActivity(req, res, async(turnContext) => {
        // route to main dialog.
        await bot.run(turnContext);
    });
    res.send(200);
}