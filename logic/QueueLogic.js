// Get filename to use in error messages
const path = require('path')
const fileName = path.basename(__filename)

// import required packages
const { botConfigValues, errorMessages, botVariableNames, userType, customerUiStates } = require('../config/Config')
const { sendErrorMail } = require('../monitoring/Mail')
const { appInsightsClient } = require('../monitoring/AppInsights');
const { insertChatLog, insertQueueLogs, insertConnReqLogs, botConfigs, updateAgentStatus, customerSessionDetail } = require('../data/Queries');
const { sendEvent, sendAttachment } = require('../controller/SendMessages');
const { userConnectionRequestCard, convoHistoryCard, userDetailToAgentCard, dynamicsURLCard } = require('./Cards');
const { makeAgentUnavailable } = require('./BotLogic');
// const { createNewContact, getExistingContact, getAgentGuid, createNewCase, updateExistingCase } = require('../data/CRMApi');

// function to check if queue is not full and add users in queue
module.exports.addUserInQueue = (customerId, department, event, message) => {
    return new Promise(async (resolve, reject) => {
        try {
            let result;
            botConfigValues.usersInQueue[department] === undefined ? botConfigValues.usersInQueue[department] = {} : botConfigValues.usersInQueue[department]
            botConfigValues.availableAgents[department] === undefined ? botConfigValues.availableAgents[department] = {} : botConfigValues.availableAgents[department]
            if (botConfigValues.usersInQueue[department] && botConfigValues.usersInQueue[department][customerId]) {
                result = await this.getQueuePosition(department, customerId)
            } else {
                if ((botConfigValues.availableAgents[department].length > 0) && (Object.keys(botConfigValues.usersInQueue[department]).length < (botConfigValues.availableAgents[department].length * parseInt(botConfigValues.valueFromDatabase.maxCustPerAgentInQueue)))) {
                    botConfigValues.usersInQueue[department][customerId] = {}
                    botConfigValues.usersInQueue[department][customerId][botVariableNames.requestSentToAgents] = []
                    botConfigValues.usersInQueue[department][customerId][botVariableNames.requestSentToAgent] = false
                    botConfigValues.usersInQueue[department][customerId][botVariableNames.userToAgentConnRequestCount] = 1
                    botConfigValues.usersInQueue[department][customerId][botVariableNames.requestSentToAgentTime] = new Date()
                    botConfigValues.usersInQueue[department][customerId][botVariableNames.userAddedToQueueTime] = new Date()
                    botConfigValues.usersInQueue[department][customerId][botVariableNames.queuePosition] = 0
                    botConfigValues.usersInQueue[department][customerId][botVariableNames.queueGuid] = await getConnectionRequestGuid()

                    botConfigValues.conversationReferences[customerId][botVariableNames.userDepartment] = department
                    botConfigValues.conversationReferences[customerId][botVariableNames.abandonEventType] = botConfigValues.staticTexts.IQuabandonEvent

                    await insertQueueLogs(customerId, botConfigValues.staticTexts.enqueue, department, botConfigValues.staticTexts.enqueue, botConfigValues.usersInQueue[department][customerId][botVariableNames.queueGuid])

                    await customerSessionDetail(userType.post, customerId, customerUiStates.liveChat, botConfigValues.staticTexts.findLiveAgentEvent, botConfigValues.valueFromDatabase.findLiveAgentMessage)

                } else {
                    result = botConfigValues.valueFromDatabase.agentNotAvailableMessage
                    event = botConfigValues.staticTexts.noAgentEvent
                    message = botConfigValues.valueFromDatabase.agentNotAvailableMessage.replace(botConfigValues.staticTexts.replaceParam, `<a href="tel:+${botConfigValues.departments.deptContactDetail[department]}">${botConfigValues.departments.deptContactDetail[department]}</a>`)

                    botConfigValues.conversationReferences[customerId][botVariableNames.abandonEventType] = botConfigValues.staticTexts.NAabandonEvent
                    botConfigValues.conversationReferences[customerId][botVariableNames.agentPanelMessage] = message

                    await customerSessionDetail(userType.post, customerId, customerUiStates.chatOffLanding, event, botConfigValues.valueFromDatabase.customerChatDefaultHeader)
                }
                await sendEvent(customerId, event, message)

                await insertChatLog(customerId, `${event} - ${message}`, userType.bot, customerId)

                if (event !== botConfigValues.staticTexts.noAgentEvent) {
                    await this.queueLogic(department, customerId)
                }

            }

            resolve(result)
        } catch (error) {
            console.error(errorMessages.addUserinQueueError.name, error);
            appInsightsClient(errorMessages.addUserinQueueError.name, error)
            sendErrorMail(`${errorMessages.addUserinQueueError.desc} ${fileName}`, `${error.stack}<br/><br/> sender: ${customerId} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[customerId])} <br/><br/> department: ${department} <br/><br/> event:${event}`)
            reject(`${errorMessages.addUserinQueueError.desc} ${fileName} ${error.stack}`)
        }
    })
}

// function to manage users in queue and connect them with available agent found through findAvailableAgents function logic 
module.exports.queueLogic = async (department, customerId) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (botConfigValues.usersInQueue[department] && botConfigValues.usersInQueue[department][customerId]) {
                let usersInDptmtQueue = Object.keys(botConfigValues.usersInQueue[department])

                let uidqIndex = usersInDptmtQueue.indexOf(customerId)
                if (botConfigValues.availableAgents[department] && botConfigValues.availableAgents[department].length > 0) {
                    for (let agentIndex = 0; agentIndex < botConfigValues.availableAgents[department].length; agentIndex++) {

                        let agentEmail = botConfigValues.availableAgents[department][agentIndex];
                        let userReqSentToAgent = false

                        // check if user has sent request to agent and response is pending
                        if (botConfigValues.usersInQueue[department] && botConfigValues.usersInQueue[department][customerId] && botConfigValues.usersInQueue[department][customerId][botVariableNames.requestSentToAgent] && ((new Date() - botConfigValues.usersInQueue[department][customerId][botVariableNames.requestSentToAgentTime]) >= (parseFloat(botConfigValues.valueFromDatabase.conReqAutoRejectTime) * botConfigValues.staticTexts.minToMilisec))) {
                            await this.rejectConnectionRequest("queueLogic", customerId, botConfigValues.usersInQueue[department][customerId][botVariableNames.requestSentToAgent], botConfigValues.staticTexts.connReqAutoRejectedEvent)
                            userReqSentToAgent = false;
                            continue;
                        } else if (botConfigValues.usersInQueue[department] && botConfigValues.usersInQueue[department][customerId] && botConfigValues.usersInQueue[department][customerId][botVariableNames.requestSentToAgent] && ((new Date() - botConfigValues.usersInQueue[department][customerId][botVariableNames.requestSentToAgentTime]) < (parseFloat(botConfigValues.valueFromDatabase.conReqAutoRejectTime) * botConfigValues.staticTexts.minToMilisec))) {
                            userReqSentToAgent = true;
                            break;
                        }

                        // check if user waiting time in queue is not over and user is not having queue position greater than queue size and currently user is not waiting for connection request response
                        if (!userReqSentToAgent && botConfigValues.usersInQueue[department] && botConfigValues.usersInQueue[department][customerId] && ((new Date() - botConfigValues.usersInQueue[department][customerId][botVariableNames.userAddedToQueueTime]) < (parseFloat(botConfigValues.valueFromDatabase.custWaitingTimeInQueue) * botConfigValues.staticTexts.minToMilisec)) && (uidqIndex < (botConfigValues.availableAgents[department].length * parseInt(botConfigValues.valueFromDatabase.maxCustPerAgentInQueue)))) {
                            // delete agent's email who became unavailale, from user's agent requested list
                            let agentsInDptmt = botConfigValues.availableAgents[department];
                            let agentsRequested = botConfigValues.usersInQueue[department][customerId][botVariableNames.requestSentToAgents]

                            agentsRequested = agentsInDptmt.filter(value => agentsRequested.includes(value))
                            botConfigValues.usersInQueue[department][customerId][botVariableNames.requestSentToAgents] = agentsRequested

                            // ensure that all agents are being sent request multiple times
                            if ((agentsRequested.length === agentsInDptmt.length) && botConfigValues.usersInQueue[department] && botConfigValues.usersInQueue[department][customerId] && (botConfigValues.usersInQueue[department][customerId][botVariableNames.userToAgentConnRequestCount] < parseInt(botConfigValues.valueFromDatabase.userToAgentConnRequestCount))) {
                                botConfigValues.usersInQueue[department][customerId][botVariableNames.userToAgentConnRequestCount] += 1
                                botConfigValues.usersInQueue[department][customerId][botVariableNames.requestSentToAgents] = []
                                agentsRequested = []
                            } else if ((agentsRequested.length === agentsInDptmt.length) && botConfigValues.usersInQueue[department] && botConfigValues.usersInQueue[department][customerId] && (botConfigValues.usersInQueue[department][customerId][botVariableNames.userToAgentConnRequestCount] >= parseInt(botConfigValues.valueFromDatabase.userToAgentConnRequestCount))) {
                                await this.removeUserFromQueue(customerId, department, botConfigValues.staticTexts.noAgentEvent)
                                break;
                            }

                            // try to send current user's request to current agent based on certain checks
                            if ((uidqIndex === 0) && !agentsRequested.includes(agentEmail) && (botConfigValues.conversationReferences[agentEmail] && !botConfigValues.conversationReferences[agentEmail][botVariableNames.isReqestedByUser] && !botConfigValues.conversationReferences[agentEmail][botVariableNames.userConnectedTo])) {
                                await this.sendConnectionRequest(agentEmail, customerId, department)
                                break;
                            } else if ((uidqIndex !== 0) && !agentsRequested.includes(agentEmail) && (botConfigValues.conversationReferences[agentEmail] && !botConfigValues.conversationReferences[agentEmail][botVariableNames.isReqestedByUser] && !botConfigValues.conversationReferences[agentEmail][botVariableNames.userConnectedTo])) {
                                let sendReq = false;
                                for (let index = 0; index < uidqIndex; index++) {
                                    if (botConfigValues.usersInQueue[department] && botConfigValues.usersInQueue[department][usersInDptmtQueue[index]] && !botConfigValues.usersInQueue[department][usersInDptmtQueue[index]][botVariableNames.requestSentToAgents].includes(agentEmail)) {
                                        sendReq = false;
                                        break;
                                    } else {
                                        sendReq = true;
                                    }
                                }
                                if (sendReq) {
                                    await this.sendConnectionRequest(agentEmail, customerId, department)
                                    break;
                                } else {
                                    await this.getQueuePosition(department, customerId)
                                }
                            } else {
                                await this.getQueuePosition(department, customerId)
                            }
                        } else {
                            await this.removeUserFromQueue(customerId, department, botConfigValues.staticTexts.noAgentEvent)
                            break;
                        }
                    }
                } else {
                    await this.removeUserFromQueue(customerId, department, botConfigValues.staticTexts.noAgentEvent)
                }

                setTimeout(async () => {
                    await this.queueLogic(department, customerId)
                }, 1500)

            }

            resolve()
        } catch (error) {
            console.error(errorMessages.queueLogicError.name, error);
            appInsightsClient(errorMessages.queueLogicError.name, error)
            sendErrorMail(`${errorMessages.queueLogicError.desc} ${fileName}`, `${error.stack}<br/><br/> sender: ${customerId} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[customerId])} <br/><br/> department: ${department}`)
            reject(`${errorMessages.queueLogicError.desc} ${fileName} ${error.stack}`)
        }
    })
}

// function to get user's queue position
module.exports.getQueuePosition = async (department, customerId) => {
    return new Promise(async (resolve, reject) => {
        try {
            let queueUsers = Object.keys(botConfigValues.usersInQueue[department])
            let customers = customerId ? [customerId] : Object.keys(botConfigValues.usersInQueue[department])

            customers.forEach(async (customerId) => {
                let position = queueUsers.indexOf(customerId) + 1;
                if (botConfigValues.usersInQueue[department] && botConfigValues.usersInQueue[department][customerId] && (position !== botConfigValues.usersInQueue[department][customerId][botVariableNames.queuePosition])) {
                    botConfigValues.usersInQueue[department][customerId][botVariableNames.queuePosition] = position
                    let message = botConfigValues.valueFromDatabase.queuePositionMessage.replace(botConfigValues.staticTexts.replaceParam, position)

                    await sendEvent(customerId, botConfigValues.staticTexts.inQueueEvent, message)

                    await insertChatLog(customerId, `${botConfigValues.staticTexts.inQueueEvent} - ${message}`, userType.bot, customerId)
                }
            })

            resolve()
        } catch (error) {
            console.error(errorMessages.getQueuePositionError.name, error);
            appInsightsClient(errorMessages.getQueuePositionError.name, error)
            sendErrorMail(`${errorMessages.getQueuePositionError.desc} ${fileName}`, `${error.stack}<br/><br/> sender: ${customerId} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[customerId])} <br/><br/> department: ${department}`)
            reject(`${errorMessages.getQueuePositionError.desc} ${fileName} ${error.stack}`)
        }
    })
}


// function to remove users from queue
module.exports.removeUserFromQueue = async (customerId, department, reason) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (botConfigValues.usersInQueue[department] && botConfigValues.usersInQueue[department][customerId]) {
                let guid = botConfigValues.usersInQueue[department][customerId][botVariableNames.queueGuid]
                delete botConfigValues.usersInQueue[department][customerId]

                await insertQueueLogs(customerId, botConfigValues.staticTexts.dequeue, department, reason, guid)

                await insertChatLog(customerId, `${botConfigValues.staticTexts.dequeue} - ${reason}`, userType.bot, customerId)

                if (reason === botConfigValues.staticTexts.noAgentEvent) {
                    let message = botConfigValues.valueFromDatabase.agentNotAvailableMessage.replace(botConfigValues.staticTexts.replaceParam, `<a href="tel:+${botConfigValues.departments.deptContactDetail[department]}">${botConfigValues.departments.deptContactDetail[department]}</a>`)

                    await sendEvent(customerId, botConfigValues.staticTexts.noAgentEvent, message)

                    botConfigValues.conversationReferences[customerId][botVariableNames.abandonEventType] = botConfigValues.staticTexts.NAabandonEvent
                    botConfigValues.conversationReferences[customerId][botVariableNames.agentPanelMessage] = message

                    await customerSessionDetail(userType.post, customerId, customerUiStates.chatOffLanding, reason, botConfigValues.valueFromDatabase.customerChatDefaultHeader)
                }

                await this.getQueuePosition(department)

                // await this.queueLogic(department)
            }

            resolve()
        } catch (error) {
            console.error(errorMessages.removeUserFromQueueError.name, error);
            appInsightsClient(errorMessages.removeUserFromQueueError.name, error)
            sendErrorMail(`${errorMessages.removeUserFromQueueError.desc} ${fileName}`, `${error.stack}<br/><br/> sender: ${customerId} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[customerId])} <br/><br/> remove from dept:${department} <br/><br/> reason:${reason}`)
            reject(`${errorMessages.removeUserFromQueueError.desc} ${fileName} ${error.stack}`)
        }
    })
}

// function to send connection request to agent
module.exports.sendConnectionRequest = async (agentEmail, customerId, department) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (botConfigValues.conversationReferences[agentEmail] && botConfigValues.usersInQueue[department] && botConfigValues.usersInQueue[department][customerId] && !botConfigValues.conversationReferences[agentEmail][botVariableNames.isReqestedByUser] && botConfigValues.availableAgents[department] && botConfigValues.availableAgents[department].includes(agentEmail)) {
                let reqGuid = await getConnectionRequestGuid();
                botConfigValues.conversationReferences[agentEmail][botVariableNames.isReqestedByUser] = customerId

                botConfigValues.conversationReferences[customerId][botVariableNames.connectionRequestGuid] = reqGuid
                botConfigValues.usersInQueue[department][customerId][botVariableNames.requestSentToAgents].push(agentEmail)
                botConfigValues.usersInQueue[department][customerId][botVariableNames.requestSentToAgent] = agentEmail
                botConfigValues.usersInQueue[department][customerId][botVariableNames.requestSentToAgentTime] = new Date()

                let card = await userConnectionRequestCard(botConfigValues.conversationReferences[customerId][botVariableNames.convoHistory][0].message, botConfigValues.conversationReferences[customerId][botVariableNames.personalDetail].personalDetail.name)
                await sendEvent(agentEmail, botConfigValues.staticTexts.connReqSentEvent)
                await sendAttachment(agentEmail, card)

                await insertChatLog(customerId, botConfigValues.staticTexts.connReqSentEvent, customerId, agentEmail, reqGuid)

                await insertConnReqLogs(customerId, reqGuid, agentEmail, botConfigValues.staticTexts.connReqSentEvent)

                let userDetail = botConfigValues.conversationReferences[agentEmail][botVariableNames.personalDetail]

                await updateAgentStatus(userDetail.personalDetail.adId, botConfigValues.agentpanelValues[botConfigValues.staticTexts.agentStatus].userRequested, userDetail.personalDetail.adDepartment)

                // log data to dynamics
                // if (botConfigValues.staticTexts.enableCRMIntegration.toLowerCase() === "yes") {
                //     let customerDetail = botConfigValues.conversationReferences[customerId][botVariableNames.personalDetail].personalDetail
                //     if (customerDetail.phone || customerDetail.email) {
                //         botConfigValues.conversationReferences[customerId][botVariableNames.crmContactGUID] = await createNewContact(customerDetail.name, customerDetail.phone, customerDetail.email);
                //     }
                //     else {
                //         botConfigValues.conversationReferences[customerId][botVariableNames.crmContactGUID] = await createNewContact("testBot", "9999999999", "testbot@gmail.com");
                //     }
                // }
            }
            resolve()
        } catch (error) {
            console.error(errorMessages.sendConnectionRequestError.name, error);
            appInsightsClient(errorMessages.sendConnectionRequestError.name, error)
            sendErrorMail(`${errorMessages.sendConnectionRequestError.desc} ${fileName}`, `${error.stack}<br/><br/> sender: ${customerId} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[customerId])} <br/><br/> reciever: ${agentEmail} <br/><br/> recieverdetail:${JSON.stringify(botConfigValues.conversationReferences[agentEmail])}`)
            reject(`${errorMessages.sendConnectionRequestError.desc} ${fileName} ${error.stack}`)
        }
    })
}

// function to handle request rejection scenario
module.exports.rejectConnectionRequest = async (initiator, customerId, agentEmail, event, abandonEvent) => {
    return new Promise(async (resolve, reject) => {
        try {
            abandonEvent === undefined ? abandonEvent = "test" : abandonEvent
            if (botConfigValues.conversationReferences[agentEmail] && botConfigValues.conversationReferences[agentEmail][botVariableNames.isReqestedByUser] && botConfigValues.conversationReferences[customerId] && botConfigValues.conversationReferences[customerId][botVariableNames.connectionRequestGuid]) {
                let userDetail = botConfigValues.conversationReferences[agentEmail][botVariableNames.personalDetail]
                botConfigValues.conversationReferences[agentEmail][botVariableNames.requestsRejectedCount] += 1

                await sendEvent(agentEmail, botConfigValues.staticTexts.removeCardEvent)

                await insertChatLog(customerId, event, agentEmail, customerId, botConfigValues.conversationReferences[customerId][botVariableNames.connectionRequestGuid])

                await insertConnReqLogs(customerId, botConfigValues.conversationReferences[customerId][botVariableNames.connectionRequestGuid], agentEmail, event)

                botConfigValues.usersInQueue[userDetail.personalDetail.adDepartment][customerId][botVariableNames.requestSentToAgent] = false
                botConfigValues.conversationReferences[customerId][botVariableNames.connectionRequestGuid] = false

                botConfigValues.conversationReferences[agentEmail][botVariableNames.isReqestedByUser] = false

                if (botConfigValues.conversationReferences[agentEmail][botVariableNames.requestsRejectedCount] < botConfigValues.valueFromDatabase.agentRequestRejectionThreshold) {
                    await updateAgentStatus(userDetail.personalDetail.adId, botConfigValues.agentpanelValues[botConfigValues.staticTexts.agentStatus].available, userDetail.personalDetail.adDepartment)
                } else {
                    let adeptIndex = botConfigValues.availableAgents[userDetail.personalDetail.adDepartment].indexOf(agentEmail)
                    botConfigValues.availableAgents[userDetail.personalDetail.adDepartment].splice(adeptIndex, 1)

                    await updateAgentStatus(userDetail.personalDetail.adId, botConfigValues.agentpanelValues[botConfigValues.staticTexts.agentStatus].unavailable, userDetail.personalDetail.adDepartment)
                }
                if (abandonEvent === botConfigValues.staticTexts.customerSessionAbandonEvent) {
                    await this.removeUserFromQueue(customerId, botConfigValues.conversationReferences[customerId][botVariableNames.userDepartment], abandonEvent)
                }
                // else {
                //     await this.queueLogic(userDetail.personalDetail.adDepartment)
                // }
            } else if (botConfigValues.conversationReferences[agentEmail] && botConfigValues.conversationReferences[agentEmail][botVariableNames.isReqestedByUser]) {
                let userDetail = botConfigValues.conversationReferences[agentEmail][botVariableNames.personalDetail]

                await sendEvent(agentEmail, botConfigValues.staticTexts.removeCardEvent)

                botConfigValues.conversationReferences[agentEmail][botVariableNames.isReqestedByUser] = false

                await updateAgentStatus(userDetail.personalDetail.adId, botConfigValues.agentpanelValues[botConfigValues.staticTexts.agentStatus].available, userDetail.personalDetail.adDepartment)

            }
            resolve(event)

        } catch (error) {
            console.error(errorMessages.rejectConnectionRequestError.name, error);
            appInsightsClient(errorMessages.rejectConnectionRequestError.name, error)
            sendErrorMail(`${errorMessages.rejectConnectionRequestError.desc} ${fileName}`, `${error.stack}<br/><br/> sender: ${agentEmail} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[agentEmail])} <br/><br/> reciever: ${customerId} <br/><br/> recieverdetail:${JSON.stringify(botConfigValues.conversationReferences[customerId])}<br/><br/> event:${event} <br/><br/> initiator:${initiator}`)
            reject(`${errorMessages.rejectConnectionRequestError.desc} ${fileName} ${error.stack}`)
        }
    })
}

//function to accept connection request and connect agent and customer
module.exports.acceptConnectionRequest = async (customerId, agentEmail, event) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (botConfigValues.conversationReferences[agentEmail] && botConfigValues.conversationReferences[customerId] && botConfigValues.conversationReferences[customerId][botVariableNames.convoHistory].length > 0) {
                await sendEvent(agentEmail, botConfigValues.staticTexts.removeCardEvent)
                await sendEvent(agentEmail, botConfigValues.staticTexts.agentConnectedEvent)

                if (botConfigValues.conversationReferences[customerId] && botConfigValues.conversationReferences[customerId][botVariableNames.personalDetail].personalDetail && botConfigValues.conversationReferences[customerId][botVariableNames.personalDetail].personalDetail.name) {
                    let custDetailCard = await userDetailToAgentCard(botConfigValues.conversationReferences[customerId][botVariableNames.personalDetail].personalDetail)
                    await sendAttachment(agentEmail, custDetailCard)
                }

                let card = await convoHistoryCard(botConfigValues.conversationReferences[customerId][botVariableNames.convoHistory], 0)
                await sendAttachment(agentEmail, card)

                await insertChatLog(customerId, event, agentEmail, customerId, botConfigValues.conversationReferences[customerId][botVariableNames.connectionRequestGuid])

                await insertConnReqLogs(customerId, botConfigValues.conversationReferences[customerId][botVariableNames.connectionRequestGuid], agentEmail, event)

                let userDetail = botConfigValues.conversationReferences[agentEmail][botVariableNames.personalDetail]
                await updateAgentStatus(userDetail.personalDetail.adId, botConfigValues.agentpanelValues[botConfigValues.staticTexts.agentStatus].onChat, userDetail.personalDetail.adDepartment)

                botConfigValues.conversationReferences[agentEmail][botVariableNames.userConnectedTo] = customerId
                botConfigValues.conversationReferences[agentEmail][botVariableNames.isReqestedByUser] = false
                botConfigValues.conversationReferences[agentEmail][botVariableNames.requestsRejectedCount] = 0

                botConfigValues.conversationReferences[customerId][botVariableNames.userConnectedTo] = agentEmail
                botConfigValues.conversationReferences[customerId][botVariableNames.gender] = userDetail.personalDetail.adGender
                botConfigValues.conversationReferences[customerId][botVariableNames.abandonEventType] = botConfigValues.staticTexts.ICabandonEvent

                let message = botConfigValues.valueFromDatabase.agentConnectedHeaderMessageToCustomer.replace(botConfigValues.staticTexts.replaceParam, userDetail.personalDetail.adName)

                await sendEvent(customerId, botConfigValues.staticTexts.agentConnectedEvent, JSON.stringify({
                    "message": message,
                    "gender": botConfigValues.conversationReferences[agentEmail][botVariableNames.personalDetail].personalDetail.adGender
                }))

                let serMessage = botConfigValues.valueFromDatabase.agentConnectedServiceMessageToCustomer.replace(botConfigValues.staticTexts.replaceParam, userDetail.personalDetail.adName)
                await sendEvent(customerId, botConfigValues.staticTexts.serviceMessageEvent, serMessage)

                await customerSessionDetail(userType.post, customerId, customerUiStates.liveChat, botConfigValues.staticTexts.agentConnectedEvent, message, userType.service, serMessage, userDetail.personalDetail.adGender)

                await insertChatLog(customerId, `${botConfigValues.staticTexts.agentConnectedEvent} - ${message}`, userType.bot, customerId, botConfigValues.conversationReferences[customerId][botVariableNames.connectionRequestGuid])

                await this.removeUserFromQueue(customerId, userDetail.personalDetail.adDepartment, event)

                // log data to dynamics
                // await autoOpenURLFunction(agentEmail, customerId)            

                // if (botConfigValues.staticTexts.enableCRMIntegration.toLowerCase() === "yes") {
                //     botConfigValues.conversationReferences[agentEmail][botVariableNames.crmAgentGUID] = await getAgentGuid(agentEmail)
                //     if (botConfigValues.conversationReferences[customerId][botVariableNames.crmContactGUID] && botConfigValues.conversationReferences[agentEmail][botVariableNames.crmAgentGUID] && !botConfigValues.conversationReferences[customerId][botVariableNames.crmCaseGUID]) {
                //         let caseId = await createNewCase(botConfigValues.conversationReferences[customerId][botVariableNames.convoHistory][0].message, botConfigValues.crmValues.caseTypeCode[userDetail.personalDetail.adDepartment], botConfigValues.conversationReferences[customerId][botVariableNames.crmContactGUID], botConfigValues.conversationReferences[agentEmail][botVariableNames.crmAgentGUID])
                //         botConfigValues.conversationReferences[agentEmail][botVariableNames.crmCaseGUID] = caseId
                //         botConfigValues.conversationReferences[customerId][botVariableNames.crmCaseGUID] = caseId

                //     } else if (botConfigValues.conversationReferences[customerId][botVariableNames.crmCaseGUID]) {
                //         await updateExistingCase(botConfigValues.conversationReferences[customerId][botVariableNames.crmCaseGUID], botConfigValues.conversationReferences[agentEmail][botVariableNames.crmAgentGUID])
                //     }

                //     if (botConfigValues.conversationReferences[customerId][botVariableNames.crmCaseGUID]) {
                //         let caseId = botConfigValues.conversationReferences[customerId][botVariableNames.crmCaseGUID]
                //         let caseURL = `${process.env.CRMAPIAutoOpenBaseURL}${process.env.CRMAppId}${process.env.CRMCaseId}${caseId}${process.env.CRMOtherOption}`
                //         await sendEvent(agentEmail, botConfigValues.staticTexts.openAutoUrlEvent, caseURL)

                //         let card = await dynamicsURLCard(caseId, botConfigValues.conversationReferences[customerId][botVariableNames.crmContactGUID])

                //         await sendAttachment(agentEmail, card)
                //     }
                // }

            } else {
                await sendEvent(agentEmail, botConfigValues.staticTexts.removeCardEvent)
                botConfigValues.conversationReferences[agentEmail][botVariableNames.isReqestedByUser] = false

                let userDetail = botConfigValues.conversationReferences[agentEmail][botVariableNames.personalDetail]
                await updateAgentStatus(userDetail.personalDetail.adId, botConfigValues.agentpanelValues[botConfigValues.staticTexts.agentStatus].available, userDetail.personalDetail.adDepartment)
            }
            resolve()

        } catch (error) {
            console.error(errorMessages.acceptConnectionRequestError.name, error);
            appInsightsClient(errorMessages.acceptConnectionRequestError.name, error)
            sendErrorMail(`${errorMessages.acceptConnectionRequestError.desc} ${fileName}`, `${error.stack}<br/><br/> sender: ${agentEmail} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[agentEmail])} <br/><br/> reciever: ${customerId} <br/><br/> recieverdetail:${JSON.stringify(botConfigValues.conversationReferences[customerId])}`)
            reject(`${errorMessages.acceptConnectionRequestError.desc} ${fileName} ${error.stack}`)
        }
    })
}

// function to generate guid for connection request
function getConnectionRequestGuid() {
    return new Promise((resolve, reject) => {
        try {
            var ts = String(new Date().getTime()),
                i = 0,
                out = '';

            for (i = 0; i < ts.length; i += 2) {
                out += Number(ts.substr(i, 2)).toString(36);
            }

            resolve(out);
        } catch (error) {
            console.error(errorMessages.getConnectionRequestGuidError.name, error);
            appInsightsClient(errorMessages.getConnectionRequestGuidError.name, error)
            sendErrorMail(`${errorMessages.getConnectionRequestGuidError.desc} ${fileName}`, error.stack)
            reject(`${errorMessages.getConnectionRequestGuidError.desc} ${fileName} ${error.stack}`)
        }
    })
}