const math = require('math');
var now = new Date();
var timezone = 9; //Korea is 9 hours faster than Britain. 
console.log(now);
var nowInt = math.floor(now / 1000);
console.log(nowInt);
var nowIntKorea = nowInt + 9*60*60;
console.log(nowIntKorea);
console.log(new Date(nowIntKorea * 1000));

// function aaaa(now, timezone){
//     var britainTime = math.floor(now / 1000);
//     var koreaTime   = britainTime + timezone*60*1000;
//     var nowKorea = new Date(koreaTime*1000);
//     console.log('Britain: ' +now);
//     console.log('Korea: ' +nowKorea);
// }

// aaaa(now, timezone);