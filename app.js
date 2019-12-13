var gpio = require('onoff').Gpio;
const IOfan1 = new gpio(16, 'out');
const IOfan2 = new gpio(20, 'out');
const IOfan3 = new gpio(5, 'out');
const IOwater = new gpio(6, 'out');
const IOalarm = new gpio(13, 'out');
const HIGH = 1;
const LOW = 0;

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
var ctrlElements = ['fan1', 'fan2', 'fan3', 'water','alarm', 'emgOutputForNeighbor'];
var ctrlData = [LOW, LOW, LOW, LOW, LOW, LOW];
var NeighborDeadTimer;

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
        },
        {
            name: "House1Sen3",
            type: 11,
            pin: 4,
            temperature: 0,
            humidity: ""
        },
        {
            name: "House1Sen4",
            type: 11,
            pin: 17,
            temperature: 0,
            humidity: ""    
        },
        {
            name: "House1Sen5",
            type: 11,
            pin: 27,
            temperature: 0,
            humidity: ""
        },
        {
            name: "House1Sen6",
            type: 11,
            pin: 22,
            temperature: 0,
            humidity: ""    
        }
    ],
    read: function(){
        for (var a in this.sensors){
            var b = sensorLib.read(this.sensors[a].type, this.sensors[a].pin);
            this.sensors[a].temperature = b.temperature.toFixed(1);
            this.sensors[a].humidity = b.humidity.toFixed(1);
            // console.log(
            //     this.sensors[a].name + ": " +this.sensors[a].temperature + "°C, " +this.sensors[a].humidity + "%"
            // );
        }
    }
};

//Main function. Send sensor values, and get control data
setInterval(function(){
    sensor.read();
    putSensorData("House1");
    sendSensorData("House1");
    

    for(i=0;i<6;i++){
        console.log(`센서${i+1}의 온도: ${sensor.sensors[i].temperature} 습도: ${sensor.sensors[i].humidity}`);
    }

    // Control Data
    console.log('House1 fan1: '+ctrlData[0]);

    //콘트롤 데이터 확인하여, 제어출력
    IOfan1.writeSync(ctrlData.fan1);
    IOfan2.writeSync(ctrlData.fan2);
    IOfan3.writeSync(ctrlData.fan3);
    IOwater.writeSync(ctrlData.water);
    IOalarm.writeSync(ctrlData.alarm);

    getCtrlData("House1");
}, 10000);

setNeighborDeadTimer();

function setNeighborDeadTimer(){
    NeighborDeadTimer = setTimeout(function(){
        console.log('!!WARNING!!Your neighbor is not responding for 30s.');
        var i = 0;
        var sendProbe = setInterval(function(){
            db.send('AliveCheckByH1');
            console.log('Neighbor is not responding. Probe'+i+' has been sent.');
            i++;
            if(i==2){
                clearInterval(sendProbe);
                emergentOper("House2");
            }
        }, 10000);
    }, 30000);
}

//heartbeat
db.messages["House2Temp"].signals[temperature2].onUpdate(function(){
    clearTimeout(NeighborDeadTimer);
    console.log('Timer cleared.');
    setNeighborDeadTimer();
});

function emergentOper(houseName){
    var houseNum = houseName[5];
    ctrlData[5] = HIGH; //5: emergency output for neighbor house
    console.log('House'+houseNum+' is dead!! emergency motor is ON!!');
}

db.messages["AliveCheckByH2"].signals["nodeID"].onUpdate(function(){
    db.send("AliveAnsByH1");
});

db.messages["AliveAnsByH2"].signals["nodeID"].onUpdate(function(){
    clearInterval(sendProbe);
    setNeighborDeadTimer();
});

function putSensorData(houseName){
    var houseTemp = houseName + "Temp";
    var houseHumid = houseName + "Humid";
    var houseTempTime = houseName + "TempTime";
    var houseHumidTime = houseName + "HumidTime";

    var tempNameGeneral = "temperature";
    var humidNameGeneral = "humidity";
    var i;
    for(i=0;i<6;i++){
        var tempNameSpecific = tempNameGeneral + (i+1);
        var humidNameSpecific = humidNameGeneral + (i+1);
        db.messages[houseTemp].signals[tempNameSpecific].update(sensor.sensors[i].temperature);
        db.messages[houseHumid].signals[humidNameSpecific].update(sensor.sensors[i].humidity);
    }
    db.messages[houseTempTime].signals["sigTime"].update(getTimeInt());
    db.messages[houseHumidTime].signals["sigTime"].update(getTimeInt());
}

function sendSensorData(houseName){
    var rearNameVector = ["Temp","Humid","TempTime","HumidTime"];
    var i;
    for (i=0;i<4;i++){
        db.send(houseName + rearNameVector[i]);
    }
}


function getCtrlData(houseName){
    var msgName = houseName + "Ctrl";
    var i;
    for (i=0;i<5;i++){
        ctrlData[i] = db.messages[msgName].signals[ctrlElements[i]].value;
    }
}

function getTimeInt(){
    var now = new Date();
    var nowInt = now * 1;
    return nowInt;
}