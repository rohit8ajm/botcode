var API = require('../bots/API')

module.exports.userConnectionRequestCard = (convoref) => {
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
                                "text": "User Connection Request",
                                "wrap": true,
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
                        "text": "User want’s to connect with you",
                        "wrap": true,
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
                                        "title": "Accept",
                                        "data": {
                                            "agentResponse": "Accept",
                                            "userConvo": convoref
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
                                        "title": "Reject",
                                        "data": {
                                            "agentResponse": "Reject",
                                            "userConvo": convoref
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
}

module.exports.confimrmationCard = {
    "type": "AdaptiveCard",
    "body": [
        {
            "type": "Container",
            "items": [
                {
                    "type": "TextBlock",
                    "wrap": true,
                    "size": "Default",
                    "weight": "Bolder",
                    "text": "Did that answer your question?"
                }
            ]
        },
        {
            "type": "ColumnSet",
            "columns": [
                {
                    "type": "Column",
                    "width": "auto",
                    "items": [
                        {
                            "type": "ActionSet",
                            "actions": [
                                {
                                    "type": "Action.Submit",
                                    "title": "Yes",
                                    "data": {
                                        "userResponse": "Yes"
                                    }
                                }
                            ]
                        }
                    ]
                },
                {
                    "type": "Column",
                    "width": "auto",
                    "items": [
                        {
                            "type": "ActionSet",
                            "actions": [
                                {
                                    "type": "Action.Submit",
                                    "title": "No",
                                    "data": {
                                        "userResponse": "No"
                                    }
                                }
                            ]
                        }
                    ]
                }
            ],
            "separator": true,
            "spacing": "Medium"
        }
    ],
    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
    "version": "1.2"
}

module.exports.userHelpCard = async (message) => {
    let offHours = await API.checkAgentTime(message);
    var card = {
        "type": "AdaptiveCard",
        "body": [
            {
                "type": "Container",
                "items": [
                    {
                        "type": "TextBlock",
                        "wrap": true,
                        "size": "Default",
                        "text": "How may I help you ?"
                    }
                ]
            },
            {
                "type": "ActionSet",
                "actions": [
                    {
                        "type": "Action.Submit",
                        "title": "Ask Your Question",
                        "data": {
                            "userResponse": "FAQ"
                        }
                    }
                ]
            }
        ],
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "version": "1.2"
    }
    if (offHours.time === "working") {
        card['body'].push({
            "type": "ActionSet",
            "actions": [
                {
                    "type": "Action.Submit",
                    "title": "Talk To Agent",
                    "data": {
                        "userResponse": "Talk to Agent"
                    }
                }
            ]
        })
    } else {
        card['body'].push({
            "type": "ActionSet",
            "actions": [
                {
                    "type": "Action.Submit",
                    "title": "Contact Us",
                    "data": {
                        "userResponse": "Contact Us"
                    }
                }
            ]
        })
    }
    return card;
}

module.exports.feedbackSmileyCard = (feedbackType) => {
    var card = {
        "type": "AdaptiveCard",
        "body": [
            {
                "type": "Container",
                "items": [
                    {
                        "type": "TextBlock",
                        "size": "Medium",
                        "text": "Great! Please rate your experience."
                    },
                    {
                        "type": "ColumnSet",
                        "columns": [
                            {
                                "type": "Column",
                                "width": "auto",
                                "items": [
                                    {
                                        "type": "Image",
                                        "url": "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSIw8kXVT2smkXp-LdYxMfgZKRfKnldfFytpgcBHULIODxETWlm1hQ_4_qHWAEGAzdfa9PRbkdqSwp8uQrpBiBILWHG72ZKuvo&usqp=CAU&ec=45732303",
                                        "size": "Small",
                                        "horizontalAlignment": "Center"
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "Terrible",
                                        "wrap": true,
                                        "horizontalAlignment": "Center",
                                        "spacing": "None"
                                    }
                                ],
                                "selectAction": {
                                    "type": "Action.Submit",
                                    "data": {
                                        "userResponse": "smileyFeedback",
                                        "feedbackValue": "Terrible",
                                        "feedbackType": feedbackType
                                    }
                                }
                            },
                            {
                                "type": "Column",
                                "width": "auto",
                                "items": [
                                    {
                                        "type": "Image",
                                        "url": "https://i.pinimg.com/originals/24/8c/c4/248cc4eec11b158d6eaf49c7088022a4.jpg",
                                        "size": "Small",
                                        "horizontalAlignment": "Center"
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "Poor",
                                        "wrap": true,
                                        "horizontalAlignment": "Center",
                                        "spacing": "None"
                                    }
                                ],
                                "selectAction": {
                                    "type": "Action.Submit",
                                    "data": {
                                        "userResponse": "smileyFeedback",
                                        "feedbackValue": "Poor",
                                        "feedbackType": feedbackType
                                    }
                                }
                            },
                            {
                                "type": "Column",
                                "width": "auto",
                                "items": [
                                    {
                                        "type": "Image",
                                        "url": "https://iconvulture.com/wp-content/uploads/2017/12/meh-face-emoticon.svg",
                                        "size": "Small",
                                        "horizontalAlignment": "Center"
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "Fair",
                                        "wrap": true,
                                        "horizontalAlignment": "Center",
                                        "spacing": "None"
                                    }
                                ],
                                "selectAction": {
                                    "type": "Action.Submit",
                                    "data": {
                                        "userResponse": "smileyFeedback",
                                        "feedbackValue": "Fair",
                                        "feedbackType": feedbackType
                                    }
                                }
                            },
                            {
                                "type": "Column",
                                "width": "auto",
                                "items": [
                                    {
                                        "type": "Image",
                                        "url": "https://image.flaticon.com/icons/png/512/42/42877.png",
                                        "size": "Small",
                                        "horizontalAlignment": "Center"
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "Good",
                                        "wrap": true,
                                        "horizontalAlignment": "Center",
                                        "spacing": "None"
                                    }
                                ],
                                "selectAction": {
                                    "type": "Action.Submit",
                                    "data": {
                                        "userResponse": "smileyFeedback",
                                        "feedbackValue": "Good",
                                        "feedbackType": feedbackType
                                    }
                                }
                            },
                            {
                                "type": "Column",
                                "width": "auto",
                                "items": [
                                    {
                                        "type": "Image",
                                        "url": "https://icons.iconarchive.com/icons/iconsmind/outline/512/Laughing-icon.png",
                                        "size": "Small",
                                        "horizontalAlignment": "Center"
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "Excellent",
                                        "wrap": true,
                                        "horizontalAlignment": "Center",
                                        "spacing": "None"
                                    }
                                ],
                                "selectAction": {
                                    "type": "Action.Submit",
                                    "data": {
                                        "userResponse": "smileyFeedback",
                                        "feedbackValue": "Excellent",
                                        "feedbackType": feedbackType
                                    }
                                }
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
}

module.exports.convoHistoryCard = (history, userId, count) => {
    if (history.length > 0) {
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
                                    "text": "User Conversation History",
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
        let length = history.length > 15 ? 15 : history.length
        for (let i = 0; i < length; i++) {
            if (history[i].includes("User")) {
                card["body"].push({
                    "type": "ColumnSet",
                    "columns": [
                        {
                            "type": "Column",
                            "width": "stretch",
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "text": history[i],
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
                    "columns": [
                        {
                            "type": "Column",
                            "width": "stretch",
                            "items": [
                                {
                                    "type": "TextBlock",
                                    "text": history[i],
                                    "wrap": true,
                                    "horizontalAlignment": "Left"
                                }
                            ]
                        }
                    ]
                })

            }

        }
        if (history.length > 15) {
            card["actions"].push({
                "type": "Action.Submit",
                "title": "Show More Conversation",
                "data": {
                    "agentResponse": "showMore",
                    "count": count,
                    "userConvo": userId
                }
            })

        }
        return card;
    }
}

module.exports.userProfileDetailCard = {
    "type": "AdaptiveCard",
    "body": [
        {
            "type": "Container",
            "items": [
                {
                    "type": "Container",
                    "items": [
                        {
                            "type": "TextBlock",
                            "text": "Welcome to Online Store Chat",
                            "wrap": true,
                            "horizontalAlignment": "Center",
                            "weight": "Bolder"
                        }
                    ],
                    "style": "warning",
                    "bleed": true
                }
            ]
        },
        {
            "type": "TextBlock",
            "text": "Please Enter Your Detail:",
            "wrap": true,
            "weight": "Bolder"
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
                            "text": "First Name",
                            "wrap": true,
                            "fontType": "Default"
                        }
                    ]
                },
                {
                    "type": "Column",
                    "width": "stretch",
                    "items": [
                        {
                            "type": "Input.Text",
                            "placeholder": "Enter your First Name",
                            "id": "firstName"
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
                            "text": "Last Name",
                            "wrap": true,
                            "fontType": "Default"
                        }
                    ]
                },
                {
                    "type": "Column",
                    "width": "stretch",
                    "items": [
                        {
                            "type": "Input.Text",
                            "placeholder": "Enter your Last Name",
                            "id": "lastName"
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
                            "text": "Email Id",
                            "wrap": true
                        }
                    ]
                },
                {
                    "type": "Column",
                    "width": "stretch",
                    "items": [
                        {
                            "type": "Input.Text",
                            "placeholder": "Enter your E-mail.",
                            "id": "email"
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
                            "text": "Mobile No.",
                            "wrap": true
                        }
                    ]
                },
                {
                    "type": "Column",
                    "width": "stretch",
                    "items": [
                        {
                            "type": "Input.Text",
                            "placeholder": "Enter your Mobile No.",
                            "id": "phone",
                            "style": "Tel"
                        }
                    ]
                }
            ]
        },
        {
            "type": "ActionSet",
            "actions": [
                {
                    "type": "Action.Submit",
                    "title": "Submit",
                    "data": {
                        "userResponse": "profileDetail"
                    }
                }
            ]
        }
    ],
    "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
    "version": "1.2"
}
