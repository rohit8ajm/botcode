const schedule = require('node-schedule')
const { botConfigs } = require('../controller/UI')

let rule = new schedule.RecurrenceRule()
rule.tz = 'America/Toronto'
rule.second = 0;
rule.minute=0;
rule.hour=4;

schedule.scheduleJob(rule, async () => {
    try {
        let result = await botConfigs()
    } catch (error) {

    }
})
