if(typeof alert == 'undefined'){
  alert = console.log;
}

var errors = [],
defer;

function test(code, asts){
  clearTimeout(defer);
  var run,
  cnt = 0,
  ast = function(res){
    if(!res){
      errors.push('Assertion failed: ' + asts[cnt]);
    }
    cnt++;
  };
  if(code instanceof Array){
    code = code.join('\n');
  }
  try{
    run = new Function('ast', code + '\n\nast(' + asts.join(')\nast(') + ')\n');
  }catch(e){
    errors.push('Parsing failed: ' + e + '\n' + code);
  }
  if(run){
    try{
      run(ast);
    }catch(e){
      errors.push('Evaluation failed: ' + e + '\n' + code);
    }
  }
  defer = setTimeout(function(){
    alert('Buffer backend: ' + Buffer.backend + '\n\n' +
          (errors.length ?
           ('Something went wrong...\n\n' + errors.join('\n\n')) :
           'All tests passed...'));
  }, 100);
}
