let path = require('path');
let bolt = require('./rules-parser');
let fs = require('fs');

/*
  Async file parser for split file systems
  Note: Using a modified bolt syntax to include imports
*/
export function parseAsync(filename: string) {
    let baseSymbols: {
      functions: any[],
      schema: any[],
      paths: any[],
      imports: any[]
    } = {
      functions: [],
      schema: [],
      paths: [],
      imports: []
    };

    // creating a stream through which each file will pass
    let contents =  fs.readFileSync(filename,"utf8");
    return parserWrapper(contents, filename, baseSymbols, []);
}


    /*
      *************************** Function Section ****************************
    */

    function mergeSymbols(sym : any, newRules : any, imports: any){
      //
      //       identifiers
      // Strip out anything that doesn't exist in the identifiers list

      if(sym.functions.length ==0
      && sym.schema.length == 0
      && sym.paths.length ==0
      && sym.imports.length == 0){
        return newRules;
      }
      if(imports == null){
        imports = [];// when we don't specify anything
      }
      for (var funcKey in newRules.functions) {
          if (newRules.functions.hasOwnProperty(funcKey)) {
            if(imports.indexOf(funcKey) >= 0) {
              sym.functions[funcKey] = newRules.functions[funcKey];
            }
          }
      }
      for (var schemaKey in newRules.schema) {
          if (newRules.schema.hasOwnProperty(schemaKey)) {
            if(imports.indexOf(schemaKey) >= 0) {
              sym.schema[schemaKey] = newRules.schema[schemaKey];
            }
          }
      }
      for (var pathKey in newRules.paths) {
          if (newRules.paths.hasOwnProperty(pathKey)) {
            if(imports.indexOf(pathKey) >= 0) {
              sym.paths[pathKey] = newRules.paths[pathKey];
            }
          }
      }
      for (var importKey in newRules.imports) {
          if (newRules.paths.hasOwnProperty(importKey)) {
             if(imports.indexOf(importKey) >= 0) {
              sym.paths[importKey] = newRules.paths[importKey];
            }
          }
      }
      return sym;
    }

    /* ******** wrapper for recursive parsing ******* */
    function parserWrapper(data: string, filename: string, symbols: any, identifiers: any) {
      var sym = bolt.parse(data);
      symbols = mergeSymbols(symbols, sym, identifiers);
      // Process any imports in symbol list
      for(let i=0; i< sym.imports.length; i++) {
          let next = sym.imports.pop();
          var nextFilename = getNextFilenameFromContextAndImport(filename, next.filename);
          let contents = fs.readFileSync(nextFilename,'utf8');
          let nextSymbols = parserWrapper(contents, nextFilename, sym, next.identifiers);
          sym = mergeSymbols(symbols, nextSymbols, next.identifiers);
      }
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
