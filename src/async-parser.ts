let path = require('path');
let bolt = require('./rules-parser');
let fs = require('fs');

/*
  Async file parser for split file systems
  Note: Using a modified bolt syntax to include imports
*/
export function parseAsync(filename: string) {
    let baseSymbols: {
      funtions: any[],
      schema: any[],
      paths: any[],
      imports: any[]
    } = {
      funtions: [],
      schema: [],
      paths: [],
      imports: []
    };

    // creating a stream through which each file will pass
    let contents =  fs.readFileSync(filename,"utf8");
    return parserWrapper(contents, filename, baseSymbols);
}


    /*
      *************************** Function Section ****************************
    */
    function mergeSymbols(sym : any, newRules : any) {
      for (var funcKey in newRules.functions) {
          if (newRules.functions.hasOwnProperty(funcKey)) {
              sym.functions[funcKey] = newRules.functions[funcKey];
          }
      }
      for (var schemaKey in newRules.schema) {
          if (newRules.schema.hasOwnProperty(schemaKey)) {
              sym.schema[schemaKey] = newRules.schema[schemaKey];
          }
      }
      for (var pathKey in newRules.paths) {
          if (newRules.paths.hasOwnProperty(pathKey)) {
              sym.paths[pathKey] = newRules.paths[pathKey];
          }
      }
      for (var importKey in newRules.imports) {
          if (newRules.paths.hasOwnProperty(importKey)) {
              sym.paths[importKey] = newRules.paths[importKey];
          }
      }
      return sym;
    }

    /* ******** wrapper for recursive parsing ******* */
    function parserWrapper(data: string, filename: string, symbols: any) {
      console.log("current context:" + filename);
      var sym = bolt.parse(data);
      console.log('Stage 4');
      // Process any imports in symbol list
      for(let i=0; i< sym.imports.length; i++) {
          let next = sym.imports.pop();
          var nextFilename = getNextFilenameFromContextAndImport(filename, next.filename);
          console.log('Stage 5');
          console.log(nextFilename);
          let contents = fs.readFileSync(nextFilename,'utf8');
          sym = mergeSymbols(parserWrapper(contents, nextFilename, sym), sym);
      }

      symbols = mergeSymbols(symbols, sym);
      return symbols;
    }; // end function

    function getNextFilenameFromContextAndImport(current : string, nextImport : any) {
      // Convert absolute filenames to relative
      // Convert relative filenames to include original path

      current = current.replace('.bolt', '');
      nextImport = nextImport.replace('.bolt', '');
      var currentFn = current.split('/');
      var nextFn = nextImport.split('/');
      console.log('****');
      console.log(currentFn);
      console.log('----');
      console.log(nextFn);
      let result = '';
      if (nextFn[0] != '.' && nextFn[0] != '..') { // global reference
        result = './node_modules/' + nextImport + '/index';
      } else {
        // import {./something} -> ['.','something'] -> ''
        // import {./something/anotherthing} -> ['.','something','anotherthing'] -> something

        currentFn.pop(); // remove trailing file name and leave only the directory
        nextFn = currentFn.concat(nextFn);
        // if file.bolt exists then we have it otherwise return
        console.log(nextFn.join('/') + '.bolt');
        if(fs.existsSync(nextFn.join('/') + '.bolt')){
          result = nextFn.join('/') + '.bolt';
        } else {
          result = nextFn.join('/') + '/index.bolt';
        }
      }
      return result;
    }
