// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, TurnContext, TeamsInfo, CardFactory, MessageFactory, ActivityTypes, ActionTypes } = require('botbuilder');
const cards = require('./cards')
const apis = require('./API');
const dbQuery = require('./dbQuery');
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
        this.userMessageIdleTimeOut();
        this.onConversationUpdate(async (context, next) => {
            this.adapter = context.adapter;
            await next();
        });

        this.onEvent(async (context, next) => {
            try {
                let conversationReference = await TurnContext.getConversationReference(context.activity);
                let dataToInsert = []
                if (context.activity.name === 'webchat/exit' &&
                    (this.userBotConvo[conversationReference.conversation.id])) {
                    dataToInsert.push({
                        "message": `Event: ${context.activity.name}`,
                        "sender": conversationReference.conversation.id,
                        "receiver": "BOT",
                        "convoId": conversationReference.conversation.id
                    })
                    if (this.userBotConvo[conversationReference.conversation.id].agentConvo) {
                        for (let i = 0; i < this.message.length; i++) {
                            if (this.message[i].cr386_key === "UserCloseChatWindowMessage") {
                                await this.adapter.continueConversation(this.userBotConvo[conversationReference.conversation.id].agentConvo, async (sendContext) => {
                                    await sendContext.sendActivity(this.message[i].cr386_value)
                                })
                                dataToInsert.push({
                                    "message": this.message[i].cr386_value,
                                    "sender": "BOT",
                                    "receiver": this.userBotConvo[conversationReference.conversation.id].agentConvo.user.name,
                                    "convoId": this.userBotConvo[conversationReference.conversation.id].agentConvo.conversation.id
                                })
                            }
                        }
                        availableAgents[this.userBotConvo[conversationReference.conversation.id].agentConvo.user.name] = {}
                        this.userBotConvo[this.userBotConvo[conversationReference.conversation.id].agentConvo.user.name]["userConnected"] = 0
                        this.userBotConvo[conversationReference.conversation.id]["agentConnected"] = 0
                        this.userBotConvo[conversationReference.conversation.id]["userQueuePosition"] = 0
                        this.userBotConvo[conversationReference.conversation.id]["agentConvo"] = this.userBotConvo[conversationReference.conversation.id].agentConvo
                        delete this.userBotConvo[this.userBotConvo[conversationReference.conversation.id].agentConvo.user.name].userConvo
                        await dbQuery.agentRequestAnalysis({
                            "requestStatus": "End",
                            "agentEmail": this.userBotConvo[conversationReference.conversation.id].agentConvo.user.name,
                            "userId": conversationReference.conversation.id,
                            "convoId": conversationReference.conversation.id
                        });
                    } else {
                        delete this.userqueue[conversationReference.conversation.id]
                        clearInterval(this.userBotConvo[conversationReference.conversation.id]['requestTimeObj'])
                        await dbQuery.userQueueLog({
                            "userId": conversationReference.conversation.id,
                            "convoId": conversationReference.conversation.id,
                            "queueStatus": "Dequeue"
                        })
                    }

                }

                // else if (context.activity.name === 'webchat/typing') {
                //     await context.sendActivity({
                //         type: ActivityTypes.Typing,
                //         text: "Agent is typing..."
                //     })
                // } 
                else if (context.activity.name === 'webchat/AgentInactive') {
                    dataToInsert.push({
                        "message": `Event: ${context.activity.name}`,
                        "sender": conversationReference.user.name,
                        "receiver": "BOT",
                        "convoId": conversationReference.conversation.id
                    })
                    if (this.userBotConvo[conversationReference.user.name].userConnected > 0) {
                        for (let i = 0; i < this.message.length; i++) {
                            if (this.message[i].cr386_key === "AgentEndConversationMessageToAgent") {
                                await context.sendActivity(this.message[i].cr386_value)
                                dataToInsert.push({
                                    "message": this.message[i].cr386_value,
                                    "sender": "BOT",
                                    "receiver": conversationReference.user.name,
                                    "convoId": conversationReference.conversation.id
                                })
                            } else if (this.message[i].cr386_key === "DisconnectedAgent") {
                                await this.adapter.continueConversation(this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.conversation.id].convoRef, async (sendContext) => {
                                    await sendContext.sendActivity(this.message[i].cr386_value);
                                    await sendContext.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.feedbackSmileyCard("Agent"))))
                                })
                                dataToInsert.push({
                                    "message": this.message[i].cr386_value,
                                    "sender": "BOT",
                                    "receiver": this.userBotConvo[conversationReference.user.name].userConvo.conversation.id,
                                    "convoId": this.userBotConvo[conversationReference.user.name].userConvo.conversation.id
                                }, {
                                    "message": "Feedback Card",
                                    "sender": "BOT",
                                    "receiver": this.userBotConvo[conversationReference.user.name].userConvo.conversation.id,
                                    "convoId": this.userBotConvo[conversationReference.user.name].userConvo.conversation.id
                                })
                            }
                        }
                        this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.conversation.id]["agentConnected"] = 0
                        this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.conversation.id]["userQueuePosition"] = 0
                        delete this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.conversation.id]["agentConvo"]
                        await dbQuery.agentRequestAnalysis({
                            "requestStatus": "End",
                            "agentEmail": conversationReference.user.name,
                            "userId": this.userBotConvo[conversationReference.user.name].userConvo.conversation.id,
                            "convoId": this.userBotConvo[conversationReference.user.name].userConvo.conversation.id
                        })
                    }
                    delete this.userBotConvo[conversationReference.user.name]
                    delete availableAgents[conversationReference.user.name]
                }
                else if (context.activity.name === 'webchat/AgentActive') {
                    dataToInsert.push({
                        "message": `Event: ${context.activity.name}`,
                        "sender": conversationReference.user.name,
                        "receiver": "BOT",
                        "convoId": conversationReference.conversation.id
                    })
                    let agentExists = userType[conversationReference.user.name]
                    userType[conversationReference.user.name]["userType"] = "agent"
                    availableAgents[conversationReference.user.name] = {}
                    this.userBotConvo[conversationReference.user.name] === undefined ? this.userBotConvo[conversationReference.user.name] = {} : this.userBotConvo
                    this.userBotConvo[conversationReference.user.name]["convoRef"] = conversationReference;
                    this.userBotConvo[conversationReference.user.name]["userConnected"] = 0
                    this.userBotConvo[conversationReference.user.name]["agentRequestSent"] = 0
                    this.userBotConvo[conversationReference.user.name]["agentRequested"] = 0

                }

                if (dataToInsert.length > 0) {
                    await dbQuery.insertChatLogs(dataToInsert)
                };
            } catch (error) {
                console.error(error);
            }
            await next()
        })

        this.onMembersAdded(async (context, next) => {
            try {
                //////////////////////////////////////////welcome message to new users-----------------------------
                let dataToInsert = [];
                const membersAdded = context.activity.membersAdded;
                for (let cnt = 0; cnt < membersAdded.length; cnt++) {
                    if (membersAdded[cnt].id !== context.activity.recipient.id) {
                        this.message = await apis.getConfigDetails();
                        let conversationReference = await TurnContext.getConversationReference(context.activity);
                        // let agentExists = await apis.getAvailableAgents(conversationReference.user.name);
                        let agentExists;

                        if ((!Object.keys(userType).includes(conversationReference.user.name))) {
                            agentExists = await apis.getAvailableAgents(conversationReference.user.name);
                            userType[conversationReference.user.name] = agentExists
                        } else {
                            agentExists = userType[conversationReference.user.name]
                        }

                        ///////////////////////////////////////welcome agent message---------------------------------------------------
                        if (conversationReference.user.name 
                            && (agentExists.email.includes(conversationReference.user.name.toLowerCase()))) {
                            dataToInsert.push({
                                "message": "Event: webchat/join",
                                "sender": conversationReference.user.name,
                                "receiver": "BOT",
                                "convoId": conversationReference.conversation.id
                            })
                            availableAgents[conversationReference.user.name] = {}
                            this.userBotConvo[conversationReference.user.name] === undefined ? this.userBotConvo[conversationReference.user.name] = {} : this.userBotConvo
                            this.userBotConvo[conversationReference.user.name]["convoRef"] = conversationReference;
                            this.userBotConvo[conversationReference.user.name]["userConnected"] = 0
                            this.userBotConvo[conversationReference.user.name]["agentRequestSent"] = 0
                            this.userBotConvo[conversationReference.user.name]["agentRequested"] = 0
                            userType[conversationReference.user.name]["userType"] = "agent"
                            for (let i = 0; i < this.message.length; i++) {
                                if (this.message[i].cr386_key.toLowerCase() === 'agentwelcomemessage') {
                                    dataToInsert.push({
                                        "message": this.message[i].cr386_value.replace('Hi.', `Hi ${agentExists.fullname},`),
                                        "sender": "BOT",
                                        "receiver": conversationReference.user.name,
                                        "convoId": conversationReference.conversation.id
                                    })
                                    await context.sendActivity(this.message[i].cr386_value.replace('Hi.', `Hi ${agentExists.fullname},`))
                                    break;
                                }
                            }
                        }
                        ///////////////////////////////////////welcome user message---------------------------------------------------
                        else {
                            let name = conversationReference.user.name.split(',');
                            if (name[1] !== "null") {
                                let userProfile = await apis.getUserDetails(name[1]);
                                dataToInsert.push({
                                    "message": "Event: webchat/join",
                                    "sender": conversationReference.conversation.id,
                                    "receiver": "BOT",
                                    "convoId": conversationReference.conversation.id
                                })
                                userType[conversationReference.conversation.id] === undefined ? userType[conversationReference.conversation.id] = {} : userType[conversationReference.conversation.id]
                                userType[conversationReference.conversation.id]["userType"] = "user"
                                for (let i = 0; i < this.message.length; i++) {
                                    if (this.message[i].cr386_key.toLowerCase() === 'userwelcomemessage') {

                                        await context.sendActivity(this.message[i].cr386_value)
                                        await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(await cards.userHelpCard(this.message))))
                                        let offHours = await apis.checkAgentTime(this.message)
                                        dataToInsert.push({
                                            "message": this.message[i].cr386_value,
                                            "sender": "BOT",
                                            "receiver": conversationReference.conversation.id,
                                            "convoId": conversationReference.conversation.id
                                        }, {
                                            "message": "Help Card",
                                            "sender": "BOT",
                                            "receiver": conversationReference.conversation.id,
                                            "convoId": conversationReference.conversation.id
                                        })
                                        if (offHours.message !== "working") {
                                            await context.sendActivity({
                                                type: ActivityTypes.Event,
                                                name: "NoAgent",
                                                text: offHours.message
                                            })

                                            dataToInsert.push({
                                                "message": `Event: NoAgent`,
                                                "sender": "BOT",
                                                "receiver": conversationReference.user.name,
                                                "convoId": conversationReference.conversation.id
                                            })
                                        }
                                        break;
                                    }
                                }
                            } else {
                                await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.userProfileDetailCard)))
                            }
                        }
                    }
                }
                if (dataToInsert.length > 0) {
                    await dbQuery.insertChatLogs(dataToInsert)
                }
            } catch (error) {
                console.error(error);
            }

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        this.onMessage(async (context, next) => {
            try {
                let conversationReference = await TurnContext.getConversationReference(context.activity);
                let agentExists = userType[conversationReference.user.name]
                let dataToInsert = [];
                /////////////////////////////agent flow------------------------------------
                if (conversationReference.user.name && (agentExists.email.includes(conversationReference.user.name.toLowerCase())
                        || userType[conversationReference.user.name]["userType"] === "agent")) {
                    userType[conversationReference.user.name]["userType"] = "agent"
                    availableAgents[conversationReference.user.name] = {}
                    this.userBotConvo[conversationReference.user.name] === undefined ? this.userBotConvo[conversationReference.user.name] = {} : this.userBotConvo
                    this.userBotConvo[conversationReference.user.name]["convoRef"] = conversationReference;
                    ///////////////////////////////agent sends bye-----------------------------------
                    if (context.activity.text && context.activity.text.toLowerCase().includes("bye") && this.userBotConvo[conversationReference.user.name].userConnected > 0) {
                        dataToInsert.push({
                            "message": context.activity.text,
                            "sender": conversationReference.user.name,
                            "receiver": "BOT",
                            "convoId": conversationReference.conversation.id
                        })
                        for (let i = 0; i < this.message.length; i++) {
                            if (this.message[i].cr386_key === "AgentEndConversationMessageToAgent") {
                                await context.sendActivity(this.message[i].cr386_value)
                                dataToInsert.push({
                                    "message": this.message[i].cr386_value,
                                    "sender": "BOT",
                                    "receiver": conversationReference.user.name,
                                    "convoId": conversationReference.conversation.id
                                })
                            } else if (this.message[i].cr386_key === "DisconnectedAgent") {
                                await this.adapter.continueConversation(this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.conversation.id].convoRef, async (sendContext) => {
                                    // await sendContext.sendActivity(this.message[i].cr386_value);
                                    await sendContext.sendActivity({
                                        type: ActivityTypes.Event,
                                        name: "DisconnectedAgent",
                                        text: this.message[i].cr386_value
                                    });
                                    await sendContext.sendActivity(this.message[i].cr386_value)
                                    await sendContext.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.feedbackSmileyCard("Agent"))))
                                })
                                dataToInsert.push({
                                    "message": this.message[i].cr386_value,
                                    "sender": "BOT",
                                    "receiver": this.userBotConvo[conversationReference.user.name].userConvo.conversation.id,
                                    "convoId": this.userBotConvo[conversationReference.user.name].userConvo.conversation.id
                                }, {
                                    "message": "Feedback Card",
                                    "sender": "BOT",
                                    "receiver": this.userBotConvo[conversationReference.user.name].userConvo.conversation.id,
                                    "convoId": this.userBotConvo[conversationReference.user.name].userConvo.conversation.id
                                }, {
                                    "message": "Event: DisconnectedAgent",
                                    "sender": "BOT",
                                    "receiver": this.userBotConvo[conversationReference.user.name].userConvo.conversation.id,
                                    "convoId": this.userBotConvo[conversationReference.user.name].userConvo.conversation.id
                                })

                            }
                        }
                        availableAgents[conversationReference.user.name] = {}
                        this.userBotConvo[conversationReference.user.name]["userConnected"] = 0
                        this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.conversation.id]["agentConnected"] = 0
                        this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.conversation.id]["userQueuePosition"] = 0

                        await dbQuery.agentRequestAnalysis({
                            "requestStatus": "End",
                            "agentEmail": conversationReference.user.name,
                            "userId": this.userBotConvo[conversationReference.user.name].userConvo.conversation.id,
                            "convoId": this.userBotConvo[conversationReference.user.name].userConvo.conversation.id
                        });
                        delete this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.conversation.id]["agentConvo"]
                        delete this.userBotConvo[conversationReference.user.name].userConvo
                    }
                    ///////////////////////////////agent checking user covo history----------------------
                    else if (context.activity.value && context.activity.value.agentResponse.toLowerCase() === "showmore") {
                        await context.sendActivity(MessageFactory.attachment(
                            CardFactory.adaptiveCard(
                                cards.convoHistoryCard(this.userBotConvo[context.activity.value.userConvo.conversation.id]["convoHistory"].slice(((context.activity.value.count + 1) * 15)),
                                    context.activity.value.userConvo, context.activity.value.count + 1))))
                        dataToInsert.push({
                            "message": context.activity.value.agentResponse,
                            "sender": conversationReference.user.name,
                            "receiver": "BOT",
                            "convoId": conversationReference.conversation.id
                        }, {
                            "message": "User And Bot Conversation Card",
                            "sender": "BOT",
                            "receiver": conversationReference.user.name,
                            "convoId": conversationReference.conversation.id
                        })
                    }
                    ///////////////////////////////agent sending message to user--------------------------
                    else if (this.userBotConvo[conversationReference.user.name].userConnected > 0) {
                        this.userBotConvo[conversationReference.user.name]["activityTime"] = new Date()
                        await this.adapter.continueConversation(this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.conversation.id].convoRef, async (sendContext) => {
                            await sendContext.sendActivity(context.activity.text);
                        })
                        dataToInsert.push({
                            "message": context.activity.text,
                            "sender": conversationReference.user.name,
                            "receiver": this.userBotConvo[conversationReference.user.name].userConvo.conversation.id,
                            "convoId": this.userBotConvo[conversationReference.user.name].userConvo.conversation.id
                        })
                    }

                    ///////////////////////////////agent accepting request--------------------------
                    else if (context.activity.value && context.activity.value.agentResponse.toLowerCase() === "accept") {
                        dataToInsert.push({
                            "message": "Accepted",
                            "sender": conversationReference.user.name,
                            "receiver": this.userBotConvo[context.activity.value.userConvo.conversation.id].convoRef.conversation.id,
                            "convoId": this.userBotConvo[context.activity.value.userConvo.conversation.id].convoRef.conversation.id
                        })
                        this.userBotConvo[conversationReference.user.name]["userConnected"] = 1
                        this.userBotConvo[conversationReference.user.name]["activityTime"] = new Date();
                        this.userBotConvo[conversationReference.user.name]["userConvo"] = context.activity.value.userConvo
                        this.userBotConvo[context.activity.value.userConvo.conversation.id]['requestSentToAgents'] = []
                        delete this.userqueue[context.activity.value.userConvo.conversation.id]
                        // delete availableAgents[conversationReference.user.name]
                        clearInterval(this.userBotConvo[context.activity.value.userConvo.conversation.id]['requestTimeObj'])
                        this.userBotConvo[context.activity.value.userConvo.conversation.id]["agentConnected"] = 1
                        this.userBotConvo[context.activity.value.userConvo.conversation.id]["agentConvo"] = conversationReference
                        if (this.userBotConvo[context.activity.value.userConvo.conversation.id]["convoHistory"].length > 0) {
                            await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.convoHistoryCard(this.userBotConvo[context.activity.value.userConvo.conversation.id]["convoHistory"], context.activity.value.userConvo, 0))))
                            dataToInsert.push({
                                "message": "User And Bot Conversation Card",
                                "sender": "BOT",
                                "receiver": conversationReference.user.name,
                                "convoId": conversationReference.conversation.id
                            })
                        }
                        for (let i = 0; i < this.message.length; i++) {
                            if (this.message[i].cr386_key === "AgentIsConnectedToUserMessage") {
                                await this.adapter.continueConversation(this.userBotConvo[context.activity.value.userConvo.conversation.id].convoRef, async (sendContext) => {
                                    await sendContext.sendActivity({
                                        type: ActivityTypes.Event,
                                        name: "ConnectedAgent",
                                        text: this.message[i].cr386_value.replace('{0}', userType[conversationReference.user.name].fullname)
                                    });
                                    await sendContext.sendActivity(this.message[i].cr386_value.replace('{0}', userType[conversationReference.user.name].fullname));
                                })
                                dataToInsert.push({
                                    "message": this.message[i].cr386_value.replace('{0}', userType[conversationReference.user.name].fullname),
                                    "sender": "BOT",
                                    "receiver": this.userBotConvo[context.activity.value.userConvo.conversation.id].convoRef.conversation.id,
                                    "convoId": this.userBotConvo[context.activity.value.userConvo.conversation.id].convoRef.conversation.id
                                }, {
                                    "message": "Event: ConnectedAgent",
                                    "sender": "BOT",
                                    "receiver": this.userBotConvo[context.activity.value.userConvo.conversation.id].convoRef.conversation.id,
                                    "convoId": this.userBotConvo[context.activity.value.userConvo.conversation.id].convoRef.conversation.id
                                })
                            }
                        }

                        this.userBotConvo[this.agentRequestedByUser[context.activity.value.userConvo.conversation.id]]["agentRequested"] = 0
                        this.userBotConvo[context.activity.value.userConvo.conversation.id]["agentRequestedLast"] = "abc"
                        delete this.agentRequestedByUser[context.activity.value.userConvo.conversation.id]
                        await dbQuery.agentRequestAnalysis({
                            "requestStatus": "Accepted",
                            "agentEmail": conversationReference.user.name,
                            "userId": this.userBotConvo[context.activity.value.userConvo.conversation.id].convoRef.conversation.id,
                            "convoId": this.userBotConvo[context.activity.value.userConvo.conversation.id].convoRef.conversation.id
                        });
                        await dbQuery.userQueueLog({
                            "userId": context.activity.value.userConvo.conversation.id,
                            "convoId": context.activity.value.userConvo.conversation.id,
                            "queueStatus": "Dequeue"
                        })
                    }
                    ///////////////////////////////agent rejecting request--------------------------
                    else if (context.activity.value && context.activity.value.agentResponse.toLowerCase() === "reject") {
                        dataToInsert.push({
                            "message": "ManualRejected",
                            "sender": conversationReference.user.name,
                            "receiver": this.userBotConvo[context.activity.value.userConvo.conversation.id].convoRef.conversation.id,
                            "convoId": this.userBotConvo[context.activity.value.userConvo.conversation.id].convoRef.conversation.id
                        })
                        this.userBotConvo[conversationReference.user.name]["convoRef"] = conversationReference
                        this.userBotConvo[this.agentRequestedByUser[context.activity.value.userConvo.conversation.id]]["agentRequested"] = 0
                        this.userBotConvo[context.activity.value.userConvo.conversation.id]["requestCount"] = 0
                        this.userBotConvo[context.activity.value.userConvo.conversation.id]["agentRequestedLast"] = "abc"
                        delete this.agentRequestedByUser[context.activity.value.userConvo.conversation.id]
                        await dbQuery.agentRequestAnalysis({
                            "requestStatus": "ManualRejected",
                            "agentEmail": conversationReference.user.name,
                            "userId": this.userBotConvo[context.activity.value.userConvo.conversation.id].convoRef.conversation.id,
                            "convoId": this.userBotConvo[context.activity.value.userConvo.conversation.id].convoRef.conversation.id
                        });
                    }
                    /////////////////////////////normal message from agent to bot-----------------------
                    else {
                        dataToInsert.push({
                            "message": context.activity.text,
                            "sender": conversationReference.user.name,
                            "receiver": "BOT",
                            "convoId": conversationReference.conversation.id
                        })
                        this.userBotConvo[conversationReference.user.name]["userConnected"] = 0
                        this.userBotConvo[conversationReference.user.name]["agentRequestSent"] = 0
                        this.userBotConvo[conversationReference.user.name]["agentRequested"] = 0

                        for (let i = 0; i < this.message.length; i++) {
                            if (this.message[i].cr386_key.toLowerCase() === 'agentwelcomemessage') {

                                await context.sendActivity(this.message[i].cr386_value.replace('Hi.', `Hi ${agentExists.fullname},`))
                                dataToInsert.push({
                                    "message": this.message[i].cr386_value.replace('Hi.', `Hi ${agentExists.fullname},`),
                                    "sender": "BOT",
                                    "receiver": conversationReference.user.name,
                                    "convoId": conversationReference.conversation.id
                                })
                                break;
                            }
                        }
                    }
                }
                /////////////////////////////user flow---------------------------------------
                else {
                    userType[conversationReference.conversation.id] === undefined ? userType[conversationReference.conversation.id] = {} : userType[conversationReference.conversation.id]
                    userType[conversationReference.conversation.id]["userType"] = "user"
                    //////////////////////////converting button click to text----------------------------------
                    if (context.activity.value && context.activity.value.userResponse) {
                        context.activity.text = context.activity.value.userResponse
                    }
                    this.userBotConvo[conversationReference.conversation.id] === undefined ? this.userBotConvo[conversationReference.conversation.id] = {} : this.userBotConvo
                    this.userBotConvo[conversationReference.conversation.id]["convoHistory"] === undefined ? this.userBotConvo[conversationReference.conversation.id]["convoHistory"] = [] : this.userBotConvo
                    /////////////////////////////user message to agent---------------------------------
                    if (this.userBotConvo[conversationReference.conversation.id] && this.userBotConvo[conversationReference.conversation.id]["agentConnected"] === 1) {
                        this.userBotConvo[conversationReference.conversation.id]["activityTime"] = new Date();
                        await this.adapter.continueConversation(this.userBotConvo[conversationReference.conversation.id].agentConvo, async (sendContext) => {
                            await sendContext.sendActivity(context.activity.text);
                        })
                        dataToInsert.push({
                            "message": context.activity.text,
                            "sender": conversationReference.conversation.id,
                            "receiver": this.userBotConvo[conversationReference.conversation.id].agentConvo.user.name,
                            "convoId": this.userBotConvo[conversationReference.conversation.id].agentConvo.conversation.id
                        })
                        this.userBotConvo[this.userBotConvo[conversationReference.conversation.id].agentConvo.user.name].userConvo = conversationReference

                    }
                    //////////////////////////user contact us option--------------------------------------
                    else if (context.activity.text && context.activity.text.toLowerCase().includes("contact us")) {
                        for (let i = 0; i < this.message.length; i++) {
                            if (this.message[i].cr386_key === 'ContactUs') {
                                await context.sendActivity(this.message[i].cr386_value);
                                dataToInsert.push({
                                    "message": context.activity.text,
                                    "sender": conversationReference.conversation.id,
                                    "receiver": "BOT",
                                    "convoId": conversationReference.conversation.id
                                }, {
                                    "message": this.message[i].cr386_value,
                                    "sender": "BOT",
                                    "receiver": conversationReference.conversation.id,
                                    "convoId": conversationReference.conversation.id
                                })
                                break;
                            }
                        }
                    }
                    //////////////////////////user trying to connect to agent-------------------------------
                    else if (context.activity.text && context.activity.text.toLowerCase().includes("agent")) {
                        dataToInsert.push({
                            "message": context.activity.text,
                            "sender": conversationReference.conversation.id,
                            "receiver": "BOT",
                            "convoId": conversationReference.conversation.id
                        })
                        if (this.userqueue[conversationReference.conversation.id] === undefined) {
                            let offHours = await apis.checkAgentTime(this.message)
                            if (offHours.time === "working") {
                                this.userqueue[conversationReference.conversation.id] = {};
                                this.userBotConvo[conversationReference.conversation.id]["activityTime"] = new Date();
                                this.userBotConvo[conversationReference.conversation.id]["convoRef"] = conversationReference;
                                this.userBotConvo[conversationReference.conversation.id]["requestCount"] = 0;
                                this.userBotConvo[conversationReference.conversation.id]["agentRequestCount"] = 0
                                this.userBotConvo[conversationReference.conversation.id]["requestSentToAgents"] === undefined
                                    ? this.userBotConvo[conversationReference.conversation.id]["requestSentToAgents"] = []
                                    : this.userBotConvo[conversationReference.conversation.id]["requestSentToAgents"];
                                this.userBotConvo[conversationReference.conversation.id]["agentConnected"] = 0
                                this.userBotConvo[conversationReference.conversation.id]["userRequestAgentTime"] = new Date()
                                this.queueManagementLogic(conversationReference.conversation.id, Object.keys(this.userqueue));
                                await dbQuery.userQueueLog({
                                    "userId": conversationReference.conversation.id,
                                    "convoId": conversationReference.conversation.id,
                                    "queueStatus": "Enqueue"
                                })
                            } else {
                                await context.sendActivity({
                                    type: ActivityTypes.Event,
                                    text: offHours.message
                                })
                                for (let i = 0; i < this.message.length; i++) {
                                    if (this.message[i].cr386_key === 'AgentOffHoursMessage') {
                                        await context.sendActivity(this.message[i].cr386_value);
                                        await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(await cards.userHelpCard(this.message))))
                                        dataToInsert.push({
                                            "message": this.message[i].cr386_value,
                                            "sender": "BOT",
                                            "receiver": conversationReference.conversation.id,
                                            "convoId": conversationReference.conversation.id
                                        }, {
                                            "message": "Help Card",
                                            "sender": "BOT",
                                            "receiver": conversationReference.conversation.id,
                                            "convoId": conversationReference.conversation.id
                                        }, {
                                            "message": "Event: OffHours",
                                            "sender": "BOT",
                                            "receiver": conversationReference.conversation.id,
                                            "convoId": conversationReference.conversation.id
                                        })
                                        break;
                                    }
                                }
                            }
                        } else {
                            let key = Object.keys(this.userqueue)
                            this.userBotConvo[conversationReference.conversation.id]["userQueuePosition"] = key.indexOf(conversationReference.conversation.id) + 1;
                            for (let i = 0; i < this.message.length; i++) {
                                if (this.message[i].cr386_key === "InQueuePositionMessage") {
                                    await context.sendActivity({
                                        type: ActivityTypes.Event,
                                        name: "AgentQueue",
                                        text: this.message[i].cr386_value.replace('{0}', `${key.indexOf(conversationReference.conversation.id) + 1}`)
                                    });
                                    await context.sendActivity(this.message[i].cr386_value.replace('{0}', `${key.indexOf(conversationReference.conversation.id) + 1}`))

                                    dataToInsert.push({
                                        "message": this.message[i].cr386_value.replace('{0}', `${key.indexOf(conversationReference.conversation.id) + 1}`),
                                        "sender": "BOT",
                                        "receiver": conversationReference.conversation.id,
                                        "convoId": conversationReference.conversation.id
                                    }, {
                                        "message": "Event: AgentQueue",
                                        "sender": "BOT",
                                        "receiver": conversationReference.conversation.id,
                                        "convoId": conversationReference.conversation.id
                                    })
                                    break;
                                }
                            }

                        }

                    }
                    //////////////////////////user submitting profile detail
                    else if (context.activity.text && context.activity.text.toLowerCase().includes("profiledetail")) {
                        for (let i = 0; i < this.message.length; i++) {
                            if (this.message[i].cr386_key.toLowerCase() === 'userwelcomemessage') {

                                await context.sendActivity(this.message[i].cr386_value)
                                await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(await cards.userHelpCard(this.message))))
                                let offHours = await apis.checkAgentTime(this.message)
                                dataToInsert.push({
                                    "message": this.message[i].cr386_value,
                                    "sender": "BOT",
                                    "receiver": conversationReference.conversation.id,
                                    "convoId": conversationReference.conversation.id
                                }, {
                                    "message": "Help Card",
                                    "sender": "BOT",
                                    "receiver": conversationReference.conversation.id,
                                    "convoId": conversationReference.conversation.id
                                })
                                if (offHours.message !== "working") {
                                    await context.sendActivity({
                                        type: ActivityTypes.Event,
                                        name: "NoAgent",
                                        text: offHours.message
                                    })

                                    dataToInsert.push({
                                        "message": `Event: NoAgent`,
                                        "sender": "BOT",
                                        "receiver": conversationReference.user.name,
                                        "convoId": conversationReference.conversation.id
                                    })
                                }
                                break;
                            }
                        }
                        await dbQuery.userProfileDetail({
                            "ProfileSource": "DetailCard",
                            "Email": context.activity.value.email,
                            "FirstName": context.activity.value.firstName,
                            "LastName": context.activity.value.lastName,
                            "phone": context.activity.value.phone,
                        })
                    }
                    //////////////////////////user message to bot------------------------------------
                    else {
                        //////////////////////////calling QnA maker to get answer---------------------
                        if (context.activity.text.toLowerCase().includes("faq")) {
                            dataToInsert.push({
                                "message": context.activity.text,
                                "sender": conversationReference.conversation.id,
                                "receiver": "BOT",
                                "convoId": conversationReference.conversation.id
                            })
                            await context.sendActivity("Type your question below")
                            dataToInsert.push({
                                "message": "Type your question below",
                                "sender": "BOT",
                                "receiver": conversationReference.conversation.id,
                                "convoId": conversationReference.conversation.id
                            })
                        } else if (context.activity.text.includes("smileyFeedback")) {
                            dataToInsert.push({
                                "message": `Feedback(${context.activity.value.feedbackType})-${context.activity.value.feedbackValue}`,
                                "sender": conversationReference.conversation.id,
                                "receiver": "BOT",
                                "convoId": conversationReference.conversation.id
                            })
                            for (let i = 0; i < this.message.length; i++) {
                                if (this.message[i].cr386_key === 'EndConversationMessage') {
                                    await context.sendActivity(this.message[i].cr386_value);
                                    dataToInsert.push({
                                        "message": this.message[i].cr386_value,
                                        "sender": "BOT",
                                        "receiver": conversationReference.conversation.id,
                                        "convoId": conversationReference.conversation.id
                                    })
                                    break;
                                }
                            }
                        } else if (context.activity.text.toLowerCase().includes("yes")) {
                            dataToInsert.push({
                                "message": context.activity.text,
                                "sender": conversationReference.conversation.id,
                                "receiver": "BOT",
                                "convoId": conversationReference.conversation.id
                            }, {
                                "message": "Feedback Card",
                                "sender": "BOT",
                                "receiver": conversationReference.conversation.id,
                                "convoId": conversationReference.conversation.id
                            })
                            await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.feedbackSmileyCard("FAQ"))))
                        } else if (context.activity.text.toLowerCase().includes("no")) {
                            dataToInsert.push({
                                "message": context.activity.text,
                                "sender": conversationReference.conversation.id,
                                "receiver": "BOT",
                                "convoId": conversationReference.conversation.id
                            }, {
                                "message": "Help Card",
                                "sender": "BOT",
                                "receiver": conversationReference.conversation.id,
                                "convoId": conversationReference.conversation.id
                            })
                            await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(await cards.userHelpCard(this.message))))
                        } else {
                            dataToInsert.push({
                                "message": context.activity.text,
                                "sender": conversationReference.conversation.id,
                                "receiver": "BOT",
                                "convoId": conversationReference.conversation.id
                            })
                            let qnaResults = await this.callQnAapi(context.activity.text, conversationReference)
                            this.userBotConvo[conversationReference.conversation.id]["convoHistory"].push(`**User:** ${context.activity.text}`)
                            if (qnaResults.toLowerCase().includes("greeting")) {
                                await context.sendActivity(qnaResults.slice(9))
                                this.userBotConvo[conversationReference.conversation.id]["convoHistory"].push(`**Bot:** ${qnaResults.slice(9)}`)
                                dataToInsert.push({
                                    "message": qnaResults.slice(9),
                                    "sender": "BOT",
                                    "receiver": conversationReference.conversation.id,
                                    "convoId": conversationReference.conversation.id
                                })
                            } else if (qnaResults !== 'No good match found in KB.') {
                                dataToInsert.push({
                                    "message": qnaResults,
                                    "sender": "BOT",
                                    "receiver": conversationReference.conversation.id,
                                    "convoId": conversationReference.conversation.id
                                })
                                let urls = qnaResults.split('|');
                                if (qnaResults.toLowerCase().includes("video") && urls.length === 3) {
                                    await context.sendActivity(MessageFactory.attachment(CardFactory.videoCard(
                                        '',
                                        [{
                                            url: `${urls[1]}`
                                        }],
                                        [{
                                            title: 'Lean More',
                                            type: 'openUrl',
                                            value: urls[2]
                                        }]
                                    )));
                                } else if (qnaResults.toLowerCase().includes("video") && urls.length === 2) {
                                    await context.sendActivity(urls[1])
                                }
                                else {
                                    await context.sendActivity(qnaResults)
                                }
                                await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.confimrmationCard)))
                                dataToInsert.push({
                                    "message": "Confirmation Card",
                                    "sender": "BOT",
                                    "receiver": conversationReference.conversation.id,
                                    "convoId": conversationReference.conversation.id
                                })
                                this.userBotConvo[conversationReference.conversation.id]["convoHistory"].push(`**Bot:** ${qnaResults}`)
                            } else {

                                for (let i = 0; i < this.message.length; i++) {
                                    if (this.message[i].cr386_key.toLowerCase() === 'noqueryfoundinkb') {
                                        this.userBotConvo[conversationReference.conversation.id]["convoHistory"].push(`**Bot:** ${this.message[i].cr386_value}`)
                                        await context.sendActivity(this.message[i].cr386_value);
                                        await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(await cards.userHelpCard(this.message))))
                                        dataToInsert.push({
                                            "message": this.message[i].cr386_value,
                                            "sender": "BOT",
                                            "receiver": conversationReference.conversation.id,
                                            "convoId": conversationReference.conversation.id
                                        }, {
                                            "message": "Help Card",
                                            "sender": "BOT",
                                            "receiver": conversationReference.conversation.id,
                                            "convoId": conversationReference.conversation.id
                                        })
                                        await dbQuery.faqUnansweredQueries({
                                            "query": context.activity.text,
                                            "userId": conversationReference.conversation.id,
                                            "convoId": conversationReference.conversation.id
                                        })
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
                if (dataToInsert.length > 0) {
                    await dbQuery.insertChatLogs(dataToInsert)
                }
            } catch (error) {
                console.error("on message", error)
            }

            await next();
        });
    }

    //////////////////////////////////////queue management logic------------------------------------------------------
    async queueManagementLogic(userId, userque) {
        try {

            this.userBotConvo[userId]['requestTimeObj'] = setInterval(async () => {
                let queueSize, usermaxtime;
                for (let i = 0; i < this.message.length; i++) {
                    if (this.message[i].cr386_key === "MaximumUsersPerAgentInQueue") {
                        queueSize = parseInt(this.message[i].cr386_value)
                    }
                    else if (this.message[i].cr386_key === "TotalWaitingTimeInMilliseconds") {
                        usermaxtime = parseInt(this.message[i].cr386_value)
                    }
                }

                let dataToInsert = [];
                let availableAgentstoCheck = Object.keys(availableAgents);
                let userqueu = userque
                if ((availableAgentstoCheck.length > 0) && (userqueu.length <= (availableAgentstoCheck.length * queueSize))) {
                    let time = new Date() - this.userBotConvo[userId]["activityTime"]
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

                    if ((time > xtime) && ((new Date() - this.userBotConvo[userId].userRequestAgentTime) <= usermaxtime)) {
                        this.userBotConvo[userId]["activityTime"] = new Date();
                        if (this.userBotConvo[userId]["agentRequestedLast"] !== undefined && this.userBotConvo[userId]["agentRequestedLast"] !== "abc") {
                            await this.adapter.continueConversation(this.userBotConvo[this.userBotConvo[userId]["agentRequestedLast"]].convoRef, async (sendContext) => {
                                await sendContext.sendActivity({
                                    type: ActivityTypes.Event,
                                    name: "RemoveCard"
                                })
                            })
                            dataToInsert.push({
                                "message": "AutoRejected",
                                "sender": this.userBotConvo[userId]["agentRequestedLast"],
                                "receiver": userId,
                                "convoId": this.userBotConvo[userId].convoRef.conversation.id
                            })
                            this.userBotConvo[userId]["agentRequestedLast"] = "abc"
                            await dbQuery.agentRequestAnalysis({
                                "requestStatus": "AutoRejected",
                                "agentEmail": this.userBotConvo[userId]["agentRequestedLast"],
                                "userId": userId,
                                "convoId": this.userBotConvo[userId].convoRef.conversation.id
                            });
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
                                            dataToInsert.push({
                                                "message": this.message[i].cr386_value,
                                                "sender": "BOT",
                                                "receiver": this.userBotConvo[userId].convoRef.conversation.id,
                                                "convoId": this.userBotConvo[userId].convoRef.conversation.id
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
                                                dataToInsert.push({
                                                    "message": this.message[i].cr386_value.replace('{0}', `${key.indexOf(userId) + 1}`),
                                                    "sender": "BOT",
                                                    "receiver": this.userBotConvo[userId].convoRef.conversation.id,
                                                    "convoId": this.userBotConvo[userId].convoRef.conversation.id
                                                }, {
                                                    "message": "Event: AgentQueue",
                                                    "sender": "BOT",
                                                    "receiver": this.userBotConvo[userId].convoRef.conversation.id,
                                                    "convoId": this.userBotConvo[userId].convoRef.conversation.id
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
                                dataToInsert.push({
                                    "message": "Connection Request Sent",
                                    "sender": userId,
                                    "receiver": availableAgentstoCheck[i],
                                    "convoId": this.userBotConvo[userId].convoRef.conversation.id
                                })

                                await this.adapter.continueConversation(this.userBotConvo[userId].convoRef, async (sendContext) => {
                                    await sendContext.sendActivity({
                                        type: ActivityTypes.Typing,
                                        text: "Trying to find an Agent..."
                                    })
                                })
                                await dbQuery.agentRequestAnalysis({
                                    "requestStatus": "Connection Request Sent",
                                    "agentEmail": availableAgentstoCheck[i],
                                    "userId": userId,
                                    "convoId": this.userBotConvo[userId].convoRef.conversation.id
                                });
                                break;
                            }
                            else if (i === availableAgentstoCheck.length - 1) {
                                this.userBotConvo[this.agentRequestedByUser[userId]] === undefined
                                    ? this.userBotConvo[this.agentRequestedByUser[userId]]
                                    : this.userBotConvo[this.agentRequestedByUser[userId]]["agentRequested"] = 0
                                //////////////////////if agent available but not accepting request---------------------------------------------------
                                if (this.userBotConvo[userId]["requestSentToAgents"].length < availableAgentstoCheck.length) {
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
                                                dataToInsert.push({
                                                    "message": this.message[i].cr386_value.replace('{0}', `${key.indexOf(userId) + 1}`),
                                                    "sender": "BOT",
                                                    "receiver": this.userBotConvo[userId].convoRef.conversation.id,
                                                    "convoId": this.userBotConvo[userId].convoRef.conversation.id
                                                }, {
                                                    "message": "Event: AgentQueue",
                                                    "sender": "BOT",
                                                    "receiver": this.userBotConvo[userId].convoRef.conversation.id,
                                                    "convoId": this.userBotConvo[userId].convoRef.conversation.id
                                                })
                                                break;
                                            }
                                        }
                                    }
                                    break;
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
                                            dataToInsert.push({
                                                "message": this.message[i].cr386_value,
                                                "sender": "BOT",
                                                "receiver": this.userBotConvo[userId].convoRef.conversation.id,
                                                "convoId": this.userBotConvo[userId].convoRef.conversation.id
                                            }, {
                                                "message": "Help Card",
                                                "sender": "BOT",
                                                "receiver": this.userBotConvo[userId].convoRef.conversation.id,
                                                "convoId": this.userBotConvo[userId].convoRef.conversation.id
                                            }, {
                                                "message": "Event: NoAgent",
                                                "sender": "BOT",
                                                "receiver": this.userBotConvo[userId].convoRef.conversation.id,
                                                "convoId": this.userBotConvo[userId].convoRef.conversation.id
                                            })
                                            break;
                                        }
                                    }

                                    this.userBotConvo[userId]["requestSentToAgents"] = []
                                    delete this.userqueue[userId]
                                    await dbQuery.userQueueLog({
                                        "userId": userId,
                                        "convoId": userId,
                                        "queueStatus": "Dequeue"
                                    })
                                }
                                break;
                            }
                        }

                    } else if ((new Date() - this.userBotConvo[userId].userRequestAgentTime) > usermaxtime) {
                        clearInterval(this.userBotConvo[userId]['requestTimeObj'])
                        delete this.userqueue[userId]
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
                                dataToInsert.push({
                                    "message": this.message[i].cr386_value,
                                    "sender": "BOT",
                                    "receiver": this.userBotConvo[userId].convoRef.conversation.id,
                                    "convoId": this.userBotConvo[userId].convoRef.conversation.id
                                }, {
                                    "message": "Help Card",
                                    "sender": "BOT",
                                    "receiver": this.userBotConvo[userId].convoRef.conversation.id,
                                    "convoId": this.userBotConvo[userId].convoRef.conversation.id
                                }, {
                                    "message": "Event: NoAgent",
                                    "sender": "BOT",
                                    "receiver": this.userBotConvo[userId].convoRef.conversation.id,
                                    "convoId": this.userBotConvo[userId].convoRef.conversation.id
                                })
                                break;
                            }
                        }
                        await dbQuery.userQueueLog({
                            "userId": userId,
                            "convoId": userId,
                            "queueStatus": "Dequeue"
                        })
                    }
                } else {
                    clearInterval(this.userBotConvo[userId]['requestTimeObj'])
                    delete this.userqueue[userId]
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
                            dataToInsert.push({
                                "message": this.message[i].cr386_value,
                                "sender": "BOT",
                                "receiver": this.userBotConvo[userId].convoRef.conversation.id,
                                "convoId": this.userBotConvo[userId].convoRef.conversation.id
                            }, {
                                "message": "Help Card",
                                "sender": "BOT",
                                "receiver": this.userBotConvo[userId].convoRef.conversation.id,
                                "convoId": this.userBotConvo[userId].convoRef.conversation.id
                            }, {
                                "message": "Event: NoAgent",
                                "sender": "BOT",
                                "receiver": this.userBotConvo[userId].convoRef.conversation.id,
                                "convoId": this.userBotConvo[userId].convoRef.conversation.id
                            })
                            break;
                        }
                    }
                    await dbQuery.userQueueLog({
                        "userId": userId,
                        "convoId": userId,
                        "queueStatus": "Dequeue"
                    })
                }
                if (dataToInsert.length > 0) {
                    await dbQuery.insertChatLogs(dataToInsert)
                }

            }, 5000);
        } catch (error) {
            console.error(error)
        }
    }

    /////////////////////////////////////activity time check (ideal timeout) logic--------------------------------------
    async userMessageIdleTimeOut() {
        try {
            setInterval(async () => {
                let dataToInsert = [];
                let keys = Object.keys(this.userBotConvo);
                let userNotSendingMessageTime, agentNotSendingMessageTime, messageToUser, messageToAgent, eventMessage;

                if (this.message.length > 5) {
                    this.message.forEach(element => {
                        if (element.cr386_key === "AgentIdealTimeForLiveChatConversation") {
                            userNotSendingMessageTime = element.cr386_value
                        } else if (element.cr386_key === "AgentIdealWaitingTimeMessageToUser") {
                            messageToUser = element.cr386_value
                        } else if (element.cr386_key === "UserIdealTimeForLiveChatConversation") {
                            agentNotSendingMessageTime = element.cr386_value
                        } else if (element.cr386_key === "UserIdealWaitingTimeMessageToAgent") {
                            messageToAgent = element.cr386_value
                        } else if (element.cr386_key === "DisconnectedAgent") {
                            eventMessage = element.cr386_value
                        }
                    })
                }
                keys.forEach(async (element) => {
                    ////////////////////////////agent connected but not sending message-----------------------------
                    if (userType[element].userType === "agent" && this.userBotConvo[element]["userConnected"] > 0 &&
                        ((new Date() - this.userBotConvo[element]["activityTime"]) > parseInt(userNotSendingMessageTime))) {
                        this.userBotConvo[element]["userConnected"] = 0
                        await this.adapter.continueConversation(this.userBotConvo[element].convoRef, async (sendContext) => {
                            await sendContext.sendActivity(messageToAgent)
                        })
                        await this.adapter.continueConversation(this.userBotConvo[this.userBotConvo[element].userConvo.conversation.id].convoRef, async (sendContext) => {
                            await sendContext.sendActivity({
                                type: ActivityTypes.Event,
                                name: "DisconnectedAgent",
                                text: eventMessage
                            });
                            await sendContext.sendActivity(messageToUser)
                            await sendContext.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.feedbackSmileyCard("Agent"))))
                        })
                        dataToInsert.push({
                            "message": messageToUser,
                            "sender": "BOT",
                            "receiver": this.userBotConvo[element].userConvo.conversation.id,
                            "convoId": this.userBotConvo[element].userConvo.conversation.id
                        }, {
                            "message": "Feedback Card",
                            "sender": "BOT",
                            "receiver": this.userBotConvo[element].userConvo.conversation.id,
                            "convoId": this.userBotConvo[element].userConvo.conversation.id
                        }, {
                            "message": "Event: DisconnectedAgent",
                            "sender": "BOT",
                            "receiver": this.userBotConvo[element].userConvo.conversation.id,
                            "convoId": this.userBotConvo[element].userConvo.conversation.id
                        }, {
                            "message": messageToAgent,
                            "sender": "BOT",
                            "receiver": this.userBotConvo[element].convoRef.user.name,
                            "convoId": this.userBotConvo[element].convoRef.user.name
                        })
                        availableAgents[element] = {}

                        this.userBotConvo[this.userBotConvo[element].userConvo.conversation.id]["agentConnected"] = 0
                        this.userBotConvo[this.userBotConvo[element].userConvo.conversation.id]["userQueuePosition"] = 0
                        delete this.userBotConvo[this.userBotConvo[element].userConvo.conversation.id]["agentConvo"]
                        delete this.userBotConvo[element].userConvo
                        await dbQuery.agentRequestAnalysis({
                            "requestStatus": "End",
                            "agentEmail": this.userBotConvo[element].agentConvo.user.name,
                            "userId": element,
                            "convoId": this.userBotConvo[element].convoRef.conversation.id
                        });

                    }
                    ////////////////////////////user connected but not sending message-----------------------------
                    else if (userType[element].userType === "user" && this.userBotConvo[element]["agentConnected"] > 0 &&
                        ((new Date() - this.userBotConvo[element]["activityTime"]) > parseInt(agentNotSendingMessageTime))) {
                        this.userBotConvo[element]["agentConnected"] = 0
                        await this.adapter.continueConversation(this.userBotConvo[element].convoRef, async (sendContext) => {
                            await sendContext.sendActivity({
                                type: ActivityTypes.Event,
                                name: "DisconnectedAgent",
                                text: eventMessage
                            });
                            await sendContext.sendActivity(messageToUser)
                            await sendContext.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.feedbackSmileyCard("Agent"))))
                        })
                        await this.adapter.continueConversation(this.userBotConvo[element].agentConvo, async (sendContext) => {
                            await sendContext.sendActivity(messageToAgent)
                        })
                        dataToInsert.push({
                            "message": messageToUser,
                            "sender": "BOT",
                            "receiver": this.userBotConvo[element].convoRef.conversation.id,
                            "convoId": this.userBotConvo[element].convoRef.conversation.id
                        }, {
                            "message": "Feedback Card",
                            "sender": "BOT",
                            "receiver": this.userBotConvo[element].convoRef.conversation.id,
                            "convoId": this.userBotConvo[element].convoRef.conversation.id
                        }, {
                            "message": "Event: DisconnectedAgent",
                            "sender": "BOT",
                            "receiver": this.userBotConvo[element].convoRef.conversation.id,
                            "convoId": this.userBotConvo[element].convoRef.conversation.id
                        }, {
                            "message": messageToAgent,
                            "sender": "BOT",
                            "receiver": this.userBotConvo[element].convoRef.user.name,
                            "convoId": this.userBotConvo[element].convoRef.user.name
                        })

                        availableAgents[this.userBotConvo[element].agentConvo.user.name] = {}
                        this.userBotConvo[this.userBotConvo[element].agentConvo.user.name]["userConnected"] = 0
                        this.userBotConvo[element]["userQueuePosition"] = 0
                        this.userBotConvo[element]["agentConvo"] = this.userBotConvo[element].agentConvo
                        delete this.userBotConvo[this.userBotConvo[element].agentConvo.user.name].userConvo

                        await dbQuery.agentRequestAnalysis({
                            "requestStatus": "End",
                            "agentEmail": this.userBotConvo[element].agentConvo.user.name,
                            "userId": element,
                            "convoId": this.userBotConvo[element].convoRef.conversation.id
                        });
                    }
                })
                if (dataToInsert.length > 0) {
                    await dbQuery.insertChatLogs(dataToInsert)
                }
            }, 5000)

        } catch (error) {
            console.error(error);
        }
    }
    /////////////////////////////////////function to call QnA maker for FAQ----------------------------------------------
    async callQnAapi(text, conversationReference) {
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
            request(options, async function (error, response) {
                if (error) {
                    resolve("No good match found in KB.");
                    throw new Error(error);
                } else {
                    if (JSON.parse(response.body).answers[0].score < 30) {
                        resolve('No good match found in KB.')
                    } else {
                        await dbQuery.faqQueris({
                            "userId": conversationReference.conversation.id,
                            "query": text,
                            "faqQuestion": JSON.parse(response.body).answers[0].questions[0],
                            "faqAnswer": JSON.parse(response.body).answers[0].answer,
                            "faqCategory": JSON.parse(response.body).answers[0].metadata[0].value,
                            "convoId": conversationReference.conversation.id
                        })
                        resolve(JSON.parse(response.body).answers[0].answer)
                    }
                }
            });
        })

    }
}




module.exports.LiveAgentChatbot = LiveAgentChatbot;
