// Get filename to use in error messages
const path = require('path')
const fileName = path.basename(__filename)
var _ = require('lodash')


// Import required project files
const { appInsightsClient } = require('../monitoring/AppInsights')
const { sendErrorMail, sendContactMail } = require('../monitoring/Mail')
const { botConfigValues, errorMessages, botVariableNames, userType } = require('../config/Config')
const { getStaticValues, agentPanelvalues, agentDetail, updateAgentStatus, insertBotTrigger, insertFormDetail, insertChatLog, customerSessionDetail } = require('../data/Queries')
const { checkAgentWorkingHour, checkAgentAvailability } = require('../logic/BotLogic')
const { uploadString } = require('../data/StorageAccount')

// remove stuck convoid
module.exports.removeStuckConvo = async (req, res) => {
    try {
        if (botConfigValues.conversationReferences[req.params.convoId]) {
            delete botConfigValues.conversationReferences[req.params.convoId]
            res.send(200, "ok");
        }
    } catch (error) {

    }
}

// get bot configs from backend and send to UI
module.exports.botConfigs = async () => {
    return new Promise(async (resolve, reject) => {
        try {
            const oldData = botConfigValues.valueFromDatabase
            oldData["staticTexts"] = botConfigValues.staticTexts
            oldData["initialQuestionCategory"] = Object.keys(botConfigValues.initialQuestionCategory)

            let result = await getStaticValues()
            result["staticTexts"] = botConfigValues.staticTexts
            let agentAvailability = await checkAgentWorkingHour()
            result["isLiveChat"] = agentAvailability.isLiveChat
            oldData["isLiveChat"] = agentAvailability.isLiveChat
            result["initialQuestionCategory"] = Object.keys(botConfigValues.initialQuestionCategory)

            // if (!_.isEqual(oldData, result)) {
                uploadString(JSON.stringify(result))
            // }

            resolve(result);

        } catch (error) {
            console.error(errorMessages.botConfigError.name, error);
            appInsightsClient(errorMessages.botConfigError.name, error)
            sendErrorMail(`${errorMessages.botConfigError.desc} ${fileName}`, error.stack)
            reject(error)
        }
    })
}

// get quick replies from backend and send to UI
module.exports.agentPanelvalues = async (req, res) => {
    try {
        let result = await agentPanelvalues()
        res.send(200, result)
    } catch (error) {
        console.error(errorMessages.agentPanelvaluesError.name, error);
        appInsightsClient(errorMessages.agentPanelvaluesError.name, error)
        sendErrorMail(`${errorMessages.agentPanelvaluesError.desc} ${fileName}`, error.stack)
        res.send(404, botVariableNames.uiRequestResponse)
    }
}

// verify agent with given id exists or not
module.exports.authenticateAgent = async (req, res) => {
    try {
        if (req.query.emailId) {
            let result = await agentDetail(req.query.emailId)
            res.send(200, result)
        } else {
            res.send(403, botVariableNames.uiRequestResponse)
        }

    } catch (error) {
        console.error(errorMessages.agentDetailError.name, error);
        appInsightsClient(errorMessages.agentDetailError.name, error)
        sendErrorMail(`${errorMessages.agentDetailError.desc} ${fileName}`, error.stack)
        res.send(404, botVariableNames.uiRequestResponse)
    }
}

// update agent status on backend based on detail from UI
module.exports.updateAgentStatus = async (req, res) => {
    try {
        if (req.body.agentId && req.body.status && req.body.department && Object.keys(botConfigValues.agentpanelValues[botConfigValues.staticTexts.agentStatus]).includes(req.body.status.toLowerCase())) {
            let result = await updateAgentStatus(req.body.agentId, req.body.status, req.body.department)
            if (result.length > 0) {
                res.send(200, result)
            } else {
                res.send(403, botVariableNames.uiRequestResponse)
            }
        } else {
            res.send(403, botVariableNames.uiRequestResponse)
        }

    } catch (error) {
        console.error(errorMessages.updateAgentStatusError.name, error);
        appInsightsClient(errorMessages.updateAgentStatusError.name, error)
        sendErrorMail(`${errorMessages.updateAgentStatusError.desc} ${fileName}`, error.stack)
        res.send(404, botVariableNames.uiRequestResponse)
    }
}

// get customer UI values
module.exports.getWorkingHour = async (req, res) => {
    try {
        let agentAvailability = await checkAgentWorkingHour()
        res.send(200, agentAvailability)
    } catch (error) {
        console.error(errorMessages.getWorkingHourError.name, error);
        appInsightsClient(errorMessages.getWorkingHourError.name, error)
        sendErrorMail(`${errorMessages.getWorkingHourError.desc} ${fileName}`, error.stack)
        res.send(404, botVariableNames.uiRequestResponse)
    }
}

// save form detail to database
module.exports.insertFormDetail = async (req, res) => {
    try {

        if (req.body.convoId && req.body.name && req.body.email && req.body.message && req.body.formType && req.body.helpCat, req.body.mailTo) {
            sendContactMail(req.body.mailTo, req.body.name, req.body.email, req.body.contactOption, req.body.phone, req.body.helpCat, req.body.message)
            let result = await insertFormDetail(req.body.convoId, req.body.name, req.body.email, req.body.contactOption, req.body.phone, `${req.body.helpCat} - ${req.body.mailTo}`, req.body.message, req.body.formType)
            res.send(200)
        } else {
            res.send(403, botVariableNames.uiRequestResponse)
        }
    } catch (error) {
        console.error(errorMessages.insertFormDetailError.name, error);
        appInsightsClient(errorMessages.insertFormDetailError.name, error)
        sendErrorMail(`${errorMessages.insertFormDetailError.desc} ${fileName}`, error.stack)
        res.send(404, botVariableNames.uiRequestResponse)
    }
}

// get customer session detail
module.exports.customerSessionDetail = async (req, res) => {
    try {
        if (req.params.convoId && botConfigValues.conversationReferences[req.params.convoId]) {
            let result = await customerSessionDetail('get', req.params.convoId);
            res.send(200, result)
        } else {
            res.send(403, botVariableNames.uiRequestResponse)
        }

    } catch (error) {
        console.error(errorMessages.customerSessionDetailError.name, error);
        appInsightsClient(errorMessages.customerSessionDetailError.name, error)
        sendErrorMail(`${errorMessages.customerSessionDetailError.desc} ${fileName}`, error.stack)
        res.send(404, botVariableNames.uiRequestResponse)
    }
}

// get available agent detail
module.exports.checkAgentAvailability = async (req, res) => {
    try {
        let result = await checkAgentAvailability("checkAgentAvailability api")
        res.send(200, result)
    } catch (error) {
        console.error(errorMessages.checkAgentAvailabilityError.name, error);
        appInsightsClient(errorMessages.checkAgentAvailabilityError.name, error)
        sendErrorMail(`${errorMessages.checkAgentAvailabilityError.desc} ${fileName}`, error.stack)
        res.send(404, botVariableNames.uiRequestResponse)
    }
}