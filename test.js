let result = 0;
function add(x,y){
    return x + y;
}
function getResult(callback){
    setTimeout(function(){
        result = add(first, second);
        console.log(result);
        callback();
    }, 2000);
}

getResult(function(){
    first = 20;
});