// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, TurnContext, TeamsInfo, CardFactory, MessageFactory, ActivityTypes } = require('botbuilder');
const cards = require('./cards')
const apis = require('./API');
const { parse } = require('path');
const { off } = require('process');
let userType = {}
let availableAgents = {}
class LiveAgentChatbot extends ActivityHandler {
    constructor(conversationReferences, conversationState) {
        super();

        // Dependency injected dictionary for storing ConversationReference objects used in NotifyController to proactively message users
        this.conversationReferences = conversationReferences;
        this.conversationState = conversationState;
        this.dialogState = this.conversationState.createProperty('DialogState');
        this.userBotConvo = {}
        this.userqueue = {}
        this.message = 'abcd';
        this.agentRequestedByUser = {}
        this.onConversationUpdate(async (context, next) => {
            this.adapter = context.adapter;
            await next();
        });

        this.onEvent(async (context, next) => {
            try {
                let conversationReference = await TurnContext.getConversationReference(context.activity);
                if (context.activity.name === 'webchat/exit' &&
                    (this.userBotConvo[conversationReference.user.id] && this.userBotConvo[conversationReference.user.id].agentConvo)) {
                    for (let i = 0; i < this.message.length; i++) {
                        if (this.message[i].cr386_key === "UserCloseChatWindowMessage") {
                            await this.adapter.continueConversation(this.userBotConvo[conversationReference.user.id].agentConvo, async (sendContext) => {
                                await sendContext.sendActivity(this.message[i].cr386_value)
                            })
                        }
                    }
                    availableAgents[this.userBotConvo[conversationReference.user.id].agentConvo.user.name] = {}
                    this.userBotConvo[this.userBotConvo[conversationReference.user.id].agentConvo.user.name]["userConnected"] = 0
                    this.userBotConvo[conversationReference.user.id]["agentConnected"] = 0
                    this.userBotConvo[conversationReference.user.id]["userQueuePosition"] = 0
                    this.userBotConvo[conversationReference.user.id]["agentConvo"] = this.userBotConvo[conversationReference.user.id].agentConvo
                    delete this.userBotConvo[this.userBotConvo[conversationReference.user.id].agentConvo.user.name].userConvo

                }
                // else if (context.activity.name === 'webchat/typing') {
                //     await context.sendActivity({
                //         type: ActivityTypes.Typing,
                //         text: "Agent is typing..."
                //     })
                // } 
                else if (context.activity.name === 'webchat/AgentInactive') {
                    if (this.userBotConvo[conversationReference.user.name].userConnected > 0) {

                        for (let i = 0; i < this.message.length; i++) {
                            if (this.message[i].cr386_key === "AgentEndConversationMessageToAgent") {
                                await context.sendActivity(this.message[i].cr386_value)
                            } else if (this.message[i].cr386_key === "DisconnectedAgent") {
                                await this.adapter.continueConversation(this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.user.id].convoRef, async (sendContext) => {
                                    await sendContext.sendActivity(this.message[i].cr386_value);
                                    await sendContext.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.feedbackSmileyCard)))
                                })
                            }
                        }
                        this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.user.id]["agentConnected"] = 0
                        this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.user.id]["userQueuePosition"] = 0
                        this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.user.id]["agentConvo"] = conversationReference
                    }
                    delete this.userBotConvo[conversationReference.user.name]
                    delete availableAgents[conversationReference.user.name]
                }
                else if (context.activity.name === 'webchat/AgentActive') {
                    let agentExists = userType[conversationReference.user.name]
                    userType[conversationReference.user.name]["userType"] = "agent"
                    availableAgents[conversationReference.user.name] = {}
                    this.userBotConvo[conversationReference.user.name] === undefined ? this.userBotConvo[conversationReference.user.name] = {} : this.userBotConvo
                    this.userBotConvo[conversationReference.user.name]["convoRef"] = conversationReference;
                    this.userBotConvo[conversationReference.user.name]["userConnected"] = 0
                    this.userBotConvo[conversationReference.user.name]["agentRequestSent"] = 0
                    this.userBotConvo[conversationReference.user.name]["agentRequested"] = 0

                }
            } catch (error) {
                console.error(error);
            }
            await next()
        })

        this.onMembersAdded(async (context, next) => {
            try {
                //////////////////////////////////////////welcome message to new users-----------------------------
                const membersAdded = context.activity.membersAdded;
                for (let cnt = 0; cnt < membersAdded.length; cnt++) {
                    if (membersAdded[cnt].id !== context.activity.recipient.id) {
                        this.message = await apis.getConfigDetails();
                        let conversationReference = await TurnContext.getConversationReference(context.activity);
                        // let agentExists = await apis.getAvailableAgents(conversationReference.user.name);
                        let agentExists;
                        if (!Object.keys(userType).includes(conversationReference.user.name)) {
                            agentExists = await apis.getAvailableAgents(conversationReference.user.name);
                            userType[conversationReference.user.name] = agentExists
                        } else {
                            agentExists = userType[conversationReference.user.name]
                        }
                        ///////////////////////////////////////welcome agent message---------------------------------------------------
                        if (conversationReference.user.name && (agentExists.email.includes(conversationReference.user.name.toLowerCase()))) {
                            availableAgents[conversationReference.user.name] = {}
                            this.userBotConvo[conversationReference.user.name] === undefined ? this.userBotConvo[conversationReference.user.name] = {} : this.userBotConvo
                            this.userBotConvo[conversationReference.user.name]["convoRef"] = conversationReference;
                            this.userBotConvo[conversationReference.user.name]["userConnected"] = 0
                            this.userBotConvo[conversationReference.user.name]["agentRequestSent"] = 0
                            this.userBotConvo[conversationReference.user.name]["agentRequested"] = 0
                            for (let i = 0; i < this.message.length; i++) {
                                if (this.message[i].cr386_key.toLowerCase() === 'agentwelcomemessage') {
                                    await context.sendActivity(this.message[i].cr386_value.replace('Hi.', `Hi ${agentExists.fullname},`))
                                    break;
                                }
                            }
                        }
                        ///////////////////////////////////////welcome user message---------------------------------------------------
                        else {
                            for (let i = 0; i < this.message.length; i++) {
                                if (this.message[i].cr386_key.toLowerCase() === 'userwelcomemessage') {
                                    await context.sendActivity(this.message[i].cr386_value)
                                    await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(await cards.userHelpCard(this.message))))
                                    let offHours = await apis.checkAgentTime(this.message)
                                    if (offHours.message !== "working") {
                                        await context.sendActivity({
                                            type: ActivityTypes.Event,
                                            name: "NoAgent",
                                            text: offHours.message
                                        })
                                    }
                                    break;
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(error);
            }

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        this.onMessage(async (context, next) => {
            // Echo back what the user said
            try {
                let conversationReference = await TurnContext.getConversationReference(context.activity);
                let agentExists = userType[conversationReference.user.name]
                /////////////////////////////agent flow------------------------------------
                if (conversationReference.user.name && (agentExists.email.includes(conversationReference.user.name.toLowerCase())
                    || userType[conversationReference.user.name]["userType"] === "agent")) {
                    userType[conversationReference.user.name]["userType"] = "agent"
                    availableAgents[conversationReference.user.name] = {}
                    this.userBotConvo[conversationReference.user.name] === undefined ? this.userBotConvo[conversationReference.user.name] = {} : this.userBotConvo
                    this.userBotConvo[conversationReference.user.name]["convoRef"] = conversationReference;
                    ///////////////////////////////agent sends bye-----------------------------------
                    if (context.activity.text && context.activity.text.toLowerCase().includes("bye") && this.userBotConvo[conversationReference.user.name].userConnected > 0) {

                        for (let i = 0; i < this.message.length; i++) {
                            if (this.message[i].cr386_key === "AgentEndConversationMessageToAgent") {
                                await context.sendActivity(this.message[i].cr386_value)
                            } else if (this.message[i].cr386_key === "DisconnectedAgent") {
                                await this.adapter.continueConversation(this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.user.id].convoRef, async (sendContext) => {
                                    // await sendContext.sendActivity(this.message[i].cr386_value);
                                    await sendContext.sendActivity({
                                        type: ActivityTypes.Event,
                                        name: "DisconnectedAgent",
                                        text: this.message[i].cr386_value
                                    });
                                    await sendContext.sendActivity(this.message[i].cr386_value)
                                    await sendContext.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.feedbackSmileyCard)))
                                })
                            }
                        }
                        availableAgents[conversationReference.user.name] = {}
                        this.userBotConvo[conversationReference.user.name]["userConnected"] = 0
                        this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.user.id]["agentConnected"] = 0
                        this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.user.id]["userQueuePosition"] = 0
                        this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.user.id]["agentConvo"] = conversationReference
                        delete this.userBotConvo[conversationReference.user.name].userConvo

                    }
                    ///////////////////////////////agent checking user covo history----------------------
                    else if (context.activity.value && context.activity.value.agentResponse.toLowerCase() === "showmore") {
                        await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.convoHistoryCard(this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.user.id]["convoHistory"].slice((context.activity.value.count + 1 * 15)), context.activity.value.userConvo.user.id, context.activity.value.count + 1))))
                    }
                    ///////////////////////////////agent sending message to user--------------------------
                    else if (this.userBotConvo[conversationReference.user.name].userConnected > 0) {
                        await this.adapter.continueConversation(this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.user.id].convoRef, async (sendContext) => {
                            await sendContext.sendActivity(context.activity.text);
                        })
                    }

                    ///////////////////////////////agent accepting request--------------------------
                    else if (context.activity.value && context.activity.value.agentResponse.toLowerCase() === "accept") {
                        this.userBotConvo[conversationReference.user.name]["userConnected"] = 1
                        this.userBotConvo[conversationReference.user.name]["userConvo"] = context.activity.value.userConvo
                        this.userBotConvo[context.activity.value.userConvo.user.id]['requestSentToAgents'] = []
                        delete this.userqueue[context.activity.value.userConvo.user.id]
                        // delete availableAgents[conversationReference.user.name]
                        clearInterval(this.userBotConvo[context.activity.value.userConvo.user.id]['requestTimeObj'])
                        this.userBotConvo[context.activity.value.userConvo.user.id]["agentConnected"] = 1
                        this.userBotConvo[context.activity.value.userConvo.user.id]["agentConvo"] = conversationReference
                        if (this.userBotConvo[context.activity.value.userConvo.user.id]["convoHistory"].length > 0) {
                            await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.convoHistoryCard(this.userBotConvo[context.activity.value.userConvo.user.id]["convoHistory"], context.activity.value.userConvo, 0))))
                        }
                        for (let i = 0; i < this.message.length; i++) {
                            if (this.message[i].cr386_key === "AgentIsConnectedToUserMessage") {
                                await this.adapter.continueConversation(this.userBotConvo[context.activity.value.userConvo.user.id].convoRef, async (sendContext) => {
                                    await sendContext.sendActivity({
                                        type: ActivityTypes.Event,
                                        name: "ConnectedAgent",
                                        text: this.message[i].cr386_value.replace('{0}', userType[conversationReference.user.name].fullname)
                                    });
                                    await sendContext.sendActivity(this.message[i].cr386_value.replace('{0}', userType[conversationReference.user.name].fullname));
                                })
                            }
                        }

                        this.userBotConvo[this.agentRequestedByUser[context.activity.value.userConvo.user.id]]["agentRequested"] = 0
                        delete this.agentRequestedByUser[context.activity.value.userConvo.user.id]

                    }
                    ///////////////////////////////agent rejecting request--------------------------
                    else if (context.activity.value && context.activity.value.agentResponse.toLowerCase() === "reject") {
                        this.userBotConvo[conversationReference.user.name]["convoRef"] = conversationReference
                        this.userBotConvo[this.agentRequestedByUser[context.activity.value.userConvo.user.id]]["agentRequested"] = 0
                        this.userBotConvo[context.activity.value.userConvo.user.id]["requestCount"] = 0
                        delete this.agentRequestedByUser[context.activity.value.userConvo.user.id]

                    }
                    /////////////////////////////normal message from agent to bot-----------------------
                    else {
                        this.userBotConvo[conversationReference.user.name]["userConnected"] = 0
                        this.userBotConvo[conversationReference.user.name]["agentRequestSent"] = 0
                        this.userBotConvo[conversationReference.user.name]["agentRequested"] = 0

                        for (let i = 0; i < this.message.length; i++) {
                            if (this.message[i].cr386_key.toLowerCase() === 'agentwelcomemessage') {

                                await context.sendActivity(this.message[i].cr386_value.replace('Hi.', `Hi ${agentExists.fullname},`))
                                break;
                            }
                        }
                    }
                }
                /////////////////////////////user flow---------------------------------------
                else {
                    userType[conversationReference.user.name]["userType"] = "user"
                    //////////////////////////converting button click to text----------------------------------
                    if (context.activity.value && context.activity.value.userResponse) {
                        context.activity.text = context.activity.value.userResponse
                    }
                    this.userBotConvo[conversationReference.user.id] === undefined ? this.userBotConvo[conversationReference.user.id] = {} : this.userBotConvo
                    this.userBotConvo[conversationReference.user.id]["convoHistory"] === undefined ? this.userBotConvo[conversationReference.user.id]["convoHistory"] = [] : this.userBotConvo
                    /////////////////////////////user message to agent---------------------------------
                    if (this.userBotConvo[conversationReference.user.id] && this.userBotConvo[conversationReference.user.id]["agentConnected"] === 1) {
                        await this.adapter.continueConversation(this.userBotConvo[conversationReference.user.id].agentConvo, async (sendContext) => {
                            await sendContext.sendActivity(context.activity.text);
                        })
                        this.userBotConvo[this.userBotConvo[conversationReference.user.id].agentConvo.user.name].userConvo = conversationReference
                    }
                    //////////////////////////user contact us option--------------------------------------
                    else if (context.activity.text && context.activity.text.toLowerCase().includes("contact us")) {
                        for (let i = 0; i < this.message.length; i++) {
                            if (this.message[i].cr386_key === 'ContactUs') {
                                await context.sendActivity(this.message[i].cr386_value);
                                break;
                            }
                        }
                    }
                    //////////////////////////user trying to connect to agent-------------------------------
                    else if (context.activity.text && context.activity.text.toLowerCase().includes("agent")) {
                        let offHours = await apis.checkAgentTime(this.message)
                        if (offHours.time === "working") {
                            this.userqueue[conversationReference.user.id] = {};
                            this.userBotConvo[conversationReference.user.id]["activityTime"] = new Date();
                            this.userBotConvo[conversationReference.user.id]["convoRef"] = conversationReference;
                            this.userBotConvo[conversationReference.user.id]["requestCount"] = 0;
                            this.userBotConvo[conversationReference.user.id]["agentRequestCount"] = 0
                            this.userBotConvo[conversationReference.user.id]["requestSentToAgents"] === undefined
                                ? this.userBotConvo[conversationReference.user.id]["requestSentToAgents"] = []
                                : this.userBotConvo[conversationReference.user.id]["requestSentToAgents"];
                            this.userBotConvo[conversationReference.user.id]["agentConnected"] = 0
                            this.userActivityTimeCheck(conversationReference.user.id);
                        } else {
                            await context.sendActivity({
                                type: ActivityTypes.Event,
                                text: offHours.message
                            })
                            for (let i = 0; i < this.message.length; i++) {
                                if (this.message[i].cr386_key === 'AgentOffHoursMessage') {
                                    await context.sendActivity(this.message[i].cr386_value);
                                    await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(await cards.userHelpCard(this.message))))
                                    break;
                                }
                            }
                        }

                    }
                    //////////////////////////user message to bot------------------------------------
                    else {
                        //////////////////////////calling QnA maker to get answer---------------------
                        if (context.activity.text.toLowerCase().includes("faq")) {
                            await context.sendActivity("Type your question below")
                        } else if (context.activity.text.includes("smileyFeedback")) {


                            for (let i = 0; i < this.message.length; i++) {
                                if (this.message[i].cr386_key === 'EndConversationMessage') {
                                    await context.sendActivity(this.message[i].cr386_value);
                                    break;
                                }
                            }
                        } else if (context.activity.text.toLowerCase().includes("yes")) {
                            await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.feedbackSmileyCard)))
                        } else if (context.activity.text.toLowerCase().includes("no")) {
                            await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(await cards.userHelpCard(this.message))))
                        } else {
                            let qnaResults = await this.callQnAapi(context.activity.text)
                            this.userBotConvo[conversationReference.user.id]["convoHistory"].push(`**User:** ${context.activity.text}`)
                            if (qnaResults.toLowerCase().includes("greeting")) {
                                await context.sendActivity(qnaResults.slice(9))
                                this.userBotConvo[conversationReference.user.id]["convoHistory"].push(`**Bot:** ${qnaResults.slice(9)}`)
                            } else if (qnaResults !== 'No good match found in KB.') {
                                await context.sendActivity(qnaResults)
                                await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.confimrmationCard)))
                                this.userBotConvo[conversationReference.user.id]["convoHistory"].push(`**Bot:** ${qnaResults}`)
                            } else {

                                for (let i = 0; i < this.message.length; i++) {
                                    if (this.message[i].cr386_key.toLowerCase() === 'noqueryfoundinkb') {
                                        this.userBotConvo[conversationReference.user.id]["convoHistory"].push(`**Bot:** ${this.message[i].cr386_value}`)
                                        await context.sendActivity(this.message[i].cr386_value);
                                        await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(await cards.userHelpCard(this.message))))
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }

            } catch (error) {
                console.error("on message", error)
            }

            await next();
        });
    }

    //////////////////////////////////////queue management logic------------------------------------------------------
    async userActivityTimeCheck(userId) {
        try {
            this.userBotConvo[userId]['requestTimeObj'] = setInterval(async () => {
                let availableAgentstoCheck = Object.keys(availableAgents);
                if (availableAgentstoCheck.length > 0) {
                    let time = new Date() - this.userBotConvo[userId].activityTime
                    let xtime = 0;
                    for (let i = 0; i < this.message.length; i++) {
                        if (this.message[i].cr386_key === "AgentWaitingTimeInMilliseconds") {
                            xtime = parseInt(this.message[i].cr386_value)
                            break;
                        }
                    }
                    if (this.userBotConvo[userId]["requestCount"] === 0) {
                        time = xtime + 10
                    }
                    if (time > xtime) {
                        if (this.userBotConvo[userId]["agentRequestedLast"] !== undefined && this.userBotConvo[userId]["agentRequestedLast"] !== "abc") {
                            await this.adapter.continueConversation(this.userBotConvo[this.userBotConvo[userId]["agentRequestedLast"]].convoRef, async (sendContext) => {
                                await sendContext.sendActivity({
                                    type: ActivityTypes.Event,
                                    name: "RemoveCard"
                                })
                            })
                            this.userBotConvo[userId]["agentRequestedLast"] = "abc"
                        }
                        for (let i = 0; i < availableAgentstoCheck.length; i++) {
                            ////////////////////sending requests to available agents--------------------------------------------
                            if (Object.keys(this.userBotConvo).includes(availableAgentstoCheck[i]) && this.userBotConvo[availableAgentstoCheck[i]].userConnected === 0
                                && this.userBotConvo[availableAgentstoCheck[i]].agentRequested === 0
                                && !this.userBotConvo[userId]["requestSentToAgents"].includes(availableAgentstoCheck[i])) {
                                this.userBotConvo[userId]["agentRequestedLast"] = availableAgentstoCheck[i]
                                this.userBotConvo[this.agentRequestedByUser[userId]] === undefined
                                    ? this.userBotConvo[this.agentRequestedByUser[userId]]
                                    : this.userBotConvo[this.agentRequestedByUser[userId]]["agentRequested"] = 0
                                this.agentRequestedByUser[userId] = availableAgentstoCheck[i]
                                this.userBotConvo[availableAgentstoCheck[i]]["agentRequested"] = 1
                                this.userBotConvo[userId]["requestCount"] += 1
                                this.userBotConvo[userId]["requestSentToAgents"].push(availableAgentstoCheck[i])
                                this.userBotConvo[userId]["activityTime"] = new Date();
                                let key = Object.keys(this.userqueue)
                                if (this.userBotConvo[userId]["agentRequestCount"] === 0) {
                                    this.userBotConvo[userId]["agentRequestCount"] += 1
                                    for (let i = 0; i < this.message.length; i++) {
                                        if (this.message[i].cr386_key === "OnRequestTalkToAgent") {
                                            await this.adapter.continueConversation(this.userBotConvo[userId].convoRef, async (sendContext) => {
                                                // await sendContext.sendActivity({
                                                //     type: ActivityTypes.Event,
                                                //     name: "AgentQueue",
                                                //     text: this.message[i].cr386_value
                                                // });
                                                await sendContext.sendActivity(this.message[i].cr386_value)
                                            })
                                            break;
                                        }
                                    }
                                } else {
                                    this.userBotConvo[userId]["agentRequestCount"] += 1
                                    if ((key.indexOf(userId) + 1) !== this.userBotConvo[userId]["userQueuePosition"]) {
                                        this.userBotConvo[userId]["userQueuePosition"] = key.indexOf(userId) + 1;
                                        for (let i = 0; i < this.message.length; i++) {
                                            if (this.message[i].cr386_key === "InQueuePositionMessage") {
                                                await this.adapter.continueConversation(this.userBotConvo[userId].convoRef, async (sendContext) => {
                                                    await sendContext.sendActivity({
                                                        type: ActivityTypes.Event,
                                                        name: "AgentQueue",
                                                        text: this.message[i].cr386_value.replace('{0}', `${key.indexOf(userId) + 1}`)
                                                    });
                                                    await sendContext.sendActivity(this.message[i].cr386_value.replace('{0}', `${key.indexOf(userId) + 1}`))
                                                })
                                                break;
                                            }
                                        }
                                    }
                                }
                                await this.adapter.continueConversation(this.userBotConvo[availableAgentstoCheck[i]].convoRef, async (sendContext) => {
                                    await sendContext.sendActivity({
                                        type: ActivityTypes.Event,
                                        name: "ConnectionRequest"
                                    })
                                    await sendContext.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.userConnectionRequestCard(this.userBotConvo[userId].convoRef))));
                                })
                                await this.adapter.continueConversation(this.userBotConvo[userId].convoRef, async (sendContext) => {
                                    await sendContext.sendActivity({
                                        type: ActivityTypes.Typing,
                                        text: "Trying to find an Agent..."
                                    })
                                })
                                break;
                            }
                            else if (i === availableAgentstoCheck.length - 1) {
                                this.userBotConvo[this.agentRequestedByUser[userId]] === undefined
                                    ? this.userBotConvo[this.agentRequestedByUser[userId]]
                                    : this.userBotConvo[this.agentRequestedByUser[userId]]["agentRequested"] = 0
                                //////////////////////if agent available but not accepting request---------------------------------------------------
                                if (this.userBotConvo[userId]["requestSentToAgents"].length < availableAgentstoCheck.length) {
                                    this.userBotConvo[userId]["activityTime"] = new Date();
                                    let key = Object.keys(this.userqueue)
                                    if ((key.indexOf(userId) + 1) !== this.userBotConvo[userId]["userQueuePosition"]) {
                                        this.userBotConvo[userId]["userQueuePosition"] = key.indexOf(userId) + 1;
                                        for (let i = 0; i < this.message.length; i++) {
                                            if (this.message[i].cr386_key === "InQueuePositionMessage") {
                                                await this.adapter.continueConversation(this.userBotConvo[userId].convoRef, async (sendContext) => {
                                                    await sendContext.sendActivity({
                                                        type: ActivityTypes.Event,
                                                        name: "AgentQueue",
                                                        text: this.message[i].cr386_value.replace('{0}', `${key.indexOf(userId) + 1}`)
                                                    });
                                                    await sendContext.sendActivity(this.message[i].cr386_value.replace('{0}', `${key.indexOf(userId) + 1}`))
                                                })
                                                break;
                                            }
                                        }
                                    }
                                }
                                /////////////////////////////////agent not available-------------------------------------------------------- 
                                else {
                                    clearInterval(this.userBotConvo[userId]['requestTimeObj'])
                                    this.userBotConvo[this.agentRequestedByUser[userId]] === undefined
                                        ? this.userBotConvo[this.agentRequestedByUser[userId]]
                                        : this.userBotConvo[this.agentRequestedByUser[userId]]["agentRequested"] = 0


                                    for (let i = 0; i < this.message.length; i++) {
                                        if (this.message[i].cr386_key.toLowerCase() === 'agentnotavailablemessage') {
                                            await this.adapter.continueConversation(this.userBotConvo[userId].convoRef, async (sendContext) => {
                                                // await sendContext.sendActivity(this.message[i].cr386_value);
                                                await sendContext.sendActivity({
                                                    type: ActivityTypes.Event,
                                                    name: "NoAgent",
                                                    text: "Agent is not available."
                                                })
                                                await sendContext.sendActivity(this.message[i].cr386_value)
                                                await sendContext.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(await cards.userHelpCard(this.message))))

                                            })
                                            break;
                                        }
                                    }

                                    this.userBotConvo[userId]["requestSentToAgents"] = []
                                    delete this.userqueue[userId]
                                }

                            }
                        }

                    }
                } else {
                    clearInterval(this.userBotConvo[userId]['requestTimeObj'])
                    if (this.userBotConvo[userId]["agentRequestedLast"] !== undefined && this.userBotConvo[userId]["agentRequestedLast"] !== "abc") {
                        await this.adapter.continueConversation(this.userBotConvo[this.userBotConvo[userId]["agentRequestedLast"]].convoRef, async (sendContext) => {
                            await sendContext.sendActivity({
                                type: ActivityTypes.Event,
                                name: "RemoveCard"
                            })
                        })
                        this.userBotConvo[userId]["agentRequestedLast"] = "abc"
                    }
                    for (let i = 0; i < this.message.length; i++) {
                        if (this.message[i].cr386_key.toLowerCase() === 'agentnotavailablemessage') {
                            await this.adapter.continueConversation(this.userBotConvo[userId].convoRef, async (sendContext) => {
                                await sendContext.sendActivity({
                                    type: ActivityTypes.Event,
                                    name: "NoAgent",
                                    text: "Agent is not available."
                                })
                                await sendContext.sendActivity(this.message[i].cr386_value);
                                await sendContext.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(await cards.userHelpCard(this.message))))

                            })
                            break;
                        }
                    }
                }
            }, 1000);
        } catch (error) {
            console.error(error)
        }
    }

    /////////////////////////////////////function to call QnA maker for FAQ----------------------------------------------
    async callQnAapi(text) {
        return new Promise((resolve, reject) => {
            var request = require('request');
            var options = {
                'method': 'POST',
                'url': 'https://cicchatbotqnaapp.azurewebsites.net/qnamaker/knowledgebases/beae0c29-51cb-48ba-b5f4-316dc5cf2413/generateAnswer',
                'headers': {
                    'Authorization': 'EndpointKey 483c8677-3e5c-474b-9cc5-d392fd3a1822',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ "question": `${text}` })

            };
            request(options, function (error, response) {
                if (error) {
                    resolve("No good match found in KB.");
                    throw new Error(error);
                } else {
                    if (JSON.parse(response.body).answers[0].score < 30) {
                        resolve('No good match found in KB.')
                    } else {
                        resolve(JSON.parse(response.body).answers[0].answer)
                    }
                }
            });
        })

    }
}




module.exports.LiveAgentChatbot = LiveAgentChatbot;
