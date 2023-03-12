declare module DemobotTypes {
    class Player {
        DISCORD_ID: string;
        NAME: string;
        DEMOLITIONS: int;
        EXTERMINATIONS: int;
        COUNTRY: string;
        LAST_UPDATE: string;
        AUTHORIZED: int;
    }

    class HistoryEntry {
        DISCORD_ID: string;
        DEMOLITIONS: int;
        EXTERMINATIONS: int;
        TIMESTAMP: string;
    }
}