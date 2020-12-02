// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, TurnContext, TeamsInfo, CardFactory, MessageFactory, ActivityTypes } = require('botbuilder');
const cards = require('./cards')
const apis = require('./API')
let userType = {}
var agentList = ['rohit', 'kunal', 'arihant', 'kamal']
let availableAgents = {}
class LiveAgentChatbot extends ActivityHandler {
    constructor(conversationReferences, conversationState, getConfigDetails) {
        super();

        // Dependency injected dictionary for storing ConversationReference objects used in NotifyController to proactively message users
        this.conversationReferences = conversationReferences;
        this.conversationState = conversationState;
        this.dialogState = this.conversationState.createProperty('DialogState');
        this.userBotConvo = {}
        this.userqueue = {}
        this.message;

        this.agentRequestedByUser = {}
        this.onConversationUpdate(async (context, next) => {
            this.adapter = context.adapter;
            if (this.message === undefined) {
                this.message = getConfigDetails
            }
            await next();
            const membersAdded = context.activity.membersAdded;
            // for (let cnt = 0; cnt < membersAdded.length; cnt++) {
            //     if (membersAdded[cnt].id === context.activity.recipient.id) {
            //     }
            // }

        });

        this.onEvent(async (context, next) => {
            if (context.activity.name === 'webchat/exit') { }
            else if (context.activity.name === 'webchat/typing') {
                await context.sendActivity({
                    type: ActivityTypes.Typing,
                    text: "Agent is typing..."
                })
            }
            await next()
        })

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            for (let cnt = 0; cnt < membersAdded.length; cnt++) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    let conversationReference = await TurnContext.getConversationReference(context.activity);
                    let agentExists = await apis.getAvailableAgents(conversationReference.user.name);

                    if (conversationReference.user.name && (agentExists.email.includes(conversationReference.user.name.toLowerCase()))) {

                        for (let i = 0; i < this.message.length; i++) {
                            if (this.message[i].cr386_key.toLowerCase() === 'agentwelcomemessage') {
                                await context.sendActivity(this.message[i].cr386_value.replace('Hi.', `Hi ${agentExists.fullname},`))
                                break;
                            }
                        }
                    }
                    else {

                        for (let i = 0; i < this.message.length; i++) {
                            if (this.message[i].cr386_key.toLowerCase() === 'userwelcomemessage') {
                                await context.sendActivity(this.message[i].cr386_value)
                                let time =
                                    await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.userHelpCard)))
                                break;
                            }
                        }
                    }
                }
            }

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        this.onMessage(async (context, next) => {
            // Echo back what the user said
            try {
                let conversationReference = await TurnContext.getConversationReference(context.activity);
                let agentExists;
                if (!Object.keys(userType).includes(conversationReference.user.name)) {
                    agentExists = await apis.getAvailableAgents(conversationReference.user.name);
                    userType[conversationReference.user.name] = agentExists
                } else {
                    agentExists = userType[conversationReference.user.name]
                }
                /////////////////////////////agent flow------------------------------------
                if (conversationReference.user.name && (agentExists.email.includes(conversationReference.user.name.toLowerCase())
                    || userType[conversationReference.user.name]["userType"] === "agent")) {
                    userType[conversationReference.user.name]["userType"] = "agent"
                    availableAgents[conversationReference.user.name] = {}
                    this.userBotConvo[conversationReference.user.name] === undefined ? this.userBotConvo[conversationReference.user.name] = {} : this.userBotConvo
                    this.userBotConvo[conversationReference.user.name]["convoRef"] = conversationReference;
                    ///////////////////////////////agent marks himself unavailable-----------------------------------
                    if (context.activity.text && context.activity.text.toLowerCase().includes("unavailable")) {
                        if (this.userBotConvo[conversationReference.user.name].userConnected > 0) {

                            for (let i = 0; i < this.message.length; i++) {
                                if (this.message[i].cr386_key === "AgentEndConversationMessageToAgent") {
                                    await context.sendActivity(this.message[i].cr386_value)
                                } else if (this.message[i].cr386_key === "DisconnectedAgent") {
                                    await this.adapter.continueConversation(this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.user.id].convoRef, async (sendContext) => {
                                        await sendContext.sendActivity(this.message[i].cr386_value);
                                    })
                                    await sendContext.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.feedbackSmileyCard)))
                                }
                            }
                            this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.user.id]["agentConnected"] = 0
                            this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.user.id]["agentConvo"] = conversationReference
                        }
                        delete this.userBotConvo[conversationReference.user.name]
                        delete availableAgents[conversationReference.user.name]
                    }
                    ///////////////////////////////agent sends bye-----------------------------------
                    else if (context.activity.text && context.activity.text.toLowerCase().includes("bye") && this.userBotConvo[conversationReference.user.name].userConnected > 0) {

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
                        availableAgents[conversationReference.user.name] = {}
                        this.userBotConvo[conversationReference.user.name]["userConnected"] = 0
                        this.userBotConvo[this.userBotConvo[conversationReference.user.name].userConvo.user.id]["agentConnected"] = 0
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
                        delete availableAgents[conversationReference.user.name]
                        clearInterval(this.userBotConvo[context.activity.value.userConvo.user.id]['requestTimeObj'])
                        this.userBotConvo[context.activity.value.userConvo.user.id]["agentConnected"] = 1
                        this.userBotConvo[context.activity.value.userConvo.user.id]["agentConvo"] = conversationReference
                        await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.convoHistoryCard(this.userBotConvo[context.activity.value.userConvo.user.id]["convoHistory"], context.activity.value.userConvo, 0))))

                        for (let i = 0; i < this.message.length; i++) {
                            if (this.message[i].cr386_key === "AgentIsConnectedToUserMessage") {
                                await this.adapter.continueConversation(this.userBotConvo[context.activity.value.userConvo.user.id].convoRef, async (sendContext) => {
                                    await sendContext.sendActivity(this.message[i].cr386_value.replace('{0}', userType[conversationReference.user.name].fullname));
                                })
                            }
                        }

                        this.userBotConvo[this.agentRequestedByUser[context.activity.value.userConvo.user.id]]["agentRequested"] = 0
                        delete this.agentRequestedByUser[context.activity.value.userConvo.user.id]

                    }
                    ///////////////////////////////agent rejecting request--------------------------
                    else if (context.activity.value && context.activity.value.agentResponse.toLowerCase() === "reject") {
                        this.userBotConvo[context.activity.value.userConvo.user.id]["requestCount"] = 0;
                        this.userBotConvo[this.agentRequestedByUser[context.activity.value.userConvo.user.id]]["agentRequested"] = 0
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
                    //////////////////////////user trying to connect to agent-------------------------------
                    else if (context.activity.text && context.activity.text.toLowerCase().includes("agent")) {
                        this.userqueue[conversationReference.user.id] = {};
                        // if (new Date().getHours() > 17) {
                        this.userBotConvo[conversationReference.user.id]["activityTime"] = new Date();
                        this.userBotConvo[conversationReference.user.id]["convoRef"] = conversationReference;
                        this.userBotConvo[conversationReference.user.id]["requestCount"] = 0;
                        this.userBotConvo[conversationReference.user.id]["requestSentToAgents"] === undefined
                            ? this.userBotConvo[conversationReference.user.id]["requestSentToAgents"] = []
                            : this.userBotConvo[conversationReference.user.id]["requestSentToAgents"];
                        this.userBotConvo[conversationReference.user.id]["agentConnected"] = 0

                        this.userActivityTimeCheck(conversationReference.user.id);
                        // }else{
                        //     await context.sendActivity("agent is not available")
                        // }
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
                            await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.userHelpCard)))
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
                                        await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.userHelpCard)))
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
                if (!availableAgentstoCheck.length <= 0) {
                    let time = new Date() - this.userBotConvo[userId].activityTime
                    if (this.userBotConvo[userId].requestCount === 0) {
                        time = 11000
                    }
                    if (time > 10000) {

                        for (let i = 0; i < availableAgentstoCheck.length; i++) {
                            ////////////////////sending requests to available agents--------------------------------------------
                            if (Object.keys(this.userBotConvo).includes(availableAgentstoCheck[i]) && this.userBotConvo[availableAgentstoCheck[i]].userConnected === 0
                                && this.userBotConvo[availableAgentstoCheck[i]].agentRequested === 0
                                && !this.userBotConvo[userId]["requestSentToAgents"].includes(availableAgentstoCheck[i])) {
                                this.userBotConvo[this.agentRequestedByUser[userId]] === undefined
                                    ? this.userBotConvo[this.agentRequestedByUser[userId]]
                                    : this.userBotConvo[this.agentRequestedByUser[userId]]["agentRequested"] = 0
                                this.agentRequestedByUser[userId] = availableAgentstoCheck[i]
                                this.userBotConvo[availableAgentstoCheck[i]]["agentRequested"] = 1
                                this.userBotConvo[userId]["requestSentToAgents"].push(availableAgentstoCheck[i])
                                this.userBotConvo[userId]["activityTime"] = new Date();
                                this.userBotConvo[userId].requestCount += 1
                                await this.adapter.continueConversation(this.userBotConvo[availableAgentstoCheck[i]].convoRef, async (sendContext) => {
                                    await sendContext.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.userConnectionRequestCard(this.userBotConvo[userId].convoRef))));
                                })
                                let key = Object.keys(this.userqueue)

                                for (let i = 0; i < this.message.length; i++) {
                                    if (this.message[i].cr386_key === "InQueuePositionMessage") {
                                        await this.adapter.continueConversation(this.userBotConvo[userId].convoRef, async (sendContext) => {
                                            await sendContext.sendActivity(this.message[i].cr386_value.replace('{0}', `${key.indexOf(userId) + 1}`));
                                        })
                                        break;
                                    }
                                }

                                break;
                            }
                            else if (i === availableAgentstoCheck.length - 1) {
                                this.userBotConvo[this.agentRequestedByUser[userId]] === undefined
                                    ? this.userBotConvo[this.agentRequestedByUser[userId]]
                                    : this.userBotConvo[this.agentRequestedByUser[userId]]["agentRequested"] = 0
                                //////////////////////if agent available but not accepting request---------------------------------------------------
                                if (this.userBotConvo[userId]["requestSentToAgents"].length < availableAgentstoCheck.length) {
                                    this.userBotConvo[userId].requestCount += 1
                                    this.userBotConvo[userId]["activityTime"] = new Date();
                                    let key = Object.keys(this.userqueue)

                                    for (let i = 0; i < this.message.length; i++) {
                                        if (this.message[i].cr386_key === "InQueuePositionMessage") {
                                            await this.adapter.continueConversation(this.userBotConvo[userId].convoRef, async (sendContext) => {
                                                await sendContext.sendActivity(this.message[i].cr386_value.replace('{0}', `${key.indexOf(userId) + 1}`));
                                            })
                                            break;
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
                                                await sendContext.sendActivity(this.message[i].cr386_value);
                                                await sendContext.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.userHelpCard)))

                                            })
                                            break;
                                        }
                                    }

                                    this.userBotConvo[userId]["requestCount"] = 0;
                                    this.userBotConvo[userId]["requestSentToAgents"] = []
                                    delete this.userqueue[userId]
                                }

                            }
                        }

                    }
                } else {
                    clearInterval(this.userBotConvo[userId]['requestTimeObj'])

                    for (let i = 0; i < this.message.length; i++) {
                        if (this.message[i].cr386_key.toLowerCase() === 'agentnotavailablemessage') {
                            await this.adapter.continueConversation(this.userBotConvo[userId].convoRef, async (sendContext) => {
                                await sendContext.sendActivity(this.message[i].cr386_value);
                                await sendContext.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(cards.userHelpCard)))

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
