// Import required packages
var appInsights = require("applicationinsights");

// setup AppInsights
appInsights.setup(process.env.appInsightsKey)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true)
    .setUseDiskRetryCaching(true)
    .setSendLiveMetrics(true)
    .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
    .start();


// send exceptions to app insights
module.exports.appInsightsClient = (name, error) => {
    try {
        appInsights.defaultClient.trackException({
            exception: new MyError(name, error)
        })
    } catch (error) {
        console.error("application insights error", error)
    }
}

//customise error type in AI
class MyError extends Error {
    constructor(errorName, error) {
        super(error)
        this.name = errorName
    }
}