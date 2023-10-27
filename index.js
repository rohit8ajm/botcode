// Import and link .env file with project to pick various config values
const path = require('path');
const ENV_FILE = path.join(__dirname, '/config/.env');
require('dotenv').config({ path: ENV_FILE });

// Import required packages
const restify = require('restify');
const { botVariableNames } = require('./config/Config');
const { processActivity } = require('./controller/ProcessActivity')
const { botConfigs, authenticateAgent, updateAgentStatus, agentPanelvalues, getWorkingHour, insertBotTrigger, insertFormDetail, customerSessionDetail, removeStuckConvo, checkAgentAvailability } = require('./controller/UI')
const dbConnection = require('./data/Connection');
const { getStaticValues } = require('./data/Queries');
const { cron } = require('./config/configCron')

// Create HTTP server.
const server = restify.createServer();
server.use(restify.plugins.jsonBodyParser());
server.use(restify.plugins.queryParser());
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log(`\n${server.name} listening to ${server.url}`);
});

// Listen for incoming requests and route them 
server.get('/', async(req, res) => {
    res.send(200, "ok")
})
server.get('/getStaticValues', async(req, res) => {
    getStaticValues()
    res.send(200, "ok")
})
server.post('/api/messages', processActivity);
server.post('/api/formDetail', insertFormDetail)
server.get('/api/botConfigs', async (req, res) => {
    try {
        let result = await botConfigs()
        res.send(200, result)
    } catch (error) {
        res.send(404, botVariableNames.uiRequestResponse)

    }
})
server.get('/api/authenticateAgent', authenticateAgent)
server.get('/api/panelValues', agentPanelvalues)
server.get('/api/getWorkingHour', getWorkingHour)
server.get('/api/customerSessionDetail/:convoId', customerSessionDetail)
server.patch('/api/updateAgentStatus', updateAgentStatus)
server.get('/removeStuckConvo/:convoId', removeStuckConvo)
server.get('/api/checkAgentAvailability', checkAgentAvailability)