var nodeoutlook = require('nodejs-nodemailer-outlook');
const { botConfigValues } = require('../config/Config');

module.exports.sendErrorMail = (subject, body) => {
    try {
        let mailTo = process.env.mailTo.split(",")
        nodeoutlook.sendEmail({
            auth: {
                user: process.env.mailFrom,
                pass: process.env.mailPass
            },
            from: process.env.mailFrom,
            to: mailTo,
            subject: `${process.env.Environment} environment - ${subject}`,
            html: body,
            onError: (e) => console.log("outlook error", e),
            onSuccess: (i) => console.log("outlook success", subject)
        });
    } catch (error) {
        console.error(error);
    }
}

module.exports.sendContactMail = (mailTo, name, email, preferredMethod, phone, helpWith, question) => {
    try {
        nodeoutlook.sendEmail({
            auth: {
                user: process.env.mailFrom,
                pass: process.env.mailPass
            },
            from: process.env.mailFrom,
            to: mailTo,
            subject: botConfigValues.valueFromDatabase.contactMailSubject.replace(botConfigValues.staticTexts.replaceParam, helpWith),
            html: `<style>td { border: 1px solid black; padding: 8px; }</style><table style="border-collapse: collapse;"><tr><td><b>Name</b></td><td>${name}</td></tr><tr><td><b>Email Address</b></td><td>${email}</td></tr><tr><td><b>Preferred Method of Contact</b></td><td>${preferredMethod}</td></tr><tr><td><b>Phone Number</b></td><td>${phone}</td></tr><tr><td><b>What do you need help with</b></td><td>${helpWith}</td></tr><tr><td><b>Question</b></td><td>${question}</td></tr></table>`,
            onError: (e) => console.log("outlook error", e),
            onSuccess: (i) => console.log("outlook success", subject)
        });
    } catch (error) {
        console.error(error);
    }
}

