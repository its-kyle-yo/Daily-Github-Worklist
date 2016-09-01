// Description:
//   Serves a daily PR report of PR's that have not been updated within 24-72 + hours
//
// Dependencies:
//   None
//
// Configuration:
//    GITHUB_TOKEN
//    HUBOT_SLACK_TOKEN
// Commands:
//   candi set repos
//   candi test - sends the daily PR payloads to ALL users
//   candi show github users - displays all current users added to lsit
//   candi add (Github User Name) to github users - adds the current slack user to the github user list as the provided user name
//   candy remove (Slack User Name) from github users - removes slack user from github users
//
// Author:
//    YetiAllMighty

module.exports = function(robot) {
    var orgName = "100health";
    var ghRepos, ghUsers;
    var request = require("request");
    var cronJob = require('cron').CronJob;
    var _ = require("lodash");
    // 0 0 9 * * 1-5 is for running the task every weekday (mon-1 => fri-5) at 9am
    new cronJob('0 0 9 * * 1-5', sendUserPrs, null, true, 'America/Chicago');
    startUp();
    //used for testing daily task => before using this you must set repos and
    //add at least 1 user to github user list by commanding candy i.e. candy set repos 
    robot.respond(/show my prs/i, function(res) {
        sendUserPrs(orgName, res.message.user.name);
    });

    robot.respond(/update/i, function(res) {
        startUp();
        res.send("User list and Repo set updated succesfully.");
    });
    //used to verify persistence has been set
    robot.respond(/show repos/i, function(res) {
        var ghRepos = robot.brain.get("ghReposBrain");
        var payload = "Current Repo List: \n";
        payload += ghRepos.join("\n");
        res.send(payload);
    });

    //this will add whatever user you specify ***NOTE This will asign the GH User to the current slack user
    //only do this as the user pair you would want to add
    robot.respond(/add (.*) to github users/i, function(res) {
        var ghUsers = robot.brain.get("ghUsersBrain") || {};
        var payload = "Adding: " + res.match[1] + "\n";
        ghUsers[res.message.user.name] = res.match[1];
        robot.brain.set("ghUsersBrain", ghUsers);
        Object.keys(robot.brain.get("ghUsersBrain"))
            .forEach(function(user) {
                payload += "@" + user + ": " + ghUsers[user] + "\n";
            });
        res.send(payload);
    });

    //obvious purpose
    robot.respond(/show github users/i, function(res) {
        if (Object.keys(robot.brain.get("ghUsersBrain")).length === 0) {
            res.send("Currently no users on the list captain!\nTry adding some?");
        } else {
            var ghUsers = robot.brain.get("ghUsersBrain");
            var payload = "Current user list: \n";
            Object.keys(robot.brain.get("ghUsersBrain"))
                .forEach(function(user) {
                    payload += "@" + user + ": " + ghUsers[user] + "\n";
                });
            res.send(payload);
        }
    });

    //this is not constrained by the current user. 
    //use the SLACK username to remove/undefine the user from the 
    //user list

    robot.respond(/remove (.*) from github users/i, function(res) {
        var ghUsers = robot.brain.get("ghUsersBrain");
        if (!(res.match[1] in ghUsers)) {
            res.send("No one by that name on the list!");
        } else {
            var payload = "They're gone! \nCurrent User List: \n";
            delete ghUsers[res.match[1]];
            robot.brain.set("ghUsersBrain", ghUsers);
            Object.keys(robot.brain.get("ghUsersBrain"))
                .forEach(function(user) {
                    payload += "@" + user + ": " + ghUsers[user];
                });
            res.send(payload);
        }
    });

    function getPrs(org, repos, usr, callback) {
        var options = {
            url: "https://api.github.com/repos/" + org + "/" + repos + "/pulls",
            headers: {
                'User-Agent': usr,
                'Authorization': 'token ' + process.env.GITHUB_TOKEN
            }
        };

        request.get(options, function(err, response, body) {
            callback(err, JSON.parse(body));
        });
    }

    function getRepos(org, callback) {
        var options = {
            url: "https://api.github.com/orgs/" + org + "/repos",
            headers: {
                'User-Agent': org,
                'Authorization': 'token ' + process.env.GITHUB_TOKEN
            }
        };

        request.get(options, function(err, response, body) {
            callback(err, JSON.parse(body));
        });
    }

    function getUsers(callback) {
        var options = {
            url: "https://slack.com/api/users.list",
            qs: {
                "token": process.env.HUBOT_SLACK_TOKEN
            }
        };

        request.get(options, function(err, response, body) {

            callback(err, JSON.parse(body));
        });
    }

    //this is used to send a CUSTOM payload vs the standard/default 
    //robot functions. Allows user and attachments to be easily specified for whatever platform is currently being used. i.e. slack, flowdock etc
    function sendPayload(payload) {
        robot.adapter.customMessage(payload);
    }

    //currently send an object for EACH Pr. Makes multiple payloads. Current comments would help with forcing it 
    //to only send one whole payload. Need a way to have a way to sendPayload() when we are at the end of the response list 
    function sendUserPrs(org, userName) {
        //redefined in the daily task to force update data. instead of using global.
        org = orgName;
        startUp(org);
        var ghUsers = robot.brain.get("ghUsersBrain");
        var ghRepos = robot.brain.get("ghReposBrain");
        var invertUsers = _.invert(ghUsers);

        if (!userName) {
            Object.keys(ghUsers).forEach(function(user) {
                buildPRs(org, user);
            });
        } else {
            buildPRs(org, userName);
        }

    }

    function howManyHoursAgo(updated) {

        var now = new Date();
        updated = Date.parse(updated);
        var difference = now - updated;
        var hours = difference / 1000 / 60 / 60;

        return hours;
    }

    function updateText(invertUsers, pr_html_url, pr_number, pr_title, pr_user_login) {
        return "<" + pr_html_url +
            " | #" + pr_number + "> " +
            pr_title + " (<@" + invertUsers[pr_user_login] + ">)\n";
    }

    function loginsFromUsers(users) {
        return users.map(function(user) {
            return user.login;
        });
    }

    function prCreatedByUser(pr, user) {
        return pr.user.login === user;
    }

    function getAgeLocation(hoursDifference) {
        if (hoursDifference <= 24) {
            return 2;
        } else if (hoursDifference <= 72) {
            return 1;
        } else {
            return 0;
        }
    }

    function startUp(org) {
        org = orgName;
        ghRepos = robot.brain.get("ghReposBrain") || [];
        ghUsers = robot.brain.get("ghUsersBrain") || {};
        getRepos(org, function(err, response) {
            if (err) {
                console.log(err);
                throw err;
            }

            ghRepos = response.map(function(repo) {
                return repo.name;
            });
            robot.brain.set("ghReposBrain", ghRepos);
        });

        getUsers(function(err, response) {
            if (err) {
                console.log(err);
                throw err;
            }

            response.members.filter(function(user) {
                    return user.profile.skype
                })
                .forEach(function(user) {
                    ghUsers[user.name] = user.profile.skype;
                });
            robot.brain.set("ghUsersBrain", ghUsers);
        });
    }

    function buildPRs(org, user) {
        var invertUsers = _.invert(ghUsers);
        var userPayload = {
            channel: user,
            text: "Incoming! PR's rollin out!",
            attachments: [{
                color: 'danger',
                title: '72hrs+',
                text: ""
            }, {
                color: 'warning',
                title: '24-72hrs',
                text: ""
            }, {
                color: 'good',
                title: '< 24hrs',
                text: ""
            }, {
                title: 'Unassigned',
                text: ""
            }]
        };

        var repoCount = 0;
        ghRepos.forEach(function(repo) {
            getPrs(org, repo, user, function(err, prList) {
                if (err) {
                    console.log(err);
                    throw err;
                }
                repoCount++;
                prList.forEach(function(pr) {
                    if ((pr.assignees.length === 0 && pr.assignee === null) && !prCreatedByUser(pr, ghUsers[user])) {
                        if (!(pr.user.login in invertUsers)) {
                            userPayload.attachments[3].text += updateText(invertUsers, pr.html_url, pr.number, pr.title, pr.user.login);
                        }
                    } else if (prCreatedByUser(pr, ghUsers[user]) || (loginsFromUsers(pr.assignees).indexOf(ghUsers[user]) !== -1 || pr.assignee.login === ghUsers[user])) {

                        var hoursDifference = howManyHoursAgo(pr.updated_at);
                        var ageLocation = getAgeLocation(hoursDifference);
                        userPayload.attachments[ageLocation].text += updateText(invertUsers, pr.html_url, pr.number, pr.title, pr.user.login);
                    }

                });
                if (repoCount === ghRepos.length) {
                    sendPayload(userPayload);
                }
            });

        });
    }
};