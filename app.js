var exec = require('child_process').exec;

// Activate real canbus: can0
exec("sudo ip link set can0 up type can bitrate 500000", function(err, stdout, stderr){
    console.log('Activating can0... ');
    console.log('stdout: '+ stdout);
    console.log('stderr: '+ stderr);
    if(err != null){
        console.log('error: '+ err);
    }else{
        console.log('Real CANBUS can0 activated.');
    }
});

var can = require('socketcan');
const math = require('math');

// var fs = require('fs');
var sensorLib = require('node-dht-sensor');

// Parse database
var network = can.parseNetworkDescription("./node_modules/socketcan/samples/mycan_definition.kcd");
var channel = can.createRawChannel("can0");
var db = new can.DatabaseService(channel, network.buses["FarmBUS"]);
channel.start();
var ctrlData = {
    fan1: 0, 
    fan2: 0,
    fan3: 0, 
    water: 0, 
    alarm: 0
};

var sensor = {
    sensors : [
        {
            name: "House1Sen1",
            type: 11,
            pin: 2,
            temperature: 0,
            humidity: ""
        },
        {
            name: "House1Sen2",
            type: 11,
            pin: 3,
            temperature: 0,
            humidity: ""    
        }
    ],
    read: function(){
        for (var a in this.sensors){
            var b = sensorLib.read(this.sensors[a].type, this.sensors[a].pin);
            this.sensors[a].temperature = b.temperature.toFixed(1);
            this.sensors[a].humidity = b.humidity.toFixed(1);
            console.log(
                this.sensors[a].name + ": " +this.sensors[a].temperature + "°C, " +this.sensors[a].humidity + "%"
            );
        }
    }
};

//Main function. Send sensor values, and get control data
setInterval(function(){
    sensor.read();
    var sensorData = {
        temperature1 : 0,
        temperature2 : 0,
        humidity1: "",
        humidity2: "",
        sigTime: ""
    };

    sensorData.temperature1 = sensor.sensors[0].temperature;
    sensorData.temperature2 = sensor.sensors[1].temperature;
    sensorData.humidity1    = sensor.sensors[0].humidity;
    sensorData.humidity2    = sensor.sensors[1].humidity;
    sensorData.sigTime      = getTimeInt();
    console.log('house1 humid2:'+sensorData.humidity2);
    // console.log(sensorData.sigTime);

    db.messages["House1Stat"].signals["temperature1"].update(sensorData.temperature1);
    db.messages["House1Stat"].signals["temperature2"].update(sensorData.temperature2);
    db.messages["House1Stat"].signals["humidity1"].update(sensorData.humidity1);
    db.messages["House1Stat"].signals["humidity2"].update(sensorData.humidity2);
    db.messages["House1Stat"].signals["sigTime"].update(sensorData.sigTime);
    
    // Trigger sending this message
    db.send("House1Stat");

    // Control Data
    console.log(ctrlData.fan1);
}, 10000);

db.messages["House1Ctrl"].signals["fan1"].onUpdate(function(s){
    ctrlData.fan1 = s.value;
    console.log('fan1 State: '+ctrlData.fan1);
});
db.messages["House1Ctrl"].signals["fan2"].onUpdate(function(s){
    ctrlData.fan2 = s.value;
});
db.messages["House1Ctrl"].signals["fan3"].onUpdate(function(s){
    ctrlData.fan3 = s.value;
});
db.messages["House1Ctrl"].signals["water"].onUpdate(function(s){
    ctrlData.water = s.value;
});
db.messages["House1Ctrl"].signals["alarm"].onUpdate(function(s){
    ctrlData.alarm = s.value;
});

function getTimeInt(){
    var now = new Date();
    var nowInt = math.floor(now/1000);
    return nowInt;
}