const mosca = require('mosca');
const ascoltatori = require('ascoltatori');
const HashMap = require('hashmap');
const callsMap = new HashMap();
const devicePendingMessages = new HashMap();
const User = require('./models/user');
const Calls = require('./models/call');
const Device = require('./models/device');
const dbConfig = require('./config/database');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;

mongoose.connect(dbConfig.database);

//TODO in future whole logic should be moved from app.js

//mongodb://heroku_user:ciheroku@ds141068.mlab.com:41068/intercom

var ascoltatore = {
    //using ascoltatore
    type: 'mongo',
    url: 'mongodb://heroku_user:ciheroku@ds141068.mlab.com:41068/intercom',
    pubsubCollection: 'ascoltatori',
    mongo: {}
};

var settings = {
    http: {
        port: 5080,
        bundle: true,
        static: './'
    },
    port: 5083,
    backend: ascoltatore
};

var server = new mosca.Server(settings);

server.on('clientConnected', async function (client) {
    console.log('client connected', client.id);
    let device = await Device.findOne({"deviceId": client.id}).populate("user").exec().catch(err => err);
    client.userId = device.user.username;
});

// fired when a message is received
server.on('published', async function (packet, client) {
    console.log('Published', packet.topic);
    try {
        console.log('PublishedDATA', JSON.parse(packet.payload));
    }
    catch (err) {
        console.log('PublishedDATA', packet.payload);
    }
    let topics = packet.topic.split("/");
    switch (topics[0]) {
        case "calls":
            let message = JSON.parse(packet.payload);

            let call;
            if (message.messageType !== "callnew") {
                try {
                    call = await Calls.findOne({callId: message.callId}).exec();
                }
                catch (err) {
                    console.log("Error");
                    return;
                }
            }

            if (topics[1] === "ongoing") {
                handelOngoingCallEvent(packet, client, message, call);
            } else if (topics[1] === "server") {
                handelGeneralCallEvent(packet, client, message, call);
            }
            break;
    }
});

server.on('ready', setup);

function sendPendingCallIfExist(devideId) {


}

async function handelOngoingCallEvent(packet, client, message, call) {
    switch (message.callEvent) {
        case "answer":
            //MAYBE WE CAN MAKE TOPIC FOR PRE_CALL_ESTABLISHMENT EVENTS SO WE WILL NOT MAKE FOR LOOP and it has other adavantages
            call.status = "connected";
            call.answeredDeviceId = client.id;
            await call.save().catch(err => err);
            for (let i = 0; i < call.remoteUserIds.length; i++) {
                let callAnsweredMessage = getCallAnsweredMessage(message.callId, call.remoteUserIds[i]);
                server.publish(callAnsweredMessage);
            }
            break;
        case "hangup":
            call.status = "terminated";
            await call.save().catch(err => err);
            break;
        case "invite":
            break;
    }
}

async function handelGeneralCallEvent(packet, client, message, call) {
    //first topic item is "calls"

    switch (message.messageType) {
        //calls/general/*
        case "callnew":
            //FIXME callId should be generated
            let callId = message.rawCallId + "real";
            call = new Calls({
                callId: callId,
                rawCallId: message.rawCallId,
                callMakerUserId: client.userId,
                recipientUsersIds: message.remoteUserIds,
                status: 'connecting'
            });
            call.save(function (err) {
                if (err) {
                    console.log(err)
                } else {
                    console.log(`Successfully created new Call ${callId}`)
                }
            });
            let callInfoMessage = getCallInfoMessage(client.id, callId, message.rawCallId);
            server.publish(callInfoMessage);
            for (let i = 0; i < message.remoteUserIds.length; i++) {
                //FIXME client.id is device id but user id should be passed
                let inviteMessage = getInviteMessage(client.id, message.remoteUserIds[i], message.callType, callId);
                server.publish(inviteMessage);
            }
            break;

        case "calldecline":
            //if all call recipients sent decline we should notify caller
            //FIXME check if all recipients sent decline
            call.status = "terminated";
            await call.save().catch(err => err);
            let declineMessage = getDeclinedMessage(call.callerDeviceId, message.callId);
            server.publish(declineMessage);
            callsMap.delete(message.callId);
            break;
        case "callhangup":
            call.status = "terminated";
            await call.save().catch(err => err);
            for (let i = 0; i < call.remoteUserIds.length; i++) {
                let hangupMessage = getHangupMessage(message.callId, call.remoteUserIds[i]);
                server.publish(hangupMessage);
            }
            break;
    }
}



server.on('delivered', async function (packet, client) {
    await Device.findOneAndUpdate({deviceId: client.id}, {lastTimeReceivedMessage: Date.now()}, {new: true}).catch(err => err);
});

server.on("subscribed", async function (topic, client) {
    if (topic === "calls/device/" + client.id) {
        let device = await Device.findOne({deviceId: client.id}).exec().catch(err => err);
        let calls = await Calls.find().and([{status: "connecting"},
            {recipientUsersIds: client.userId},
            {lastTimeUpdated: {$gt: device.lastTimeReceivedMessage}}
        ]).exec().catch(err => err);

        calls.forEach(function (call) {
            let inviteMessage = getInviteDeviceMessage(call.callMakerUserId, client.id, "", call.callId);
            server.publish(inviteMessage);
        })
    }
});

function getMqttMessage(topic, payload) {
    return {
        topic: topic,
        payload: JSON.stringify(payload), // or a Buffer
        qos: 0, // 0, 1, or 2
        retain: false // or true
    };

}

function getCallAnsweredMessage(callId, remoteUserId) {
    return getMqttMessage(
        'calls/user/' + remoteUserId,
        {
            messageType: "callanswered",
            callId: callId
        }
    );
}

function getHangupMessage(callId, remoteUserId) {
    return getMqttMessage(
        'calls/user/' + remoteUserId,
        {
            messageType: "callhangup",
            callId: callId
        }
    );
}

function getDeclinedMessage(callerDeviceId, callId) {
    return getMqttMessage(
        'calls/device/' + callerDeviceId,
        {
            messageType: "calldecline",
            callId: callId
        }
    );
}

//Call invitation logic removed

// fired when the mqtt server is ready
function setup() {
    console.log('Mosca server is up and running');
}



