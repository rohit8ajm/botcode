var request = require('request')
const dbQuery = require('./dbQuery')
function getToken() {
    return new Promise((resolve, reject) => {
        try {
            var options = {
                'method': 'GET',
                'url': process.env.getTokenURL,
                'headers': {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                form: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Grant_type': process.env.grantType,
                    'resource': process.env.resourceURL,
                    'client_id': process.env.clientId,
                    'client_secret': process.env.clientSecret
                }
            };
            request(options, function (error, response) {
                if (error) {
                    console.error(error);
                    reject(error)
                } else {
                    resolve(JSON.parse(response.body).access_token)
                }
            });

        } catch (error) {
            console.error("get token", error);
        }
    })
}

module.exports.getConfigDetails = () => {
    return new Promise((resolve, reject) => {
        try {
            getToken().then(token => {
                var options = {
                    'method': 'GET',
                    'url': `${process.env.apiBaseURL}cr386_botconfigses?$select=cr386_key,cr386_value`,
                    'headers': {
                        'Authorization': `Bearer ${token}`
                    }
                };
                request(options, function (error, response) {
                    if (error) {
                        console.error(error);
                        reject(error)
                    } else {
                        resolve(JSON.parse(response.body).value)
                    }
                });
            })
        } catch (error) {
            console.error("get config", error);
        }
    })
}


module.exports.getAvailableAgents = (email) => {
    return new Promise((resolve, reject) => {
        try {
            getToken().then(token => {

                let options = {
                    'method': 'GET',
                    'url': `${process.env.apiBaseURL}systemusers?$select=systemuserid,fullname&$filter=domainname eq '${email}'`,
                    'headers': {
                        'Authorization': `Bearer ${token}`
                    }
                };
                request(options, function (error, response) {
                    if (error) {
                        console.error(error);
                        reject(error)
                    } else {
                        if (JSON.parse(response.body).value.length > 0) {
                            let fullname = JSON.parse(response.body).value[0].fullname
                            let options = {
                                'method': 'GET',
                                'url': `${process.env.apiBaseURL}cr386_agentinfos?$select=cr386_agentinfoid,_cr386_agentnames_value&$filter=cr386_availabilitystatus eq 441020000 and cr386_utilizationstatus eq 441020000 and cr386_isrequestsent eq false and cr386_livestatus eq 441020000 and (cr386_classificationstatus eq 441020000 or cr386_classificationstatus eq 441020001) and _cr386_agentnames_value eq '${JSON.parse(response.body).value[0].systemuserid}'`,
                                'headers': {
                                    'Authorization': `Bearer ${token}`
                                }
                            };
                            request(options, function (error, response) {
                                if (error) {
                                    console.error(error);
                                    reject(error)
                                } else {
                                    let agentExists = JSON.parse(response.body).value.length > 0 ? "Yes" : "No"
                                    resolve({
                                        "email": email,
                                        "fullname": fullname
                                    })

                                }
                            });
                        } else {
                            resolve({
                                "email": "user",
                                "fullname": "user"
                            })
                        }

                    }
                });
            })
        } catch (error) {
            console.error(error);
        }
    })
}

module.exports.checkAgentTime = (timeDetails) => {
    return new Promise(async (resolve, reject) => {
        try {
            let checkHoliday = await this.checkHoliday();
            if (checkHoliday.isHoliday) {
                for (let i = 0; i < timeDetails.length; i++) {
                    if (timeDetails[i].cr386_key === "HolidayHeaderMessage") {
                        resolve({
                            "time": "holiday",
                            "message": `${timeDetails[i].cr386_value} ${checkHoliday.message}.`
                        })
                        break;
                    }
                }
            }
            else {
                let estTime = new Date().toLocaleTimeString("en-us", { timeZone: "America/New_York" });
                let date = new Date().toLocaleDateString("en-us", { timeZone: "America/New_York" })
                estTime = Date.parse(`${date} ${estTime}`)
                let weekDay = new Date().getDay("en-us", { timeZone: "America/New_York" });
                let startTime, endTime, satStartTime, satEndTime, sunStartTime, sunEndTime, lunchTime, satLunchTime, sunLunchTime, isLunchTime,
                    lunchTimeMessage, offHourMessage, tempStTime, tempSatStTime, tempSunStTime;
                timeDetails.forEach(element => {
                    if (element.cr386_key === "StartTime") {
                        tempStTime = element.cr386_value
                        startTime = element.cr386_value
                        startTime = Date.parse(`${date} ${startTime}`)
                    } else if (element.cr386_key === "EndTime") {
                        endTime = element.cr386_value
                        endTime = Date.parse(`${date} ${endTime}`)
                    } else if (element.cr386_key === "SaturdayStartTime") {
                        tempSatStTime = element.cr386_value
                        satStartTime = element.cr386_value
                        satStartTime = Date.parse(`${date} ${satStartTime}`)
                    } else if (element.cr386_key === "SaturdayEndTime") {
                        satEndTime = element.cr386_value
                        satEndTime = Date.parse(`${date} ${satEndTime}`)
                    } else if (element.cr386_key === "SundayStartTime") {
                        tempSunStTime = element.cr386_value
                        sunStartTime = element.cr386_value
                        sunStartTime = Date.parse(`${date} ${sunStartTime}`)
                    } else if (element.cr386_key === "SundayEndTime") {
                        sunEndTime = element.cr386_value
                        sunEndTime = Date.parse(`${date} ${sunEndTime}`)
                    } else if (element.cr386_key === "LunchTime") {
                        lunchTime = element.cr386_value
                        lunchTime = Date.parse(`${date} ${lunchTime}`)
                    } else if (element.cr386_key === "SaturdayLunchTime") {
                        satLunchTime = element.cr386_value
                        satLunchTime = Date.parse(`${date} ${satLunchTime}`)
                    } else if (element.cr386_key === "SundayLunchTime") {
                        sunLunchTime = element.cr386_value
                        sunLunchTime = Date.parse(`${date} ${sunLunchTime}`)
                    } else if (element.cr386_key === "IsLunchTimeStatic") {
                        isLunchTime = element.cr386_value
                        // isLunchTime = Date.parse(`${date} ${isLunchTime}`)
                    } else if (element.cr386_key === "LunchTimeMessage") {
                        lunchTimeMessage = element.cr386_value
                    } else if (element.cr386_key === "AgentOffHourMessageToUser") {
                        offHourMessage = element.cr386_value
                    }
                });
                //////monday to friday logic
                if (weekDay >= 1 && weekDay <= 5) {
                    if (estTime >= startTime && estTime <= endTime) {
                        if (isLunchTime && (estTime >= lunchTime && estTime <= lunchTime + 3600000)) {
                            resolve({
                                "time": "lunch",
                                "message": lunchTimeMessage
                            })
                        } else {
                            resolve({
                                "time": "working",
                                "message": "working"
                            })
                        }
                    } else {
                        resolve({
                            "time": "offHour",
                            "message": `${offHourMessage} ${tempStTime} EST`
                        })
                    }
                }
                //////saturday logic 
                else if (weekDay === 6) {
                    if (estTime >= satStartTime && estTime <= satEndTime) {
                        if (isLunchTime && (estTime >= satLunchTime && estTime <= satLunchTime + 3600000)) {
                            resolve({
                                "time": "lunch",
                                "message": lunchTimeMessage
                            })
                        } else {
                            resolve({
                                "time": "working",
                                "message": "working"
                            })
                        }
                    } else {
                        resolve({
                            "time": "offHour",
                            "message": `${offHourMessage} ${tempSatStTime} EST`
                        })
                    }
                }
                //////sunday logic
                else if (weekDay === 0) {
                    if (estTime >= sunStartTime && estTime <= sunEndTime) {
                        if (isLunchTime && (estTime >= sunLunchTime && estTime <= sunLunchTime + 3600000)) {
                            resolve({
                                "time": "lunch",
                                "message": lunchTimeMessage
                            })
                        } else {
                            resolve({
                                "time": "working",
                                "message": "working"
                            })
                        }
                    } else {
                        resolve({
                            "time": "offHour",
                            "message": `${offHourMessage} ${tempSunStTime} EST`
                        })
                    }
                }
            }
        } catch (error) {
            console.error(error);
            resolve("dfw")
        }
    })
}

module.exports.checkHoliday = () => {
    return new Promise((resolve, reject) => {
        try {
            getToken().then(token => {
                var options = {
                    'method': 'GET',
                    'url': `${process.env.apiBaseURL}cr386_agentholidayses?$select=cr386_holidaydate,cr386_holidayname&$filter=cr386_holidaydate eq ${new Date().toISOString().slice(0, 10)}`,
                    'headers': {
                        'Authorization': `Bearer ${token}`
                    }
                };
                request(options, function (error, response) {
                    if (error) {
                        console.error(error);
                        reject(error)
                    } else {
                        if (JSON.parse(response.body).value.length > 0) {
                            resolve({
                                "isHoliday": true,
                                "message": JSON.parse(response.body).value[0].cr386_holidayname
                            })
                        } else {
                            resolve({
                                "isHoliday": false,
                                "message": "no holiday"
                            })
                        }
                    }
                });
            })
        } catch (error) {
            console.error(error);
        }
    })
}

module.exports.getQuickReplies = () => {
    return new Promise((resolve, reject) => {
        try {
            getToken().then(token => {
                var options = {
                    'method': 'GET',
                    'url': `${process.env.apiBaseURL}cr386_botquickreplieses?$select=cr386_msg`,
                    'headers': {
                        'Authorization': `Bearer ${token}`
                    }
                };
                request(options, function (error, response) {
                    if (error) {
                        console.error(error);
                        reject(error)
                    } else {
                        resolve(JSON.parse(response.body).value)
                    }
                });
            })
        } catch (error) {
            console.error("get config", error);
        }
    })
}


module.exports.getUserGuid = (mail) => {
    return new Promise((resolve, reject) => {
        try {
            getToken().then(token => {
                var options = {
                    'method': 'GET',
                    'url': `${process.env.apiBaseURL}systemusers?$select=domainname,mobilephone,systemuserid&$filter=domainname eq '${mail}'`,
                    'headers': {
                        'Authorization': `Bearer ${token}`
                    }
                };
                request(options, function (error, response) {
                    if (error) {
                        console.error(error);
                        reject(error)
                    } else {
                        resolve(JSON.parse(response.body).value)
                    }
                });
            })
        } catch (error) {
            console.error("get config", error);
        }
    })
}


module.exports.getAgentGuid = (userGuid) => {
    return new Promise((resolve, reject) => {
        try {
            getToken().then(token => {
                var options = {
                    'method': 'GET',
                    'url': `${process.env.apiBaseURL}cr386_agentinfos?$select=cr386_agentinfoid&$filter=_cr386_agentnames_value eq ${userGuid}`,
                    'headers': {
                        'Authorization': `Bearer ${token}`
                    }
                };
                request(options, function (error, response) {
                    if (error) {
                        console.error(error);
                        reject(error)
                    } else {
                        resolve(JSON.parse(response.body).value)
                    }
                });
            })
        } catch (error) {
            console.error("get config", error);
        }
    })
}

module.exports.setDropDown = (agentGuid, body) => {
    return new Promise((resolve, reject) => {
        try {
            getToken().then(token => {
                var request = require('request');
                var options = {
                    'method': 'PATCH',
                    'url': `${process.env.apiBaseURL}cr386_agentinfos(${agentGuid})`,
                    'headers': {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(body)
                };
                request(options, function (error, response) {
                    if (error) throw new Error(error);
                    resolve(response.body)
                });
            })
        } catch (error) {
            console.error("get config", error);
        }
    })
}

module.exports.getUserDetails = (email) => {
    return new Promise((resolve, reject) => {
        try {
            var options = {
                'method': 'GET',
                'rejectUnauthorized': false,
                'url': `https://oktapreview.benjaminmoore.com/api/v1/users?q=${email}`,
                'headers': {
                    'Authorization': process.env.oktaToken
                }
            };
            request(options, async function (error, response) {
                if (error) {
                    console.error(error);
                    resolve();
                }
                else {
                    let data = JSON.parse(response.body)
                    if (data.length > 0) {
                        await dbQuery.userProfileDetail({
                            "ProfileSource": "OktaAPI",
                            "Email": data[0].profile.email,
                            "FirstName": data[0].profile.firstName,
                            "LastName": data[0].profile.lastName,
                            "phone": data[0].profile.mobilePhone,
                        })
                        resolve(`${data[0].profile.firstName} ${data[0].profile.lastName}`)
                    } else {
                        resolve("no user")
                    }
                }
            });
        } catch (error) {
            console.error(error);
        }
    })
}