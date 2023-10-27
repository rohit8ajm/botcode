// Get filename to use in error messages
const path = require('path')
const fileName = path.basename(__filename)

// import required packages
const { ActivityHandler, TurnContext, CardFactory, MessageFactory, ActivityTypes } = require('botbuilder');
const { sendErrorMail } = require('../monitoring/Mail')
const { appInsightsClient } = require('../monitoring/AppInsights')
const { botConfigValues, errorMessages, botVariableNames, userType, customerUiStates } = require('../config/Config')
const { authenticateUser, createConvoReference, checkAgentWorkingHour, customerLoggedIn, endConversation, disconnectAgentCustomer, transferCustomer, sendTypingIndicator, makeAgentUnavailable, autoDisconnectAgentCustomer, checkAgentAvailability } = require('../logic/BotLogic');
const { addUserInQueue, agentFindCustomer, rejectConnectionRequest, queueLogic, acceptConnectionRequest, removeUserFromQueue } = require('../logic/QueueLogic');
const { insertChatLog, updateAgentStatus, agentDetail, insertInitialQuestion, customerSessionDetail, insertCustomerDetail, insertAutoDisconnectRunLogs } = require('../data/Queries');
const { sendEvent, sendMessage, sendAttachment } = require('./SendMessages');
const { convoHistoryCard } = require('../logic/Cards');

class RecieveMessages extends ActivityHandler {
    constructor() {
        super();


        // update adapter of bot with every change on bot to be used at various places to continue conversation
        this.onConversationUpdate(async (context, next) => {
            botConfigValues.botAdapter = context.adapter;
            await next();
        });

        // detect various events coming from bot user and process them to respond to user
        this.onEvent(async (context, next) => {
            try {
                var sender, reciever;

                botConfigValues.botAdapter = context.adapter;

                let conversationReference = await TurnContext.getConversationReference(context.activity);
                conversationReference.user.name = conversationReference.user.name.trim().toLowerCase()

                if (!botConfigValues.conversationReferences[conversationReference.user.name] && !botConfigValues.conversationReferences[conversationReference.conversation.id] && context.activity.name !== botConfigValues.staticTexts.customerSessionAbandonEvent && context.activity.name !== botConfigValues.staticTexts.customerExitEvent) {
                    var customerDetail = {}
                    if (context.activity && context.activity.text) {
                        let tempCustProf = context.activity.text.split(";")
                        context.activity.text = tempCustProf[0]
                        if (tempCustProf[1] && tempCustProf[1] !== null && tempCustProf[1].toLowerCase() !== "null") {
                            tempCustProf[1] = JSON.parse(tempCustProf[1])
                            customerDetail["name"] = `${tempCustProf[1].firstName} ${tempCustProf[1].lastName}`
                            customerDetail["email"] = tempCustProf[1].email
                            customerDetail["phone"] = tempCustProf[1].mobilePhone

                            await insertCustomerDetail(conversationReference.conversation.id, customerDetail.name, customerDetail.email, customerDetail.phone)
                        }
                    }
                    var userDetail = await authenticateUser(conversationReference.user.name, conversationReference, `${context.activity.name} - ${context.activity.text}`, context.activity.text, customerDetail)
                    let result = await createConvoReference(userDetail, conversationReference, context.activity.text)
                    if ((context.activity.text === botConfigValues.valueFromDatabase.messageUsButtonText) && (userDetail.userType === userType.customer)) {
                        await customerSessionDetail(userType.post, conversationReference.conversation.id, customerUiStates.chatOffLanding, `${context.activity.name} - ${context.activity.text}`, botConfigValues.valueFromDatabase.customerChatDefaultHeader)
                    } else if ((context.activity.text === botConfigValues.valueFromDatabase.liveChatButtonText) && (userDetail.userType === userType.customer)) {
                        botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.liveChatStatus] = true
                        await customerSessionDetail(userType.post, conversationReference.conversation.id, customerUiStates.chatLanding, `${context.activity.name} - ${context.activity.text}`, botConfigValues.valueFromDatabase.customerChatDefaultHeader)
                    }
                }
                if (botConfigValues.conversationReferences[conversationReference.user.name] || botConfigValues.conversationReferences[conversationReference.conversation.id]) {
                    switch (context.activity.name) {
                        // send typing event to each other
                        case botConfigValues.staticTexts.typingEvent:
                            await sendTypingIndicator(conversationReference, context.activity.name)
                            break;

                        // send activity on join event
                        case botConfigValues.staticTexts.joinEvent:
                            sender = botConfigValues.conversationReferences[conversationReference.user.name] ? conversationReference.user.name : conversationReference.conversation.id

                            if (userDetail && userDetail.userType === userType.customer) {
                                if (context.activity.text === botConfigValues.valueFromDatabase.messageUsButtonText) {
                                    botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.abandonEventType] = botConfigValues.staticTexts.MSabandonEvent
                                } else {
                                    let agentAvailability = await checkAgentAvailability(botConfigValues.staticTexts.joinEvent)
                                    if (agentAvailability && !agentAvailability.isAgentAvailable) {
                                        botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.abandonEventType] = botConfigValues.staticTexts.NAabandonEvent
                                        botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.agentPanelMessage] = agentAvailability.message

                                        await customerSessionDetail(userType.post, conversationReference.conversation.id, customerUiStates.chatOffLanding, botConfigValues.staticTexts.noAgentEvent, botConfigValues.valueFromDatabase.customerChatDefaultHeader)

                                        await insertChatLog(conversationReference.conversation.id, `${botConfigValues.staticTexts.noAgentEvent} - ${agentAvailability.message}`, userType.bot, conversationReference.conversation.id)
                                    } else {
                                        botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.abandonEventType] = botConfigValues.staticTexts.IQabandonEvent
                                    }
                                }
                                await sendEvent(conversationReference.conversation.id, botConfigValues.staticTexts.joinEvent, botConfigValues.valueFromDatabase.customerChatDefaultHeader)
                            } else if (userDetail && userDetail.userType === userType.agent) {
                                await sendEvent(conversationReference.user.name, botConfigValues.staticTexts.joinEvent)
                            }
                            if (!botConfigValues.autoDisconnectRunning) {
                                await insertAutoDisconnectRunLogs(`auto disconnect function start run ${conversationReference.conversation.id}`)
                                autoDisconnectAgentCustomer();
                            }
                            break;

                        // transfer chat to another department
                        case botConfigValues.staticTexts.transferCustomerEvent:
                            if (botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.isReqestedByUser] || botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo]) {
                                let customerId = botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.isReqestedByUser] ? botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.isReqestedByUser] : botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo]
                                sender = conversationReference.user.name
                                reciever = customerId

                                await insertChatLog(customerId, `${context.activity.name} - ${context.activity.value.text}`, conversationReference.user.name, userType.bot, botConfigValues.conversationReferences[customerId][botVariableNames.connectionRequestGuid])
                                userDetail = botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.personalDetail]
                                await transferCustomer(conversationReference.user.name, userDetail.personalDetail.adDepartment, context.activity.value.text, botConfigValues.staticTexts.transferCustomerEvent);
                            }
                            break;

                        // process activities related to agent becomes available
                        case botConfigValues.staticTexts.agentAvailableEvent:
                            sender = conversationReference.user.name

                            userDetail = botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.personalDetail]
                            let message = botConfigValues.valueFromDatabase.agentDefaultResponseMessage.replace(botConfigValues.staticTexts.replaceParam, userDetail.personalDetail.adName)
                            await insertChatLog(conversationReference.conversation.id, context.activity.name, conversationReference.user.name, userType.bot)
                            await sendMessage(conversationReference.user.name, message)
                            await insertChatLog(conversationReference.conversation.id, message, userType.bot, conversationReference.user.name)
                            await updateAgentStatus(userDetail.personalDetail.adId, context.activity.value.text, userDetail.personalDetail.adDepartment)
                            break;

                        // process activites when agent becomes unavailable
                        case botConfigValues.staticTexts.agentUnavailableEvent:

                            sender = conversationReference.user.name
                            reciever = botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.isReqestedByUser] ? botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.isReqestedByUser] : botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo]

                            await insertChatLog(conversationReference.conversation.id, context.activity.name, conversationReference.user.name, userType.bot)
                            userDetail = botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.personalDetail]
                            if (botConfigValues.availableAgents[userDetail.personalDetail.adDepartment] && botConfigValues.availableAgents[userDetail.personalDetail.adDepartment].includes(conversationReference.user.name)) {
                                let adeptIndex = botConfigValues.availableAgents[userDetail.personalDetail.adDepartment].indexOf(conversationReference.user.name)
                                botConfigValues.availableAgents[userDetail.personalDetail.adDepartment].splice(adeptIndex, 1)
                            }
                            await disconnectAgentCustomer(botConfigValues.staticTexts.agentUnavailableEvent, botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo], conversationReference.user.name, conversationReference.user.name, botConfigValues.staticTexts.agentUnavailableEvent) //rethink---------code left for it
                            await rejectConnectionRequest(botConfigValues.staticTexts.agentUnavailableEvent, botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.isReqestedByUser], conversationReference.user.name, botConfigValues.staticTexts.connReqManualRejectedEvent)
                            await updateAgentStatus(userDetail.personalDetail.adId, context.activity.value.text, userDetail.personalDetail.adDepartment)
                            break;

                        // customer chose to skip personal detail
                        case botConfigValues.staticTexts.customerSkipPersonalDetailEvent:

                            botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.activityTime] = new Date()

                            sender = conversationReference.conversation.id
                            await insertChatLog(conversationReference.conversation.id, botConfigValues.staticTexts.customerSkipPersonalDetailEvent, userType.bot, conversationReference.conversation.id)

                            await customerSessionDetail(userType.post, conversationReference.conversation.id, customerUiStates.liveChat, botConfigValues.staticTexts.customerSkipPersonalDetailEvent, botConfigValues.valueFromDatabase.customerChatDefaultHeader, userType.bot, botConfigValues.staticTexts.customerSkipPersonalDetailEvent, userType.customer)

                            let personalDetail = botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.personalDetail].personalDetail
                            if (personalDetail && personalDetail.name) {
                                await insertCustomerDetail(conversationReference.conversation.id, personalDetail.name, personalDetail.email, personalDetail.phone)
                            }

                            await addUserInQueue(conversationReference.conversation.id, botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.userDepartment], botConfigValues.staticTexts.findLiveAgentEvent, botConfigValues.valueFromDatabase.findLiveAgentMessage)
                            break;

                        // customer chose to abandon or exit the session
                        case botConfigValues.staticTexts.customerSessionAbandonEvent:

                            let department = botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.userDepartment]

                            sender = conversationReference.conversation.id
                            reciever = botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.userConnectedTo] ? botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.userConnectedTo] : (botConfigValues.usersInQueue[department] && botConfigValues.usersInQueue[department][conversationReference.conversation.id]) ? botConfigValues.usersInQueue[department][conversationReference.conversation.id][botVariableNames.requestSentToAgent] : ""

                            await disconnectAgentCustomer(botConfigValues.staticTexts.customerSessionAbandonEvent, conversationReference.conversation.id, botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.userConnectedTo], conversationReference.conversation.id, botConfigValues.staticTexts.customerSessionAbandonEvent)

                            if (department && botConfigValues.usersInQueue[department] && botConfigValues.usersInQueue[department][conversationReference.conversation.id]) {
                                await rejectConnectionRequest(botConfigValues.staticTexts.customerSessionAbandonEvent, conversationReference.conversation.id, botConfigValues.usersInQueue[department][conversationReference.conversation.id][botVariableNames.requestSentToAgent], botConfigValues.staticTexts.connReqAutoRejectedEvent, botConfigValues.staticTexts.customerSessionAbandonEvent)
                            }

                            await removeUserFromQueue(conversationReference.conversation.id, department, botConfigValues.staticTexts.customerSessionAbandonEvent)
                        case botConfigValues.staticTexts.customerExitEvent:

                            sender = conversationReference.conversation.id

                            await customerSessionDetail(userType.post, conversationReference.conversation.id, customerUiStates.endchat, context.activity.name, botConfigValues.valueFromDatabase.customerChatDefaultHeader)
                            await endConversation(conversationReference.conversation.id, conversationReference.conversation.id, conversationReference.conversation.id, userType.bot, `${context.activity.name} - ${context.activity.text}`)
                            await sendMessage(context.activity.name)

                            break;

                        default:
                    }
                }
                await next();
            } catch (error) {
                console.error(errorMessages.eventError.name, error);
                appInsightsClient(`${context.activity.name.replace(botConfigValues.replaceChar, '')}${errorMessages.eventError.name}`, error)
                sendErrorMail(`${errorMessages.eventError.desc} ${fileName}`, `${errorMessages.eventError.body} ${context.activity.name}<br/><br/> ${error.stack}<br/><br/> sender: ${sender} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[sender])} <br/><br/> reciever: ${reciever} <br/><br/> recieverdetail:${JSON.stringify(botConfigValues.conversationReferences[reciever])} <br/><br/> message: ${context.activity.text} <br/><br/> activityName: ${context.activity.name}`)
            }
        })

        // detect various messages coming from bot user and process them to respond to user
        this.onMessage(async (context, next) => {
            try {
                var sender, reciever;
                botConfigValues.botAdapter = context.adapter;
                let conversationReference = await TurnContext.getConversationReference(context.activity);
                conversationReference.user.name = conversationReference.user.name.trim().toLowerCase()

                if (botConfigValues.conversationReferences[conversationReference.user.name] || botConfigValues.conversationReferences[conversationReference.conversation.id]) {

                    if (context.activity.value && context.activity.value.userResponse) {
                        context.activity.text = context.activity.value.userResponse
                        context.activity.text = context.activity.text.replace("𝐘𝐨𝐮: ", "")
                    }
                    switch (true) {
                        // process messages if user is agent
                        case (botConfigValues.conversationReferences[conversationReference.user.name] && (botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userType] === userType.agent)):
                            sender = conversationReference.user.name
                            var userDetail = botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.personalDetail]

                            botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.activityTime] = new Date()
                            botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.convoRef] = conversationReference

                            switch (true) {
                                // agent requesting disconnection with customer
                                case botConfigValues.agentpanelValues[botConfigValues.staticTexts.qrEndConvoCategory].includes(context.activity.text):
                                    reciever = botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo]
                                    await disconnectAgentCustomer(`${botConfigValues.staticTexts.agentCustomerDisconnectedEvent} - ${context.activity.text}`, botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo], conversationReference.user.name, conversationReference.user.name, `${botConfigValues.staticTexts.agentCustomerDisconnectedEvent} - ${context.activity.text}`)
                                    break;

                                // reject connection request
                                case (context.activity.text === botConfigValues.staticTexts.connReqManualRejectedEvent):
                                    reciever = botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.isReqestedByUser]
                                    await rejectConnectionRequest(botConfigValues.staticTexts.connReqManualRejectedEvent, botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.isReqestedByUser], conversationReference.user.name, botConfigValues.staticTexts.connReqManualRejectedEvent)
                                    break;

                                // accept connection request
                                case (context.activity.text === botConfigValues.staticTexts.connReqAcceptedEvent):
                                    reciever = botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.isReqestedByUser]
                                    await acceptConnectionRequest(botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.isReqestedByUser], conversationReference.user.name, botConfigValues.staticTexts.connReqAcceptedEvent)
                                    break;

                                // show more conversation history to agent
                                case (context.activity.text === botConfigValues.valueFromDatabase.convoHistoryCardBtnText):
                                    let card = await convoHistoryCard(botConfigValues.conversationReferences[botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo]][botVariableNames.convoHistory], context.activity.value.count)
                                    await sendAttachment(conversationReference.user.name, card)

                                    break;

                                // send agent message to customer
                                case (botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo] !== false):
                                    reciever = botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo]
                                    await sendMessage(botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo], `<b>${userDetail.personalDetail.adName}:</b> ${context.activity.text}`)
                                    botConfigValues.conversationReferences[botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo]][botVariableNames.convoHistory].push({
                                        "sender": userDetail.personalDetail.adName,
                                        "message": context.activity.text,
                                        "timeStamp": new Date()
                                    })
                                    let time = botConfigValues.conversationReferences[botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo]][botVariableNames.messageSentToAgent] ?
                                        botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.activityTime] - botConfigValues.conversationReferences[botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo]][botVariableNames.activityTime] : null

                                    botConfigValues.conversationReferences[botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo]][botVariableNames.messageSentToAgent] = false

                                    await insertChatLog(botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo], context.activity.text, conversationReference.user.name, botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo], botConfigValues.conversationReferences[botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo]][botVariableNames.connectionRequestGuid], time)


                                    let msg = botConfigValues.valueFromDatabase.agentConnectedHeaderMessageToCustomer.replace(botConfigValues.staticTexts.replaceParam, userDetail.personalDetail.adName)

                                    await customerSessionDetail(userType.post, botConfigValues.conversationReferences[conversationReference.user.name][botVariableNames.userConnectedTo], customerUiStates.liveChat, botConfigValues.staticTexts.agentConnectedEvent, msg, userType.agent, `<b>${userDetail.personalDetail.adName}:</b> ${context.activity.text}`, userDetail.personalDetail.adGender)
                                    break;

                                //send agent message to bot
                                default:
                                    await insertChatLog(conversationReference.conversation.id, context.activity.text, conversationReference.user.name, userType.bot)
                                    let message = botConfigValues.valueFromDatabase.agentDefaultResponseMessage.replace(botConfigValues.staticTexts.replaceParam, userDetail.personalDetail.adName)
                                    await sendMessage(conversationReference.user.name, message)
                                    await insertChatLog(conversationReference.conversation.id, message, userType.bot, conversationReference.user.name)
                            }
                            break;

                        // process messages if user is customer
                        case (botConfigValues.conversationReferences[conversationReference.conversation.id] && (botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.userType] === userType.customer)):
                            sender = conversationReference.conversation.id

                            botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.activityTime] = new Date()
                            botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.convoRef] = conversationReference

                            switch (true) {
                                // send customer message to agent
                                case (botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.userConnectedTo] !== false):
                                    reciever = botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.userConnectedTo]
                                    botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.messageSentToAgent] = true
                                    await sendMessage(botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.userConnectedTo], context.activity.text)
                                    botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.convoHistory].push({
                                        "sender": userType.customer,
                                        "message": context.activity.text,
                                        "timeStamp": new Date()
                                    })

                                    await insertChatLog(conversationReference.conversation.id, context.activity.text, conversationReference.conversation.id, botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.userConnectedTo], botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.connectionRequestGuid])

                                    let userDetail = botConfigValues.conversationReferences[botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.userConnectedTo]][botVariableNames.personalDetail]
                                    let msg = botConfigValues.valueFromDatabase.agentConnectedHeaderMessageToCustomer.replace(botConfigValues.staticTexts.replaceParam, userDetail.personalDetail.adName)

                                    await customerSessionDetail(userType.post, conversationReference.conversation.id, customerUiStates.liveChat, botConfigValues.staticTexts.agentConnectedEvent, msg, userType.customer, context.activity.text, userType.customer)

                                    break;

                                // connect customer to ecommerce queue
                                default:
                                    if (botConfigValues.conversationReferences[conversationReference.conversation.id] && botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.convoHistory].length <= 0) {
                                        let data = context.activity.text.split("<br/><br/>");
                                        let department = botConfigValues.initialQuestionCategory[data[0]]

                                        botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.userDepartment] = department

                                        await insertInitialQuestion(conversationReference.conversation.id, data[0], data[1])
                                        botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.convoHistory].push({
                                            "sender": userType.customer,
                                            "message": data[1],
                                            "timeStamp": new Date()
                                        })
                                        await insertChatLog(conversationReference.conversation.id, context.activity.text, conversationReference.conversation.id, userType.bot)

                                        await customerSessionDetail(userType.post, conversationReference.conversation.id, customerUiStates.liveChat, botConfigValues.staticTexts.customerAskPersonalDetailEvent, botConfigValues.valueFromDatabase.customerChatDefaultHeader, userType.customer, context.activity.text, userType.customer)

                                        let agentAvailability = await checkAgentAvailability(context.activity.text, department)
                                        if (agentAvailability && !agentAvailability.isAgentAvailable) {
                                            botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.abandonEventType] = botConfigValues.staticTexts.NAabandonEvent
                                            botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.agentPanelMessage] = agentAvailability.message

                                            await sendEvent(conversationReference.conversation.id, botConfigValues.staticTexts.noAgentEvent, agentAvailability.message)

                                            await customerSessionDetail(userType.post, conversationReference.conversation.id, customerUiStates.chatOffLanding, botConfigValues.staticTexts.noAgentEvent, botConfigValues.valueFromDatabase.customerChatDefaultHeader)

                                            await insertChatLog(conversationReference.conversation.id, `${botConfigValues.staticTexts.noAgentEvent} - ${agentAvailability.message}`, userType.bot, conversationReference.conversation.id)

                                        } else {
                                            let personalDetail = botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.personalDetail].personalDetail
                                            if (personalDetail && personalDetail.name) {
                                                await addUserInQueue(conversationReference.conversation.id, department, botConfigValues.staticTexts.findLiveAgentEvent, botConfigValues.valueFromDatabase.findLiveAgentMessage)
                                            } else {
                                                botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.abandonEventType] = botConfigValues.staticTexts.CDabandonEvent

                                                await sendEvent(conversationReference.conversation.id, botConfigValues.staticTexts.customerAskPersonalDetailEvent, botConfigValues.valueFromDatabase.customerLiveChatNameQuestion)

                                                await sendMessage(conversationReference.conversation.id, botConfigValues.valueFromDatabase.customerLiveChatNameQuestion)

                                                botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.currentQuestion] = botConfigValues.valueFromDatabase.customerLiveChatNameQuestion

                                                await customerSessionDetail(userType.post, conversationReference.conversation.id, customerUiStates.liveChat, botConfigValues.staticTexts.customerAskPersonalDetailEvent, botConfigValues.valueFromDatabase.customerChatDefaultHeader, userType.bot, botConfigValues.valueFromDatabase.customerLiveChatNameQuestion, userType.bot)

                                                await insertChatLog(conversationReference.conversation.id, `${botConfigValues.staticTexts.customerAskPersonalDetailEvent} - ${botConfigValues.valueFromDatabase.customerLiveChatNameQuestion}`, userType.bot, conversationReference.conversation.id)
                                            }
                                        }
                                    } else if (botConfigValues.conversationReferences[conversationReference.conversation.id] && botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.convoHistory].length <= 1) {
                                        botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.abandonEventType] = botConfigValues.staticTexts.CDabandonEvent
                                        if (botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.currentQuestion] === botConfigValues.valueFromDatabase.customerLiveChatNameQuestion) {
                                            botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.personalDetail].personalDetail = {
                                                name: "",
                                                phone: "",
                                                email: ""
                                            }

                                            if (context.activity.text && context.activity.text.match(botConfigValues.nameRegex)) {
                                                botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.personalDetail].personalDetail["name"] = context.activity.text

                                                await insertChatLog(conversationReference.conversation.id, context.activity.text, conversationReference.conversation.id, userType.bot)

                                                await customerSessionDetail(userType.post, conversationReference.conversation.id, customerUiStates.liveChat, botConfigValues.staticTexts.customerAskPersonalDetailEvent, botConfigValues.valueFromDatabase.customerChatDefaultHeader, userType.customer, context.activity.text, userType.customer)

                                                await sendMessage(conversationReference.conversation.id, botConfigValues.valueFromDatabase.customerLiveChatEmailQuestion)

                                                botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.currentQuestion] = botConfigValues.valueFromDatabase.customerLiveChatEmailQuestion

                                                await insertChatLog(conversationReference.conversation.id, botConfigValues.valueFromDatabase.customerLiveChatEmailQuestion, userType.bot, conversationReference.conversation.id)

                                                await customerSessionDetail(userType.post, conversationReference.conversation.id, customerUiStates.liveChat, botConfigValues.staticTexts.customerAskPersonalDetailEvent, botConfigValues.valueFromDatabase.customerChatDefaultHeader, userType.bot, botConfigValues.valueFromDatabase.customerLiveChatEmailQuestion, userType.bot)
                                            } else {
                                                await sendMessage(conversationReference.conversation.id, botConfigValues.valueFromDatabase.customerLiveChatNameValidationMessage)
                                            }
                                        } else if (botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.currentQuestion] === botConfigValues.valueFromDatabase.customerLiveChatEmailQuestion) {
                                            let email = context.activity.text.match(botConfigValues.emailRegex);
                                            let phone = context.activity.text.match(botConfigValues.phoneRegex);

                                            if (email || phone) {
                                                botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.personalDetail].personalDetail["email"] = email ? email[0] : ""
                                                botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.personalDetail].personalDetail["phone"] = phone ? phone[0] : ""

                                                await sendMessage(conversationReference.conversation.id, botConfigValues.valueFromDatabase.customerPersonalDetailThanks)

                                                await insertChatLog(conversationReference.conversation.id, context.activity.text, conversationReference.conversation.id, userType.bot)

                                                await customerSessionDetail(userType.post, conversationReference.conversation.id, customerUiStates.liveChat, botConfigValues.staticTexts.customerAskPersonalDetailEvent, botConfigValues.valueFromDatabase.customerChatDefaultHeader, userType.customer, context.activity.text, userType.customer)

                                                await insertCustomerDetail(conversationReference.conversation.id, botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.personalDetail].personalDetail["name"], botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.personalDetail].personalDetail["email"], botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.personalDetail].personalDetail["phone"])

                                                await insertChatLog(conversationReference.conversation.id, botConfigValues.valueFromDatabase.customerPersonalDetailThanks, userType.bot, conversationReference.conversation.id)

                                                await customerSessionDetail(userType.post, conversationReference.conversation.id, customerUiStates.liveChat, botConfigValues.staticTexts.customerAskPersonalDetailEvent, botConfigValues.valueFromDatabase.customerChatDefaultHeader, userType.bot, botConfigValues.valueFromDatabase.customerPersonalDetailThanks, userType.customer)

                                                await insertChatLog(conversationReference.conversation.id, botConfigValues.staticTexts.customerFillPersonalDetailEvent, userType.bot, conversationReference.conversation.id)

                                                await addUserInQueue(conversationReference.conversation.id, botConfigValues.conversationReferences[conversationReference.conversation.id][botVariableNames.userDepartment], botConfigValues.staticTexts.findLiveAgentEvent, botConfigValues.valueFromDatabase.findLiveAgentMessage)
                                            } else {
                                                await sendMessage(conversationReference.conversation.id, botConfigValues.valueFromDatabase.customerLiveChatEmailValidationMessage)
                                            }
                                        }
                                    }
                            }
                            break;

                        // process messages if user is unauthorized
                        default:
                            await context.sendActivity(botConfigValues.staticTexts.unAuthorizedUser)
                    }
                }

                await next();
            } catch (error) {
                console.error(errorMessages.onMessageError.name, error);
                appInsightsClient(errorMessages.onMessageError.name, error)
                sendErrorMail(`${errorMessages.onMessageError.desc} ${fileName}`, `${errorMessages.onMessageError.body} ${context.activity.text} <br/><br/> ${error.stack}<br/><br/> sender: ${sender} <br/><br/> senderdetail:${JSON.stringify(botConfigValues.conversationReferences[sender])} <br/><br/> reciever: ${reciever} <br/><br/> recieverdetail:${JSON.stringify(botConfigValues.conversationReferences[reciever])} <br/><br/> message: ${context.activity.text}`)
            }
        })
    }
}


module.exports.RecieveMessages = RecieveMessages;