// Get filename to use in error messages
const path = require('path')
const fileName = path.basename(__filename)

const { botConfigValues, errorMessages, botVariableNames, userType } = require('../config/Config')
const { insertChatLog } = require('../data/Queries')
const { ActivityTypes, MessageFactory, CardFactory } = require('botbuilder')

// function to send events to users
module.exports.sendEvent = async (user, eventName, message) => {
    return new Promise(async (resolve, reject) => {
        try {
            message === undefined ? message = '' : message

            if (botConfigValues.conversationReferences[user]) {
                await botConfigValues.botAdapter.continueConversation(botConfigValues.conversationReferences[user][botVariableNames.convoRef], async (sendContext) => {
                    if (message === userType.typing) {
                        await sendContext.sendActivity({
                            type: ActivityTypes.Typing,
                            name: eventName
                        })
                    } else {
                        await sendContext.sendActivity({
                            type: ActivityTypes.Event,
                            name: eventName,
                            text: message
                        })
                    }
                })
            }
            resolve()

        } catch (error) {
            console.error(errorMessages.sendEventError.name, error);
            appInsightsClient(`${eventName}${errorMessages.sendEventError.name}`, error)
            sendErrorMail(`${errorMessages.sendEventError.desc} ${fileName}`, `${errorMessages.sendEventError.body} ${eventName} - ${message}\n ${error.stack}`)
            reject(`${errorMessages.sendEventError.desc} ${fileName}`, `${errorMessages.sendEventError.body} ${eventName} - ${message}\n ${error.stack}`)
        }
    })
}


// function to send text messages to users
module.exports.sendMessage = async (user, message) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (botConfigValues.conversationReferences[user]) {
                await botConfigValues.botAdapter.continueConversation(botConfigValues.conversationReferences[user][botVariableNames.convoRef], async (sendContext) => {
                    await sendContext.sendActivity(message)
                })
            }
            resolve()

        } catch (error) {
            console.error(errorMessages.sendMessageError.name, error);
            appInsightsClient(`${eventName}${errorMessages.sendMessageError.name}`, error)
            sendErrorMail(`${errorMessages.sendMessageError.desc} ${fileName}`, `${errorMessages.sendMessageError.body} ${message}\n ${error.stack}`)
            reject(`${errorMessages.sendMessageError.desc} ${fileName}`, `${errorMessages.sendMessageError.body} ${message}\n ${error.stack}`)
        }
    })
}

// function to send attachment message to users
module.exports.sendAttachment = async (user, card) => {
    return new Promise(async (resolve, reject) => {
        try {
            if (botConfigValues.conversationReferences[user]) {
                await botConfigValues.botAdapter.continueConversation(botConfigValues.conversationReferences[user][botVariableNames.convoRef], async (sendContext) => {
                    await sendContext.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(card)))
                })
            }
            resolve()

        } catch (error) {
            console.error(errorMessages.sendAttachmentError.name, error);
            appInsightsClient(`${eventName}${errorMessages.sendAttachmentError.name}`, error)
            sendErrorMail(`${errorMessages.sendAttachmentError.desc} ${fileName}`, `${errorMessages.sendAttachmentError.body} ${message}\n ${error.stack}`)
            reject(`${errorMessages.sendAttachmentError.desc} ${fileName}`, `${errorMessages.sendAttachmentError.body} ${message}\n ${error.stack}`)
        }
    })
}