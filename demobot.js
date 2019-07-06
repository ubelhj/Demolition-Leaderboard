const Discord = require("discord.js");
const client = new Discord.Client();
// const config = require("./config.json");
const leaderboard = require("./leaderboard.json");
const highscores = require("./highscores.json");
const fs = require('fs');
const fetch = require('isomorphic-fetch');
const Dropbox = require('dropbox').Dropbox;
const http = require('http');
let dbx = new Dropbox({accessToken: process.env.dropToken, fetch: fetch});



client.on("ready", () => {
    // downloads and saves dropbox file
    dbx.filesDownload({path: "/leaderboard.json"})
        .then(function (data) {
            fs.writeFile("./leaderboard.json", data.fileBinary, 'binary', function (err) {
                if (err) { throw err; }
                console.log('File: ' + data.name + ' saved.');
            });
        })
        .catch(function (err) {
            throw err;
        });
    dbx.filesDownload({path: "/leaderboard.csv"})
        .then(function (data) {
            fs.writeFile("./leaderboard.csv", data.fileBinary, 'binary', function (err) {
                if (err) { throw err; }
                console.log('File: ' + data.name + ' saved.');
            });
        })
        .catch(function (err) {
            throw err;
        });
    // connects to server to please heroku
    http.createServer().listen(process.env.PORT, function () {
        console.log('Express server listening on' + process.env.PORT);
    });
    console.log("I am ready!");
    // keeps awake
    setInterval(function() {
        http.get("http://demo-leaderboard.herokuapp.com/");
    }, 300000);
});

client.on("message", message => {
    // if (message.channel.equals("431088274636013579")) console.log("wrong channel error");
    if (message.author.bot) return;
    if(message.content.indexOf(process.env.prefix) !== 0) return;
    // This is the best way to define args. Trust me.
    const args = message.content.slice(process.env.prefix.length).trim().split(/ +/g);
    let author = message.author.id;
    // D: Authorize DISCORDID name
    if (author == leaderboard.Car.Discord && args[0] == "Authorize") {
        let name = "";
        if (args.length > 3) {
            name = args[2];
            for (let i = 3; i < args.length; i++) {
                name = name + " " + args[i];
            }
        } else {
            name = args[2];
        }
        console.log(name);
        leaderboard[name].Discord = args[1];
        leaderboard[name].Authorized = 1;
        upload(message);
        console.log("Authorized " + name);

    // Ensures proper command syntax
    } else if (args.length < 4 || args.length > 8) {
        message.channel.send("Try updating your stats with the following format: D: # of demos " +
            "E: # of exterminations Your Username\n Ex: D: 200 E: 10 Demo Leaderboard");
    } else if (isNaN(args[0]) || isNaN(args[2])) {
        message.channel.send("Try updating your stats with the following format: D: # of demos " +
            "E: # of exterminations Your Username\n Ex: D: 200 E: 10 Demo Leaderboard");
    } else {
        // Sets name variable for long names
        let name = "";
        if (args.length > 4) {
            for (let i = 3; i < args.length; i++) {
                name = name + " " + args[i];
            }
        } else {
            name = args[3];
        }

        // console.log(leaderboard.hasOwnProperty(name));
        console.log(leaderboard[name]);

        var changed = false;


        if (!leaderboard[name]) {
            leaderboard[name] = {Authorized: 0, Discord: "", Demos: 0, Exterminations: 0};
        }
        if (!leaderboard[name].Discord) {
            leaderboard[name].Discord = author;
        }
        // backdoor for creator to upload any data, also authorizes user
        if (author == leaderboard.Car.Discord) {
            leaderboard[name].Demos = args[0];
            leaderboard[name].Exterminations = args[2];
            leaderboard[name].Authorized = 1;
            changed = true;
        // ensures only proper user can change their data
        } else if (leaderboard[name].Discord == author) {
            // only authorized users can upload
            if (leaderboard[name].Authorized == 0) {
                if (parseInt(args[0], 10) > parseInt(highscores.manualDemoLimit, 10)) {
                    message.channel.send("Congratulations, your stats qualify for a top 20 position! " +
                        "(A top 20 submission requires manual review from an admin and consequently may take " +
                        "longer to be accepted). A screenshot may be requested if your submission is suspect or " +
                        "results in a significant change in position. If you have any questions, " +
                        "please contact an admin or JerryTheBee");
                } else if (parseInt(args[2], 10) > parseInt(highscores.manualExtermLimit, 10)) {
                    message.channel.send("Congratulations, your stats qualify for a top 20 position! " +
                        "(A top 20 submission requires manual review from an admin and consequently may take " +
                        "longer to be accepted). A screenshot may be requested if your submission is suspect or " +
                        "results in a significant change in position. If you have any questions, " +
                        "please contact an admin or JerryTheBee");
                } else {
                    leaderboard[name].Demos = args[0];
                    leaderboard[name].Exterminations = args[2];
                    changed = true;
                }
            } else if (author != leaderboard.toothboto.Discord) {
                if (parseInt(args[0], 10) > parseInt(highscores.leaderDemos, 10)) {
                    message.channel.send("Congrats on the top place for Demos! " +
                        "Please send verification to an admin before we can verify your spot.");
                } else if (parseInt(args[2], 10) > parseInt(highscores.leaderExterm, 10)) {
                    message.channel.send("Congrats on the top place for Exterminations! " +
                        "Please send verification to an admin before we can verify your spot.");
                } else {
                    leaderboard[name].Demos = args[0];
                    leaderboard[name].Exterminations = args[2];
                    changed = true;
                }
            }
        } else {
            message.channel.send("Cannot update leaderboard for other users, " +
                "Please DM JerryTheBee if something is wrong");
        }

        fs.writeFile("leaderboard.json", JSON.stringify(leaderboard), (err) => {
            if (err) throw err;
            console.log('Wrote Json');
        });

        let content = "\n" + name + "," + args[0] + "," + args[2];

        fs.appendFile("leaderboard.csv", content, (err) => {
            if (err) throw err;
            console.log('Appended CSV');
        });

        if (changed) {
            upload(message);
        }
    }
});

// uploads updated files to dropbox
function upload(message) {
    fs.readFile("leaderboard.csv", function (err, data) {
        if (err) {
            throw err;
        }
        // console.log(data.toString());
        dbx.filesUpload({path: '/leaderboard.csv', contents: data, mode: "overwrite"})
            .catch(function (error) {
                console.error(error);
            });
    });


    message.channel.send("Updated Leaderboard!");
    dbx.filesUpload({path: '/leaderboard.json', contents: JSON.stringify(leaderboard), mode: "overwrite"})
        .catch(function (error) {
            console.error(error);
        });
}

client.login(process.env.token);