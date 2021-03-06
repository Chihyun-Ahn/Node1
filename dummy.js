var gpio = require('onoff').Gpio;
var timeGetter = require('./getTime');
const IOfan1 = new gpio(16,'out');
const IOfan2 = new gpio(20,'out');
const IOfan3 = new gpio(5,'out');
const IOwater = new gpio(6,'out');
const IOalarm = new gpio(13,'out');

const HIGH = 1;
const LOW = 0;
var exec = require('child_process').exec;

//Activate real canbus: can0
exec("sudo ip link set can0 up type can bitrate 500000", function(err, stdout, stderr){
   console.log('Activating can0...');
   console.log('stdout: '+ stdout);
   console.log('stderr: '+ stderr);
   if(err != null){
      console.log('error: '+ err);
   }else{
      console.log('Real CANBUS can0 activated.');
   }
});


var can = require('socketcan');
var sensorLib = require('node-dht-sensor');

// Parse database
var network = can.parseNetworkDescription("./node_modules/socketcan/samples/mycan_definition.kcd");
var channel = can.createRawChannel("can0");
var db = new can.DatabaseService(channel, network.buses["FarmBUS"]);
channel.start();

var ctrlElements = ['fan1', 'fan2', 'fan3', 'water', 'alarm', 'emgOutputForNeighbor'];
var ctrlData = [LOW,LOW,LOW,LOW,LOW,LOW];
var neighborDeadTimer, sendProbe;
var commState = {
   H1H2: HIGH, H1Fog: HIGH, H2Fog: HIGH
}; 

var msgNum = 0;
var edgeDepTime = 0;
var edgeDepTimeCalib = 0;

var sensor = {
   sensors: [
      {
         name: "House2Sen1",
         type: 22,
         pin: 2,
         temperature: 0,
         humidity: ""
      },
      {
         name: "House2Sen2",
         type: 22,
         pin: 3,
         temperature: 0,
         humidity: ""
      },
      {
         name: "House2Sen3",
         type: 22,
         pin: 4,
         temperature: 0,
         humidity: ""
      },
      {
         name: "House2Sen4",
         type: 22,
         pin: 17,
         temperature: 0,
         humidity: ""
      },
      {
         name: "House2Sen5",
         type: 22,
         pin: 27,
         temperature: 0,
         humidity: ""
      },
      {
         name: "House2Sen6",
         type: 22,
         pin: 22,
         temperature: 0,
         humidity: ""
      },

   ],
   read: function(){
      for (var a in  this.sensors){
         var b = sensorLib.read(this.sensors[a].type, this.sensors[a].pin);
         this.sensors[a].temperature = b.temperature.toFixed(1);
         this.sensors[a].humidity = b.humidity.toFixed(1);
      }
   }
};

//###########################################################
//########################Main func. setInterval#############

setInterval(function(){
   sensor.read();  
   putSensorData("House2");
   sendSensorData("House2");

   for(i=0;i<6;i++){
      console.log(`센서${i+1}의 온도: ${sensor.sensors[i].temperature} 습도: ${sensor.sensors[i].humidity}`);
   }

   //Control Data
   console.log('House2 fan1:'+ctrlData[0]);

   //콘트롤 데이터 확인하여, 제어출력
   IOfan1.writeSync(ctrlData.fan1);
   IOfan2.writeSync(ctrlData.fan2);
   IOfan3.writeSync(ctrlData.fan3);
   IOwater.writeSync(ctrlData.water);
   IOalarm.writeSync(ctrlData.alarm);

   getCtrlData("House2");

}, 10000);
//###########################################################
//#########################Time Sync#########################

// db.messages['timeSyncResFogH2'].signals['sigTime'].onUpdate(function(s){
   
// });

//###########################################################
//########################Resilience#########################

setNeighborDeadTimer();

// Neighbor Dead Timer function
function setNeighborDeadTimer(){
   neighborDeadTimer = setTimeout(function(){
      console.log('!!WARNING!! House1 not responding for 30s.');
      var i=1;
      db.send("AliveCheckByH2");
      console.log('Probe '+i+' has been sent.');
      sendProbe = setInterval(function(){
         i++;
         if(i<=3){
            commState.H1H2 = LOW;
            db.send('AliveCheckByH2');
            console.log('Probe '+i+' has been sent.');
         }else if(i>3 && i<6){
            commState.H1H2 = LOW;
            db.messages['H1StateByH2'].signals['state'].update(commState.H1H2);
            db.send('H1AskingByH2');
            console.log('Probe '+(i-3)+' has been sent to the Fog.');
         }else if(i>=6){
            commState.H1Fog = LOW;
            clearInterval(sendProbe);
            emergentOper("House1");
         };
      }, 10000);
   }, 30000);   
}


//심장박동
db.messages["House1Temp"].signals["temperature2"].onUpdate(function(s){
   if(commState.H1H2 == LOW){
      commState.H1H2 = HIGH;
   }
   clearTimeout(neighborDeadTimer);
   clearInterval(sendProbe);
   console.log('timer cleared.');
   setNeighborDeadTimer();
});

function emergentOper(houseName){
   var houseNum = houseName[5];
   ctrlData[5] = HIGH; //5: emergency output for neighbor house
   console.log('House'+houseNum+' is dead!! emergency motor is ON!!');
}

db.messages["AliveCheckByH1"].signals["nodeID"].onUpdate(function(){
   console.log('Edge1 sent aliveCheck. Answer is sent. ');
   db.send("AliveAnsByH2");
});

db.messages['AliveAnsByH1'].signals['nodeID'].onUpdate(function(){
   commState.H1H2 = HIGH;
   clearInterval(sendProbe);
   ctrlData[5] = LOW;
   console.log('House1 is recovered. Emergency motor is OFF');
   setNeighborDeadTimer();
});

db.messages['H1StateByFog'].signals['state'].onUpdate(function(s){
   console.log('H1StateByFog: '+s.value);
   commState.H1Fog = s.value;
   if(commState.H1Fog == HIGH){
      console.log('House1-House2 CAN communication error.');
      clearInterval(sendProbe);
   }else if(commState.H1Fog == LOW){
      console.log('House1 is in blackout.');
      clearInterval(sendProbe);
      emergentOper("House1");
   }else{
      console.log('H1StateByFog answer value wrong.');
   }
});

db.messages['H1AskingByFog'].signals['nodeID'].onUpdate(function(){
   db.messages['H1StateByH2'].signals['state'].update(commState.H1H2);
   db.send('H1StateByH2');
});

db.messages['AliveCheckH2ByFog'].signals['nodeID'].onUpdate(function(){
   console.log('Fog sent aliveCheck. Answer is sent.');
   db.send('AliveAnsToFogByH2');
});

db.messages['timeSyncReqToH2'].signals['msgNum'].onUpdate(function(s){
   var msgNumImsi = s.value;
   if(msgNum==msgNumImsi){
      var edgeReturnTime = timeGetter.nowMilli();
      var rtt = edgeReturnTime - edgeDepTime;
      var oneWayDelay = Math.round(rtt / 2.0);
      var estimatedFogArrTime = edgeDepTime+oneWayDelay;
      var fogArrTime = db.messages['timeSyncReqToH2'].signals['fogTime'].value;
      var timeDifference = estimatedFogArrTime - fogArrTime;
      edgeDepTimeCalib = edgeDepTime - timeDifference;
      db.messages['timeSyncResH2'].signals['edgeDepTimeCalib'].update(edgeDepTimeCalib);
      db.messages['timeSyncResH2'].signals['msgNum'].update(msgNum);
      db.send('timeSyncResH2');
   }
});

//###########################################################
//########################Functions to call##################

function putSensorData(houseName){
   var houseTemp = houseName + "Temp";
   var houseHumid = houseName + "Humid";
   var houseMsgNum = houseName + "MsgNum";
   var tempNameGeneral = "temperature";
   var humidNameGeneral = "humidity";
   var i;
   for(i=0;i<6;i++){
      var tempNameSpecific = tempNameGeneral + (i+1);
      var humidNameSpecific = humidNameGeneral + (i+1);
      db.messages[houseTemp].signals[tempNameSpecific].update(sensor.sensors[i].temperature*10);
      db.messages[houseHumid].signals[humidNameSpecific].update(sensor.sensors[i].humidity*10);
   }
   msgNum = parseInt(Math.random()*1000);
   db.messages[houseMsgNum].signals['msgNum'].update(msgNum);
   // console.log(houseMsgInfo + ":" + db.messages[houseMsgInfo].signals["msgTime"].value);
}

function sendSensorData(houseName){
   var rearNameVector = ["Temp", "Humid", "MsgNum"];
   var i;
   var msgName;
   for (i=0;i<3;i++){
      msgName = houseName + rearNameVector[i];
      if(i==2){
         edgeDepTime = timeGetter.nowMilli();
         console.log('edgeDepTime before adjusted: '+edgeDepTime);
      };
      db.send(msgName);
   }
}

function getCtrlData(houseName){
   var msgName = houseName + "Ctrl";
   var i;
   for (i=0;i<ctrlElements.length;i++){
      ctrlData[i] = db.messages[msgName].signals[ctrlElements[i]].value;
   }
}