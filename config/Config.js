/*isConnectedToUser to check if agent is not conne cted to user
isReqestedByUser to check if agent does not have any connection request
department to save agent's department in convoref
requestSentToAgents--{"agentA":1, "agentB":2} to save how many times request is being sent to particular agent by current user
*/

/*-------create keys in dynamics------
userToAgentConnRequestCount
VideoFAQCategory
LinkVideoCategory   
*/
module.exports.errorMessages = {
    "staticValuesError": {
        "name": "staticValuesError",
        "desc": "Error occured while trying to fetch static values from database in"
    },
    "dbConnectError":{
        "name" :"Database connection error",
        "desc":"Error occured while tyring to connect database."
    }
}

module.exports.botVariableNames = {
    "abandonEventType": "abandonEventType",
    "agentCustomerDisconnected": "agentCustomerDisconnected",
    "activityTime": "activityTime",
    "agentPanelMessage": "agentPanelMessage",
    "autoDisconnectWarnMessageFlag": "autoDisconnectWarnMessageFlag",
    "connectionRequestGuid": "connectionRequestGuid",
    "convoHistory": "convoHistory",
    "convoRef": "convoRef",
    "crmAgentGUID": "crmAgentGUID",
    "crmCaseGUID": "crmCaseGUID",
    "crmContactGUID": "crmContactGUID",
    "currentQuestion": "currentQuestion",
    "gender": "gender",
    "isReqestedByUser": "isReqestedByUser",
    "liveChatStatus": "liveChatStatus",
    "messageSentToAgent": "messageSentToAgent",
    "personalDetail": "personalDetail",
    "queueGuid": "queueGuid",
    "queuePosition": "queuePosition",
    "requestsRejectedCount": "requestsRejectedCount",
    "requestSentToAgent": "requestSentToAgent",
    "requestSentToAgents": "requestSentToAgents",
    "requestSentToAgentTime": "requestSentToAgentTime",
    "userAddedToQueueTime": "userAddedToQueueTime",
    "userConnectedTo": "userConnectedTo",
    "userDepartment": "userDepartment",
    "userToAgentConnRequestCount": "userToAgentConnRequestCount",
    "userType": "userType",
}

module.exports.botConfigValues = {
    "replaceChar": /[^a-zA-Z0-9]/g,
    "phoneRegex": /(\d{3}[.\-_–\s])(\d{3}[.\-_–\s])(\d{4})|(\d{5}[.\-_–\s])(\d{5})|(\d{10})/g,
    "emailRegex": /(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))/g,
    "nameRegex": /^[a-zA-Z\s]{2,50}$/,
    "autoDisconnectRunning": false,
    "autoDisconnectRunCurrentUsers": [],
    "isHoliday": false,
    "botAdapter": "",
    "valueFromDatabase": {},
    "agentpanelValues": {},
    "departments": {
        "defaultDept": "",
        "regular": [],
        "deptContactDetail": {}
    },
    "conversationReferences": {},
    "usersInQueue": {},
    "availableAgents": {},
    "staticTexts": {},
    "initialQuestionCategory": {},
    "crmValues": {
        "expiryTime": "",
        "token": "",
        "caseTypeCode": {
            "Product Information": 7,
            "E-commerce": 9
        }
    }
}

module.exports.userType = {
    "customer": "customer",
    "agent": "agent",
    "unauthorized": "unauthorized",
    "bot": "Bot",
    "post": "post",
    "service": "service",
    "typing": "typing"
}

module.exports.customerUiStates = {
    "chatOffLanding": "chatOffLanding",
    "chatLanding": "chatLanding",
    "thankYou": "thankYou",
    "endchat": "endchat",
    "liveChat": "liveChat",
    "defaultTime": "Just Now"
}