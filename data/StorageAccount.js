const path = require('path');
const fileName = path.basename(__filename)
const storage = require('azure-storage');

const blobService = storage.createBlobService();

module.exports.uploadString = async (text) => {
    try {
        blobService.createBlockBlobFromText(process.env.Container, process.env.Blob, text, err => {
            if (err) {
                console.error(errorMessages.botConfigError.name, err);
                appInsightsClient("UploadBlobError", err)
                sendErrorMail(`Error occured while trying to update blob storage. ${fileName}`, err)
            }
        });
    } catch (error) {

    }

};