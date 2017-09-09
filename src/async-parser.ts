let path = require('path');
let bolt = require('./rules-parser');
let fs = require('fs');
let id = 0;
/*
  Async file parser for split file systems
  Note: Using a modified bolt syntax to include imports
*/
export function parseAsync(filename: string) {
    let baseSymbols: {
      functions: any[],
      schema: any[],
      paths: any[],
      imports: any[],
      externals: any[]
    } = {
      functions: [],
      schema: [],
      paths: [],
      imports: [],
      externals: []
    };

    // creating a stream through which each file will pass
    let contents =  fs.readFileSync(filename,"utf8");
    return parserWrapper(contents, filename);
}


    /*
      *************************** Function Section ****************************
    */

    /* ******** wrapper for recursive parsing ******* */
    function parserWrapper(data: string, filename: string) {
      var sym = bolt.parse(data);

      // Process any imports in symbol list
      for(let i = 0; i< sym.imports.length; i++) {
          let next = sym.imports[i];
          var nextFilename = getNextFilenameFromContextAndImport(filename, next.filename);
          let contents = fs.readFileSync(nextFilename,'utf8');
          let nextSymbols = parserWrapper(contents, nextFilename);
          sym.imports[i].symbols = nextSymbols; // add it to the next part of the tree
      }
      return sym;
    }; // end function


    function getNextFilenameFromContextAndImport(current : string, nextImport : any) {
      // Convert absolute filenames to relative
      // Convert relative filenames to include original path

      current = current.replace('.bolt', '');
      nextImport = nextImport.replace('.bolt', '');
      var currentFn = current.split('/');
      var nextFn = nextImport.split('/');
      let result = '';
      if (nextFn[0] != '.' && nextFn[0] != '..') { // global reference
        result = './node_modules/' + nextImport + '/index';
      } else {
        // import {./something} -> ['.','something'] -> ''
        // import {./something/anotherthing} -> ['.','something','anotherthing'] -> something

        currentFn.pop(); // remove trailing file name and leave only the directory
        nextFn = currentFn.concat(nextFn);
        // if file.bolt exists then we have it otherwise return
        if(fs.existsSync(nextFn.join('/') + '.bolt')){
          result = nextFn.join('/') + '.bolt';
        } else {
          result = nextFn.join('/') + '/index.bolt';
        }
      }
      return result;
    }
