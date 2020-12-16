const sql = require('mssql')
const format = require('pg-format')
module.exports.insertChatLogs = (dataToInsert) => {
    try {
        var request = new sql.Request();
        dataToInsert.forEach(element => {
            let arr = [element.message, element.sender, element.receiver, element.convoId]
            let query = format('insert into nodeChatLog (Message,Sender,Receiver,ConversationId) values(%L)', arr)
            request.query(query, (err, result) => {
            })
        });

    } catch (error) {
        console.error(error);
    }
}

module.exports.agentRequestAnalysis = (dataToInsert) => {
    try {

        var request = new sql.Request();
        let arr = [dataToInsert.agentEmail, dataToInsert.userId, dataToInsert.requestStatus, dataToInsert.convoId]
        let query = format('insert into nodeAgentRequestAnalysis (AgentEmail,UserId,RequestStatus,ConversationId) values(%L)', arr)
        request.query(query, (err, result) => {
        })

    } catch (error) {
        console.error(error);
    }
}

module.exports.faqUnansweredQueries = (dataToInsert) => {
    try {

        var request = new sql.Request();
        let arr = [dataToInsert.userId, dataToInsert.query, dataToInsert.convoId]
        let query = format('insert into nodeUnansweredQueries (UserId,Query,ConversationId) values(%L)', arr)
        request.query(query, (err, result) => {
        })

    } catch (error) {
        console.error(error);
    }
}

module.exports.faqQueris = (dataToInsert) => {
    try {
        var request = new sql.Request();
        let arr = [dataToInsert.userId, dataToInsert.query, dataToInsert.faqQuestion, dataToInsert.faqAnswer, dataToInsert.faqCategory, dataToInsert.convoId]
        let query = format('insert into nodeFaQQuestions (UserId,UserQuery,FAQQuestion,FAQAnswer,FAQCategory,ConversationId) values(%L)', arr)
        request.query(query, (err, result) => {
        })

    } catch (error) {
        console.error(error);
    }
}