let mongoose = require('mongoose');
let Schema = mongoose.Schema;

let DeviceSchema = new Schema({

    deviceId: {
        type: String,
        required: true
    },
    pushToken: {
        type: String
    },
    lastTimeReceivedMessage:{
        type:Date
    },
    //TODO check performance string over number, this field can be number, if there is performance differences
    deviceType: {
        type: String
    },
    isMqttConnected: {
        type: Boolean
    },
    user: {
        type: Schema.Types.ObjectId,
        ref: "User"
    }
});

module.exports = mongoose.model('Device', DeviceSchema);