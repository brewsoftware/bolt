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
var simulator_1 = require('../simulator');
var secrets = require('../../auth-secrets');
simulator_1.rulesSuite("Mail", function (test) {
    var uid = test.uid;
    test.database(secrets.APP, secrets.SECRET);
    test.rules('samples/mail');
    test("Inbox tests.", function (rules) {
        rules
            .as('tom')
            .at('/users/' + uid('bill') + '/inbox/1')
            .write({
            from: uid('tom'),
            to: uid('bill'),
            message: 'Hi, Bill!'
        })
            .succeeds("Normal write.")
            .write(null)
            .fails("Sender cannot delete sent message.")
            .write({
            from: uid('tom'),
            to: uid('bill'),
            message: 'Hello, again!'
        })
            .fails("Sender cannot overwrite.")
            .at('/users/' + uid('bill') + '/inbox/2')
            .write({
            from: uid('tom'),
            to: uid('bill'),
            message: 'Hi, Bill!',
            spurious: 'supurious data'
        })
            .fails("No undefined fields.")
            .write({
            from: uid('george'),
            to: uid('bill'),
            message: 'Hi, Bill!'
        })
            .fails("From field should be correct.")
            .at('/users/' + uid('bill') + '/inbox/1/message')
            .write("Bill gets my inheritance")
            .fails("Cannnot tamper with message.")
            .at('/users/' + uid('bill') + '/inbox/1/from')
            .write(uid('bill'))
            .fails("Cannot tamper with from field.")
            .as('bill')
            .at('/users/' + uid('bill') + '/inbox/1')
            .write(null)
            .succeeds("Receiver can delete received mail.");
    });
    test("Outbox tests.", function (rules) {
        rules
            .as('bill')
            .at('/users/' + uid('bill') + '/outbox/1')
            .write({
            from: uid('bill'),
            to: uid('tom'),
            message: "Hi, Tom!"
        })
            .succeeds("Normal write.")
            .as('tom')
            .write(null)
            .fails("Receiver cannot delete outbox message.")
            .as('bill')
            .at('/users/' + uid('bill') + '/outbox/1/message')
            .write("Bill gets my inheritance.")
            .fails("Sender cannot tamper with outbox message.")
            .at('/users/' + uid('bill') + '/outbox/1/from')
            .write('bill')
            .fails("Can't do a partial overwrite - even if same data.")
            .as('bill')
            .at('/users/' + uid('bill') + '/outbox/2')
            .write({
            from: 'joe',
            to: 'tom',
            message: "Hi, Tom!"
        })
            .fails("From field must be correct.")
            .write({
            from: 'bill',
            to: 'tom',
            message: "Hi, Tom!",
            spurious: "spurious"
        })
            .fails("No undefined fields.")
            .at('/users/' + uid('bill') + '/outbox/1')
            .write(null)
            .succeeds("Sender can delete sent mail in outbox.");
    });
    test("Read permissions.", function (rules) {
        rules
            .as('bill')
            .at('/users/' + uid('bill') + '/outbox/1')
            .write({
            from: uid('bill'),
            to: uid('tom'),
            message: 'Hi, Tom!'
        })
            .succeeds("Normal write.")
            .as('tom')
            .at('/users/' + uid('bill') + '/inbox/1')
            .write({
            from: uid('tom'),
            to: uid('bill'),
            message: 'Hi, Bill!'
        })
            .as('bill')
            .at('/users/' + uid('bill') + '/inbox/1')
            .read()
            .succeeds("Can read own inbox.")
            .at('/users/' + uid('bill') + '/outbox/1')
            .read()
            .succeeds("Can read own outbox.")
            .as('tom')
            .at('/users/' + uid('bill') + '/inbox/1')
            .read()
            .fails("Can't read Bill's inbox.")
            .at('/users/' + uid('bill') + '/outbox/1')
            .read()
            .fails("Can't read Bills outbox.");
    });
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,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VyxDQUFDO2FBQ3pDLElBQUksRUFBRTthQUNOLEtBQUssQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO0lBQ3ZDLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJmaWxlIjoidGVzdC9tYWlsLXRlc3QuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxyXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxyXG4gKlxyXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xyXG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXHJcbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxyXG4gKlxyXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcbiAqXHJcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxyXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cclxuICovXHJcbmltcG9ydCB7cnVsZXNTdWl0ZX0gZnJvbSAnLi4vc2ltdWxhdG9yJztcclxudmFyIHNlY3JldHMgPSByZXF1aXJlKCcuLi8uLi9hdXRoLXNlY3JldHMnKTtcclxuXHJcbnJ1bGVzU3VpdGUoXCJNYWlsXCIsIGZ1bmN0aW9uKHRlc3QpIHtcclxuICB2YXIgdWlkID0gdGVzdC51aWQ7XHJcblxyXG4gIHRlc3QuZGF0YWJhc2Uoc2VjcmV0cy5BUFAsIHNlY3JldHMuU0VDUkVUKTtcclxuICB0ZXN0LnJ1bGVzKCdzYW1wbGVzL21haWwnKTtcclxuXHJcbiAgdGVzdChcIkluYm94IHRlc3RzLlwiLCBmdW5jdGlvbihydWxlcykge1xyXG4gICAgcnVsZXNcclxuICAgICAgLmFzKCd0b20nKVxyXG4gICAgICAuYXQoJy91c2Vycy8nICsgdWlkKCdiaWxsJykgKyAnL2luYm94LzEnKVxyXG4gICAgICAud3JpdGUoe1xyXG4gICAgICAgIGZyb206IHVpZCgndG9tJyksXHJcbiAgICAgICAgdG86IHVpZCgnYmlsbCcpLFxyXG4gICAgICAgIG1lc3NhZ2U6ICdIaSwgQmlsbCEnXHJcbiAgICAgIH0pXHJcbiAgICAgIC5zdWNjZWVkcyhcIk5vcm1hbCB3cml0ZS5cIilcclxuXHJcbiAgICAgIC53cml0ZShudWxsKVxyXG4gICAgICAuZmFpbHMoXCJTZW5kZXIgY2Fubm90IGRlbGV0ZSBzZW50IG1lc3NhZ2UuXCIpXHJcblxyXG4gICAgICAud3JpdGUoe1xyXG4gICAgICAgIGZyb206IHVpZCgndG9tJyksXHJcbiAgICAgICAgdG86IHVpZCgnYmlsbCcpLFxyXG4gICAgICAgIG1lc3NhZ2U6ICdIZWxsbywgYWdhaW4hJ1xyXG4gICAgICB9KVxyXG4gICAgICAuZmFpbHMoXCJTZW5kZXIgY2Fubm90IG92ZXJ3cml0ZS5cIilcclxuXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvaW5ib3gvMicpXHJcbiAgICAgIC53cml0ZSh7XHJcbiAgICAgICAgZnJvbTogdWlkKCd0b20nKSxcclxuICAgICAgICB0bzogdWlkKCdiaWxsJyksXHJcbiAgICAgICAgbWVzc2FnZTogJ0hpLCBCaWxsIScsXHJcbiAgICAgICAgc3B1cmlvdXM6ICdzdXB1cmlvdXMgZGF0YSdcclxuICAgICAgfSlcclxuICAgICAgLmZhaWxzKFwiTm8gdW5kZWZpbmVkIGZpZWxkcy5cIilcclxuXHJcbiAgICAgIC53cml0ZSh7XHJcbiAgICAgICAgZnJvbTogdWlkKCdnZW9yZ2UnKSxcclxuICAgICAgICB0bzogdWlkKCdiaWxsJyksXHJcbiAgICAgICAgbWVzc2FnZTogJ0hpLCBCaWxsISdcclxuICAgICAgfSlcclxuICAgICAgLmZhaWxzKFwiRnJvbSBmaWVsZCBzaG91bGQgYmUgY29ycmVjdC5cIilcclxuXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvaW5ib3gvMS9tZXNzYWdlJylcclxuICAgICAgLndyaXRlKFwiQmlsbCBnZXRzIG15IGluaGVyaXRhbmNlXCIpXHJcbiAgICAgIC5mYWlscyhcIkNhbm5ub3QgdGFtcGVyIHdpdGggbWVzc2FnZS5cIilcclxuXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvaW5ib3gvMS9mcm9tJylcclxuICAgICAgLndyaXRlKHVpZCgnYmlsbCcpKVxyXG4gICAgICAuZmFpbHMoXCJDYW5ub3QgdGFtcGVyIHdpdGggZnJvbSBmaWVsZC5cIilcclxuXHJcbiAgICAgIC5hcygnYmlsbCcpXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvaW5ib3gvMScpXHJcbiAgICAgIC53cml0ZShudWxsKVxyXG4gICAgICAuc3VjY2VlZHMoXCJSZWNlaXZlciBjYW4gZGVsZXRlIHJlY2VpdmVkIG1haWwuXCIpO1xyXG4gIH0pO1xyXG5cclxuXHJcbiAgdGVzdChcIk91dGJveCB0ZXN0cy5cIiwgZnVuY3Rpb24ocnVsZXMpIHtcclxuICAgIHJ1bGVzXHJcbiAgICAgIC5hcygnYmlsbCcpXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvb3V0Ym94LzEnKVxyXG4gICAgICAud3JpdGUoe1xyXG4gICAgICAgIGZyb206IHVpZCgnYmlsbCcpLFxyXG4gICAgICAgIHRvOiB1aWQoJ3RvbScpLFxyXG4gICAgICAgIG1lc3NhZ2U6IFwiSGksIFRvbSFcIlxyXG4gICAgICB9KVxyXG4gICAgICAuc3VjY2VlZHMoXCJOb3JtYWwgd3JpdGUuXCIpXHJcblxyXG4gICAgICAuYXMoJ3RvbScpXHJcbiAgICAgIC53cml0ZShudWxsKVxyXG4gICAgICAuZmFpbHMoXCJSZWNlaXZlciBjYW5ub3QgZGVsZXRlIG91dGJveCBtZXNzYWdlLlwiKVxyXG5cclxuICAgICAgLmFzKCdiaWxsJylcclxuXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvb3V0Ym94LzEvbWVzc2FnZScpXHJcbiAgICAgIC53cml0ZShcIkJpbGwgZ2V0cyBteSBpbmhlcml0YW5jZS5cIilcclxuICAgICAgLmZhaWxzKFwiU2VuZGVyIGNhbm5vdCB0YW1wZXIgd2l0aCBvdXRib3ggbWVzc2FnZS5cIilcclxuXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvb3V0Ym94LzEvZnJvbScpXHJcbiAgICAgIC53cml0ZSgnYmlsbCcpXHJcbiAgICAgIC5mYWlscyhcIkNhbid0IGRvIGEgcGFydGlhbCBvdmVyd3JpdGUgLSBldmVuIGlmIHNhbWUgZGF0YS5cIilcclxuXHJcbiAgICAgIC5hcygnYmlsbCcpXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvb3V0Ym94LzInKVxyXG4gICAgICAud3JpdGUoe1xyXG4gICAgICAgIGZyb206ICdqb2UnLFxyXG4gICAgICAgIHRvOiAndG9tJyxcclxuICAgICAgICBtZXNzYWdlOiBcIkhpLCBUb20hXCJcclxuICAgICAgfSlcclxuICAgICAgLmZhaWxzKFwiRnJvbSBmaWVsZCBtdXN0IGJlIGNvcnJlY3QuXCIpXHJcblxyXG4gICAgICAud3JpdGUoe1xyXG4gICAgICAgIGZyb206ICdiaWxsJyxcclxuICAgICAgICB0bzogJ3RvbScsXHJcbiAgICAgICAgbWVzc2FnZTogXCJIaSwgVG9tIVwiLFxyXG4gICAgICAgIHNwdXJpb3VzOiBcInNwdXJpb3VzXCJcclxuICAgICAgfSlcclxuICAgICAgLmZhaWxzKFwiTm8gdW5kZWZpbmVkIGZpZWxkcy5cIilcclxuXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvb3V0Ym94LzEnKVxyXG4gICAgICAud3JpdGUobnVsbClcclxuICAgICAgLnN1Y2NlZWRzKFwiU2VuZGVyIGNhbiBkZWxldGUgc2VudCBtYWlsIGluIG91dGJveC5cIik7XHJcbiAgfSk7XHJcblxyXG4gIHRlc3QoXCJSZWFkIHBlcm1pc3Npb25zLlwiLCBmdW5jdGlvbihydWxlcykge1xyXG4gICAgcnVsZXNcclxuICAgICAgLmFzKCdiaWxsJylcclxuICAgICAgLmF0KCcvdXNlcnMvJyArIHVpZCgnYmlsbCcpICsgJy9vdXRib3gvMScpXHJcbiAgICAgIC53cml0ZSh7XHJcbiAgICAgICAgZnJvbTogdWlkKCdiaWxsJyksXHJcbiAgICAgICAgdG86IHVpZCgndG9tJyksXHJcbiAgICAgICAgbWVzc2FnZTogJ0hpLCBUb20hJ1xyXG4gICAgICB9KVxyXG4gICAgICAuc3VjY2VlZHMoXCJOb3JtYWwgd3JpdGUuXCIpXHJcblxyXG4gICAgICAuYXMoJ3RvbScpXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvaW5ib3gvMScpXHJcbiAgICAgIC53cml0ZSh7XHJcbiAgICAgICAgZnJvbTogdWlkKCd0b20nKSxcclxuICAgICAgICB0bzogdWlkKCdiaWxsJyksXHJcbiAgICAgICAgbWVzc2FnZTogJ0hpLCBCaWxsISdcclxuICAgICAgfSlcclxuXHJcbiAgICAgIC5hcygnYmlsbCcpXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvaW5ib3gvMScpXHJcbiAgICAgIC5yZWFkKClcclxuICAgICAgLnN1Y2NlZWRzKFwiQ2FuIHJlYWQgb3duIGluYm94LlwiKVxyXG5cclxuICAgICAgLmF0KCcvdXNlcnMvJyArIHVpZCgnYmlsbCcpICsgJy9vdXRib3gvMScpXHJcbiAgICAgIC5yZWFkKClcclxuICAgICAgLnN1Y2NlZWRzKFwiQ2FuIHJlYWQgb3duIG91dGJveC5cIilcclxuXHJcbiAgICAgIC5hcygndG9tJylcclxuICAgICAgLmF0KCcvdXNlcnMvJyArIHVpZCgnYmlsbCcpICsgJy9pbmJveC8xJylcclxuICAgICAgLnJlYWQoKVxyXG4gICAgICAuZmFpbHMoXCJDYW4ndCByZWFkIEJpbGwncyBpbmJveC5cIilcclxuXHJcbiAgICAgIC5hdCgnL3VzZXJzLycgKyB1aWQoJ2JpbGwnKSArICcvb3V0Ym94LzEnKVxyXG4gICAgICAucmVhZCgpXHJcbiAgICAgIC5mYWlscyhcIkNhbid0IHJlYWQgQmlsbHMgb3V0Ym94LlwiKTtcclxuICB9KTtcclxufSk7XHJcbiJdfQ==
