// Get filename to use in error messages
const path = require('path')
const fileName = path.basename(__filename)

// Import required project files
const { appInsightsClient } = require('../monitoring/AppInsights')
const { sendErrorMail } = require('../monitoring/Mail')
const { botConfigValues, botVariableNames, errorMessages, userType, customerUiStates } = require('../config/Config')
const { agentDetail, insertChatLog, updateAgentStatus, insertBotTrigger, customerSessionDetail, insertConnReqLogs, insertAutoDisconnectRunLogs } = require('../data/Queries')
const { sendEvent, sendMessage, sendAttachment } = require('../controller/SendMessages')
const { rejectConnectionRequest, addUserInQueue, removeUserFromQueue } = require('./QueueLogic')
// const { attachTranscriptToCase, getAgentGuid, createNewCase, updateExistingCase } = require('../data/CRMApi')
const { dynamicsURLCard } = require('./Cards')

// Identify user type
module.exports.authenticateUser = async (username, conversationReference, event, text, customerProfile) => {
    return new Promise(async (resolve, reject) => {
        try {
            var result, convoref;
            if (username.includes(userType.customer)) {
                result = {
                    "userType": userType.customer,
                    "personalDetail": customerProfile
                }
                convoref = conversationReference.conversation.id
            } else {
                let getUser = await agentDetail(username);
                if (getUser.agentExists) {
                    if (getUser.agentDetail.adName) {
                        let tempNameArr = getUser.agentDetail.adName.split(" ");
                        let name = tempNameArr[0] + " "
                        if (tempNameArr.length > 1) {
                            name += tempNameArr[(tempNameArr.length - 1)].substring(0, 1) + "."
                        }
                        getUser.agentDetail.adName = name
                    }
                    result = {
                        "userType": userType.agent,
                        "personalDetail": getUser.agentDetail
                    }
                    convoref = conversationReference.user.name
                } else {
                    result = {
                        "userType": userType.unauthorized,
                        "personalDetail": userType.unauthorized
                    }
                }
            }
            if (result.userType === userType.customer) {
                await insertBotTrigger(convoref, text, event)
                await insertChatLog(conversationReference.conversation.id, event, convoref, userType.bot)
            }
            resolve(result)
        } catch (error) {
            console.error(errorMessages.authenticateUserError.name, error);
            appInsightsClient(errorMessages.authenticateUserError.name, error)
            sendErrorMail(`${errorMessages.authenticateUserError.desc} ${fileName}`, `${error.stack}<br/><br/> sender: ${convoref} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[customerId])} <br/><br/> text: ${text} <br/><br/> event:${event}`)
            reject(`${errorMessages.authenticateUserError.desc} ${fileName} ${error.stack}`)
        }
    })
}

// Create and store conversation reference of bot users
module.exports.createConvoReference = async (userDetail, conversationReference) => {
    return new Promise((resolve, reject) => {
        try {
            var convoReferrer;
            if (userDetail.userType === userType.agent) {
                convoReferrer = conversationReference.user.name
            } else if (userDetail.userType === userType.customer) {
                convoReferrer = conversationReference.conversation.id
            } else {
                resolve(botVariableNames.unAuthorizedUser)
            }

            botConfigValues.conversationReferences[convoReferrer] === undefined ? botConfigValues.conversationReferences[convoReferrer] = {} : botConfigValues.conversationReferences[convoReferrer]
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.convoRef] = conversationReference
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.userType] = userDetail.userType
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.activityTime] = new Date()
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.convoHistory] = []
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.userConnectedTo] = false
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.connectionRequestGuid] = false
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.personalDetail] = userDetail
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.isReqestedByUser] = false
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.requestsRejectedCount] = 0
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.userDepartment] = false
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.gender] = userType.bot
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.liveChatStatus] = false
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.messageSentToAgent] = false
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.abandonEventType] = false
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.agentPanelMessage] = false
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.agentCustomerDisconnected] = false
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.currentQuestion] = false
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.autoDisconnectWarnMessageFlag] = false
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.crmContactGUID] = false
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.crmAgentGUID] = false
            botConfigValues.conversationReferences[convoReferrer][botVariableNames.crmCaseGUID] = false

            resolve(convoReferrer);
        } catch (error) {
            console.error(errorMessages.createConvoReferenceError.name, error);
            appInsightsClient(errorMessages.createConvoReferenceError.name, error)
            sendErrorMail(`${errorMessages.createConvoReferenceError.desc} ${fileName}`, `${error.stack}<br/><br/> sender: ${convoReferrer} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[convoReferrer])}`)
            reject(`${errorMessages.createConvoReferenceError.desc} ${fileName} ${error.stack}`)
        }
    })
}

// check agent working hours
module.exports.checkAgentWorkingHour = () => {
    return new Promise((resolve, reject) => {
        try {
            let result;
            if (botConfigValues.isHoliday) {
                result = {
                    "isLiveChat": false
                }
            } else {
                let estTime = new Date().toLocaleTimeString(botConfigValues.staticTexts.timeLanguage, { timeZone: botConfigValues.staticTexts.timeZone });
                let date = new Date().toLocaleDateString(botConfigValues.staticTexts.timeLanguage, { timeZone: botConfigValues.staticTexts.timeZone })
                estTime = Date.parse(`${date} ${estTime}`)
                let weekDay = new Date().getDay(botConfigValues.staticTexts.timeLanguage, { timeZone: botConfigValues.staticTexts.timeZone });
                let weekDayStartTime = Date.parse(`${date} ${botConfigValues.valueFromDatabase.weekDayStartTime}`),
                    weekDayEndTime = Date.parse(`${date} ${botConfigValues.valueFromDatabase.weekDayEndTime}`),
                    weekEndStartTime = Date.parse(`${date} ${botConfigValues.valueFromDatabase.weekEndStartTime}`),
                    weekEndEndTime = Date.parse(`${date} ${botConfigValues.valueFromDatabase.weekEndEndTime}`),
                    weekDayLunchStartTime = Date.parse(`${date} ${botConfigValues.valueFromDatabase.weekDayLunchStartTime}`),
                    weekDayLunchEndTime = Date.parse(`${date} ${botConfigValues.valueFromDatabase.weekDayLunchEndTime}`),
                    weekEndLunchStartTime = Date.parse(`${date} ${botConfigValues.valueFromDatabase.weekEndLunchStartTime}`),
                    weekEndLunchEndTime = Date.parse(`${date} ${botConfigValues.valueFromDatabase.weekEndLunchEndTime}`),
                    weekDayStaticLunch = botConfigValues.valueFromDatabase.weekDayStaticLunch.toLowerCase(),
                    weekEndStaticLunch = botConfigValues.valueFromDatabase.weekEndStaticLunch.toLowerCase()

                //////weekDay logic
                if (weekDay >= 1 && weekDay <= 5) {
                    if (estTime >= weekDayStartTime && estTime <= weekDayEndTime) {
                        if (weekDayStaticLunch === "true" && (estTime >= weekDayLunchStartTime && estTime <= weekDayLunchEndTime)) {
                            result = {
                                "isLiveChat": false
                            }
                        } else {
                            result = {
                                "isLiveChat": true
                            }
                        }
                    } else {
                        result = {
                            "isLiveChat": false
                        }
                    }
                }
                //////weekEnd logic 
                else if (weekDay === 6 || weekDay === 0) {
                    if (estTime >= weekEndStartTime && estTime <= weekEndEndTime) {
                        if (weekEndStaticLunch === "true" && (estTime >= weekEndLunchStartTime && estTime <= weekEndLunchEndTime)) {
                            result = {
                                "isLiveChat": false
                            }
                        } else {
                            result = {
                                "isLiveChat": true
                            }
                        }
                    } else {
                        result = {
                            "isLiveChat": false
                        }
                    }
                }
                //////default logic
                else {
                    result = {
                        "isLiveChat": false
                    }
                }

            }
            resolve(result)

        } catch (error) {
            console.error(errorMessages.checkAgentWorkingHourError.name, error);
            appInsightsClient(errorMessages.checkAgentWorkingHourError.name, error)
            sendErrorMail(`${errorMessages.checkAgentWorkingHourError.desc} ${fileName}`, error.stack)
            reject(`${errorMessages.checkAgentWorkingHourError.desc} ${fileName} ${error.stack}`)
        }
    })
}

// function to transfer customer to another agent
module.exports.transferCustomer = (agentEmail, currentDepartment, transferToDepartment, message) => {
    return new Promise(async (resolve, reject) => {
        try {
            var customerId;
            if (botConfigValues.conversationReferences[agentEmail] && botConfigValues.conversationReferences[agentEmail][botVariableNames.userConnectedTo]) {
                customerId = botConfigValues.conversationReferences[agentEmail][botVariableNames.userConnectedTo]
                await this.disconnectAgentCustomer(message, customerId, agentEmail, agentEmail, message, transferToDepartment)
                setTimeout(async () => {
                    await addUserInQueue(customerId, transferToDepartment, botConfigValues.staticTexts.findLiveAgentEvent, botConfigValues.valueFromDatabase.findLiveAgentMessage)
                }, parseInt(botConfigValues.staticTexts.noAgentEventTimeout))
            }
            else if (botConfigValues.conversationReferences[agentEmail] && botConfigValues.conversationReferences[agentEmail][botVariableNames.isReqestedByUser] && currentDepartment === transferToDepartment) {
                customerId = botConfigValues.conversationReferences[agentEmail][botVariableNames.isReqestedByUser]
                await rejectConnectionRequest(message, customerId, agentEmail, botConfigValues.staticTexts.connReqManualRejectedEvent)
            }
            else if (botConfigValues.conversationReferences[agentEmail] && botConfigValues.conversationReferences[agentEmail][botVariableNames.isReqestedByUser] && currentDepartment !== transferToDepartment) {
                customerId = botConfigValues.conversationReferences[agentEmail][botVariableNames.isReqestedByUser]
                await rejectConnectionRequest(message, customerId, agentEmail, botConfigValues.staticTexts.transferCustomerEvent)
                await removeUserFromQueue(customerId, currentDepartment, botConfigValues.staticTexts.transferCustomerEvent)

                let msg = botConfigValues.valueFromDatabase.inQueueTransferMessageToCustomer.replace(botConfigValues.staticTexts.replaceParam, transferToDepartment)
                await sendMessage(customerId, msg)
                await customerSessionDetail(userType.post, customerId, customerUiStates.liveChat, botConfigValues.staticTexts.findLiveAgentEvent, botConfigValues.valueFromDatabase.findLiveAgentMessage, userType.agent, msg, userType.bot)
                await insertChatLog(customerId, msg, userType.bot, customerId)

                setTimeout(async () => {
                    await addUserInQueue(customerId, transferToDepartment, botConfigValues.staticTexts.findLiveAgentEvent, botConfigValues.valueFromDatabase.findLiveAgentMessage)
                }, parseInt(botConfigValues.staticTexts.noAgentEventTimeout))
            }
            resolve()
        } catch (error) {
            console.error(errorMessages.transferCustomerError.name, error);
            appInsightsClient(errorMessages.transferCustomerError.name, error)
            sendErrorMail(`${errorMessages.transferCustomerError.desc} ${fileName}`, `${error.stack}<br/><br/> sender: ${agentEmail} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[agentEmail])} <br/><br/> reciever: ${customerId} <br/><br/> recieverdetail:${JSON.stringify(botConfigValues.conversationReferences[customerId])} <br/><br/> transferFrom:${currentDepartment} <br/><br/> transferTo:${transferToDepartment}`)
            reject(`${errorMessages.transferCustomerError.desc} ${fileName} ${error.stack}`)
        }
    })
}

// function to disconnect agent and customer
module.exports.disconnectAgentCustomer = (initiator, customerId, agentEmail, sender, message, department) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (botConfigValues.conversationReferences[sender] && botConfigValues.conversationReferences[sender][botVariableNames.userConnectedTo]) {

                botConfigValues.conversationReferences[agentEmail][botVariableNames.userConnectedTo] = false
                botConfigValues.conversationReferences[customerId][botVariableNames.userConnectedTo] = false

                await insertChatLog(customerId, message, sender, userType.bot, botConfigValues.conversationReferences[customerId][botVariableNames.connectionRequestGuid])

                await insertConnReqLogs(customerId, botConfigValues.conversationReferences[customerId][botVariableNames.connectionRequestGuid], agentEmail, botConfigValues.staticTexts.connReqEndChatEvent)

                let userDetail = botConfigValues.conversationReferences[agentEmail][botVariableNames.personalDetail]
                await updateAgentStatus(userDetail.personalDetail.adId, botConfigValues.agentpanelValues[botConfigValues.staticTexts.agentStatus].available, userDetail.personalDetail.adDepartment)

                botConfigValues.conversationReferences[customerId][botVariableNames.gender] = userType.bot

                // customer choose to abandon session
                if (message.includes(botConfigValues.staticTexts.customerSessionAbandonEvent)) {
                    await sendEvent(agentEmail, botConfigValues.staticTexts.agentCustomerDisconnectedEvent, botConfigValues.valueFromDatabase.agentDisconnectedMessageToAgent)

                    await sendMessage(agentEmail, botConfigValues.valueFromDatabase.agentDisconnectedMessageToAgent)

                    await insertChatLog(customerId, botConfigValues.valueFromDatabase.agentDisconnectedMessageToAgent, userType.bot, agentEmail)
                }

                // agent chosse to transfer customer
                else if (message.includes(botConfigValues.staticTexts.transferCustomerEvent)) {
                    await sendEvent(agentEmail, botConfigValues.staticTexts.agentCustomerDisconnectedEvent, botConfigValues.valueFromDatabase.agentDisconnectedMessageToAgent)
                    await sendMessage(agentEmail, botConfigValues.valueFromDatabase.agentDisconnectedMessageToAgent)
                    await insertChatLog(customerId, botConfigValues.valueFromDatabase.agentDisconnectedMessageToAgent, userType.bot, agentEmail)

                    let msg = botConfigValues.valueFromDatabase.inChatTransferMessageToCustomer.replace(botConfigValues.staticTexts.replaceParam, department)
                    await sendMessage(customerId, msg)
                    await customerSessionDetail(userType.post, customerId, customerUiStates.liveChat, botConfigValues.staticTexts.findLiveAgentEvent, botConfigValues.valueFromDatabase.findLiveAgentMessage, userType.agent, msg, userType.bot)
                    await insertChatLog(customerId, msg, userType.bot, customerId)
                }

                // agent choose to disconnect with customer
                else if (message.includes(botConfigValues.staticTexts.agentCustomerDisconnectedEvent)) {
                    botConfigValues.conversationReferences[customerId][botVariableNames.agentCustomerDisconnected] = true

                    await sendEvent(agentEmail, botConfigValues.staticTexts.agentCustomerDisconnectedEvent, botConfigValues.valueFromDatabase.agentDisconnectedMessageToAgent)
                    await sendMessage(agentEmail, botConfigValues.valueFromDatabase.agentDisconnectedMessageToAgent)
                    await insertChatLog(customerId, botConfigValues.valueFromDatabase.agentDisconnectedMessageToAgent, userType.bot, agentEmail)

                    await sendEvent(customerId, botConfigValues.staticTexts.serviceMessageEvent, botConfigValues.valueFromDatabase.agentDisconnectedServiceMessageToCustomer)
                    await customerSessionDetail(userType.post, customerId, customerUiStates.liveChat, botConfigValues.staticTexts.agentCustomerDisconnectedEvent, botConfigValues.valueFromDatabase.customerChatDefaultHeader, userType.service, botConfigValues.valueFromDatabase.agentDisconnectedServiceMessageToCustomer, userType.bot)
                    await sendEvent(customerId, botConfigValues.staticTexts.agentCustomerDisconnectedEvent, JSON.stringify({
                        "message": botConfigValues.valueFromDatabase.agentDisconnectedMessageToCustomer,
                        "mail": agentEmail
                    }))
                    await customerSessionDetail(userType.post, customerId, customerUiStates.liveChat, botConfigValues.staticTexts.agentCustomerDisconnectedEvent, botConfigValues.valueFromDatabase.customerChatDefaultHeader, userType.agent, botConfigValues.valueFromDatabase.agentDisconnectedMessageToCustomer, userType.bot)

                    await insertChatLog(customerId, `${botConfigValues.staticTexts.agentCustomerDisconnectedEvent} - ${botConfigValues.valueFromDatabase.agentDisconnectedMessageToCustomer}`, userType.bot, customerId, botConfigValues.conversationReferences[customerId][botVariableNames.connectionRequestGuid])
                }

                // agent made himself unavailable
                else if (message.includes(botConfigValues.staticTexts.agentUnavailableEvent)) {
                    botConfigValues.conversationReferences[customerId][botVariableNames.agentCustomerDisconnected] = true

                    await sendEvent(customerId, botConfigValues.staticTexts.serviceMessageEvent, botConfigValues.valueFromDatabase.agentDisconnectedServiceMessageToCustomer)
                    await customerSessionDetail(userType.post, customerId, customerUiStates.liveChat, botConfigValues.staticTexts.agentCustomerDisconnectedEvent, botConfigValues.valueFromDatabase.customerChatDefaultHeader, userType.service, botConfigValues.valueFromDatabase.agentDisconnectedServiceMessageToCustomer, userType.bot)
                    await sendEvent(customerId, botConfigValues.staticTexts.agentCustomerDisconnectedEvent, JSON.stringify({
                        "message": botConfigValues.valueFromDatabase.agentDisconnectedMessageToCustomer,
                        "mail": agentEmail
                    }))
                    await customerSessionDetail(userType.post, customerId, customerUiStates.liveChat, botConfigValues.staticTexts.agentCustomerDisconnectedEvent, botConfigValues.valueFromDatabase.customerChatDefaultHeader, userType.agent, botConfigValues.valueFromDatabase.agentDisconnectedMessageToCustomer, userType.bot)

                    await insertChatLog(customerId, `${botConfigValues.staticTexts.agentCustomerDisconnectedEvent} - ${botConfigValues.valueFromDatabase.agentDisconnectedMessageToCustomer}`, userType.bot, customerId, botConfigValues.conversationReferences[customerId][botVariableNames.connectionRequestGuid])
                }

                // log data to dynamics
                // if (botConfigValues.staticTexts.enableCRMIntegration.toLowerCase() === "yes") {
                //     await attachTranscriptToCase(`Conversation Id: ${customerId} and Agent Email: ${agentEmail}`, botConfigValues.conversationReferences[customerId][botVariableNames.convoHistory], customerId, botConfigValues.conversationReferences[customerId][botVariableNames.crmCaseGUID], botConfigValues.conversationReferences[agentEmail][botVariableNames.crmAgentGUID])
                // }
            }

            resolve()
        } catch (error) {
            console.error(errorMessages.disconnectAgentCustomerError.name, error);
            appInsightsClient(errorMessages.disconnectAgentCustomerError.name, error)
            sendErrorMail(`${errorMessages.disconnectAgentCustomerError.desc} ${fileName}`, `${error.stack}<br/><br/> sender: ${sender} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[sender])} <br/><br/> agent: ${agentEmail} <br/><br/> agentdetail:${JSON.stringify(botConfigValues.conversationReferences[agentEmail])} <br/><br/> customer:${customerId} <br/><br/> customerDetail:${JSON.stringify(botConfigValues.conversationReferences[customerId])} <br/><br/> message:${message} <br/><br/> department:${department} <br/><br/> initiator: ${initiator}`)
            reject(`${errorMessages.disconnectAgentCustomerError.desc} ${fileName} ${error.stack}`)
        }
    })
}

// fuction to end user's conversation
module.exports.endConversation = (conversationId, convoReferrer, sender, reciever, event) => {
    return new Promise(async (resolve, reject) => {
        try {
            await insertChatLog(conversationId, event, sender, reciever)

            botConfigValues.conversationReferences[convoReferrer] ? delete botConfigValues.conversationReferences[convoReferrer] : botConfigValues.conversationReferences

            resolve(botConfigValues.conversationReferences)
        } catch (error) {
            console.error(errorMessages.endConversationError.name, error);
            appInsightsClient(errorMessages.endConversationError.name, error)
            sendErrorMail(`${errorMessages.endConversationError.desc} ${fileName}`, `${error.stack}<br/><br/> sender: ${sender} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[sender])} <br/><br/> reciever: ${reciever} <br/><br/> recieverdetail:${JSON.stringify(botConfigValues.conversationReferences[reciever])} <br/><br/> event:${event}`)
            reject(`${errorMessages.endConversationError.desc} ${fileName} ${error.stack}`)
        }
    })
}

// function to send typing event to concerned user
module.exports.sendTypingIndicator = (conversationReference, event) => {
    return new Promise(async (resolve, reject) => {
        try {
            var sender, reciever;
            if (botConfigValues.conversationReferences[conversationReference.user.name]) {
                await sendEvent(botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo], event)

                sender = conversationReference.user.name
                reciever = botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo]

            } else if (botConfigValues.conversationReferences[conversationReference.conversation.id]) {
                await sendEvent(botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.userConnectedTo], event, userType.typing)

                sender = conversationReference.conversation.id
                reciever = botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.userConnectedTo]
            }
            resolve()
        } catch (error) {
            console.error(errorMessages.sendTypingIndicatorError.name, error);
            appInsightsClient(errorMessages.sendTypingIndicatorError.name, error)
            sendErrorMail(`${errorMessages.sendTypingIndicatorError.desc} ${fileName}`, `${error.stack}<br/><br/> sender: ${sender} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[sender])} <br/><br/> reciever: ${reciever} <br/><br/> recieverdetail:${JSON.stringify(botConfigValues.conversationReferences[reciever])}`)
            reject(`${errorMessages.sendTypingIndicatorError.desc} ${fileName} ${error.stack}`)
        }
    })
}

// function to make agent unavailable
module.exports.makeAgentUnavailable = (agentEmail) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (botConfigValues.conversationReferences[agentEmail] && (!botConfigValues.conversationReferences[agentEmail][botVariableNames.userConnectedTo]
                && !botConfigValues.conversationReferences[agentEmail][botVariableNames.isReqestedByUser])) {
                userDetail = botConfigValues.conversationReferences[agentEmail][botVariableNames.personalDetail]

                if (botConfigValues.availableAgents[userDetail.personalDetail.adDepartment] && botConfigValues.availableAgents[userDetail.personalDetail.adDepartment].includes(agentEmail)) {
                    let adeptIndex = botConfigValues.availableAgents[userDetail.personalDetail.adDepartment].indexOf(agentEmail)
                    botConfigValues.availableAgents[userDetail.personalDetail.adDepartment].splice(adeptIndex, 1)
                }

                let message = botConfigValues.valueFromDatabase.agentUnavailableMessageToAgent.replace(botConfigValues.staticTexts.replaceParam, userDetail.personalDetail.adName)
                await sendEvent(agentEmail, botConfigValues.staticTexts.agentUnavailableEvent, message)
                await sendMessage(agentEmail, message)
                if (botConfigValues.conversationReferences[agentEmail] && botConfigValues.conversationReferences[agentEmail][botVariableNames.convoRef]) {
                    await this.endConversation(botConfigValues.conversationReferences[agentEmail][botVariableNames.convoRef].conversation.id, agentEmail, userType.bot, agentEmail, message)
                }
            }

            resolve()
        } catch (error) {
            console.error(errorMessages.makeAgentUnavailableError.name, error);
            appInsightsClient(errorMessages.makeAgentUnavailableError.name, error)
            sendErrorMail(`${errorMessages.makeAgentUnavailableError.desc} ${fileName}`, `${error.stack}<br/><br/> sender: ${agentEmail} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[agentEmail])}`)
            reject(`${errorMessages.makeAgentUnavailableError.desc} ${fileName} ${error.stack}`)
        }
    })
}

// function to auto disconnect agent and customer after time interval
module.exports.autoDisconnectAgentCustomer = () => {
    return new Promise(async (resolve, reject) => {
        try {
            var sender, reciever, event;
            if (botConfigValues.conversationReferences && Object.keys(botConfigValues.conversationReferences).length > 0) {
                botConfigValues.autoDisconnectRunning = true
                let users = Object.keys(botConfigValues.conversationReferences)
                // save log of new run
                if (JSON.stringify(Object.keys(botConfigValues.conversationReferences)) !== JSON.stringify(botConfigValues.autoDisconnectRunCurrentUsers)) {
                    botConfigValues.autoDisconnectRunCurrentUsers = Object.keys(botConfigValues.conversationReferences)
                    await insertAutoDisconnectRunLogs(`auto disconnect function running on ${users.length} users ${users}`)
                }

                //loop on current users
                for (var userIndex = 0; userIndex < users.length; userIndex++) {
                    sender = null; reciever = null; event = null;

                    // auto disconnect if agent not responding
                    if (botConfigValues.conversationReferences[users[userIndex]] && (botConfigValues.conversationReferences[users[userIndex]][botVariableNames.userType] === userType.agent) && botConfigValues.conversationReferences[users[userIndex]][botVariableNames.userConnectedTo] && ((new Date() - botConfigValues.conversationReferences[users[userIndex]][botVariableNames.activityTime]) >= parseFloat(botConfigValues.valueFromDatabase.autoDisconnectAgentTime * botConfigValues.staticTexts.minToMilisec))) {

                        sender = users[userIndex]
                        reciever = botConfigValues.conversationReferences[users[userIndex]][botVariableNames.userConnectedTo]
                        event = `${botConfigValues.staticTexts.agentCustomerDisconnectedEvent} - ${botConfigValues.staticTexts.agentNotRespondedEvent}`

                        await this.disconnectAgentCustomer(botConfigValues.staticTexts.agentNotRespondedEvent, botConfigValues.conversationReferences[users[userIndex]][botVariableNames.userConnectedTo], users[userIndex], users[userIndex], `${botConfigValues.staticTexts.agentCustomerDisconnectedEvent} - ${botConfigValues.staticTexts.agentNotRespondedEvent}`)
                    }

                    // warn customer before auto disconnect if not responding
                    else if (botConfigValues.conversationReferences[users[userIndex]] && !botConfigValues.conversationReferences[users[userIndex]][botVariableNames.autoDisconnectWarnMessageFlag] && (botConfigValues.conversationReferences[users[userIndex]][botVariableNames.userType] === userType.customer) && botConfigValues.conversationReferences[users[userIndex]][botVariableNames.userConnectedTo] && ((new Date() - botConfigValues.conversationReferences[users[userIndex]][botVariableNames.activityTime]) >= parseFloat((botConfigValues.valueFromDatabase.autoDisconnectCustomerTime - botConfigValues.valueFromDatabase.autoDisconnectCustomerWarningTime) * botConfigValues.staticTexts.minToMilisec))) {

                        botConfigValues.conversationReferences[users[userIndex]][botVariableNames.autoDisconnectWarnMessageFlag] = true
                        let message = botConfigValues.valueFromDatabase.autoDisconnectCustomerWarningMessage.replace(botConfigValues.staticTexts.replaceParam, botConfigValues.valueFromDatabase.autoDisconnectCustomerWarningTime)

                        sender = users[userIndex]
                        event = message

                        await sendEvent(users[userIndex], botConfigValues.staticTexts.serviceMessageEvent, message)

                        let userDetail = botConfigValues.conversationReferences[botConfigValues.conversationReferences[users[userIndex]][botVariableNames.userConnectedTo]][botVariableNames.personalDetail]
                        let msg = botConfigValues.valueFromDatabase.agentConnectedHeaderMessageToCustomer.replace(botConfigValues.staticTexts.replaceParam, userDetail.personalDetail.adName)

                        await customerSessionDetail(userType.post, users[userIndex], customerUiStates.liveChat, botConfigValues.staticTexts.agentConnectedEvent, msg, userType.bot, message, userType.bot)

                        await insertChatLog(users[userIndex], message, userType.bot, users[userIndex])
                    }

                    // auto disconnect if customer not responding
                    else if (botConfigValues.conversationReferences[users[userIndex]] && (botConfigValues.conversationReferences[users[userIndex]][botVariableNames.userType] === userType.customer) && botConfigValues.conversationReferences[users[userIndex]][botVariableNames.userConnectedTo] && ((new Date() - botConfigValues.conversationReferences[users[userIndex]][botVariableNames.activityTime]) >= parseFloat(botConfigValues.valueFromDatabase.autoDisconnectCustomerTime * botConfigValues.staticTexts.minToMilisec))) {

                        sender = users[userIndex]
                        reciever = botConfigValues.conversationReferences[users[userIndex]][botVariableNames.userConnectedTo]
                        event = `${botConfigValues.staticTexts.agentCustomerDisconnectedEvent} - ${botConfigValues.staticTexts.customerNotRespondedEvent}`

                        await this.disconnectAgentCustomer(botConfigValues.staticTexts.customerNotRespondedEvent, users[userIndex], botConfigValues.conversationReferences[users[userIndex]][botVariableNames.userConnectedTo], users[userIndex], `${botConfigValues.staticTexts.agentCustomerDisconnectedEvent} - ${botConfigValues.staticTexts.customerNotRespondedEvent}`)
                    }

                    // auto abandon customer if not responding
                    else if (botConfigValues.conversationReferences[users[userIndex]] && (botConfigValues.conversationReferences[users[userIndex]][botVariableNames.userType] === userType.customer) && !botConfigValues.conversationReferences[users[userIndex]][botVariableNames.userConnectedTo] && ((new Date() - botConfigValues.conversationReferences[users[userIndex]][botVariableNames.activityTime]) >= parseFloat(botConfigValues.valueFromDatabase.autoAbandonCustomerTime * botConfigValues.staticTexts.minToMilisec)) && (!botConfigValues.usersInQueue[botConfigValues.conversationReferences[users[userIndex]][botVariableNames.userDepartment]] || botConfigValues.usersInQueue[botConfigValues.conversationReferences[users[userIndex]][botVariableNames.userDepartment]] && !botConfigValues.usersInQueue[botConfigValues.conversationReferences[users[userIndex]][botVariableNames.userDepartment]][users[userIndex]])) {

                        sender = users[userIndex]
                        event = `${botConfigValues.staticTexts.customerSessionAbandonEvent} - ${botConfigValues.conversationReferences[users[userIndex]][botVariableNames.abandonEventType]}`

                        botConfigValues.conversationReferences[users[userIndex]][botVariableNames.activityTime] = new Date()
                        await customerSessionDetail(userType.post, users[userIndex], customerUiStates.endchat, botConfigValues.staticTexts.customerExitEvent, botConfigValues.valueFromDatabase.customerChatDefaultHeader)
                        await sendEvent(users[userIndex], botConfigValues.staticTexts.customerSessionAbandonEvent)
                        botConfigValues.conversationReferences[users[userIndex]][botVariableNames.agentCustomerDisconnected] ? await this.endConversation(users[userIndex], users[userIndex], userType.bot, users[userIndex], `${botConfigValues.staticTexts.customerExitEvent} - ${botConfigValues.staticTexts.sessionExitByCustomer}`) : await this.endConversation(users[userIndex], users[userIndex], userType.bot, users[userIndex], `${botConfigValues.staticTexts.customerSessionAbandonEvent} - ${botConfigValues.conversationReferences[users[userIndex]][botVariableNames.abandonEventType]}`)
                    }

                    if ((userIndex === (users.length - 1))) {
                        setTimeout(async () => {
                            await this.autoDisconnectAgentCustomer()
                        }, 2000)
                    }
                }

            } else {
                await insertAutoDisconnectRunLogs(`auto disconnect function not running because of no active users`)
                botConfigValues.autoDisconnectRunning = false
            }

            resolve()
        } catch (error) {
            console.error(errorMessages.autoDisconnectAgentCustomerError.name, error);
            appInsightsClient(errorMessages.autoDisconnectAgentCustomerError.name, error)
            sendErrorMail(`${errorMessages.autoDisconnectAgentCustomerError.desc} ${fileName}`, `${error.stack}<br/><br/> sender: ${sender} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[sender])}<br/><br/> reciever: ${reciever} <br/><br/> recieverdetail:${JSON.stringify(botConfigValues.conversationReferences[reciever])}<br/><br/> event:${event}`)
            reject(`${errorMessages.autoDisconnectAgentCustomerError.desc} ${fileName} ${error.stack}`)
        }
    })
}

// function to check if agents are available in any department or not
module.exports.checkAgentAvailability = (initiator, department) => {
    return new Promise((resolve, reject) => {
        try {

            let allDept = department ? [department] : Object.keys(botConfigValues.departments.deptContactDetail)
            let message = department ? botConfigValues.valueFromDatabase.agentNotAvailableMessage.replace(botConfigValues.staticTexts.replaceParam, `<a href="tel:+${botConfigValues.departments.deptContactDetail[department]}">${botConfigValues.departments.deptContactDetail[department]}</a>`) : botConfigValues.valueFromDatabase.agentNotAvailableGeneralMessage
            let count = 0;

            allDept.forEach((department, key) => {
                botConfigValues.usersInQueue[department] === undefined ? botConfigValues.usersInQueue[department] = {} : botConfigValues.usersInQueue[department]
                if ((botConfigValues.availableAgents[department] && botConfigValues.availableAgents[department].length > 0) && (botConfigValues.usersInQueue[department] && (Object.keys(botConfigValues.usersInQueue[department]).length < (botConfigValues.availableAgents[department].length * parseInt(botConfigValues.valueFromDatabase.maxCustPerAgentInQueue))))) {
                    count++;
                }
            })
            if (count > 0) {
                resolve({
                    isAgentAvailable: true
                })
            } else {
                resolve({
                    isAgentAvailable: false,
                    message: message
                })
            }

        } catch (error) {
            console.error(errorMessages.checkAgentAvailabilityError.name, error);
            appInsightsClient(errorMessages.checkAgentAvailabilityError.name, error)
            sendErrorMail(`${errorMessages.checkAgentAvailabilityError.desc} ${fileName}`, `${error.stack} <br/><br/> initiator: ${initiator}`)
            reject(`${errorMessages.checkAgentAvailabilityError.desc} ${fileName} ${error.stack}`)
        }
    })
}

// // auto open contact and case url in dynamics
// module.exports.autoOpenURLFunction = (agentEmail, customerId) => {
//     return new Promise(async (resolve, reject) => {
//         try {
//             let userDetail = botConfigValues.conversationReferences[agentEmail][botVariableNames.personalDetail]

//             // log data to dynamics
//             botConfigValues.conversationReferences[agentEmail][botVariableNames.crmAgentGUID] = await getAgentGuid(agentEmail)
//             if (botConfigValues.conversationReferences[customerId][botVariableNames.crmContactGUID] && botConfigValues.conversationReferences[agentEmail][botVariableNames.crmAgentGUID] && !botConfigValues.conversationReferences[customerId][botVariableNames.crmCaseGUID]) {
//                 let caseId = await createNewCase(botConfigValues.conversationReferences[customerId][botVariableNames.convoHistory][0].message, botConfigValues.crmValues.caseTypeCode[userDetail.personalDetail.adDepartment], botConfigValues.conversationReferences[customerId][botVariableNames.crmContactGUID], botConfigValues.conversationReferences[agentEmail][botVariableNames.crmAgentGUID])
//                 botConfigValues.conversationReferences[agentEmail][botVariableNames.crmCaseGUID] = caseId
//                 botConfigValues.conversationReferences[customerId][botVariableNames.crmCaseGUID] = caseId

//             } else if (botConfigValues.conversationReferences[customerId][botVariableNames.crmCaseGUID]) {
//                 await updateExistingCase(botConfigValues.conversationReferences[customerId][botVariableNames.crmCaseGUID], botConfigValues.conversationReferences[agentEmail][botVariableNames.crmAgentGUID])
//             }

//             if (botConfigValues.conversationReferences[customerId][botVariableNames.crmCaseGUID]) {
//                 let caseId = botConfigValues.conversationReferences[customerId][botVariableNames.crmCaseGUID]
//                 let caseURL = `${process.env.CRMAPIAutoOpenBaseURL}${process.env.CRMAppId}${process.env.CRMCaseId}${caseId}${process.env.CRMOtherOption}`
//                 await sendEvent(agentEmail, botConfigValues.staticTexts.openAutoUrlEvent, caseURL)

//                 let card = await dynamicsURLCard(caseId, botConfigValues.conversationReferences[customerId][botVariableNames.crmContactGUID])

//                 await sendAttachment(agentEmail, card)
//             }

//             resolve()
//         } catch (error) {
//             console.error(errorMessages.autoOpenDynamicsURL.name, error);
//             appInsightsClient(errorMessages.autoOpenDynamicsURL.name, error)
//             sendErrorMail(`${errorMessages.autoOpenDynamicsURL.desc} ${fileName}`, `${error.stack} <br/><br/> agentEmail: ${agentEmail}<br/><br/> contactId: ${botConfigValues.conversationReferences[customerId][botVariableNames.crmContactGUID]}<br/><br/> caseId: ${botConfigValues.conversationReferences[customerId][botVariableNames.crmCaseGUID]}`)
//             reject(`${errorMessages.autoOpenDynamicsURL.desc} ${fileName} ${error.stack}`)
//         }
//     })
// }