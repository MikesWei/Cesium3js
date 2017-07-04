document = {
  createElement: function(){
    throw 'INVALID_CHARACTER_ERR: ';
  }
};

var b64 = require('../base64');

function gen(){
  var arr = new Array(Math.floor(Math.random()*1000)),
  i = 0;
  for(; i < arr.length; ){
    arr[i++] = String.fromCharCode(Math.floor(Math.random()*256));
  }
  return arr.join('');
}

function s2a(s){
  var r = [],
  i = 0;
  for(; i < s.length; r.push(s.charCodeAt(i++)));
  return '[' + r.join(',') + ']';
}

function a2s(a){
  var s = '',
  i = 0;
  for(; i < a.length; s += String.fromCharCode(a[i++]));
  return s;
}

for(var i = 0; i < 10000; i++){
  var s = gen(),
  b = b64.btoa(s),
  d = b64.atob(b);
  if(s != d){
    throw new Error(b + ' ' + s2a(s) + '!=' + s2a(d));
  }
}
