let readfile = require('fs-readfile-promise');
let path = require('path');
let bolt = require('./rules-parser');
let fs = require('fs');
/*
  Async file parser for split file systems
  Note: Using a modified bolt syntax to include imports
*/
var sym : any; // Global symbols variable
var cwd :string = '';
export function parseAsync(filename: string,
  cbSuccess: (symbols: any) => void,
  cbFailure: (error: string) => void) {
    let baseSymbols = {
      funtions: [],
      schema: [],
      paths: [],
      imports: []
    };
    // creating a stream through which each file will pass
    fs.readFile(filename, (err : any, data : string) =>
      parserWrapper(err, data, filename, baseSymbols,  cbSuccess, cbFailure));
}


    /*
      *************************** Function Section ****************************
    */
    function mergeSymbols(existingSymbols : any, newRules : any) {
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
      return existingSymbols;
    }
/*
next = getNextFilenameFromContextAndImport({
  filename: basePath + '/tempfilename',
  scope: false
}, next);
*/

    /* ******** Async wrapper to setup first run ******* */
    function parserWrapper(data: string, filename: string, symbols: any, cbSuccess: any, cbFailure: any) {
      console.log("current context" + filename);
      let basePath = path.basename(filename);
      sym = bolt.parse(data);
      symbols = mergeSymbols(symbols, sym);

      // Pop through the symbol list
      let callback = (newSymbols: any) => {
            if (sym.imports.length > 0) {
              let next = sym.imports.pop();
              fs.readFile(next.filename, (err : any, data : string) =>
                parserWrapper(err, data, next.filename, symbols,  cbSuccess, cbFailure));
            } else {
              cbSuccess(symbols); // Final call
            }
        }

        if(sym.imports.length > 0) {
          next = getNextFilenameFromContextAndImport({
            filename: basePath + '/tempfilename',
            scope: false
          }, next);

          fs.readFile(next.filename, (err : any, data : string) =>
            callback(data, next.filename, symbols, , cbFailure);
        } else {
          cbSuccess(symbols);
        }
    }; // end function

    function getNextFilenameFromContextAndImport(current : any, nextImport : any) {
      // Convert absolute filenames to relative
      // Convert relative filenames to include original path

      var currentFn = current.filename.split('/');
      var nextFn = nextImport.filename.split('/');
      if (nextImport.scope) {
        nextImport.filename = './node_modules/' + nextImport.filename + '/index';
      } else {
        // import {./something} -> ['.','something'] -> ''
        // import {./something/anotherthing} -> ['.','something','anotherthing'] -> something

        currentFn.pop();
        while (nextFn[0] === '..') {
          currentFn.pop();
          nextFn.shift();
        }
        if (nextFn[0] === '.') {
          nextFn.shift();
        }
        nextImport.filename  = currentFn.concat(nextFn).join('/');
      }
      return nextImport;
    }

    function processRecursive(next : any) {

      var promises : any = [];
      var p = new Promise(function(resolve, reject) {

        console.log("Reading: " + JSON.stringify(next));
        readfile(next.filename  + '.bolt').then(
          function(subData : any) {
            console.log("Success Reading: " + next.filename + '.bolt');
            var subPromises = [];
            var newRules = bolt.parse(subData.toString());
            console.log('*******' + next.filename);
            if (newRules) {
                newRules.imports.map(function (obj : any) {
                    sym.imports.push(obj);
                    return obj;
                });
            }
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

            /*
            {
              filename:
              alias:
              scope: fale = local
            }
            */

            for (var impKey in newRules.imports) {
                var imp = getNextFilenameFromContextAndImport(next, newRules.imports[impKey]);

                // check for global modules
                var inner = processRecursive(imp);
                subPromises.push(inner);
                // push a new import path
            }
            Promise.all(subPromises).then(function() {
              resolve();
            }).catch(function(ex : any){
              this.emit('error in parsed files');
            });

        }); // end readFile
      }); // end promise
    promises.push(p);

    var retPromise = new Promise(function(resolve, reject) {
      Promise.all(promises).then(function(){
        resolve();
      }).catch(function(ex : any){
        console.log(ex);
      });
    });
    return retPromise;
    }
    /*
    * readSuccess -Final call with all the symboly loaded
    * calls the original parser function after the parser has succeeded.
    */
    function readSuccess(symbols : any, cb : any) {
      var gen = new bolt.Generator(symbols);
      var rules = gen.generateRules();
      var output =  JSON.stringify(rules, null, 2);
      newfile.contents = new Buffer(output);
      newfile.path = newfile.path.replace('.bolt', '.json');
      cb(null, newfile); // finished
    };
