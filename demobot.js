const Discord = require("discord.js");
const client = new Discord.Client();
const config = require("./config.json");
const fs = require('fs');

client.on("ready", () => {
    console.log("I am ready!");
});

client.on("message", message => {
    if (message.author.bot) return;
    if(message.content.indexOf(config.prefix) !== 0) return;
    // This is the best way to define args. Trust me.
    const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
    console.log(args);
    if (args.length < 5) {
        message.author.DMchannel.send("Try updating your stats with the following format: D: # of demos " +
            "E: # of exterminations U: Your Username");
    } else {
        if (isNaN(args[0] || isNaN(args[2]))) {
            message.author.DMchannel.send("Try updating your stats with the following format: D: # of demos " +
                "E: # of exterminations U: Your Username");
        }
        var content = "Username,Demolitions,Exterminations\n" + args[5] + "," + args[0] + "," + args[2];
        fs.writeFile("leaderboard.csv" );
    }
});

client.login(config.token);