const userApi = require('./bots/API')
var jwt = require('jsonwebtoken')
var jwts = require('jwt-simple');

module.exports.getToken = (req, res, next) => {
    try {
        var payload = req.body.password;
        var secret = 'fe1a1915a379f3be5394b64d14794932';
        var decode = jwts.decode(payload, secret);
        const user = { userId: "test", password: "test" };
        if (decode.trim() === user.password.trim()) {
            const token = jwt.sign(req.body, 'my_secret_key')
            res.json({
                token: token
            })
        }
        else {
            res.send(401)
        }
    } catch (error) {
        res.send(500)
        console.error(error);
    }
}

module.exports.getUserConfigs = (req, res, next) => {
    try {
        const bearerheader = req.headers['authorization']
        if (bearerheader === undefined) {
            res.send(401)
        }
        const bearer = bearerheader.split(" ");
        const bearerToken = bearer[1]
        req.token = bearerToken;
        jwt.verify(req.token, 'my_secret_key', function (err, data) {
            if (err) {
                res.send(401)
            } else {
                const key = req.query()
                var parameters = key.split('&');
                var params = []
                parameters.forEach(par => {
                    var test = par.split('=')
                    params.push(test)
                })
                let data = []
                userApi.getConfigDetails().then(response => {
                    response.forEach(element => {
                        params.forEach(ele => {
                            if (element.cr386_key === ele[1]) {
                                var test = {
                                    key: element.cr386_key,
                                    value: element.cr386_value
                                }
                                data.push(test)
                            }
                        })
                    });
                    res.json({
                        data
                    })
                })

            }
        })
    } catch (error) {
        res.send(500)
        console.error(error);
    }
}

module.exports.getAgentConfigs = (req, res, next) => {
    try {
        const bearerheader = req.headers['authorization']
        if (bearerheader === undefined) {
            res.send(401)
        }
        const bearer = bearerheader.split(" ");
        const bearerToken = bearer[1]
        req.token = bearerToken;
        jwt.verify(req.token, 'my_secret_key', function (err, data) {
            if (err) {
                res.send(401)
            } else {
                const key = req.query()
                var parameters = key.split('&');
                var params = []
                parameters.forEach(par => {
                    var test = par.split('=')
                    params.push(test)
                })
                let data = []
                userApi.getConfigDetails().then(response => {
                    response.forEach(element => {
                        params.forEach(ele => {
                            if (element.cr386_key === ele[1]) {
                                var test = {
                                    key: element.cr386_key,
                                    value: element.cr386_value
                                }
                                data.push(test)
                            }
                        })
                    });
                    res.json({
                        data
                    })
                })
            }
        })
    } catch (error) {
        res.send(500)
        console.error(error);
    }
}


module.exports.getQuickReplies = (req, res, next) => {
    try {
        const bearerheader = req.headers['authorization']
        if (bearerheader === undefined) {
            res.send(401)
        }
        const bearer = bearerheader.split(" ");
        const bearerToken = bearer[1]
        req.token = bearerToken;
        jwt.verify(req.token, 'my_secret_key', function (err, data) {
            if (err) {
                res.send(401)
            } else {
                userApi.getQuickReplies().then(response => {
                    res.json({
                        response
                    })
                });
            }
        })
    } catch (error) {
        res.send(500)
        console.error(error);
    }
}


module.exports.getUserGuid = (req, res, next) => {
    try {
        const bearerheader = req.headers['authorization']
        if (bearerheader === undefined) {
            res.send(401)
        }
        const bearer = bearerheader.split(" ");
        const bearerToken = bearer[1]
        req.token = bearerToken;
        jwt.verify(req.token, 'my_secret_key', function (err, data) {
            if (err) {
                res.send(401)
            } else {
                var mail = req.query().split("=")
                userApi.getUserGuid(mail[1]).then(response => {
                    res.json({
                        response
                    })
                })
            }
        })
    } catch (error) {
        res.send(500)
        console.error(error);
    }
}

module.exports.getAgentGuid = (req, res, next) => {
    try {
        const bearerheader = req.headers['authorization']
        if (bearerheader === undefined) {
            res.send(401)
        }
        const bearer = bearerheader.split(" ");
        const bearerToken = bearer[1]
        req.token = bearerToken;
        jwt.verify(req.token, 'my_secret_key', function (err, data) {
            if (err) {
                res.send(401)
            } else {
                var userGuid = req.query().split("=")
                userApi.getAgentGuid(userGuid[1]).then(response => {
                    res.json({
                        response
                    })
                })
            }
        })
    } catch (error) {
        res.send(500)
        console.error(error);
    }
}


module.exports.setDropDown = (req, res, next) => {
    try {
        const bearerheader = req.headers['authorization']
        if (bearerheader === undefined) {
            res.send(401)
        }
        const bearer = bearerheader.split(" ");
        const bearerToken = bearer[1]
        req.token = bearerToken;
        jwt.verify(req.token, 'my_secret_key', function (err, data) {
            if (err) {
                res.send(401)
            } else {
                var agentGuid = req.query().split("=")
                userApi.setDropDown(agentGuid[1], req.body).then(response => {
                    res.json({
                        response
                    })
                })
            }
        })
    } catch (error) {
        res.send(500)
        console.error(error);
    }
}

// module.exports = router;