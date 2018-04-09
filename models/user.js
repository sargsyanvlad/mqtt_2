let mongoose = require('mongoose');
let Schema = mongoose.Schema;

//users schema
let UserSchema = new Schema({
    created: {
        type: Date,
        default: Date.now
    },
    name: {
        firstName: String,
        lastName: String,
        fullName: String
    },
    username: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        default: 'user',
        type: String, //we can consider using array of strings as in case user has several roles at the same time
    },
    devices:
        [
            {
                type: Schema.Types.ObjectId,
                ref: "Device"
            }
        ]
});

module.exports = mongoose.model('User', UserSchema);