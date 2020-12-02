const { resolve } = require('path');
var request = require('request')
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
                        }else{
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

module.exports.checkAgentTime = () =>{
    return new Promise((resolve, reject)=>{
        try {
            
        } catch (error) {
            console.error(error);
        }
    })
}
