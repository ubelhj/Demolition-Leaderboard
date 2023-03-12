class Database {
    /**
     * Gets a single player's row in the Players table
     * @param {string} discord_id The id of player to search for
     * @returns {DemobotTypes.Player|false} Json object of row in PLAYERS table in db
     */
    static async getPlayer(discord_id) {
        return dbSelect(
            `SELECT *
            FROM players
            WHERE discord_id = :discord_id`,
            [discord_id]
        );
    }


    /**
     * Runs any select query on the database
     * @param {String} query SQL query to run
     * @param {any[]} values Variables to bind to the sql query
     * @returns {Object} A single row from the database
     */
    static async dbSelect(query, values) {
        let connection;
        let retval;

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

            console.log(result.rows);

            if (result.rows && result.rows.length > 0) {
                retval = result.rows[0];
            } else {
                retval = false;
            }

            console.log(retval);
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
}

module.exports = Database;