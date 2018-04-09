let mongoose = require('mongoose');
let Schema = mongoose.Schema;

let callSchema = new Schema({
    callId: {
        type: String,
        required: true
    },
    rawCallId: {
        type: String,
        required: true
    },
    callMakerUserId: {
        type: String,
        required: true
    },
    recipientUsersIds: {
        type: String,
        required: true
    },
    recipientDeviceId: {
        type: String,
    },
    status: {
        type: String
    },
    lastTimeUpdated: {
        type: Date,
        default: Date.now,
    }
});

callSchema.pre('update', function (next) {
    "use strict";
    let call = this;
    if (this.isModified() || this.isNew) {
        call.lastTimeUpdated = Date.now();
    }
    next();
});

module.exports = mongoose.model('Call', callSchema);