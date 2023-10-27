const { botConfigValues, userType } = require('../config/Config')
module.exports.userConnectionRequestCard = (initialQuestion, customerName) => {
    try {
        let customer = customerName ? customerName : botConfigValues.staticTexts.connReqDefaultRequester
        var card = {
            "type": "AdaptiveCard",
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.2",
            "body": [
                {
                    "type": "Container",
                    "items": [
                        {
                            "type": "Container",
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "wrap": true,
                                    "text": botConfigValues.valueFromDatabase.connReqCardTitle,
                                    "horizontalAlignment": "Center",
                                    "weight": "Bolder"
                                }
                            ],
                            "style": "warning",
                            "bleed": true
                        },
                        {
                            "type": "TextBlock",
                            "wrap": true,
                            "text": `**${botConfigValues.valueFromDatabase.connReqFromTitle}** ${customer}`,
                            "fontType": "Default"
                        },
                        {
                            "type": "TextBlock",
                            "wrap": true,
                            "text": `**${botConfigValues.valueFromDatabase.connReqQuestionTitle}** ${initialQuestion}`,
                            "fontType": "Default"
                        }
                    ]
                },
                {
                    "type": "ColumnSet",
                    "columns": [
                        {
                            "type": "Column",
                            "width": "stretch",
                            "items": [
                                {
                                    "type": "ActionSet",
                                    "actions": [
                                        {
                                            "type": "Action.Submit",
                                            "style": "destructive",
                                            "title": botConfigValues.valueFromDatabase.connReqRejectButtonText,
                                            "data": {
                                                "userResponse": botConfigValues.staticTexts.connReqManualRejectedEvent,
                                            }
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            "type": "Column",
                            "width": "stretch",
                            "items": [
                                {
                                    "type": "ActionSet",
                                    "actions": [
                                        {
                                            "type": "Action.Submit",
                                            "title": botConfigValues.valueFromDatabase.connReqAcceptButtonText,
                                            "data": {
                                                "userResponse": botConfigValues.staticTexts.connReqAcceptedEvent,
                                            }
                                        }
                                    ]
                                }
                            ]
                        }
                    ]
                }
            ]
        }
        return card;
    } catch (error) {
        console.error(error)
    }
}

module.exports.userDetailToAgentCard = (userDetail) => {
    try {
        var card = {
            "type": "AdaptiveCard",
            "body": [
                {
                    "type": "Container",
                    "items": [
                        {
                            "type": "TextBlock",
                            "wrap": true,
                            "text": botConfigValues.valueFromDatabase.customerDetailCardTitle,
                            "wrap": true,
                            "horizontalAlignment": "Center",
                            "weight": "Bolder"
                        }
                    ],
                    "style": "warning",
                    "bleed": true
                },
                {
                    "type": "ColumnSet",
                    "columns": [
                        {
                            "type": "Column",
                            "width": "100px",
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "text": botConfigValues.valueFromDatabase.customerDetailCardName,
                                    "wrap": true,
                                    "weight": "Bolder"
                                }
                            ]
                        }, {
                            "type": "Column",
                            "width": "stretch",
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "text": userDetail.name,
                                    "wrap": true,
                                }
                            ]
                        }
                    ]
                },
                {
                    "type": "ColumnSet",
                    "columns": [
                        {
                            "type": "Column",
                            "width": "100px",
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "text": botConfigValues.valueFromDatabase.customerDetailCardEmail,
                                    "wrap": true,
                                    "weight": "Bolder"
                                }
                            ]
                        }, {
                            "type": "Column",
                            "width": "stretch",
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "text": userDetail.email,
                                    "wrap": true,
                                }
                            ]
                        }
                    ]
                },
                {
                    "type": "ColumnSet",
                    "columns": [
                        {
                            "type": "Column",
                            "width": "100px",
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "text": botConfigValues.valueFromDatabase.customerDetailCardPhone,
                                    "wrap": true,
                                    "weight": "Bolder"
                                }
                            ]
                        }, {
                            "type": "Column",
                            "width": "stretch",
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "text": userDetail.phone,
                                    "wrap": true,
                                }
                            ]
                        }
                    ]
                }
            ],
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.2"
        }
        return card;
    } catch (error) {
        console.error(error);
    }
}

module.exports.convoHistoryCard = (history, count) => {
    if (history.length > count) {
        var card = {
            "type": "AdaptiveCard",
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.2",
            "body": [
                {
                    "type": "Container",
                    "items": [
                        {
                            "type": "Container",
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "text": botConfigValues.valueFromDatabase.convoHistoryCardTitle,
                                    "wrap": true,
                                    "horizontalAlignment": "Center",
                                    "weight": "Bolder"
                                }
                            ],
                            "style": "warning",
                            "bleed": true
                        }
                    ]
                }
            ],
            "actions": []
        }
        let length = (history.length - count) > parseInt(botConfigValues.valueFromDatabase.convoHistoryCardMaxMessageCount) ? parseInt(botConfigValues.valueFromDatabase.convoHistoryCardMaxMessageCount) : (history.length - count)
        for (let i = count; i < (length + count); i++) {
            if (history[i].sender === userType.customer) {
                card["body"].push({
                    "type": "ColumnSet",
                    "separator": true,
                    "columns": [
                        {
                            "type": "Column",
                            "width": "stretch",
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "text": `**Customer:** ${history[i].message}`,
                                    "wrap": true,
                                    "horizontalAlignment": "Right"
                                }
                            ]
                        }
                    ],
                    "actions": []
                })
            } else {
                card["body"].push({
                    "type": "ColumnSet",
                    "separator": true,
                    "columns": [
                        {
                            "type": "Column",
                            "width": "auto",
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "text": `**${history[i].sender}:** ${history[i].message}`,
                                    "wrap": true,
                                    "horizontalAlignment": "Left"
                                }
                            ]
                        }
                    ]
                })

            }

        }
        if (history.length > parseInt(count + length)) {
            card["actions"].push({
                "type": "Action.Submit",
                "title": botConfigValues.valueFromDatabase.convoHistoryCardBtnText,
                "data": {
                    "userResponse": botConfigValues.valueFromDatabase.convoHistoryCardBtnText,
                    "count": (count + length),
                }
            })

        }
        return card;
    }
}

module.exports.dynamicsURLCard = (caseId, contactId) => {
    try {
        var card = {
            "type": "AdaptiveCard",
            "body": [
                {
                    "type": "Container",
                    "items": [
                        {
                            "type": "TextBlock",
                            "wrap": true,
                            "text": botConfigValues.valueFromDatabase.dynamicsURLCardTitle,
                            "wrap": true,
                            "horizontalAlignment": "Center",
                            "weight": "Bolder"
                        }
                    ],
                    "style": "warning",
                    "bleed": true
                },
                {
                    "type": "ColumnSet",
                    "columns": [
                        {
                            "type": "Column",
                            "width": "100px",
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "text": "Contact Id: ",
                                    "wrap": true,
                                    "weight": "Bolder"
                                }
                            ]
                        }, {
                            "type": "Column",
                            "width": "stretch",
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "text": `[${contactId}](${process.env.CRMAPIAutoOpenBaseURL}${process.env.CRMAppId}${process.env.CRMContactId}${contactId}${process.env.CRMOtherOption})`,
                                    "wrap": true,
                                }
                            ]
                        }
                    ]
                },
                {
                    "type": "ColumnSet",
                    "columns": [
                        {
                            "type": "Column",
                            "width": "100px",
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "text": "Case Id: ",
                                    "wrap": true,
                                    "weight": "Bolder"
                                }
                            ]
                        }, {
                            "type": "Column",
                            "width": "stretch",
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "text": `[${caseId}](${process.env.CRMAPIAutoOpenBaseURL}${process.env.CRMAppId}${process.env.CRMCaseId}${caseId}${process.env.CRMOtherOption})`,
                                    "wrap": true,
                                }
                            ]
                        }
                    ]
                }
            ],
            "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
            "version": "1.2"
        }
        return card;
    } catch (error) {
        console.error(error);
    }
}

 // var mobileRegex = /\+{0,1}((\d{0,2}[.\-_–\s])?((\d{3}[.\-_–\s])(\d{3}[.\-_–\s])(\d{4})|(\d{5}[.\-_–\s])(\d{5})))/g