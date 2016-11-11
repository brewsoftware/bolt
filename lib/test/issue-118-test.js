"use strict";
/*
 * Copyright 2016 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
var simulator_1 = require('../simulator');
var secrets = require('../../auth-secrets');
simulator_1.rulesSuite("Type[] | Scalar - issue 118", function (test) {
    test.database(secrets.APP, secrets.SECRET);
    test.rules('samples/issue-118');
    test("Scalar tests.", function (rules) {
        rules
            .as('mike')
            .at('/path/scalar')
            .write(1)
            .succeeds("Write to scalar.")
            .write(null)
            .succeeds("Deleting whole item can delete scalar.")
            .write(1)
            .at('/path/scalarOrNull')
            .write(1)
            .succeeds("Write to scalar or null.")
            .write(null)
            .succeeds("Can delete scalar or null.");
    });
    test("Array tests.", function (rules) {
        rules
            .as('mike')
            .at('/path/scalar')
            .write(1)
            .at('/path/array')
            .write([1])
            .succeeds("Write to array.")
            .write(null)
            .succeeds("Deleting whole array.")
            .at('/path/array/999')
            .write(1)
            .succeeds("Write single entry to array.")
            .at('/path/array')
            .push(2)
            .succeeds("Pushes value into array.")
            .write("bogus")
            .fails("Should not be able to write non-array to array.")
            .at('/path/arrayOrNull/999')
            .write(1)
            .succeeds("Can write single array entry to array or null.")
            .at('/path/arrayOrNull')
            .write([1])
            .succeeds("Write array to array or null.")
            .write(null)
            .succeeds("Can delete array or null.")
            .at('/path/arrayOrScalar')
            .write(1)
            .succeeds("Write scalar to array or scalar.")
            .write([1])
            .succeeds("Write array to array or scalar.");
    });
    test("Map tests.", function (rules) {
        rules
            .as('mike')
            .at('/path/scalar')
            .write(1)
            .at('/path/map')
            .write([1])
            .succeeds("Write to map.")
            .write(null)
            .succeeds("Deleting whole map.")
            .at('/path/map/key')
            .write(1)
            .succeeds("Write single entry to map.")
            .at('/path/map')
            .push(2)
            .succeeds("Pushes value into map.")
            .write("bogus")
            .fails("Should not be able to write non-map to map.")
            .at('/path/mapOrScalar')
            .write(1)
            .succeeds("Write scalar to map or scalar.")
            .write({ "key": 2 })
            .succeeds("Write map to map or scalar.");
    });
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,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SyxDQUFDLElBQUksQ0FBQzthQUNYLFFBQVEsQ0FBQyxxQkFBcUIsQ0FBQzthQUMvQixFQUFFLENBQUMsZUFBZSxDQUFDO2FBQ25CLEtBQUssQ0FBQyxDQUFDLENBQUM7YUFDUixRQUFRLENBQUMsNEJBQTRCLENBQUM7YUFDdEMsRUFBRSxDQUFDLFdBQVcsQ0FBQzthQUNmLElBQUksQ0FBQyxDQUFDLENBQUM7YUFDUCxRQUFRLENBQUMsd0JBQXdCLENBQUM7YUFDbEMsS0FBSyxDQUFDLE9BQU8sQ0FBQzthQUNkLEtBQUssQ0FBQyw2Q0FBNkMsQ0FBQzthQUVwRCxFQUFFLENBQUMsbUJBQW1CLENBQUM7YUFDdkIsS0FBSyxDQUFDLENBQUMsQ0FBQzthQUNSLFFBQVEsQ0FBQyxnQ0FBZ0MsQ0FBQzthQUMxQyxLQUFLLENBQUMsRUFBQyxLQUFLLEVBQUUsQ0FBQyxFQUFDLENBQUM7YUFDakIsUUFBUSxDQUFDLDZCQUE2QixDQUFDLENBQ3pDO0lBQ0gsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsImZpbGUiOiJ0ZXN0L2lzc3VlLTExOC10ZXN0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLypcclxuICogQ29weXJpZ2h0IDIwMTYgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cclxuICpcclxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcclxuICogeW91IG1heSBub3QgdXNlIHRoaXMgZmlsZSBleGNlcHQgaW4gY29tcGxpYW5jZSB3aXRoIHRoZSBMaWNlbnNlLlxyXG4gKiBZb3UgbWF5IG9idGFpbiBhIGNvcHkgb2YgdGhlIExpY2Vuc2UgYXRcclxuICpcclxuICogICAgIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxyXG4gKlxyXG4gKiBVbmxlc3MgcmVxdWlyZWQgYnkgYXBwbGljYWJsZSBsYXcgb3IgYWdyZWVkIHRvIGluIHdyaXRpbmcsIHNvZnR3YXJlXHJcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcclxuICogV0lUSE9VVCBXQVJSQU5USUVTIE9SIENPTkRJVElPTlMgT0YgQU5ZIEtJTkQsIGVpdGhlciBleHByZXNzIG9yIGltcGxpZWQuXHJcbiAqIFNlZSB0aGUgTGljZW5zZSBmb3IgdGhlIHNwZWNpZmljIGxhbmd1YWdlIGdvdmVybmluZyBwZXJtaXNzaW9ucyBhbmRcclxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXHJcbiAqL1xyXG5pbXBvcnQge3J1bGVzU3VpdGV9IGZyb20gJy4uL3NpbXVsYXRvcic7XHJcbnZhciBzZWNyZXRzID0gcmVxdWlyZSgnLi4vLi4vYXV0aC1zZWNyZXRzJyk7XHJcblxyXG5ydWxlc1N1aXRlKFwiVHlwZVtdIHwgU2NhbGFyIC0gaXNzdWUgMTE4XCIsIGZ1bmN0aW9uKHRlc3QpIHtcclxuICB0ZXN0LmRhdGFiYXNlKHNlY3JldHMuQVBQLCBzZWNyZXRzLlNFQ1JFVCk7XHJcbiAgdGVzdC5ydWxlcygnc2FtcGxlcy9pc3N1ZS0xMTgnKTtcclxuXHJcbiAgdGVzdChcIlNjYWxhciB0ZXN0cy5cIiwgZnVuY3Rpb24ocnVsZXMpIHtcclxuICAgIHJ1bGVzXHJcbiAgICAgIC8vIC5kZWJ1ZygpXHJcbiAgICAgIC5hcygnbWlrZScpXHJcbiAgICAgIC5hdCgnL3BhdGgvc2NhbGFyJylcclxuICAgICAgLndyaXRlKDEpXHJcbiAgICAgIC5zdWNjZWVkcyhcIldyaXRlIHRvIHNjYWxhci5cIilcclxuICAgICAgLndyaXRlKG51bGwpXHJcbiAgICAgIC5zdWNjZWVkcyhcIkRlbGV0aW5nIHdob2xlIGl0ZW0gY2FuIGRlbGV0ZSBzY2FsYXIuXCIpXHJcblxyXG4gICAgICAvLyBOZWVkZWQgZm9yIGFsbCBzdWJzZXF1ZW50IHRlc3RzIHRvIHBhc3MuXHJcbiAgICAgIC53cml0ZSgxKVxyXG5cclxuICAgICAgLmF0KCcvcGF0aC9zY2FsYXJPck51bGwnKVxyXG4gICAgICAud3JpdGUoMSlcclxuICAgICAgLnN1Y2NlZWRzKFwiV3JpdGUgdG8gc2NhbGFyIG9yIG51bGwuXCIpXHJcbiAgICAgIC53cml0ZShudWxsKVxyXG4gICAgICAuc3VjY2VlZHMoXCJDYW4gZGVsZXRlIHNjYWxhciBvciBudWxsLlwiKVxyXG4gICAgO1xyXG4gIH0pO1xyXG5cclxuICB0ZXN0KFwiQXJyYXkgdGVzdHMuXCIsIGZ1bmN0aW9uKHJ1bGVzKSB7XHJcbiAgICBydWxlc1xyXG4gICAgICAvLyAuZGVidWcoKVxyXG4gICAgICAuYXMoJ21pa2UnKVxyXG4gICAgICAuYXQoJy9wYXRoL3NjYWxhcicpXHJcbiAgICAgIC53cml0ZSgxKVxyXG5cclxuICAgICAgLmF0KCcvcGF0aC9hcnJheScpXHJcbiAgICAgIC53cml0ZShbMV0pXHJcbiAgICAgIC5zdWNjZWVkcyhcIldyaXRlIHRvIGFycmF5LlwiKVxyXG4gICAgICAud3JpdGUobnVsbClcclxuICAgICAgLnN1Y2NlZWRzKFwiRGVsZXRpbmcgd2hvbGUgYXJyYXkuXCIpXHJcbiAgICAgIC5hdCgnL3BhdGgvYXJyYXkvOTk5JylcclxuICAgICAgLndyaXRlKDEpXHJcbiAgICAgIC5zdWNjZWVkcyhcIldyaXRlIHNpbmdsZSBlbnRyeSB0byBhcnJheS5cIilcclxuICAgICAgLmF0KCcvcGF0aC9hcnJheScpXHJcbiAgICAgIC5wdXNoKDIpXHJcbiAgICAgIC5zdWNjZWVkcyhcIlB1c2hlcyB2YWx1ZSBpbnRvIGFycmF5LlwiKVxyXG4gICAgICAud3JpdGUoXCJib2d1c1wiKVxyXG4gICAgICAuZmFpbHMoXCJTaG91bGQgbm90IGJlIGFibGUgdG8gd3JpdGUgbm9uLWFycmF5IHRvIGFycmF5LlwiKVxyXG5cclxuICAgICAgLmF0KCcvcGF0aC9hcnJheU9yTnVsbC85OTknKVxyXG4gICAgICAud3JpdGUoMSlcclxuICAgICAgLnN1Y2NlZWRzKFwiQ2FuIHdyaXRlIHNpbmdsZSBhcnJheSBlbnRyeSB0byBhcnJheSBvciBudWxsLlwiKVxyXG5cclxuICAgICAgLmF0KCcvcGF0aC9hcnJheU9yTnVsbCcpXHJcbiAgICAgIC53cml0ZShbMV0pXHJcbiAgICAgIC5zdWNjZWVkcyhcIldyaXRlIGFycmF5IHRvIGFycmF5IG9yIG51bGwuXCIpXHJcbiAgICAgIC53cml0ZShudWxsKVxyXG4gICAgICAuc3VjY2VlZHMoXCJDYW4gZGVsZXRlIGFycmF5IG9yIG51bGwuXCIpXHJcblxyXG4gICAgICAuYXQoJy9wYXRoL2FycmF5T3JTY2FsYXInKVxyXG4gICAgICAud3JpdGUoMSlcclxuICAgICAgLnN1Y2NlZWRzKFwiV3JpdGUgc2NhbGFyIHRvIGFycmF5IG9yIHNjYWxhci5cIilcclxuICAgICAgLndyaXRlKFsxXSlcclxuICAgICAgLnN1Y2NlZWRzKFwiV3JpdGUgYXJyYXkgdG8gYXJyYXkgb3Igc2NhbGFyLlwiKVxyXG4gICAgO1xyXG4gIH0pO1xyXG5cclxuICB0ZXN0KFwiTWFwIHRlc3RzLlwiLCBmdW5jdGlvbihydWxlcykge1xyXG4gICAgcnVsZXNcclxuICAgICAgLy8gLmRlYnVnKClcclxuICAgICAgLmFzKCdtaWtlJylcclxuICAgICAgLmF0KCcvcGF0aC9zY2FsYXInKVxyXG4gICAgICAud3JpdGUoMSlcclxuXHJcbiAgICAgIC5hdCgnL3BhdGgvbWFwJylcclxuICAgICAgLndyaXRlKFsxXSlcclxuICAgICAgLnN1Y2NlZWRzKFwiV3JpdGUgdG8gbWFwLlwiKVxyXG4gICAgICAud3JpdGUobnVsbClcclxuICAgICAgLnN1Y2NlZWRzKFwiRGVsZXRpbmcgd2hvbGUgbWFwLlwiKVxyXG4gICAgICAuYXQoJy9wYXRoL21hcC9rZXknKVxyXG4gICAgICAud3JpdGUoMSlcclxuICAgICAgLnN1Y2NlZWRzKFwiV3JpdGUgc2luZ2xlIGVudHJ5IHRvIG1hcC5cIilcclxuICAgICAgLmF0KCcvcGF0aC9tYXAnKVxyXG4gICAgICAucHVzaCgyKVxyXG4gICAgICAuc3VjY2VlZHMoXCJQdXNoZXMgdmFsdWUgaW50byBtYXAuXCIpXHJcbiAgICAgIC53cml0ZShcImJvZ3VzXCIpXHJcbiAgICAgIC5mYWlscyhcIlNob3VsZCBub3QgYmUgYWJsZSB0byB3cml0ZSBub24tbWFwIHRvIG1hcC5cIilcclxuXHJcbiAgICAgIC5hdCgnL3BhdGgvbWFwT3JTY2FsYXInKVxyXG4gICAgICAud3JpdGUoMSlcclxuICAgICAgLnN1Y2NlZWRzKFwiV3JpdGUgc2NhbGFyIHRvIG1hcCBvciBzY2FsYXIuXCIpXHJcbiAgICAgIC53cml0ZSh7XCJrZXlcIjogMn0pXHJcbiAgICAgIC5zdWNjZWVkcyhcIldyaXRlIG1hcCB0byBtYXAgb3Igc2NhbGFyLlwiKVxyXG4gICAgO1xyXG4gIH0pO1xyXG59KTtcclxuIl19
