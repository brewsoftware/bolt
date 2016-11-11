"use strict";
/*
 * Copyright 2015 Google Inc. All Rights Reserved.
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
var chai_1 = require('chai');
var rest = require('../firebase-rest');
var secrets = require('../../auth-secrets');
suite("Firebase Rules Tests", function () {
    var client = new rest.Client(secrets.APP, secrets.SECRET);
    test("Write Rules", function () {
        return client.put(rest.RULES_LOCATION, {
            rules: {
                ".read": true,
                ".write": false,
                "rest-test": {
                    ".write": true
                }
            }
        });
    });
    test("Read Rules", function () {
        return client.get(rest.RULES_LOCATION)
            .then(function (result) {
            chai_1.assert('rules' in result);
        });
    });
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3QvZmlyZWJhc2UtcnVsZXMtdGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7O0dBY0c7QUFDSCxxQkFBcUIsTUFBTSxDQUFDLENBQUE7QUFDNUIsSUFBWSxJQUFJLFdBQU0sa0JBQWtCLENBQUMsQ0FBQTtBQUV6QyxJQUFJLE9BQU8sR0FBRyxPQUFPLENBQUMsb0JBQW9CLENBQUMsQ0FBQztBQUU1QyxLQUFLLENBQUMsc0JBQXNCLEVBQUU7SUFDNUIsSUFBSSxNQUFNLEdBQUcsSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUUsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBRTFELElBQUksQ0FBQyxhQUFhLEVBQUU7UUFDbEIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQ2YsSUFBSSxDQUFDLGNBQWMsRUFDbkI7WUFDRSxLQUFLLEVBQUU7Z0JBQ0wsT0FBTyxFQUFFLElBQUk7Z0JBQ2IsUUFBUSxFQUFFLEtBQUs7Z0JBQ2YsV0FBVyxFQUFFO29CQUNYLFFBQVEsRUFBRSxJQUFJO2lCQUNmO2FBQ0Y7U0FDRixDQUFDLENBQUM7SUFDUCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxZQUFZLEVBQUU7UUFDakIsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQzthQUNuQyxJQUFJLENBQUMsVUFBUyxNQUFXO1lBQ3hCLGFBQU0sQ0FBQyxPQUFPLElBQUksTUFBTSxDQUFDLENBQUM7UUFDNUIsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUMsQ0FBQyxDQUFDIiwiZmlsZSI6InRlc3QvZmlyZWJhc2UtcnVsZXMtdGVzdC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qXHJcbiAqIENvcHlyaWdodCAyMDE1IEdvb2dsZSBJbmMuIEFsbCBSaWdodHMgUmVzZXJ2ZWQuXHJcbiAqXHJcbiAqIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAgKHRoZSBcIkxpY2Vuc2VcIik7XHJcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cclxuICogWW91IG1heSBvYnRhaW4gYSBjb3B5IG9mIHRoZSBMaWNlbnNlIGF0XHJcbiAqXHJcbiAqICAgICBodHRwOi8vd3d3LmFwYWNoZS5vcmcvbGljZW5zZXMvTElDRU5TRS0yLjBcclxuICpcclxuICogVW5sZXNzIHJlcXVpcmVkIGJ5IGFwcGxpY2FibGUgbGF3IG9yIGFncmVlZCB0byBpbiB3cml0aW5nLCBzb2Z0d2FyZVxyXG4gKiBkaXN0cmlidXRlZCB1bmRlciB0aGUgTGljZW5zZSBpcyBkaXN0cmlidXRlZCBvbiBhbiBcIkFTIElTXCIgQkFTSVMsXHJcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxyXG4gKiBTZWUgdGhlIExpY2Vuc2UgZm9yIHRoZSBzcGVjaWZpYyBsYW5ndWFnZSBnb3Zlcm5pbmcgcGVybWlzc2lvbnMgYW5kXHJcbiAqIGxpbWl0YXRpb25zIHVuZGVyIHRoZSBMaWNlbnNlLlxyXG4gKi9cclxuaW1wb3J0IHthc3NlcnR9IGZyb20gJ2NoYWknO1xyXG5pbXBvcnQgKiBhcyByZXN0IGZyb20gJy4uL2ZpcmViYXNlLXJlc3QnO1xyXG5cclxubGV0IHNlY3JldHMgPSByZXF1aXJlKCcuLi8uLi9hdXRoLXNlY3JldHMnKTtcclxuXHJcbnN1aXRlKFwiRmlyZWJhc2UgUnVsZXMgVGVzdHNcIiwgZnVuY3Rpb24oKSB7XHJcbiAgdmFyIGNsaWVudCA9IG5ldyByZXN0LkNsaWVudChzZWNyZXRzLkFQUCwgc2VjcmV0cy5TRUNSRVQpO1xyXG5cclxuICB0ZXN0KFwiV3JpdGUgUnVsZXNcIiwgZnVuY3Rpb24oKSB7XHJcbiAgICByZXR1cm4gY2xpZW50LnB1dChcclxuICAgICAgcmVzdC5SVUxFU19MT0NBVElPTixcclxuICAgICAge1xyXG4gICAgICAgIHJ1bGVzOiB7XHJcbiAgICAgICAgICBcIi5yZWFkXCI6IHRydWUsXHJcbiAgICAgICAgICBcIi53cml0ZVwiOiBmYWxzZSxcclxuICAgICAgICAgIFwicmVzdC10ZXN0XCI6IHtcclxuICAgICAgICAgICAgXCIud3JpdGVcIjogdHJ1ZVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcbiAgfSk7XHJcblxyXG4gIHRlc3QoXCJSZWFkIFJ1bGVzXCIsIGZ1bmN0aW9uKCkge1xyXG4gICAgcmV0dXJuIGNsaWVudC5nZXQocmVzdC5SVUxFU19MT0NBVElPTilcclxuICAgICAgLnRoZW4oZnVuY3Rpb24ocmVzdWx0OiBhbnkpIHtcclxuICAgICAgICBhc3NlcnQoJ3J1bGVzJyBpbiByZXN1bHQpO1xyXG4gICAgICB9KTtcclxuICB9KTtcclxufSk7XHJcbiJdfQ==
