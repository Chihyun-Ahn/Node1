var exec = require('child_process').exec;

exec("sudo ip link set can0 up type can bitrate 500000", function(err, stdout, stderr){
    console.log('stdout: \n'+ stdout);
    console.log('stderr: '+ stderr);
    if(err != null){
        console.log('error: '+ err);
    }
});