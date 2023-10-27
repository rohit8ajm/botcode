// Get filename to use in error messages
const path = require('path')
const fileName = path.basename(__filename)

// Import required project files
const { appInsightsClient } = require('../monitoring/AppInsights')
const { sendErrorMail } = require('../monitoring/Mail')
const { botConfigValues, errorMessages, userType, botVariableNames, customerUiStates } = require('../config/Config')
const sql = require('mssql')
const botLogic = require('../logic/BotLogic')

// get static values from database
module.exports.getStaticValues = async () => {
    return new Promise(async (resolve, reject) => {

        try {
            var request = new sql.Request();
            let result = await request.execute("getStaticValues")
            result.recordsets[0].forEach(element => {
                errorMessages[element.cedName] = {}
                errorMessages[element.cedName]["name"] = element.cedName
                errorMessages[element.cedName]["desc"] = element.cedDesc
                errorMessages[element.cedName]["body"] = element.cedBody
            })
            result.recordsets[1].forEach(element => {
                botConfigValues.staticTexts[element.sbvKey] = element.sbvValue
            })
            botConfigValues.staticTexts["conFormHelpBtnText"] = []
            result.recordsets[2].forEach(element => {
                botConfigValues.staticTexts["conFormHelpBtnText"].push({
                    "text": element.cfhText,
                    "value": element.cfhValue
                })
            })
            result.recordsets[3].forEach(element => {
                botConfigValues.initialQuestionCategory[element.iqCCategory] = element.iqCDepartment
            })
            await this.agentPanelvalues()
            let output = await this.botConfigs()

            resolve(output)
        } catch (error) {
            console.error(errorMessages.staticValuesError.name, error);
            appInsightsClient(errorMessages.staticValuesError.name, error)
            sendErrorMail(`${errorMessages.staticValuesError.desc} ${fileName}`, error.stack)
        }
    })
}

// fetch bot configs from database
module.exports.botConfigs = () => {
    return new Promise(async (resolve, reject) => {
        try {
            var request = new sql.Request();
            let result = await request.execute("getBotConfig")
            let output = {};
            result.recordsets[0].forEach(element => {
                output[element.configKey] = element.configValue
            })
            botConfigValues.valueFromDatabase = output

            result.recordsets[1].length === 1 ? botConfigValues.isHoliday = result.recordsets[1][0].ahName : botConfigValues.isHoliday = false

            let department = []
            result.recordsets[2].forEach(element => {
                botConfigValues.departments.deptContactDetail[element.deptName] = element.deptPhone
                if (element.deptCategory === botConfigValues.staticTexts.defaultDept) {
                    botConfigValues.departments.defaultDept = element.deptName
                } else {
                    department.push(element.deptName)
                    botConfigValues.departments.regular = department
                }
            })

            resolve(output)

        } catch (error) {
            console.error(errorMessages.botConfigError.name, error);
            appInsightsClient(errorMessages.botConfigError.name, error)
            sendErrorMail(`${errorMessages.botConfigError.desc} ${fileName}`, error.stack)
            reject(error)
        }
    })
}

// fetch agent panel values from database
module.exports.agentPanelvalues = () => {
    return new Promise(async (resolve, reject) => {
        try {
            var request = new sql.Request();
            let result = await request.execute("getAgentPanelValues")
            botConfigValues.agentpanelValues[botConfigValues.staticTexts.qrEndConvoCategory] = []
            botConfigValues.agentpanelValues[botConfigValues.staticTexts.agentStatus] = {}

            let output = {}
            output[botConfigValues.staticTexts.qrEndConvoCategory] = []
            output[botConfigValues.staticTexts.qrMessageCategory] = []
            output[botConfigValues.valueFromDatabase.transferToText] = []
            output[botConfigValues.staticTexts.agentStatus] = []
            result.recordsets[0].forEach(element => {

                if (element.qrCategory === botConfigValues.staticTexts.qrEndConvoCategory) {
                    botConfigValues.agentpanelValues[botConfigValues.staticTexts.qrEndConvoCategory].push(element.qrValue)
                    output[botConfigValues.staticTexts.qrEndConvoCategory].push(element.qrValue)
                } else {
                    output[botConfigValues.staticTexts.qrMessageCategory].push(element.qrValue)
                }
            })
            result.recordsets[1].forEach(element => {
                output[botConfigValues.valueFromDatabase.transferToText].push(element.deptName)
            })
            result.recordsets[2].forEach(element => {
                output[botConfigValues.staticTexts.agentStatus].push(element.asvValue)
                botConfigValues.agentpanelValues[botConfigValues.staticTexts.agentStatus][element.asvKey] = element.asvValue
            })
            resolve(output)


        } catch (error) {
            console.error(errorMessages.agentPanelvaluesError.name, error);
            appInsightsClient(errorMessages.agentPanelvaluesError.name, error)
            sendErrorMail(`${errorMessages.agentPanelvaluesError.desc} ${fileName}`, error.stack)
            reject(error)
        }
    })
}

// fetch agent details from database
module.exports.agentDetail = (emailId, department) => {
    return new Promise(async (resolve, reject) => {
        try {
            var request = new sql.Request();
            request.input("emailId", emailId)
            request.input("department", department)
            let result = await request.execute("getAgentDetail")
            if (result.recordsets[1] && result.recordsets[1].length > 0) {
                result.recordsets[1].forEach(async (element) => {
                    if (Object.keys(botConfigValues.conversationReferences).includes(element.adEmail.toLowerCase())) {
                        botLogic.makeAgentUnavailable(element.adEmail.toLowerCase())
                    }
                })
            }
            if (department && (result.recordsets[0] && result.recordsets[0].length > 0)) {
                let output = []
                await result.recordsets[0].forEach((element, key) => {
                    if (botConfigValues.conversationReferences[element.adEmail.toLowerCase()]) {
                        output.push(element.adEmail.toLowerCase())
                    }

                })

                botConfigValues.availableAgents[department] = output
                resolve(output)

            } else if (result.recordsets[0] && result.recordsets[0].length > 0) {
                resolve({
                    "agentExists": true,
                    "agentDetail": result.recordsets[0][0]
                })
            } else {
                resolve({
                    "agentExists": false,
                    "agentDetail": userType.unauthorized
                })
            }

        } catch (error) {
            console.error(errorMessages.agentDetailError.name, error);
            appInsightsClient(errorMessages.agentDetailError.name, error)
            sendErrorMail(`${errorMessages.agentDetailError.desc} ${fileName}`, error.stack)
            reject(error)
        }
    })
}

// update agent status in database
module.exports.updateAgentStatus = (recordId, status, department) => {
    return new Promise(async (resolve, reject) => {
        try {
            var request = new sql.Request();
            request.input("recordId", recordId)
            request.input("status", status)
            let result = await request.execute("updateAgentStatus")

            await this.agentDetail(null, department)

            resolve(result.recordsets[0])
        } catch (error) {
            console.error(errorMessages.updateAgentStatusError.name, error);
            appInsightsClient(errorMessages.updateAgentStatusError.name, error)
            sendErrorMail(`${errorMessages.updateAgentStatusError.desc} ${fileName}`, error.stack)
            reject(error)
        }
    })
}

// save data to chatlog in database
module.exports.insertChatLog = (convoId, message, sender, reciever, agentRequestId, agentResTime) => {
    return new Promise(async (resolve, reject) => {
        try {
            var request = new sql.Request();
            request.input("convoId", convoId)
            request.input("message", message)
            request.input("sender", sender)
            request.input("reciever", reciever)
            request.input("agentRequestId", agentRequestId)
            request.input("agentResTime", agentResTime)
            let result = await request.execute("insertChatLog")
            resolve(result)
        } catch (error) {
            console.error(errorMessages.insertChatLogError.name, error);
            appInsightsClient(errorMessages.insertChatLogError.name, error)
            sendErrorMail(`${errorMessages.insertChatLogError.desc} ${fileName}`, error.stack)
            reject(error)
        }
    })
}

// save data to queueLogs in database
module.exports.insertQueueLogs = (convoId, status, department, reason, guid) => {
    return new Promise(async (resolve, reject) => {
        try {
            var request = new sql.Request();
            request.input("convoId", convoId)
            request.input("status", status)
            request.input("department", department)
            request.input("reason", reason)
            request.input("guid", guid)
            let result = await request.execute("updateUserQueueStatus")

            await this.updateLiveQueue();

            resolve(result)
        } catch (error) {
            console.error(errorMessages.insertQueueLogsError.name, error);
            appInsightsClient(errorMessages.insertQueueLogsError.name, error)
            sendErrorMail(`${errorMessages.insertQueueLogsError.desc} ${fileName}`, error.stack)
            reject(error)
        }
    })
}

// update live queue status in database
module.exports.updateLiveQueue = () => {
    return new Promise(async (resolve, reject) => {
        try {
            let request = new sql.Request();
            request.input("type", "truncate")
            let result = await request.execute("updateUsersInQueue")

            let count = 0;
            Object.keys(botConfigValues.usersInQueue).forEach(department => {
                if (Object.keys(botConfigValues.usersInQueue[department]) && Object.keys(botConfigValues.usersInQueue[department]).length > 0) {
                    Object.keys(botConfigValues.usersInQueue[department]).forEach(async (customer) => {
                        let request = new sql.Request();
                        request.input("convoId", customer)
                        request.input("department", department)
                        let result = await request.execute("updateUsersInQueue")

                        resolve(result)
                    })
                } else {
                    count++;
                }
                if (count === Object.keys(botConfigValues.usersInQueue).length) {
                    resolve(null)
                }
            })
        } catch (error) {
            console.error(errorMessages.updateLiveQueueError.name, error);
            appInsightsClient(errorMessages.updateLiveQueueError.name, error)
            sendErrorMail(`${errorMessages.updateLiveQueueError.desc} ${fileName}`, error.stack)
            reject(error)
        }
    })
}

// save data to connection request logs in database
module.exports.insertConnReqLogs = (convoId, AgentRequestId, AgentEmail, Status) => {
    return new Promise(async (resolve, reject) => {
        try {
            var request = new sql.Request();
            request.input("convoId", convoId)
            request.input("AgentRequestId", AgentRequestId)
            request.input("AgentEmail", AgentEmail)
            request.input("Status", Status)
            let result = await request.execute("insertConnReqLogs")

            resolve(result)
        } catch (error) {
            console.error(errorMessages.insertConnReqLogsError.name, error);
            appInsightsClient(errorMessages.insertConnReqLogsError.name, error)
            sendErrorMail(`${errorMessages.insertConnReqLogsError.desc} ${fileName}`, error.stack)
            reject(error)
        }
    })
}


// save data to bot trigger in database
module.exports.insertBotTrigger = (convoId, text, event) => {
    return new Promise(async (resolve, reject) => {
        try {
            var request = new sql.Request();
            request.input("convoId", convoId)
            request.input("btText", text)
            let result = await request.execute("insertBotTrigger")

            resolve(result)
        } catch (error) {
            console.error(errorMessages.insertBotTriggerError.name, error);
            appInsightsClient(errorMessages.insertBotTriggerError.name, error)
            sendErrorMail(`${errorMessages.insertBotTriggerError.desc} ${fileName}`, `${error.stack}<br/><br/> sender: ${convoId} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[convoId])} <br/><br/> text: ${text} <br/><br/> event:${event}`)
            reject(error)
        }
    })
}

// save form detail to database
module.exports.insertFormDetail = (convoId, name, email, contactOption, phone, helpCat, message, formType) => {
    return new Promise(async (resolve, reject) => {
        try {
            var request = new sql.Request();
            request.input("convoId", convoId);
            request.input("name", name);
            request.input("email", email);
            request.input("contactOption", contactOption);
            request.input("phone", phone);
            request.input("helpCat", helpCat);
            request.input("message", message);
            request.input("formType", formType);

            let result = await request.execute("insertFormDetail")

            await this.customerSessionDetail(userType.post, convoId, customerUiStates.thankYou, botConfigValues.staticTexts.customerExitEvent, botConfigValues.valueFromDatabase.customerChatDefaultHeader)

            resolve(result)
        } catch (error) {
            console.error(errorMessages.insertFormDetailError.name, error);
            appInsightsClient(errorMessages.insertFormDetailError.name, error)
            sendErrorMail(`${errorMessages.insertFormDetailError.desc} ${fileName}`, error.stack)
            reject(error)
        }
    })
}

// save initial question to database
module.exports.insertInitialQuestion = (convoId, category, message) => {
    return new Promise(async (resolve, reject) => {
        try {
            var request = new sql.Request();
            request.input("convoId", convoId);
            request.input("category", category);
            request.input("message", message);

            let result = await request.execute("insertInitialQuestion")

            resolve(result)
        } catch (error) {
            console.error(errorMessages.insertInitialQuestionError.name, error);
            appInsightsClient(errorMessages.insertInitialQuestionError.name, error)
            sendErrorMail(`${errorMessages.insertInitialQuestionError.desc} ${fileName}`, `${error.stack}<br/><br/> sender: ${convoId} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[convoId])} <br/><br/> message: ${message}`)
            reject(error)
        }
    })
}

// save and get customer session detail from database
module.exports.customerSessionDetail = (type, convoId, currState, eventTitle, eventName, sender, msg, gender) => {
    return new Promise(async (resolve, reject) => {
        try {

            let headerMsg = {
                "event": eventTitle,
                "name": eventName
            }

            var message = {}

            if (sender !== userType.bot) {
                message[sender] = {
                    "Msg": msg,
                    "timeMsg": customerUiStates.defaultTime,
                    "gender": gender,
                    "time": new Date().toISOString()
                }

            } else {
                message[sender] = {
                    "Msg": msg
                }
            }

            var request = new sql.Request();
            request.input("type", type);
            request.input("convoId", convoId);
            request.input("currState", currState);
            request.input("headerMsg", JSON.stringify(headerMsg));
            request.input("message", JSON.stringify(message));

            let result = await request.execute("customerSessionDetail")
            let output = {
                "currentState": "",
                "headerMsg": "",
                "gender": "",
                "livechatMsg": [],
                "liveChatStatus": "",
                "agentPanelMessage": ""
            }
            if (type === "get") {
                result.recordsets[0].forEach((element, key) => {
                    output.livechatMsg.push(JSON.parse(element.csmMessage))
                    if (key === result.recordsets[0].length - 1) {
                        output.currentState = element.csmCurrState
                        output.headerMsg = JSON.parse(element.csmHeaderMsg)
                        output.gender = botConfigValues.conversationReferences[convoId][botVariableNames.gender]
                        output.liveChatStatus = botConfigValues.conversationReferences[convoId][botVariableNames.liveChatStatus]
                        output.agentPanelMessage = botConfigValues.conversationReferences[convoId][botVariableNames.agentPanelMessage]
                    }
                })
            }

            resolve(output)
        } catch (error) {
            console.error(errorMessages.insertInitialQuestionError.name, error);
            appInsightsClient(errorMessages.insertInitialQuestionError.name, error)
            sendErrorMail(`${errorMessages.insertInitialQuestionError.desc} ${fileName}`, error.stack)
            reject(error)
        }
    })
}

// save customer detail to database
module.exports.insertCustomerDetail = (convoId, name, email, phone) => {
    return new Promise(async (resolve, reject) => {
        try {

            var request = new sql.Request();
            request.input("convoId", convoId);
            request.input("name", name);
            request.input("email", email);
            request.input("phone", phone);

            let result = await request.execute("insertCustomerDetail")

            resolve()
        } catch (error) {
            console.error(errorMessages.insertCustomerDetailError.name, error);
            appInsightsClient(errorMessages.insertCustomerDetailError.name, error)
            sendErrorMail(`${errorMessages.insertCustomerDetailError.desc} ${fileName}`, error.stack)
            reject(error)
        }
    })
}

// save auto disconnect function running logs
module.exports.insertAutoDisconnectRunLogs = (message) => {
    return new Promise(async (resolve, reject) => {
        try {
            var request = new sql.Request();
            request.input("message", message);

            let result = await request.execute("insertAutoDisconnectRunLogs")

            resolve(result)
        } catch (error) {
            console.error(errorMessages.insertAutoDisconnectRunLogsError.name, error);
            appInsightsClient(errorMessages.insertAutoDisconnectRunLogsError.name, error)
            sendErrorMail(`${errorMessages.insertAutoDisconnectRunLogsError.desc} ${fileName}`, `${error.stack}`)
            reject(error)
        }
    })
}