// Get filename to use in error messages
const path = require('path')
const fileName = path.basename(__filename)

const { botConfigValues, errorMessages } = require('../config/Config');
const { appInsightsClient } = require('../monitoring/AppInsights');
const { sendErrorMail } = require('../monitoring/Mail');

var request = require('request');

module.exports.tokenGeneration = async () => {
    return new Promise((resolve, reject) => {
        try {
            if (botConfigValues.crmValues && botConfigValues.crmValues.token && ((new Date(botConfigValues.crmValues.expiryTime) - new Date() < botConfigValues.crmValues.expiryTime))) {
                resolve(botConfigValues.crmValues.token)
            } else {
                var options = {
                    'method': 'POST',
                    'url': process.env.CRMTokenAPI,
                    'headers': {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    form: {
                        'client_id': process.env.CRMClientID,
                        'client_secret': process.env.CRMClientSecret,
                        'grant_type': process.env.CRMGrantType,
                        'resource': process.env.CRMResourceURL
                    }
                };
                request(options, function (error, response) {
                    if (error) {
                        console.error(errorMessages.CRMTokenGenerationError.name, error);
                        appInsightsClient(errorMessages.CRMTokenGenerationError.name, error)
                        sendErrorMail(`${errorMessages.CRMTokenGenerationError.desc} ${fileName}`, `${error}<br/><br/>api response code:${response.statusCode}`)
                    } else {
                        if (response.statusCode.toString().includes("20")) {
                            botConfigValues.crmValues.token = `Bearer ${JSON.parse(response.body).access_token}`
                            botConfigValues.crmValues.expiryTime = JSON.parse(response.body).expires_in * 1000

                            resolve(botConfigValues.crmValues.token)
                        } else {
                            console.error(errorMessages.CRMTokenGenerationError.name, response.body);
                            appInsightsClient(errorMessages.CRMTokenGenerationError.name, response.body)
                            sendErrorMail(`${errorMessages.CRMTokenGenerationError.desc} ${fileName}`, `${response.body}<br/><br/>api response code:${response.statusCode}`)
                        }
                    }
                });
            }
        } catch (error) {
            console.error(errorMessages.CRMTokenGenerationError.name, error);
            appInsightsClient(errorMessages.CRMTokenGenerationError.name, error)
            sendErrorMail(`${errorMessages.CRMTokenGenerationError.desc} ${fileName}`, `${error}`)
        }
    })
}

module.exports.getExistingContact = async (phone, email, name) => {
    return new Promise(async (resolve, reject) => {
        try {
            let token = await this.tokenGeneration();
            var options = {
                'method': 'GET',
                'url': `${process.env.CRMAPIBaseURL}contacts?$filter= mobilephone eq '${phone}' or emailaddress1 eq '${email}' &$orderby=createdon desc &$select=contactid`,
                'headers': {
                    'Authorization': token
                }
            };
            request(options, async function (error, response) {
                if (error) {
                    console.error(errorMessages.CRMGetExistingContactError.name, error);
                    appInsightsClient(errorMessages.CRMGetExistingContactError.name, error)
                    sendErrorMail(`${errorMessages.CRMGetExistingContactError.desc} ${fileName}`, `${error}<br/><br/> phone: ${phone} <br/><br/> email:${email}<br/><br/> name: ${name}<br/><br/>api response code:${response.statusCode}`)
                } else {
                    if (response.statusCode.toString().includes("20")) {
                        if (JSON.parse(response.body) && JSON.parse(response.body).value && JSON.parse(response.body).value.length > 0) {
                            resolve(JSON.parse(response.body).value[0].contactid)
                        } else {
                            resolve(null);
                        }
                    } else {
                        console.error(errorMessages.CRMGetExistingContactError.name, response.body);
                        appInsightsClient(errorMessages.CRMGetExistingContactError.name, response.body)
                        sendErrorMail(`${errorMessages.CRMGetExistingContactError.desc} ${fileName}`, `${response.body}<br/><br/> phone: ${phone} <br/><br/> email:${email}<br/><br/> name: ${name}<br/><br/>api response code:${response.statusCode}`)
                    }
                }
            });

        } catch (error) {
            console.error(errorMessages.CRMGetExistingContactError.name, error);
            appInsightsClient(errorMessages.CRMGetExistingContactError.name, error)
            sendErrorMail(`${errorMessages.CRMGetExistingContactError.desc} ${fileName}`, `${error}<br/><br/> phone: ${phone} <br/><br/> email:${email}<br/><br/> name: ${name}`)
        }
    })
}


module.exports.createNewContact = async (name, phone, email) => {
    return new Promise(async (resolve, reject) => {
        try {
            let token = await this.tokenGeneration();
            let contactId = await this.getExistingContact(phone, email, name)
            if (contactId) {
                resolve(contactId)
            }
            else {
                let splitName = name.split(" ")
                console.log(splitName)
                let first = "", second = "";
                if (splitName.length > 1) {
                    first = splitName[0]
                    second = splitName.slice(1).join(" ")
                } else if (splitName.length === 1) {
                    second = splitName[0]
                }
                var options = {
                    'method': 'POST',
                    'url': `${process.env.CRMAPIBaseURL}contacts?$select=contactid`,
                    'headers': {
                        'Authorization': token,
                        'Prefer': 'return=representation',
                        'Content-Type': 'application/json'
                    },
                    'body': JSON.stringify({
                        "firstname": first,
                        "lastname": second,
                        "po_customersegment": 100000008,
                        "po_contacttype": 100000004,
                        "emailaddress1": email,
                        "mobilephone": phone,
                        "bmc_contactsource": 6
                    })
                };
                request(options, function (error, response) {
                    if (error) {
                        console.error(errorMessages.CRMCreateContactError.name, error);
                        appInsightsClient(errorMessages.CRMCreateContactError.name, error)
                        sendErrorMail(`${errorMessages.CRMCreateContactError.desc} ${fileName}`, `${error}<br/><br/> phone: ${phone} <br/><br/> email:${email}<br/><br/> name: ${name}<br/><br/>api response code:${response.statusCode}`)
                    } else {
                        if (response.statusCode.toString().includes("20")) {
                            if (JSON.parse(response.body)) {
                                resolve(JSON.parse(response.body).contactid)
                            } else {
                                resolve(null)
                            }
                        } else {
                            console.error(errorMessages.CRMCreateContactError.name, response.body);
                            appInsightsClient(errorMessages.CRMCreateContactError.name, response.body)
                            sendErrorMail(`${errorMessages.CRMCreateContactError.desc} ${fileName}`, `${response.body}<br/><br/> phone: ${phone} <br/><br/> email:${email}<br/><br/> name: ${name}<br/><br/>api response code:${response.statusCode}`)
                        }
                    }
                });
            }

        } catch (error) {
            console.error(errorMessages.CRMCreateContactError.name, error);
            appInsightsClient(errorMessages.CRMCreateContactError.name, error)
            sendErrorMail(`${errorMessages.CRMCreateContactError.desc} ${fileName}`, `${error}<br/><br/> phone: ${phone} <br/><br/> email:${email}<br/><br/> name: ${name}`)
        }
    })
}

module.exports.getAgentGuid = async (email) => {
    return new Promise(async (resolve, reject) => {
        try {
            let token = await this.tokenGeneration();
            var options = {
                'method': 'GET',
                'url': `${process.env.CRMAPIBaseURL}systemusers?$filter=domainname eq '${email}' &$select=systemuserid`,
                'headers': {
                    'Authorization': token
                }
            };
            request(options, function (error, response) {
                if (error) {
                    console.error(errorMessages.CRMGetAgentGuidError.name, error);
                    appInsightsClient(errorMessages.CRMGetAgentGuidError.name, error)
                    sendErrorMail(`${errorMessages.CRMGetAgentGuidError.desc} ${fileName}`, `${error}<br/><br/> email: ${email}<br/><br/>api response code:${response.statusCode}`)
                } else {
                    if (response.statusCode.toString().includes("20")) {
                        if (JSON.parse(response.body) && JSON.parse(response.body).value && JSON.parse(response.body).value.length > 0) {
                            resolve(JSON.parse(response.body).value[0].systemuserid)
                        } else {
                            resolve(null)
                        }
                    } else {
                        console.error(errorMessages.CRMGetAgentGuidError.name, response.body);
                        appInsightsClient(errorMessages.CRMGetAgentGuidError.name, response.body)
                        sendErrorMail(`${errorMessages.CRMGetAgentGuidError.desc} ${fileName}`, `${response.body}<br/><br/> email: ${email}<br/><br/>api response code:${response.statusCode}`)
                    }
                }
            });

        } catch (error) {
            console.error(errorMessages.CRMGetAgentGuidError.name, error);
            appInsightsClient(errorMessages.CRMGetAgentGuidError.name, error)
            sendErrorMail(`${errorMessages.CRMGetAgentGuidError.desc} ${fileName}`, `${error}<br/><br/> email: ${email}`)
        }
    })
}

module.exports.createNewCase = async (initialQuestion, casetypecode, contactId, systemuserid) => {
    return new Promise(async (resolve, reject) => {
        try {
            let token = await this.tokenGeneration();
            if (systemuserid) {
                var options = {
                    'method': 'POST',
                    'url': `${process.env.CRMAPIBaseURL}incidents?$select=incidentid`,
                    'headers': {
                        'Authorization': token,
                        'Prefer': 'return=representation',
                        'Content-Type': 'application/json'
                    },
                    'body': JSON.stringify({
                        "new_additionalnotes": initialQuestion,
                        "casetypecode": casetypecode,
                        "caseorigincode": 4,
                        "customerid_contact@odata.bind": `/contacts(${contactId})`,
                        "ownerid@odata.bind": `/systemusers(${systemuserid})`
                    })
                };
                request(options, function (error, response) {
                    if (error) {
                        console.error(errorMessages.CRMCreateNewCaseError.name, error);
                        appInsightsClient(errorMessages.CRMCreateNewCaseError.name, error)
                        sendErrorMail(`${errorMessages.CRMCreateNewCaseError.desc} ${fileName}`, `${error}<br/><br/> initialQuestion/subject: ${initialQuestion} <br/><br/> casetype: ${casetypecode} <br/><br/> contactGUID: ${contactId} <br/><br/> agent/systemuserGUID: ${systemuserid}<br/><br/>api response code:${response.statusCode}`)
                    } else {
                        if (response.statusCode.toString().includes("20")) {
                            if (JSON.parse(response.body)) {
                                resolve(JSON.parse(response.body).incidentid)
                            } else {
                                resolve(null)
                            }
                        } else {
                            console.error(errorMessages.CRMCreateNewCaseError.name, response.body);
                            appInsightsClient(errorMessages.CRMCreateNewCaseError.name, response.body)
                            sendErrorMail(`${errorMessages.CRMCreateNewCaseError.desc} ${fileName}`, `${response.body}<br/><br/> initialQuestion/subject: ${initialQuestion} <br/><br/> casetype: ${casetypecode} <br/><br/> contactGUID: ${contactId} <br/><br/> agent/systemuserGUID: ${systemuserid}<br/><br/>api response code:${response.statusCode}`)
                        }
                    }
                });
            } else {
                resolve(null)
            }

        } catch (error) {
            console.error(errorMessages.CRMCreateNewCaseError.name, error);
            appInsightsClient(errorMessages.CRMCreateNewCaseError.name, error)
            sendErrorMail(`${errorMessages.CRMCreateNewCaseError.desc} ${fileName}`, `${error}<br/><br/> initialQuestion/subject: ${initialQuestion} <br/><br/> casetype: ${casetypecode} <br/><br/> contactGUID: ${contactId} <br/><br/> agent/systemuserGUID: ${systemuserid}`)
        }
    })
}

module.exports.updateExistingCase = async (caseId, systemuserid) => {
    return new Promise(async (resolve, reject) => {
        try {
            let token = await this.tokenGeneration();
            if (systemuserid) {
                var options = {
                    'method': 'PATCH',
                    'url': `${process.env.CRMAPIBaseURL}incidents(${caseId})?$select=incidentid`,
                    'headers': {
                        'Authorization': token,
                        'Prefer': 'return=representation',
                        'Content-Type': 'application/json'
                    },
                    'body': JSON.stringify({
                        "ownerid@odata.bind": `/systemusers(${systemuserid})`
                    })
                };
                request(options, function (error, response) {
                    if (error) {
                        console.error(errorMessages.CRMCreateNewCaseError.name, error);
                        appInsightsClient(errorMessages.CRMCreateNewCaseError.name, error)
                        sendErrorMail(`${errorMessages.CRMCreateNewCaseError.desc} ${fileName}`, `${error}<br/><br/> initialQuestion/subject: ${initialQuestion} <br/><br/> casetype: ${casetypecode} <br/><br/> contactGUID: ${contactId} <br/><br/> agent/systemuserGUID: ${systemuserid}<br/><br/>api response code:${response.statusCode}`)
                    } else {
                        if (response.statusCode.toString().includes("20")) {
                            if (JSON.parse(response.body)) {
                                resolve(JSON.parse(response.body).incidentid)
                            } else {
                                resolve(null)
                            }
                        } else {
                            console.error(errorMessages.CRMCreateNewCaseError.name, response.body);
                            appInsightsClient(errorMessages.CRMCreateNewCaseError.name, response.body)
                            sendErrorMail(`${errorMessages.CRMCreateNewCaseError.desc} ${fileName}`, `${response.body}<br/><br/> initialQuestion/subject: ${initialQuestion} <br/><br/> casetype: ${casetypecode} <br/><br/> contactGUID: ${contactId} <br/><br/> agent/systemuserGUID: ${systemuserid}<br/><br/>api response code:${response.statusCode}`)
                        }
                    }
                });
            } else {
                resolve(null)
            }

        } catch (error) {
            console.error(errorMessages.CRMCreateNewCaseError.name, error);
            appInsightsClient(errorMessages.CRMCreateNewCaseError.name, error)
            sendErrorMail(`${errorMessages.CRMCreateNewCaseError.desc} ${fileName}`, `${error}<br/><br/> initialQuestion/subject: ${initialQuestion} <br/><br/> casetype: ${casetypecode} <br/><br/> contactGUID: ${contactId} <br/><br/> agent/systemuserGUID: ${systemuserid}`)
        }
    })
}

module.exports.attachTranscriptToCase = async (subject, conversation, conversationId, caseId, agentGuid) => {
    return new Promise(async (resolve, reject) => {
        try {
            let token = await this.tokenGeneration();
            let transcript = ""
            conversation.forEach(element => {
                transcript += `<b>${element.sender}</b> (${element.timeStamp})- ${element.message}<br/>`
            });
            var options = {
                'method': 'POST',
                'url': `${process.env.CRMAPIBaseURL}bmc_chattranscripts?$select=activityid`,
                'headers': {
                    'Authorization': token,
                    'Prefer': 'return=representation',
                    'Content-Type': 'application/json'
                },
                'body': JSON.stringify({
                    "subject": subject,
                    "bmc_transcript": transcript,//pass html over here
                    "bmc_conversationid": conversationId,
                    "regardingobjectid_incident@odata.bind": `/incidents(${caseId})`,
                    "bmc_agentdetail_bmc_chattranscript@odata.bind": `/systemusers(${agentGuid})`
                })
            };
            request(options, function (error, response) {
                if (error) {
                    console.error(errorMessages.CRMAttachCaseTranscriptError.name, error);
                    appInsightsClient(errorMessages.CRMAttachCaseTranscriptError.name, error)
                    sendErrorMail(`${errorMessages.CRMAttachCaseTranscriptError.desc} ${fileName}`, `${error}<br/><br/> subject: ${subject} <br/><br/> conversation/transcript:${JSON.stringify(conversation)}<br/><br/> customer conversationID: ${conversationId} <br/><br/> caseId:${caseId}<br/><br/>api response code:${response.statusCode}`)
                } else {
                    if (response.statusCode.toString().includes("20")) {
                        if (JSON.parse(response.body)) {
                            resolve(JSON.parse(response.body).activityid)
                        } else {
                            resolve(null)
                        }
                    } else {
                        console.error(errorMessages.CRMAttachCaseTranscriptError.name, response.body);
                        appInsightsClient(errorMessages.CRMAttachCaseTranscriptError.name, response.body)
                        sendErrorMail(`${errorMessages.CRMAttachCaseTranscriptError.desc} ${fileName}`, `${response.body}<br/><br/> subject: ${subject} <br/><br/> conversation/transcript:${JSON.stringify(conversation)}<br/><br/> customer conversationID: ${conversationId} <br/><br/> caseId:${caseId}<br/><br/>api response code:${response.statusCode}`)
                    }
                }
            });

        } catch (error) {
            console.error(errorMessages.CRMAttachCaseTranscriptError.name, error);
            appInsightsClient(errorMessages.CRMAttachCaseTranscriptError.name, error)
            sendErrorMail(`${errorMessages.CRMAttachCaseTranscriptError.desc} ${fileName}`, `${error}<br/><br/> subject: ${subject} <br/><br/> conversation/transcript:${JSON.stringify(conversation)}<br/><br/> customer conversationID: ${conversationId} <br/><br/> caseId:${caseId}`)
        }
    })
}
