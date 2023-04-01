const oracledb = require('oracledb');
const config = require("./config.json"); 

// Caches user scores to prevent constant checks to server
var cachedLeaderboard = {};

class Database {
    /**
     * Gets a single player's row in the Players table
     * @param {string} discord_id The id of player to search for
     * @returns {DemobotTypes.Player|false} Json object of row in PLAYERS table in db
     */
    static async getPlayer(discord_id) {
        if (cachedLeaderboard[discord_id]) {
            return cachedLeaderboard[discord_id];
        }

        const dbResult = this.dbSelect(
            `SELECT *
            FROM players
            WHERE discord_id = :discord_id`,
            [discord_id]
        );

        if (dbResult) {
            cachedLeaderboard[discord_id] = dbResult;
        }

        return dbResult;
    }

    /**
     * Update a single player's row in the Players table
     * @param {DemobotTypes.Player} player Object mapping to update with pairings from KEYNAME: value
     * @returns {Boolean} Whether the update succeeded
     */
    static async updatePlayer(player) {
        console.log("updating player");
        console.log(player);

        cachedLeaderboard[discord_id] = player;

        return this.dbExecute(
            `UPDATE PLAYERS
            SET DISCORD_ID = :discord_id, NAME = :name, DEMOLITIONS = :demolitions, EXTERMINATIONS = :exterminations,
                COUNTRY = :country, LAST_UPDATE = :last_update, AUTHORIZED = :authorized, DELETED_AT = :deleted_at
            WHERE discord_id = :discord_id1`,
            [...Object.values(player), player.DISCORD_ID]
        );
    }

    /**
     * Insert a single player row in the Players table
     * @param {DemobotTypes.Player} player Object mapping to update with pairings from KEYNAME: value
     * @returns {Boolean} Whether the insert succeeded
     */
    static async insertPlayer(player) {
        console.log("inserting player");
        console.log(player);

        cachedLeaderboard[discord_id] = player;

        return this.dbExecute(
            `INSERT INTO PLAYERS (DISCORD_ID, NAME, DEMOLITIONS, EXTERMINATIONS, COUNTRY, LAST_UPDATE, AUTHORIZED)
            VALUES (:discord_id, :name, :demolitions, :exterminations, :country, :last_update, :authorized)`,
            [Object.values(player)]
        );
    }


    /**
     * Runs any select query on the database
     * @param {String} query SQL query to run
     * @param {any[]} values Variables to bind to the sql query
     * @returns {Object} A single row from the database
     */
    static async dbSelect(query, values) {
        var connection;
        var retval;

        try {
            connection = await oracledb.getConnection( {
            user          : "ADMIN",
            password      : config.oraclePassword,
            connectString : config.connectString,
            });

            const result = await connection.execute(
                query,
                values,
                {
                    'outFormat': oracledb.OBJECT,
                }
            );

            // console.log(result.rows);

            if (result.rows && result.rows.length > 0) {
                retval = result.rows[0];
            } else {
                retval = false;
            }

            // console.log(retval);
        } catch (err) {
            console.error(err);
        } finally {
            if (connection) {
                try {
                    await connection.close();

                    return retval;
                } catch (err) {
                    console.error(err);
                }
            }
        }
    }

    /**
     * Runs any query with no result on the database, such as an update
     * @param {String} query SQL query to run
     * @param {any[]} values Variables to bind to the sql query
     * @returns {Boolean} whether the change succeeded
     */
    static async dbExecute(query, values) {
        var connection;

        try {
            connection = await oracledb.getConnection( {
            user          : "ADMIN",
            password      : config.oraclePassword,
            connectString : config.connectString,
            });

            // console.log("Executing query");
            // console.log(query);
            // console.log(values);

            const result = await connection.execute(
                query,
                values
            );

            // Commits update to DB
            await connection.commit();

            // console.log(result);
        } catch (err) {
            console.error(err);
        } finally {
            if (connection) {
                try {
                    await connection.close();
                    return true;
                } catch (err) {
                    console.error(err);

                    return false;
                }
            }

            return false;
        }
    }
}

module.exports = Database;