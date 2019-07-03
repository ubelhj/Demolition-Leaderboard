const Discord = require("discord.js");
const client = new Discord.Client();
const config = require("./config.json");
const highscores = require("./highscores.json");
const fs = require('fs');

client.on("ready", () => {
    console.log("I am ready!");
});

client.on("message", message => {
    if (message.channel.equals("596091609955958785")) console.log("wrong channel error");
    if (message.author.bot) return;
    if(message.content.indexOf(config.prefix) !== 0) return;
    // This is the best way to define args. Trust me.
    const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
    console.log(args);
    if (args.length < 4 || args.length > 8) {
        message.channel.send("Try updating your stats with the following format: D: # of demos " +
            "E: # of exterminations U: Your Username");
    } else if (isNaN(args[0]) || isNaN(args[2])) {
        message.channel.send("Try updating your stats with the following format: D: # of demos " +
            "E: # of exterminations U: Your Username");
    } else if (parseInt(args[0], 10) > parseInt(highscores.manualDemoLimit, 10)) {
        message.channel.send("Your Demos are in the top 20, and must be verified. Please DM JerryTheBee");
    } else if (parseInt(args[2], 10) > parseInt(highscores.manualExtermLimit, 10)) {
        message.channel.send("Your Exterminations are in the top 20, " +
             "and must be verified. Please DM JerryTheBee");
    } else {
        var name = "";

        if (args.length > 4) {
            for (var i = 3; i < args.length; i++) {
                name = name + " " + args[i];
            }
        } else {
            name = args[3];
        }

        var content = "\n" + name + "," + args[0] + "," + args[2];

        fs.appendFile("leaderboard.csv", content);
        // //dmChannel.send("Logged Leaderboard Data");
    }
});

client.login(config.token);