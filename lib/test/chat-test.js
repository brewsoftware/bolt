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
simulator_1.rulesSuite("Chat", function (test) {
    var uid = test.uid;
    test.rules('samples/chat');
    function makeMikesRoom(rules) {
        return rules
            .as('mike')
            .at('/rooms/mikes-room')
            .write({
            name: "Mike's room",
            creator: uid('mike')
        });
    }
    test("Create and Delete Room.", function (rules) {
        makeMikesRoom(rules)
            .succeeds("Create empty room.")
            .as('fred')
            .write(null)
            .fails("Non-owner cannot delete room.")
            .as('mike')
            .write(null)
            .succeeds("Owner can delete room.");
    });
    test("Forge Creator of Room.", function (rules) {
        rules
            .as('mike')
            .at('/rooms/mikes-room')
            .write({
            name: "Mike's room",
            creator: uid('fred')
        })
            .fails("Can't create forged room.");
    });
    test("Join a Room.", function (rules) {
        makeMikesRoom(rules)
            .at('/rooms/mikes-room/members/' + uid('mike'))
            .write({
            nickname: 'Mike',
            isBanned: false
        })
            .succeeds("Add self to room members.")
            .at('/rooms/mikes-room/members/' + uid('fred'))
            .write({
            nickname: 'Fred',
            isBanned: false
        })
            .succeeds("Creator can add other members.")
            .as('barney')
            .at('/rooms/mikes-room/members/' + uid('barney'))
            .write({
            nickname: 'Barney',
            isBanned: false
        })
            .succeeds("User can add self to a room.")
            .as('mike')
            .at('/rooms/mikes-room/members/' + uid('fred'))
            .write(null)
            .succeeds("Creator can remove a member.");
    });
    test("Banning and unbanning.", function (rules) {
        makeMikesRoom(rules)
            .at('/rooms/mikes-room/members/' + uid('mike'))
            .as('barney')
            .at('/rooms/mikes-room/members/' + uid('barney'))
            .write({
            nickname: 'Barney',
            isBanned: false
        })
            .succeeds("User can add self to a room.")
            .as('mike')
            .at('/rooms/mikes-room/members/' + uid('barney') + '/isBanned')
            .write(true)
            .succeeds("Creator can ban a member.")
            .as('barney')
            .at('/rooms/mikes-room/members/' + uid('barney'))
            .write(null)
            .fails("User tries to delete self.")
            .as('barney')
            .at('/rooms/mikes-room/members/' + uid('barney'))
            .write({
            nickname: 'Barney',
            isBanned: false
        })
            .fails("User tries to rejoin")
            .as('barney')
            .at('/rooms/mikes-room/members/' + uid('barney') + '/isBanned')
            .write(false)
            .fails("User tries to unban self.")
            .as('mike')
            .at('/rooms/mikes-room/members/' + uid('barney') + '/isBanned')
            .write(false)
            .succeeds("Room creator can unban user.");
    });
    test("Posting.", function (rules) {
        makeMikesRoom(rules)
            .at('/posts/mikes-room')
            .push({
            from: uid('mike'),
            message: "Hello, world!",
            created: test.TIMESTAMP
        })
            .fails("Owner can't write into room until he is a member.")
            .at('/rooms/mikes-room/members/' + uid('mike'))
            .write({
            nickname: 'Mike',
            isBanned: false
        })
            .succeeds("Add self to room members.")
            .at('/posts/mikes-room')
            .push({
            from: uid('mike'),
            message: "Hello, world!",
            created: test.TIMESTAMP
        })
            .succeeds("Owner-member can post to room.")
            .as('barney')
            .at('/posts/mikes-room')
            .push({
            from: uid('barney'),
            message: "Hello, Mike!",
            created: test.TIMESTAMP
        })
            .fails("Non-members cannot post.")
            .as('barney')
            .at('/rooms/mikes-room/members/' + uid('barney'))
            .write({
            nickname: 'Barney',
            isBanned: false
        })
            .succeeds("User can add self to a room.")
            .as('barney')
            .at('/posts/mikes-room')
            .push({
            from: uid('barney'),
            message: "Hello, Mike!",
            created: test.TIMESTAMP
        })
            .succeeds("Members can post.")
            .as('mike')
            .at('/rooms/mikes-room/members/' + uid('barney') + '/isBanned')
            .write(true)
            .succeeds("Creator can ban a member.")
            .as('barney')
            .at('/posts/mikes-room')
            .push({
            from: uid('barney'),
            message: "Hello, Mike!",
            created: test.TIMESTAMP
        })
            .fails("Banned members cannot post.");
    });
});

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlc3QvY2hhdC10ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7Ozs7Ozs7Ozs7Ozs7R0FjRztBQUNILDBCQUFvQyxjQUFjLENBQUMsQ0FBQTtBQUVuRCxzQkFBVSxDQUFDLE1BQU0sRUFBRSxVQUFTLElBQUk7SUFDOUIsSUFBSSxHQUFHLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQztJQUduQixJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDO0lBRTNCLHVCQUF1QixLQUFnQjtRQUNyQyxNQUFNLENBQUMsS0FBSzthQUNULEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFDVixFQUFFLENBQUMsbUJBQW1CLENBQUM7YUFDdkIsS0FBSyxDQUFDO1lBQ0wsSUFBSSxFQUFFLGFBQWE7WUFDbkIsT0FBTyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUM7U0FDckIsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztJQUVELElBQUksQ0FBQyx5QkFBeUIsRUFBRSxVQUFTLEtBQUs7UUFDNUMsYUFBYSxDQUFDLEtBQUssQ0FBQzthQUNqQixRQUFRLENBQUMsb0JBQW9CLENBQUM7YUFDOUIsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNWLEtBQUssQ0FBQyxJQUFJLENBQUM7YUFDWCxLQUFLLENBQUMsK0JBQStCLENBQUM7YUFFdEMsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNWLEtBQUssQ0FBQyxJQUFJLENBQUM7YUFDWCxRQUFRLENBQUMsd0JBQXdCLENBQUMsQ0FDcEM7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyx3QkFBd0IsRUFBRSxVQUFTLEtBQUs7UUFDM0MsS0FBSzthQUNGLEVBQUUsQ0FBQyxNQUFNLENBQUM7YUFDVixFQUFFLENBQUMsbUJBQW1CLENBQUM7YUFDdkIsS0FBSyxDQUFDO1lBQ0wsSUFBSSxFQUFFLGFBQWE7WUFDbkIsT0FBTyxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUM7U0FDckIsQ0FBQzthQUNELEtBQUssQ0FBQywyQkFBMkIsQ0FBQyxDQUFDO0lBQ3hDLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLGNBQWMsRUFBRSxVQUFTLEtBQUs7UUFDakMsYUFBYSxDQUFDLEtBQUssQ0FBQzthQUNqQixFQUFFLENBQUMsNEJBQTRCLEdBQUcsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQzlDLEtBQUssQ0FBQztZQUNMLFFBQVEsRUFBRSxNQUFNO1lBQ2hCLFFBQVEsRUFBRSxLQUFLO1NBQ2hCLENBQUM7YUFDRCxRQUFRLENBQUMsMkJBQTJCLENBQUM7YUFFckMsRUFBRSxDQUFDLDRCQUE0QixHQUFHLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQzthQUM5QyxLQUFLLENBQUM7WUFDTCxRQUFRLEVBQUUsTUFBTTtZQUNoQixRQUFRLEVBQUUsS0FBSztTQUNoQixDQUFDO2FBQ0QsUUFBUSxDQUFDLGdDQUFnQyxDQUFDO2FBRTFDLEVBQUUsQ0FBQyxRQUFRLENBQUM7YUFDWixFQUFFLENBQUMsNEJBQTRCLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2FBQ2hELEtBQUssQ0FBQztZQUNMLFFBQVEsRUFBRSxRQUFRO1lBQ2xCLFFBQVEsRUFBRSxLQUFLO1NBQ2hCLENBQUM7YUFDRCxRQUFRLENBQUMsOEJBQThCLENBQUM7YUFFeEMsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNWLEVBQUUsQ0FBQyw0QkFBNEIsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7YUFDOUMsS0FBSyxDQUFDLElBQUksQ0FBQzthQUNYLFFBQVEsQ0FBQyw4QkFBOEIsQ0FBQyxDQUMxQztJQUNILENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLHdCQUF3QixFQUFFLFVBQVMsS0FBSztRQUMzQyxhQUFhLENBQUMsS0FBSyxDQUFDO2FBQ2pCLEVBQUUsQ0FBQyw0QkFBNEIsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7YUFFOUMsRUFBRSxDQUFDLFFBQVEsQ0FBQzthQUNaLEVBQUUsQ0FBQyw0QkFBNEIsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLENBQUM7YUFDaEQsS0FBSyxDQUFDO1lBQ0wsUUFBUSxFQUFFLFFBQVE7WUFDbEIsUUFBUSxFQUFFLEtBQUs7U0FDaEIsQ0FBQzthQUNELFFBQVEsQ0FBQyw4QkFBOEIsQ0FBQzthQUV4QyxFQUFFLENBQUMsTUFBTSxDQUFDO2FBQ1YsRUFBRSxDQUFDLDRCQUE0QixHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsR0FBRyxXQUFXLENBQUM7YUFDOUQsS0FBSyxDQUFDLElBQUksQ0FBQzthQUNYLFFBQVEsQ0FBQywyQkFBMkIsQ0FBQzthQUVyQyxFQUFFLENBQUMsUUFBUSxDQUFDO2FBQ1osRUFBRSxDQUFDLDRCQUE0QixHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUNoRCxLQUFLLENBQUMsSUFBSSxDQUFDO2FBQ1gsS0FBSyxDQUFDLDRCQUE0QixDQUFDO2FBRW5DLEVBQUUsQ0FBQyxRQUFRLENBQUM7YUFDWixFQUFFLENBQUMsNEJBQTRCLEdBQUcsR0FBRyxDQUFDLFFBQVEsQ0FBQyxDQUFDO2FBQ2hELEtBQUssQ0FBQztZQUNMLFFBQVEsRUFBRSxRQUFRO1lBQ2xCLFFBQVEsRUFBRSxLQUFLO1NBQ2hCLENBQUM7YUFDRCxLQUFLLENBQUMsc0JBQXNCLENBQUM7YUFFN0IsRUFBRSxDQUFDLFFBQVEsQ0FBQzthQUNaLEVBQUUsQ0FBQyw0QkFBNEIsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsV0FBVyxDQUFDO2FBQzlELEtBQUssQ0FBQyxLQUFLLENBQUM7YUFDWixLQUFLLENBQUMsMkJBQTJCLENBQUM7YUFFbEMsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNWLEVBQUUsQ0FBQyw0QkFBNEIsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsV0FBVyxDQUFDO2FBQzlELEtBQUssQ0FBQyxLQUFLLENBQUM7YUFDWixRQUFRLENBQUMsOEJBQThCLENBQUMsQ0FDMUM7SUFDSCxDQUFDLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxVQUFVLEVBQUUsVUFBUyxLQUFLO1FBQzdCLGFBQWEsQ0FBQyxLQUFLLENBQUM7YUFDakIsRUFBRSxDQUFDLG1CQUFtQixDQUFDO2FBQ3ZCLElBQUksQ0FBQztZQUNKLElBQUksRUFBRSxHQUFHLENBQUMsTUFBTSxDQUFDO1lBQ2pCLE9BQU8sRUFBRSxlQUFlO1lBQ3hCLE9BQU8sRUFBRSxJQUFJLENBQUMsU0FBUztTQUN4QixDQUFDO2FBQ0QsS0FBSyxDQUFDLG1EQUFtRCxDQUFDO2FBRTFELEVBQUUsQ0FBQyw0QkFBNEIsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7YUFDOUMsS0FBSyxDQUFDO1lBQ0wsUUFBUSxFQUFFLE1BQU07WUFDaEIsUUFBUSxFQUFFLEtBQUs7U0FDaEIsQ0FBQzthQUNELFFBQVEsQ0FBQywyQkFBMkIsQ0FBQzthQUVyQyxFQUFFLENBQUMsbUJBQW1CLENBQUM7YUFDdkIsSUFBSSxDQUFDO1lBQ0osSUFBSSxFQUFFLEdBQUcsQ0FBQyxNQUFNLENBQUM7WUFDakIsT0FBTyxFQUFFLGVBQWU7WUFDeEIsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTO1NBQ3hCLENBQUM7YUFDRCxRQUFRLENBQUMsZ0NBQWdDLENBQUM7YUFFMUMsRUFBRSxDQUFDLFFBQVEsQ0FBQzthQUNaLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQzthQUN2QixJQUFJLENBQUM7WUFDSixJQUFJLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQztZQUNuQixPQUFPLEVBQUUsY0FBYztZQUN2QixPQUFPLEVBQUUsSUFBSSxDQUFDLFNBQVM7U0FDeEIsQ0FBQzthQUNELEtBQUssQ0FBQywwQkFBMEIsQ0FBQzthQUVqQyxFQUFFLENBQUMsUUFBUSxDQUFDO2FBQ1osRUFBRSxDQUFDLDRCQUE0QixHQUFHLEdBQUcsQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUNoRCxLQUFLLENBQUM7WUFDTCxRQUFRLEVBQUUsUUFBUTtZQUNsQixRQUFRLEVBQUUsS0FBSztTQUNoQixDQUFDO2FBQ0QsUUFBUSxDQUFDLDhCQUE4QixDQUFDO2FBRXhDLEVBQUUsQ0FBQyxRQUFRLENBQUM7YUFDWixFQUFFLENBQUMsbUJBQW1CLENBQUM7YUFDdkIsSUFBSSxDQUFDO1lBQ0osSUFBSSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUM7WUFDbkIsT0FBTyxFQUFFLGNBQWM7WUFDdkIsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTO1NBQ3hCLENBQUM7YUFDRCxRQUFRLENBQUMsbUJBQW1CLENBQUM7YUFFN0IsRUFBRSxDQUFDLE1BQU0sQ0FBQzthQUNWLEVBQUUsQ0FBQyw0QkFBNEIsR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLEdBQUcsV0FBVyxDQUFDO2FBQzlELEtBQUssQ0FBQyxJQUFJLENBQUM7YUFDWCxRQUFRLENBQUMsMkJBQTJCLENBQUM7YUFFckMsRUFBRSxDQUFDLFFBQVEsQ0FBQzthQUNaLEVBQUUsQ0FBQyxtQkFBbUIsQ0FBQzthQUN2QixJQUFJLENBQUM7WUFDSixJQUFJLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQztZQUNuQixPQUFPLEVBQUUsY0FBYztZQUN2QixPQUFPLEVBQUUsSUFBSSxDQUFDLFNBQVM7U0FDeEIsQ0FBQzthQUNELEtBQUssQ0FBQyw2QkFBNkIsQ0FBQyxDQUN0QztJQUNILENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDLENBQUMiLCJmaWxlIjoidGVzdC9jaGF0LXRlc3QuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKlxyXG4gKiBDb3B5cmlnaHQgMjAxNSBHb29nbGUgSW5jLiBBbGwgUmlnaHRzIFJlc2VydmVkLlxyXG4gKlxyXG4gKiBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wICh0aGUgXCJMaWNlbnNlXCIpO1xyXG4gKiB5b3UgbWF5IG5vdCB1c2UgdGhpcyBmaWxlIGV4Y2VwdCBpbiBjb21wbGlhbmNlIHdpdGggdGhlIExpY2Vuc2UuXHJcbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxyXG4gKlxyXG4gKiAgICAgaHR0cDovL3d3dy5hcGFjaGUub3JnL2xpY2Vuc2VzL0xJQ0VOU0UtMi4wXHJcbiAqXHJcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcclxuICogZGlzdHJpYnV0ZWQgdW5kZXIgdGhlIExpY2Vuc2UgaXMgZGlzdHJpYnV0ZWQgb24gYW4gXCJBUyBJU1wiIEJBU0lTLFxyXG4gKiBXSVRIT1VUIFdBUlJBTlRJRVMgT1IgQ09ORElUSU9OUyBPRiBBTlkgS0lORCwgZWl0aGVyIGV4cHJlc3Mgb3IgaW1wbGllZC5cclxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxyXG4gKiBsaW1pdGF0aW9ucyB1bmRlciB0aGUgTGljZW5zZS5cclxuICovXHJcbmltcG9ydCB7cnVsZXNTdWl0ZSwgUnVsZXNUZXN0fSBmcm9tICcuLi9zaW11bGF0b3InO1xyXG5cclxucnVsZXNTdWl0ZShcIkNoYXRcIiwgZnVuY3Rpb24odGVzdCkge1xyXG4gIHZhciB1aWQgPSB0ZXN0LnVpZDtcclxuXHJcblxyXG4gIHRlc3QucnVsZXMoJ3NhbXBsZXMvY2hhdCcpO1xyXG5cclxuICBmdW5jdGlvbiBtYWtlTWlrZXNSb29tKHJ1bGVzOiBSdWxlc1Rlc3QpOiBSdWxlc1Rlc3Qge1xyXG4gICAgcmV0dXJuIHJ1bGVzXHJcbiAgICAgIC5hcygnbWlrZScpXHJcbiAgICAgIC5hdCgnL3Jvb21zL21pa2VzLXJvb20nKVxyXG4gICAgICAud3JpdGUoe1xyXG4gICAgICAgIG5hbWU6IFwiTWlrZSdzIHJvb21cIixcclxuICAgICAgICBjcmVhdG9yOiB1aWQoJ21pa2UnKSxcclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICB0ZXN0KFwiQ3JlYXRlIGFuZCBEZWxldGUgUm9vbS5cIiwgZnVuY3Rpb24ocnVsZXMpIHtcclxuICAgIG1ha2VNaWtlc1Jvb20ocnVsZXMpXHJcbiAgICAgIC5zdWNjZWVkcyhcIkNyZWF0ZSBlbXB0eSByb29tLlwiKVxyXG4gICAgICAuYXMoJ2ZyZWQnKVxyXG4gICAgICAud3JpdGUobnVsbClcclxuICAgICAgLmZhaWxzKFwiTm9uLW93bmVyIGNhbm5vdCBkZWxldGUgcm9vbS5cIilcclxuXHJcbiAgICAgIC5hcygnbWlrZScpXHJcbiAgICAgIC53cml0ZShudWxsKVxyXG4gICAgICAuc3VjY2VlZHMoXCJPd25lciBjYW4gZGVsZXRlIHJvb20uXCIpXHJcbiAgICA7XHJcbiAgfSk7XHJcblxyXG4gIHRlc3QoXCJGb3JnZSBDcmVhdG9yIG9mIFJvb20uXCIsIGZ1bmN0aW9uKHJ1bGVzKSB7XHJcbiAgICBydWxlc1xyXG4gICAgICAuYXMoJ21pa2UnKVxyXG4gICAgICAuYXQoJy9yb29tcy9taWtlcy1yb29tJylcclxuICAgICAgLndyaXRlKHtcclxuICAgICAgICBuYW1lOiBcIk1pa2UncyByb29tXCIsXHJcbiAgICAgICAgY3JlYXRvcjogdWlkKCdmcmVkJyksXHJcbiAgICAgIH0pXHJcbiAgICAgIC5mYWlscyhcIkNhbid0IGNyZWF0ZSBmb3JnZWQgcm9vbS5cIik7XHJcbiAgfSk7XHJcblxyXG4gIHRlc3QoXCJKb2luIGEgUm9vbS5cIiwgZnVuY3Rpb24ocnVsZXMpIHtcclxuICAgIG1ha2VNaWtlc1Jvb20ocnVsZXMpXHJcbiAgICAgIC5hdCgnL3Jvb21zL21pa2VzLXJvb20vbWVtYmVycy8nICsgdWlkKCdtaWtlJykpXHJcbiAgICAgIC53cml0ZSh7XHJcbiAgICAgICAgbmlja25hbWU6ICdNaWtlJyxcclxuICAgICAgICBpc0Jhbm5lZDogZmFsc2VcclxuICAgICAgfSlcclxuICAgICAgLnN1Y2NlZWRzKFwiQWRkIHNlbGYgdG8gcm9vbSBtZW1iZXJzLlwiKVxyXG5cclxuICAgICAgLmF0KCcvcm9vbXMvbWlrZXMtcm9vbS9tZW1iZXJzLycgKyB1aWQoJ2ZyZWQnKSlcclxuICAgICAgLndyaXRlKHtcclxuICAgICAgICBuaWNrbmFtZTogJ0ZyZWQnLFxyXG4gICAgICAgIGlzQmFubmVkOiBmYWxzZVxyXG4gICAgICB9KVxyXG4gICAgICAuc3VjY2VlZHMoXCJDcmVhdG9yIGNhbiBhZGQgb3RoZXIgbWVtYmVycy5cIilcclxuXHJcbiAgICAgIC5hcygnYmFybmV5JylcclxuICAgICAgLmF0KCcvcm9vbXMvbWlrZXMtcm9vbS9tZW1iZXJzLycgKyB1aWQoJ2Jhcm5leScpKVxyXG4gICAgICAud3JpdGUoe1xyXG4gICAgICAgIG5pY2tuYW1lOiAnQmFybmV5JyxcclxuICAgICAgICBpc0Jhbm5lZDogZmFsc2VcclxuICAgICAgfSlcclxuICAgICAgLnN1Y2NlZWRzKFwiVXNlciBjYW4gYWRkIHNlbGYgdG8gYSByb29tLlwiKVxyXG5cclxuICAgICAgLmFzKCdtaWtlJylcclxuICAgICAgLmF0KCcvcm9vbXMvbWlrZXMtcm9vbS9tZW1iZXJzLycgKyB1aWQoJ2ZyZWQnKSlcclxuICAgICAgLndyaXRlKG51bGwpXHJcbiAgICAgIC5zdWNjZWVkcyhcIkNyZWF0b3IgY2FuIHJlbW92ZSBhIG1lbWJlci5cIilcclxuICAgIDtcclxuICB9KTtcclxuXHJcbiAgdGVzdChcIkJhbm5pbmcgYW5kIHVuYmFubmluZy5cIiwgZnVuY3Rpb24ocnVsZXMpIHtcclxuICAgIG1ha2VNaWtlc1Jvb20ocnVsZXMpXHJcbiAgICAgIC5hdCgnL3Jvb21zL21pa2VzLXJvb20vbWVtYmVycy8nICsgdWlkKCdtaWtlJykpXHJcblxyXG4gICAgICAuYXMoJ2Jhcm5leScpXHJcbiAgICAgIC5hdCgnL3Jvb21zL21pa2VzLXJvb20vbWVtYmVycy8nICsgdWlkKCdiYXJuZXknKSlcclxuICAgICAgLndyaXRlKHtcclxuICAgICAgICBuaWNrbmFtZTogJ0Jhcm5leScsXHJcbiAgICAgICAgaXNCYW5uZWQ6IGZhbHNlXHJcbiAgICAgIH0pXHJcbiAgICAgIC5zdWNjZWVkcyhcIlVzZXIgY2FuIGFkZCBzZWxmIHRvIGEgcm9vbS5cIilcclxuXHJcbiAgICAgIC5hcygnbWlrZScpXHJcbiAgICAgIC5hdCgnL3Jvb21zL21pa2VzLXJvb20vbWVtYmVycy8nICsgdWlkKCdiYXJuZXknKSArICcvaXNCYW5uZWQnKVxyXG4gICAgICAud3JpdGUodHJ1ZSlcclxuICAgICAgLnN1Y2NlZWRzKFwiQ3JlYXRvciBjYW4gYmFuIGEgbWVtYmVyLlwiKVxyXG5cclxuICAgICAgLmFzKCdiYXJuZXknKVxyXG4gICAgICAuYXQoJy9yb29tcy9taWtlcy1yb29tL21lbWJlcnMvJyArIHVpZCgnYmFybmV5JykpXHJcbiAgICAgIC53cml0ZShudWxsKVxyXG4gICAgICAuZmFpbHMoXCJVc2VyIHRyaWVzIHRvIGRlbGV0ZSBzZWxmLlwiKVxyXG5cclxuICAgICAgLmFzKCdiYXJuZXknKVxyXG4gICAgICAuYXQoJy9yb29tcy9taWtlcy1yb29tL21lbWJlcnMvJyArIHVpZCgnYmFybmV5JykpXHJcbiAgICAgIC53cml0ZSh7XHJcbiAgICAgICAgbmlja25hbWU6ICdCYXJuZXknLFxyXG4gICAgICAgIGlzQmFubmVkOiBmYWxzZVxyXG4gICAgICB9KVxyXG4gICAgICAuZmFpbHMoXCJVc2VyIHRyaWVzIHRvIHJlam9pblwiKVxyXG5cclxuICAgICAgLmFzKCdiYXJuZXknKVxyXG4gICAgICAuYXQoJy9yb29tcy9taWtlcy1yb29tL21lbWJlcnMvJyArIHVpZCgnYmFybmV5JykgKyAnL2lzQmFubmVkJylcclxuICAgICAgLndyaXRlKGZhbHNlKVxyXG4gICAgICAuZmFpbHMoXCJVc2VyIHRyaWVzIHRvIHVuYmFuIHNlbGYuXCIpXHJcblxyXG4gICAgICAuYXMoJ21pa2UnKVxyXG4gICAgICAuYXQoJy9yb29tcy9taWtlcy1yb29tL21lbWJlcnMvJyArIHVpZCgnYmFybmV5JykgKyAnL2lzQmFubmVkJylcclxuICAgICAgLndyaXRlKGZhbHNlKVxyXG4gICAgICAuc3VjY2VlZHMoXCJSb29tIGNyZWF0b3IgY2FuIHVuYmFuIHVzZXIuXCIpXHJcbiAgICA7XHJcbiAgfSk7XHJcblxyXG4gIHRlc3QoXCJQb3N0aW5nLlwiLCBmdW5jdGlvbihydWxlcykge1xyXG4gICAgbWFrZU1pa2VzUm9vbShydWxlcylcclxuICAgICAgLmF0KCcvcG9zdHMvbWlrZXMtcm9vbScpXHJcbiAgICAgIC5wdXNoKHtcclxuICAgICAgICBmcm9tOiB1aWQoJ21pa2UnKSxcclxuICAgICAgICBtZXNzYWdlOiBcIkhlbGxvLCB3b3JsZCFcIixcclxuICAgICAgICBjcmVhdGVkOiB0ZXN0LlRJTUVTVEFNUCxcclxuICAgICAgfSlcclxuICAgICAgLmZhaWxzKFwiT3duZXIgY2FuJ3Qgd3JpdGUgaW50byByb29tIHVudGlsIGhlIGlzIGEgbWVtYmVyLlwiKVxyXG5cclxuICAgICAgLmF0KCcvcm9vbXMvbWlrZXMtcm9vbS9tZW1iZXJzLycgKyB1aWQoJ21pa2UnKSlcclxuICAgICAgLndyaXRlKHtcclxuICAgICAgICBuaWNrbmFtZTogJ01pa2UnLFxyXG4gICAgICAgIGlzQmFubmVkOiBmYWxzZVxyXG4gICAgICB9KVxyXG4gICAgICAuc3VjY2VlZHMoXCJBZGQgc2VsZiB0byByb29tIG1lbWJlcnMuXCIpXHJcblxyXG4gICAgICAuYXQoJy9wb3N0cy9taWtlcy1yb29tJylcclxuICAgICAgLnB1c2goe1xyXG4gICAgICAgIGZyb206IHVpZCgnbWlrZScpLFxyXG4gICAgICAgIG1lc3NhZ2U6IFwiSGVsbG8sIHdvcmxkIVwiLFxyXG4gICAgICAgIGNyZWF0ZWQ6IHRlc3QuVElNRVNUQU1QLFxyXG4gICAgICB9KVxyXG4gICAgICAuc3VjY2VlZHMoXCJPd25lci1tZW1iZXIgY2FuIHBvc3QgdG8gcm9vbS5cIilcclxuXHJcbiAgICAgIC5hcygnYmFybmV5JylcclxuICAgICAgLmF0KCcvcG9zdHMvbWlrZXMtcm9vbScpXHJcbiAgICAgIC5wdXNoKHtcclxuICAgICAgICBmcm9tOiB1aWQoJ2Jhcm5leScpLFxyXG4gICAgICAgIG1lc3NhZ2U6IFwiSGVsbG8sIE1pa2UhXCIsXHJcbiAgICAgICAgY3JlYXRlZDogdGVzdC5USU1FU1RBTVAsXHJcbiAgICAgIH0pXHJcbiAgICAgIC5mYWlscyhcIk5vbi1tZW1iZXJzIGNhbm5vdCBwb3N0LlwiKVxyXG5cclxuICAgICAgLmFzKCdiYXJuZXknKVxyXG4gICAgICAuYXQoJy9yb29tcy9taWtlcy1yb29tL21lbWJlcnMvJyArIHVpZCgnYmFybmV5JykpXHJcbiAgICAgIC53cml0ZSh7XHJcbiAgICAgICAgbmlja25hbWU6ICdCYXJuZXknLFxyXG4gICAgICAgIGlzQmFubmVkOiBmYWxzZVxyXG4gICAgICB9KVxyXG4gICAgICAuc3VjY2VlZHMoXCJVc2VyIGNhbiBhZGQgc2VsZiB0byBhIHJvb20uXCIpXHJcblxyXG4gICAgICAuYXMoJ2Jhcm5leScpXHJcbiAgICAgIC5hdCgnL3Bvc3RzL21pa2VzLXJvb20nKVxyXG4gICAgICAucHVzaCh7XHJcbiAgICAgICAgZnJvbTogdWlkKCdiYXJuZXknKSxcclxuICAgICAgICBtZXNzYWdlOiBcIkhlbGxvLCBNaWtlIVwiLFxyXG4gICAgICAgIGNyZWF0ZWQ6IHRlc3QuVElNRVNUQU1QLFxyXG4gICAgICB9KVxyXG4gICAgICAuc3VjY2VlZHMoXCJNZW1iZXJzIGNhbiBwb3N0LlwiKVxyXG5cclxuICAgICAgLmFzKCdtaWtlJylcclxuICAgICAgLmF0KCcvcm9vbXMvbWlrZXMtcm9vbS9tZW1iZXJzLycgKyB1aWQoJ2Jhcm5leScpICsgJy9pc0Jhbm5lZCcpXHJcbiAgICAgIC53cml0ZSh0cnVlKVxyXG4gICAgICAuc3VjY2VlZHMoXCJDcmVhdG9yIGNhbiBiYW4gYSBtZW1iZXIuXCIpXHJcblxyXG4gICAgICAuYXMoJ2Jhcm5leScpXHJcbiAgICAgIC5hdCgnL3Bvc3RzL21pa2VzLXJvb20nKVxyXG4gICAgICAucHVzaCh7XHJcbiAgICAgICAgZnJvbTogdWlkKCdiYXJuZXknKSxcclxuICAgICAgICBtZXNzYWdlOiBcIkhlbGxvLCBNaWtlIVwiLFxyXG4gICAgICAgIGNyZWF0ZWQ6IHRlc3QuVElNRVNUQU1QLFxyXG4gICAgICB9KVxyXG4gICAgICAuZmFpbHMoXCJCYW5uZWQgbWVtYmVycyBjYW5ub3QgcG9zdC5cIilcclxuICAgIDtcclxuICB9KTtcclxufSk7XHJcbiJdfQ==
