function now(){
    var date = new Date();
    var hours = addZero(date.getHours());
    var mins = addZero(date.getMinutes());
    var secs = addZero(date.getSeconds());
    var millis = addZeroMilli(date.getMilliseconds());
    var timeSum = hours+mins+secs+millis;
    return timeSum;
}

function nowMilli(){
    var date = new Date();
    var h = date.getHours()*3600000;
    var m = date.getMinutes()*60000;
    var s = date.getSeconds()*1000;
    var mi = date.getMilliseconds();
    result = h+m+s+mi;
    return result;
}

function addZero(num){
    var result = (num<10)?("0"+num):(""+num);
    return result;
};

function addZeroMilli(num){
    var result;
    if(num<10){
        result = "00"+num;
    }else if(num >=10 && num<100){
        result = "0"+num;
    }else if(num>=100 && num<1000){
        result = ""+num;
    }else{
        console.log('addZeroMilli: Input value is invalid.');
        return;
    }
    return result;
}

function convertToMilli(time){
    var hour = parseInt(time.substr(0,2));
    var min = parseInt(time.substr(2,2));
    var sec = parseInt(time.substr(4,2));
    var milsec = parseInt(time.substr(6,3));

    var hourToMilli = hour*60*60*1000;
    var minToMilli = min*60*1000;
    var secToMilli = sec*1000;

    var result = hourToMilli+minToMilli+secToMilli+milsec;
    return result;
}

function millToTime(miltime){
    var imsi;
    var hour = parseInt(miltime/3600000);
    imsi = miltime%3600000;
    var min = parseInt(imsi/60000);
    imsi = imsi%60000;
    var sec = parseInt(imsi/1000);
    imsi = imsi%1000;
    var milli = imsi;
    var result = addZero(hour)+addZero(min)+addZero(sec)+addZeroMilli(milli);
    return result;
}

module.exports = {
    now: now,
    nowMilli: nowMilli,
    convertToMilli: convertToMilli,
    millToTime: millToTime
}