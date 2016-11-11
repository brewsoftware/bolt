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
simulator_1.rulesSuite("Create, Update, and Delete", function (test) {
    test.database(secrets.APP, secrets.SECRET);
    test.rules('samples/create-update-delete');
    var uid = test.uid;
    test("Create", function (rules) {
        rules
            .at('/docs/' + uid('mike') + '/create')
            .write('created')
            .succeeds("Anyone can create.")
            .write('updated')
            .fails("No-one can update.")
            .write(null)
            .fails("No-one can delete.")
            .as('mike')
            .write('owner-updated')
            .fails("Owner can't update.")
            .write(null)
            .fails("Owner can't delete.");
    });
    test("Update", function (rules) {
        rules
            .at('/docs/' + uid('mike') + '/update')
            .as('mike')
            .write('created')
            .fails("Owner can't create.")
            .as('admin')
            .write('created')
            .succeeds("Admin can create.")
            .as('anon')
            .write('updated')
            .succeeds("Anyone can update.")
            .write(null)
            .fails("No-one can delete.")
            .as('mike')
            .write('owner-updated')
            .succeeds("Owner can update.")
            .write(null)
            .fails("Owner can't delete.");
    });
    test("Delete", function (rules) {
        rules
            .at('/docs/' + uid('mike') + '/delete')
            .as('admin')
            .write('created')
            .succeeds("Admin can create.")
            .as('anon')
            .write('updated')
            .fails("Anyone can't update.")
            .write(null)
            .succeeds("Anyone can delete.")
            .as('mike')
            .write('owner-created')
            .fails("Owner can't create.")
            .as('admin')
            .write('created')
            .as('mike')
            .write('owner-updated')
            .fails("Owner can't update.")
            .write(null)
            .succeeds("Owner can delete.");
    });
    test("Owner Create and Delete", function (rules) {
        rules
            .at('/docs/' + uid('mike') + '/owner-create-delete')
            .as('anon')
            .write('created')
            .fails("Anyone can't create.")
            .as('mike')
            .write('created')
            .succeeds("Owner can create.")
            .as('anon')
            .write('updated')
            .succeeds("Anyone can update.")
            .write(null)
            .fails("Anyone can't delete.")
            .as('mike')
            .write(null)
            .succeeds("Owner can delete.");
    });
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3QvY3JlYXRlLXVwZGF0ZS1kZWxldGUtdGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7Ozs7Ozs7Ozs7O0dBY0c7QUFDSCwwQkFBeUIsY0FBYyxDQUFDLENBQUE7QUFDeEMsSUFBSSxPQUFPLEdBQUcsT0FBTyxDQUFDLG9CQUFvQixDQUFDLENBQUM7QUFFNUMsc0JBQVUsQ0FBQyw0QkFBNEIsRUFBRSxVQUFTLElBQUk7SUFDcEQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUMzQyxJQUFJLENBQUMsS0FBSyxDQUFDLDhCQUE4QixDQUFDLENBQUM7SUFDM0MsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQztJQUVuQixJQUFJLENBQUMsUUFBUSxFQUFFLFVBQUMsS0FBSztRQUNuQixLQUFLO2FBQ0YsRUFBRSxDQUFDLFFBQVEsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsU0FBUyxDQUFDO2FBQ3RDLEtBQUssQ0FBQyxTQUFTLENBQUM7YUFDaEIsUUFBUSxDQUFDLG9CQUFvQixDQUFDO2FBRTlCLEtBQUssQ0FBQyxTQUFTLENBQUM7YUFDaEIsS0FBSyxDQUFDLG9CQUFvQixDQUFDO2FBRTNCLEtBQUssQ0FBQyxJQUFJLENBQUM7YUFDWCxLQUFLLENBQUMsb0JBQW9CLENBQUM7YUFFM0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUVWLEtBQUssQ0FBQyxlQUFlLENBQUM7YUFDdEIsS0FBSyxDQUFDLHFCQUFxQixDQUFDO2FBRTVCLEtBQUssQ0FBQyxJQUFJLENBQUM7YUFDWCxLQUFLLENBQUMscUJBQXFCLENBQUMsQ0FDOUI7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxRQUFRLEVBQUUsVUFBQyxLQUFLO1FBQ25CLEtBQUs7YUFDRixFQUFFLENBQUMsUUFBUSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxTQUFTLENBQUM7YUFDdEMsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNWLEtBQUssQ0FBQyxTQUFTLENBQUM7YUFDaEIsS0FBSyxDQUFDLHFCQUFxQixDQUFDO2FBRTVCLEVBQUUsQ0FBQyxPQUFPLENBQUM7YUFDWCxLQUFLLENBQUMsU0FBUyxDQUFDO2FBQ2hCLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQzthQUU3QixFQUFFLENBQUMsTUFBTSxDQUFDO2FBRVYsS0FBSyxDQUFDLFNBQVMsQ0FBQzthQUNoQixRQUFRLENBQUMsb0JBQW9CLENBQUM7YUFFOUIsS0FBSyxDQUFDLElBQUksQ0FBQzthQUNYLEtBQUssQ0FBQyxvQkFBb0IsQ0FBQzthQUUzQixFQUFFLENBQUMsTUFBTSxDQUFDO2FBQ1YsS0FBSyxDQUFDLGVBQWUsQ0FBQzthQUN0QixRQUFRLENBQUMsbUJBQW1CLENBQUM7YUFFN0IsS0FBSyxDQUFDLElBQUksQ0FBQzthQUNYLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQyxDQUM5QjtJQUNILENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLFFBQVEsRUFBRSxVQUFDLEtBQUs7UUFDbkIsS0FBSzthQUNGLEVBQUUsQ0FBQyxRQUFRLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLFNBQVMsQ0FBQzthQUN0QyxFQUFFLENBQUMsT0FBTyxDQUFDO2FBQ1gsS0FBSyxDQUFDLFNBQVMsQ0FBQzthQUNoQixRQUFRLENBQUMsbUJBQW1CLENBQUM7YUFFN0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUVWLEtBQUssQ0FBQyxTQUFTLENBQUM7YUFDaEIsS0FBSyxDQUFDLHNCQUFzQixDQUFDO2FBRTdCLEtBQUssQ0FBQyxJQUFJLENBQUM7YUFDWCxRQUFRLENBQUMsb0JBQW9CLENBQUM7YUFFOUIsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNWLEtBQUssQ0FBQyxlQUFlLENBQUM7YUFDdEIsS0FBSyxDQUFDLHFCQUFxQixDQUFDO2FBRTVCLEVBQUUsQ0FBQyxPQUFPLENBQUM7YUFDWCxLQUFLLENBQUMsU0FBUyxDQUFDO2FBRWhCLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFFVixLQUFLLENBQUMsZUFBZSxDQUFDO2FBQ3RCLEtBQUssQ0FBQyxxQkFBcUIsQ0FBQzthQUU1QixLQUFLLENBQUMsSUFBSSxDQUFDO2FBQ1gsUUFBUSxDQUFDLG1CQUFtQixDQUFDLENBQy9CO0lBQ0gsQ0FBQyxDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMseUJBQXlCLEVBQUUsVUFBQyxLQUFLO1FBQ3BDLEtBQUs7YUFDRixFQUFFLENBQUMsUUFBUSxHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxzQkFBc0IsQ0FBQzthQUNuRCxFQUFFLENBQUMsTUFBTSxDQUFDO2FBQ1YsS0FBSyxDQUFDLFNBQVMsQ0FBQzthQUNoQixLQUFLLENBQUMsc0JBQXNCLENBQUM7YUFFN0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNWLEtBQUssQ0FBQyxTQUFTLENBQUM7YUFDaEIsUUFBUSxDQUFDLG1CQUFtQixDQUFDO2FBRTdCLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFFVixLQUFLLENBQUMsU0FBUyxDQUFDO2FBQ2hCLFFBQVEsQ0FBQyxvQkFBb0IsQ0FBQzthQUU5QixLQUFLLENBQUMsSUFBSSxDQUFDO2FBQ1gsS0FBSyxDQUFDLHNCQUFzQixDQUFDO2FBRTdCLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFDVixLQUFLLENBQUMsSUFBSSxDQUFDO2FBQ1gsUUFBUSxDQUFDLG1CQUFtQixDQUFDLENBQy9CO0lBQ0gsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsImZpbGUiOiJ0ZXN0L2NyZWF0ZS11cGRhdGUtZGVsZXRlLXRlc3QuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxyXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxyXG4gKlxyXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xyXG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXHJcbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxyXG4gKlxyXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcbiAqXHJcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxyXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cclxuICovXHJcbmltcG9ydCB7cnVsZXNTdWl0ZX0gZnJvbSAnLi4vc2ltdWxhdG9yJztcclxudmFyIHNlY3JldHMgPSByZXF1aXJlKCcuLi8uLi9hdXRoLXNlY3JldHMnKTtcclxuXHJcbnJ1bGVzU3VpdGUoXCJDcmVhdGUsIFVwZGF0ZSwgYW5kIERlbGV0ZVwiLCBmdW5jdGlvbih0ZXN0KSB7XHJcbiAgdGVzdC5kYXRhYmFzZShzZWNyZXRzLkFQUCwgc2VjcmV0cy5TRUNSRVQpO1xyXG4gIHRlc3QucnVsZXMoJ3NhbXBsZXMvY3JlYXRlLXVwZGF0ZS1kZWxldGUnKTtcclxuICB2YXIgdWlkID0gdGVzdC51aWQ7XHJcblxyXG4gIHRlc3QoXCJDcmVhdGVcIiwgKHJ1bGVzKSA9PiB7XHJcbiAgICBydWxlc1xyXG4gICAgICAuYXQoJy9kb2NzLycgKyB1aWQoJ21pa2UnKSArICcvY3JlYXRlJylcclxuICAgICAgLndyaXRlKCdjcmVhdGVkJylcclxuICAgICAgLnN1Y2NlZWRzKFwiQW55b25lIGNhbiBjcmVhdGUuXCIpXHJcblxyXG4gICAgICAud3JpdGUoJ3VwZGF0ZWQnKVxyXG4gICAgICAuZmFpbHMoXCJOby1vbmUgY2FuIHVwZGF0ZS5cIilcclxuXHJcbiAgICAgIC53cml0ZShudWxsKVxyXG4gICAgICAuZmFpbHMoXCJOby1vbmUgY2FuIGRlbGV0ZS5cIilcclxuXHJcbiAgICAgIC5hcygnbWlrZScpXHJcblxyXG4gICAgICAud3JpdGUoJ293bmVyLXVwZGF0ZWQnKVxyXG4gICAgICAuZmFpbHMoXCJPd25lciBjYW4ndCB1cGRhdGUuXCIpXHJcblxyXG4gICAgICAud3JpdGUobnVsbClcclxuICAgICAgLmZhaWxzKFwiT3duZXIgY2FuJ3QgZGVsZXRlLlwiKVxyXG4gICAgO1xyXG4gIH0pO1xyXG5cclxuICB0ZXN0KFwiVXBkYXRlXCIsIChydWxlcykgPT4ge1xyXG4gICAgcnVsZXNcclxuICAgICAgLmF0KCcvZG9jcy8nICsgdWlkKCdtaWtlJykgKyAnL3VwZGF0ZScpXHJcbiAgICAgIC5hcygnbWlrZScpXHJcbiAgICAgIC53cml0ZSgnY3JlYXRlZCcpXHJcbiAgICAgIC5mYWlscyhcIk93bmVyIGNhbid0IGNyZWF0ZS5cIilcclxuXHJcbiAgICAgIC5hcygnYWRtaW4nKVxyXG4gICAgICAud3JpdGUoJ2NyZWF0ZWQnKVxyXG4gICAgICAuc3VjY2VlZHMoXCJBZG1pbiBjYW4gY3JlYXRlLlwiKVxyXG5cclxuICAgICAgLmFzKCdhbm9uJylcclxuXHJcbiAgICAgIC53cml0ZSgndXBkYXRlZCcpXHJcbiAgICAgIC5zdWNjZWVkcyhcIkFueW9uZSBjYW4gdXBkYXRlLlwiKVxyXG5cclxuICAgICAgLndyaXRlKG51bGwpXHJcbiAgICAgIC5mYWlscyhcIk5vLW9uZSBjYW4gZGVsZXRlLlwiKVxyXG5cclxuICAgICAgLmFzKCdtaWtlJylcclxuICAgICAgLndyaXRlKCdvd25lci11cGRhdGVkJylcclxuICAgICAgLnN1Y2NlZWRzKFwiT3duZXIgY2FuIHVwZGF0ZS5cIilcclxuXHJcbiAgICAgIC53cml0ZShudWxsKVxyXG4gICAgICAuZmFpbHMoXCJPd25lciBjYW4ndCBkZWxldGUuXCIpXHJcbiAgICA7XHJcbiAgfSk7XHJcblxyXG4gIHRlc3QoXCJEZWxldGVcIiwgKHJ1bGVzKSA9PiB7XHJcbiAgICBydWxlc1xyXG4gICAgICAuYXQoJy9kb2NzLycgKyB1aWQoJ21pa2UnKSArICcvZGVsZXRlJylcclxuICAgICAgLmFzKCdhZG1pbicpXHJcbiAgICAgIC53cml0ZSgnY3JlYXRlZCcpXHJcbiAgICAgIC5zdWNjZWVkcyhcIkFkbWluIGNhbiBjcmVhdGUuXCIpXHJcblxyXG4gICAgICAuYXMoJ2Fub24nKVxyXG5cclxuICAgICAgLndyaXRlKCd1cGRhdGVkJylcclxuICAgICAgLmZhaWxzKFwiQW55b25lIGNhbid0IHVwZGF0ZS5cIilcclxuXHJcbiAgICAgIC53cml0ZShudWxsKVxyXG4gICAgICAuc3VjY2VlZHMoXCJBbnlvbmUgY2FuIGRlbGV0ZS5cIilcclxuXHJcbiAgICAgIC5hcygnbWlrZScpXHJcbiAgICAgIC53cml0ZSgnb3duZXItY3JlYXRlZCcpXHJcbiAgICAgIC5mYWlscyhcIk93bmVyIGNhbid0IGNyZWF0ZS5cIilcclxuXHJcbiAgICAgIC5hcygnYWRtaW4nKVxyXG4gICAgICAud3JpdGUoJ2NyZWF0ZWQnKVxyXG5cclxuICAgICAgLmFzKCdtaWtlJylcclxuXHJcbiAgICAgIC53cml0ZSgnb3duZXItdXBkYXRlZCcpXHJcbiAgICAgIC5mYWlscyhcIk93bmVyIGNhbid0IHVwZGF0ZS5cIilcclxuXHJcbiAgICAgIC53cml0ZShudWxsKVxyXG4gICAgICAuc3VjY2VlZHMoXCJPd25lciBjYW4gZGVsZXRlLlwiKVxyXG4gICAgO1xyXG4gIH0pO1xyXG5cclxuICB0ZXN0KFwiT3duZXIgQ3JlYXRlIGFuZCBEZWxldGVcIiwgKHJ1bGVzKSA9PiB7XHJcbiAgICBydWxlc1xyXG4gICAgICAuYXQoJy9kb2NzLycgKyB1aWQoJ21pa2UnKSArICcvb3duZXItY3JlYXRlLWRlbGV0ZScpXHJcbiAgICAgIC5hcygnYW5vbicpXHJcbiAgICAgIC53cml0ZSgnY3JlYXRlZCcpXHJcbiAgICAgIC5mYWlscyhcIkFueW9uZSBjYW4ndCBjcmVhdGUuXCIpXHJcblxyXG4gICAgICAuYXMoJ21pa2UnKVxyXG4gICAgICAud3JpdGUoJ2NyZWF0ZWQnKVxyXG4gICAgICAuc3VjY2VlZHMoXCJPd25lciBjYW4gY3JlYXRlLlwiKVxyXG5cclxuICAgICAgLmFzKCdhbm9uJylcclxuXHJcbiAgICAgIC53cml0ZSgndXBkYXRlZCcpXHJcbiAgICAgIC5zdWNjZWVkcyhcIkFueW9uZSBjYW4gdXBkYXRlLlwiKVxyXG5cclxuICAgICAgLndyaXRlKG51bGwpXHJcbiAgICAgIC5mYWlscyhcIkFueW9uZSBjYW4ndCBkZWxldGUuXCIpXHJcblxyXG4gICAgICAuYXMoJ21pa2UnKVxyXG4gICAgICAud3JpdGUobnVsbClcclxuICAgICAgLnN1Y2NlZWRzKFwiT3duZXIgY2FuIGRlbGV0ZS5cIilcclxuICAgIDtcclxuICB9KTtcclxufSk7XHJcbiJdfQ==
